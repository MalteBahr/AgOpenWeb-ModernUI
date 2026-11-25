#!/usr/bin/env python3
# AgOpenWeb
# Copyright (C) 2024-2026 AgOpenWeb Contributors
# SPDX-License-Identifier: Apache-2.0
"""Regenerate the README's real-app screenshots using disposable demo data.

Requires .NET 10, Python and Playwright's Chromium. See Docs/MODERN_UI_DEVELOPMENT.md for setup.
The screenshot host uses the real backend and simulator, but replaces module UDP with a
no-op. It never uses the operator's data directory or connects to equipment. A fresh
browser context supplies local-only UI preferences; no application state is fabricated.
"""
import argparse
import http.client
import json
import math
import os
from pathlib import Path
import queue
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time

ROOT = Path(__file__).resolve().parent.parent
HOST_PROJECT = ROOT / "Tools/ReadmeScreenshotHost/ReadmeScreenshotHost.csproj"
HOST_DLL = ROOT / "Tools/ReadmeScreenshotHost/bin/Debug/net10.0/ReadmeScreenshotHost.dll"
OUTPUT = ROOT / "Docs/screenshots"
FIELD = "North Meadow"
ACTIVE_LINE = "North-South"
VIEWPORT = {"width": 1920, "height": 1080}


def point(latitude, longitude, east, north):
    """WGS84 coordinates from local metres, per Docs/FIELD_FILE_FORMATS.md."""
    origin = math.radians(latitude)
    metres_lat = (111132.92 - 559.82 * math.cos(2 * origin)
                  + 1.175 * math.cos(4 * origin) - 0.0023 * math.cos(6 * origin))
    lat = latitude + north / metres_lat
    angle = math.radians(lat)
    metres_lon = 111412.84 * math.cos(angle) - 93.5 * math.cos(3 * angle) + 0.118 * math.cos(5 * angle)
    return [longitude + east / metres_lon, lat]


def feature(role, geometry, coordinates, **properties):
    return {"type": "Feature", "geometry": {"type": geometry, "coordinates": coordinates},
            "properties": {"role": role, **properties}}


def demo_field(name, lat, lon, tracks=False):
    """A fictional field; no real farm, coordinates, field files or imagery are copied."""
    p = lambda e, n: point(lat, lon, e, n)
    ring = [p(-230, -260), p(210, -260), p(250, 230), p(-200, 260), p(-230, -260)]
    features = [
        feature("metadata", "Point", [lon, lat], formatVersion=1, name=name,
                originLatitude=lat, originLongitude=lon, convergence=0),
        feature("outer-boundary", "Polygon", [ring], isDriveThrough=False, isHard=False),
    ]
    if tracks:
        lines = [
            (ACTIVE_LINE, 2, [(3, -250), (3, 250)]),
            ("East Headland", 2, [(-210, 180), (210, 180)]),
            ("Creek Curve", 4, [(-180, -230), (-160, -150), (-145, -50), (-140, 50), (-115, 160)]),
            ("West Pass", 2, [(-90, -250), (-90, 250)]),
            ("South Approach", 2, [(-200, -180), (200, -180)]),
        ]
        for line_name, line_type, points in lines:
            features.append(feature("track", "LineString", [p(e, n) for e, n in points],
                                    name=line_name, trackType=line_type, isClosed=False,
                                    noPassOffset=False, nudgeDistance=0, isVisible=True))
    return {"type": "FeatureCollection", "features": features}


def seed_data(root):
    fields = root / "AgOpenWeb" / "Fields"
    for name, lat, lon in [(FIELD, 40.0, -100.0), ("South Pasture", 39.997, -100.001),
                           ("Willow Field", 40.002, -100.004)]:
        folder = fields / name
        folder.mkdir(parents=True)
        (folder / "field.geojson").write_text(json.dumps(demo_field(name, lat, lon, name == FIELD),
                                                         indent=2) + "\n", encoding="utf-8")


def free_port():
    with socket.socket() as sock:
        # Check all interfaces, not just loopback; the application server binds to 0.0.0.0.
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        sock.bind(("0.0.0.0", 0))
        return sock.getsockname()[1]


def wait_for_host(process, lines, port, timeout=45):
    deadline = time.monotonic() + timeout
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise RuntimeError("Screenshot host did not become ready in time.")
        try:
            line = lines.get(timeout=remaining)
        except queue.Empty as exc:
            raise RuntimeError("Screenshot host did not become ready in time.") from exc
        if line is None:
            raise RuntimeError(f"Screenshot host exited before becoming ready (code {process.poll()}).")
        if line.strip() == f"SCREENSHOT_HOST_READY {port}":
            return


