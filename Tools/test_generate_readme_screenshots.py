#!/usr/bin/env python3
# AgOpenWeb
# Copyright (C) 2024-2026 AgOpenWeb Contributors
# SPDX-License-Identifier: Apache-2.0
"""Safety and fixture checks for the disposable README screenshot generator."""
import importlib.util
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import threading
import unittest

sys.dont_write_bytecode = True
SCRIPT = Path(__file__).with_name("generate-readme-screenshots.py")
spec = importlib.util.spec_from_file_location("readme_screenshots", SCRIPT)
screenshots = importlib.util.module_from_spec(spec)
spec.loader.exec_module(screenshots)


class ScreenshotFixtureTests(unittest.TestCase):
    def test_demo_fields_are_self_contained_and_named(self):
        with tempfile.TemporaryDirectory(prefix="readme-fixture-test-") as temp:
            root = Path(temp)
            screenshots.seed_data(root)
            fields = root / "AgOpenWeb" / "Fields"
            self.assertEqual({p.name for p in fields.iterdir()},
                             {"North Meadow", "South Pasture", "Willow Field"})
            data = json.loads((fields / screenshots.FIELD / "field.geojson").read_text(encoding="utf-8"))
            self.assertEqual(data["type"], "FeatureCollection")
            self.assertEqual(data["features"][0]["properties"]["name"], screenshots.FIELD)
            tracks = [f for f in data["features"] if f["properties"]["role"] == "track"]
            self.assertEqual([f["properties"]["name"] for f in tracks],
                             ["North-South", "East Headland", "Creek Curve", "West Pass", "South Approach"])
            self.assertTrue(all(f["properties"]["isVisible"] for f in tracks))
            boundary = next(f for f in data["features"] if f["properties"]["role"] == "outer-boundary")
            ring = boundary["geometry"]["coordinates"][0]
            self.assertEqual(ring[0], ring[-1])

    def test_host_uses_noop_module_transport_and_no_machine_interfaces(self):
        source = (screenshots.ROOT / "Tools/ReadmeScreenshotHost/Program.cs").read_text(encoding="utf-8")
        self.assertIn("AddSingleton<IUdpCommunicationService, ScreenshotUdp>()", source)
        self.assertIn("AddSingleton<ILocalNetworkInfoProvider, ScreenshotNetwork>()", source)
        for method in ("SendToModules", "SendToLoopback", "SendGpsDataToLoopback", "SendToTaskController"):
            self.assertIn(f"public void {method}(byte[] data) {{ }}", source)
        self.assertIn("public bool IsTaskControllerHeard => false", source)
        self.assertIn("public void SendHelloPacket() { }", source)
        self.assertIn("public void ScanModules() { }", source)
        self.assertIn("GetIPv4Addresses() => Array.Empty<LocalNetworkAddress>()", source)
        self.assertNotIn("new UdpClient", source)
        self.assertNotIn("new Socket", source)
        self.assertIn('MapWebSocket("/__readme_ws_" + nonce', source)

    @unittest.skipUnless(screenshots.HOST_DLL.exists(), "build ReadmeScreenshotHost first")
    def test_host_refuses_to_run_without_screenshot_marker(self):
        with tempfile.TemporaryDirectory(prefix="readme-guard-test-") as temp:
            for marker, data in [(None, temp), ("1", None)]:
                env = os.environ.copy()
                env.pop("AGOPENWEB_SCREENSHOT_HOST", None)
                env.pop("AGOPENWEB_DATA", None)
                if marker is not None:
                    env["AGOPENWEB_SCREENSHOT_HOST"] = marker
                if data is not None:
                    env["AGOPENWEB_DATA"] = data
                result = subprocess.run(["dotnet", str(screenshots.HOST_DLL), "5174", "a" * 32],
                                        env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=15)
                self.assertEqual(result.returncode, 2)

    def test_readme_images_exist_and_have_the_documented_viewport(self):
        readme = (screenshots.ROOT / "README.md").read_text(encoding="utf-8")
        for name in ("modern-overview.png", "modern-all-lines.png"):
            self.assertIn("Docs/screenshots/" + name, readme)
            with (screenshots.OUTPUT / name).open("rb") as image:
                header = image.read(24)
            self.assertEqual(header[:8], b"\x89PNG\r\n\x1a\n")
            self.assertEqual(struct.unpack(">II", header[16:24]), (1920, 1080))

    @unittest.skipUnless(screenshots.HOST_DLL.exists(), "build ReadmeScreenshotHost first")
    def test_port_collision_never_connects_to_an_existing_server(self):
        class OtherApp(BaseHTTPRequestHandler):
            requests = []

            def do_GET(self):
                self.requests.append(self.path)
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b"not the screenshot host")

            def log_message(self, *_):
                pass

        with tempfile.TemporaryDirectory(prefix="readme-port-test-") as temp:
            root = Path(temp)
            screenshots.seed_data(root)
            other = HTTPServer(("127.0.0.1", 0), OtherApp)
            thread = threading.Thread(target=other.serve_forever, daemon=True)
            thread.start()
            port = other.server_address[1]
            nonce = "a" * 32
            proc, lines, reader = screenshots.start_host(root, port, nonce)
            try:
                try:
                    screenshots.wait_for_host(proc, lines, port, timeout=30)
                except RuntimeError:
                    # Platforms with exclusive binds reject the second listener outright.
                    self.assertNotEqual(proc.wait(timeout=10), 0)
                else:
                    # Windows may permit both binds. The read-only identity check must reject
                    # the other app before a browser or control WebSocket is opened.
                    with self.assertRaises(RuntimeError):
                        screenshots.verify_identity(port, nonce)
                    self.assertEqual(OtherApp.requests, ["/__readme_screenshot_host"])
            finally:
                if proc.poll() is None:
                    proc.terminate()
                    proc.wait(timeout=10)
                reader.join(timeout=10)
                if proc.stdout is not None:
                    proc.stdout.close()
                other.shutdown()
                other.server_close()
                thread.join(timeout=5)


if __name__ == "__main__":
    unittest.main()