def start_host(root, port, nonce, host_dll=HOST_DLL):
    env = os.environ.copy()
    env["AGOPENWEB_DATA"] = str(root)
    env["AGOPENWEB_SCREENSHOT_HOST"] = "1"
    # Never inherit opt-in feature flags or external service configuration from the operator.
    env.pop("AGOPENWEB_FEATURES", None)
    env.pop("AGOPENWEB_BUGREPORT_URL", None)
    proc = subprocess.Popen(["dotnet", str(host_dll), str(port), nonce], cwd=ROOT, env=env,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                            text=True, encoding="utf-8", errors="replace", bufsize=1)
    lines = queue.Queue()

    def drain():
        assert proc.stdout is not None
        for line in proc.stdout:
            lines.put(line)
        lines.put(None)

    reader = threading.Thread(target=drain, daemon=True)
    reader.start()
    return proc, lines, reader


def verify_identity(port, nonce):
    """A successful bind is not proof on Windows; read our unique, read-only endpoint."""
    conn = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
    try:
        conn.request("GET", "/__readme_screenshot_host")
        response = conn.getresponse()
        if response.status != 200 or response.read(128).decode("ascii", errors="replace") != nonce:
            raise RuntimeError("The selected port is not our screenshot host; no app commands were sent.")
    except (OSError, http.client.HTTPException) as exc:
        raise RuntimeError("Could not verify the screenshot host; no app commands were sent.") from exc
    finally:
        conn.close()


def capture(page, port, nonce, folder):
    # Before app scripts run, give its existing transport our private WebSocket path. An unrelated
    # AgOpenWeb server on this port cannot accept this path, acquire control, or receive commands.
    page.add_init_script("""(() => {
      const Native = window.WebSocket;
      function ScreenshotSocket(url, protocols) {
        const target = new URL(url, location.href);
        if (target.host !== location.host || target.pathname !== '/ws')
          throw new Error('Unexpected screenshot WebSocket target');
        target.pathname = '/__readme_ws_' + NONCE;
        return protocols === undefined ? new Native(target.href) : new Native(target.href, protocols);
      }
      ScreenshotSocket.prototype = Native.prototype;
      Object.setPrototypeOf(ScreenshotSocket, Native);
      window.WebSocket = ScreenshotSocket;
    })();""".replace("NONCE", json.dumps(nonce)))
    page.goto(f"http://127.0.0.1:{port}/?ui=modern", wait_until="domcontentloaded", timeout=30000)
    page.wait_for_function("() => typeof connState !== 'undefined' && connState === 'connected' && iHoldControl", timeout=30000)
    page.wait_for_function("name => fieldOps && fieldOps.fields && fieldOps.fields.some(f => f.name === name)", arg=FIELD, timeout=30000)
    # The existing host commands load the real field/job and select the line. The screenshot
    # host's no-op UDP guarantees these commands cannot reach external machinery.
    page.evaluate("name => transport.send('field.startJob|' + [name, 'Seeding', '', 'Spring planting'].join('\\t'))", FIELD)
    page.wait_for_function("name => scene && scene.hasField && scene.fieldName === name && scene.trackList.length >= 5", arg=FIELD, timeout=30000)
    page.wait_for_function("() => statusBar && statusBar.jobName === 'Spring planting'", timeout=30000)
    page.evaluate("() => transport.send('track.select|0')")
    page.wait_for_function("name => tick && tick.activeTrackName === name", arg=ACTIVE_LINE, timeout=30000)
    page.evaluate("() => cfgSend('display.uiScale', '115')")
    page.wait_for_function("() => config && config.display && config.display.uiScale === 115 && uiZoom === 1.15", timeout=30000)
    # Give the simulator a normal six-metre implement and show adjacent guidance passes. These
    # are real configuration commands, scoped to the disposable host and data directory.
    page.evaluate("() => { cfgSend('tool.sectionWidth', '0,600'); cfgSend('display.extraGuidelines', '1'); cfgSend('display.extraGuidelinesCount', '5'); }")
    page.wait_for_function("() => toolWidthM() >= 5.9 && config.display.extraGuidelines && scene.guideLines && scene.guideLines.length > 0", timeout=30000)
    page.wait_for_function("() => typeof ckStatus === 'string' && ckStatus.startsWith('ready')", timeout=30000)
    for _ in range(6):
        page.locator("#cp-zoomin").click()
    page.wait_for_function("() => pxPerM > 11", timeout=30000)
    # Keep the actual Field/Job status page selected in both images, then wait for the real
    # light-bar average to settle after loading the demo line (rather than faking a readout).
    page.wait_for_function("() => sbPage === 0 && !sbPaused", timeout=20000)
    page.locator("#sb-pause").click()
    page.wait_for_function("() => sbPaused && sbPage === 0", timeout=5000)
    page.wait_for_function("() => tick && tick.guidanceActive && Math.abs(tick.crossTrackError) < 0.005 && lbAvgM < 0.0004", timeout=60000)
    page.locator("#mod-field-name").wait_for(state="visible")
    page.locator("#mod-active-line").wait_for(state="visible")
    page.screenshot(path=str(folder / "modern-overview.png"), animations="disabled")
    page.locator("#mod-all-lines").click()
    page.locator("#mod-all-lines-panel").wait_for(state="visible")
    page.get_by_text("Creek Curve", exact=True).last.wait_for(state="visible")
    page.screenshot(path=str(folder / "modern-all-lines.png"), animations="disabled")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=OUTPUT, help="directory for the two PNG files")
    parser.add_argument("--browser", type=Path, help="existing Chromium/Chrome executable (default: Playwright Chromium)")
    args = parser.parse_args()
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        parser.exit(2, "Playwright is missing. Install Tools/requirements-screenshots.txt; see Docs/MODERN_UI_DEVELOPMENT.md.\n")

    with tempfile.TemporaryDirectory(prefix="agopenweb-readme-") as temp:
        root = Path(temp)
        # A separate build tree avoids overwriting or locking the operator's running app build.
        artifacts = root / "artifacts"
        subprocess.run(["dotnet", "build", str(HOST_PROJECT), "-c", "Debug", "-p:DesktopOnly=true",
                        "--artifacts-path", str(artifacts), "--nologo"], cwd=ROOT, check=True)
        host_dll = artifacts / "bin/ReadmeScreenshotHost/debug/ReadmeScreenshotHost.dll"
        if not host_dll.is_file():
            raise RuntimeError("The screenshot host build did not produce its expected executable.")
        seed_data(root)
        port = free_port()
        nonce = secrets.token_hex(16)
        proc, lines, reader = start_host(root, port, nonce, host_dll)
        try:
            # A ready message alone is insufficient on Windows, where port bindings can overlap.
            # Verify a read-only identity endpoint before opening any browser/control connection.
            wait_for_host(proc, lines, port)
            verify_identity(port, nonce)
            with sync_playwright() as pw:
                options = {"headless": True, "args": ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]}
                if args.browser:
                    options["executable_path"] = str(args.browser.resolve())
                browser = pw.chromium.launch(**options)
                try:
                    context = browser.new_context(viewport=VIEWPORT, device_scale_factor=1, locale="en-US",
                                                  reduced_motion="reduce")
                    origin = f"http://127.0.0.1:{port}/"
                    context.route("**/*", lambda route: route.continue_()
                                  if route.request.url.startswith(origin) else route.abort())
                    capture(context.new_page(), port, nonce, root)
                finally:
                    browser.close()
            args.output.mkdir(parents=True, exist_ok=True)
            staged = []
            try:
                # Stage on the destination volume so --output also works on another drive.
                for name in ("modern-overview.png", "modern-all-lines.png"):
                    with tempfile.NamedTemporaryFile(dir=args.output, prefix=".agopenweb-", delete=False) as dest:
                        staged.append((Path(dest.name), name))
                        with (root / name).open("rb") as source:
                            shutil.copyfileobj(source, dest)
                for path, name in staged:
                    os.replace(path, args.output / name)
                    print(f"Wrote {args.output / name}")
            finally:
                for path, _ in staged:
                    path.unlink(missing_ok=True)  # only files this run created
        finally:
            if proc.poll() is None:
                proc.terminate()  # only the screenshot host that this script started
                try:
                    proc.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    proc.kill()
                    proc.wait()
            reader.join(timeout=10)
            if proc.stdout is not None:
                proc.stdout.close()
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (RuntimeError, subprocess.CalledProcessError) as exc:
        sys.exit(str(exc))
