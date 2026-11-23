# AgOpenWeb Modern UI

This is the public [Modern UI fork](https://github.com/MalteBahr/AgOpenWeb-ModernUI) of
[AgOpenWeb](https://github.com/AgOpenGPS-Official/AgOpenWeb). Its goal is an optional,
customizable interface while keeping the original interface available and making upstream updates
as easy and safe to merge as possible.

**Status: planning only.** The modern interface, switch, themes and modular layout described below
are not implemented yet. The working application is currently the original UI. The release badges
and downloads in the inherited section below refer to **upstream builds**, not builds of this fork.

## Fork goals and non-negotiable rules

1. **UI first.** Make presentation changes in
   `Shared/AgOpenWeb.RemoteServer/wwwroot/`; keep guidance, safety, machine control and domain
   calculations in the existing backend. Tests, documentation and CI may be added as needed.
2. **Original UI stays usable.** Both interfaces must be selectable and recoverable independently
   on the same host, without reinstalling, a second backend or a separate machine configuration.
   During development, unfinished modern features must remain accessible through the original UI.
3. **Functional parity is a release gate.** Every original workflow, setting, status, warning,
   confirmation and supported integration must be reachable and behave equivalently in the modern
   UI. Modern-only enhancements are welcome but cannot replace or silently change existing behavior.
4. **No unapproved backend divergence.** An upstream change merged unchanged is not a fork-specific
   backend change. Any fork-authored backend change—including host, services, models, ViewModels,
   platform shells, persistence, API, command semantics, protocol, or even a change to
   `wwwroot/transport.js` that affects the wire contract—requires the approval and record described
   below *before implementation*. The same rule applies to fork-authored conflict resolutions there.
   Tests, documentation and CI are not backend exceptions unless they change application behavior;
   existing safety and architecture checks must not be weakened to evade this rule.
5. **Safety before appearance.** Never weaken control authority, the observer restrictions,
   deadman, warnings, confirmations or the separation between displayed and actual machine state.
   Do not assume a UI refresh or switch leaves steering or sections running.
6. **Keep the fork mergeable.** Prefer small, isolated and reversible additions; reuse upstream
   code and stable interfaces instead of maintaining a copied backend or a long-lived copy of the
   entire original UI. Preserve upstream license notices and comply with the Apache 2.0 license.

### Backend exception and approval register

No fork-specific backend changes are approved or implemented yet. Approval must come from the fork
maintainer before the change is made; a proposed exception is not authorization. If needed, add a
row here and link the decision/PR. Track upstream changes normally; do not list untouched upstream
code as a fork exception.

| ID / status | Exact files and interfaces | Need and UI-only alternatives considered | Approval and date | Tests / compatibility / migration | Upstream PR and removal plan |
|---|---|---|---|---|---|
| None | — | — | — | — | — |

For each exception, record the precise behavior and protocol or stored-data impact, the affected
platforms, regression and safety tests, merge/conflict risks, backwards-compatibility and rollback
steps. Prefer proposing generally useful backend changes upstream and remove the fork-specific patch
once upstream provides an equivalent. Update the record when the scope or approval changes.

## Architecture plan

### Current constraints

The upstream UI is a single HTML/CSS/JavaScript client in `wwwroot/`, served by the shared host
and used by every platform. `index.html` loads classic scripts in a shared global scope; the
existing `transport.js`, state model, command paths and CanvasKit renderer are coupled to those
scripts and DOM elements. `js/frame.js` starts asynchronous work after the scripts are loaded.
There is no UI build step. See [Docs/WEB_CLIENT.md](Docs/WEB_CLIENT.md),
[Docs/ARCHITECTURE.md](Docs/ARCHITECTURE.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

Upstream's `CodePathContinuityTests` expect classic scripts, no workers/modules and every own JS/CSS
file to be loaded from `index.html`. The translation extractor also scans `index.html` and `js/`.
Respect these constraints rather than silently bypassing their tests. Any necessary departure must
be reviewed, justified and tested as an explicit fork divergence.

### Proposed approach: one client, two presentations

Start with an **opt-in presentation layer** around the existing client, not a second independently
maintained application. Keep upstream markup, IDs, event handlers, transport, control authority,
renderer, config and dialogs as the source of truth. Add isolated, namespaced modern CSS/JS and a
small module registry; integrate through the smallest practical hooks. Where possible, adapt or
reposition the existing controls/panels rather than reimplementing their behavior. A modern shell
may initially open an original panel; this is preferable to a fake or incomplete replacement.

There must be one active presentation and one transport/control session per page, with no duplicate
element IDs, command handlers, timers, rendering loops or hidden controls accidentally intercepting
touches. Do not fork `transport.js`, duplicate guidance logic, or change the data contract merely to
render a new layout. Document any necessary edits to shared upstream UI files in the relevant PR.
First validate this approach with a small proof of concept: the global scripts, layout calculations
and upstream updates may make some hooks harder than they appear. If the approach proves unsuitable,
document alternatives and obtain agreement before adopting a more divergent architecture.

### Switching and recovery

- Start in **Classic** by default until the modern UI meets the release gates. Offer an explicit
  switch in both modes; remember the choice locally per browser/WebView, not as machine state.
- Plan an explicit, documented recovery URL such as `?ui=classic` that overrides a broken saved
  preference, and a reset of only the fork's UI preferences. Verify this works in browsers, installed
  PWA and each platform WebView. The exact URL and entry point are implementation decisions, not
  existing functionality.
- A mode change may require a page reload and therefore releases/reacquires a control connection.
  Warn before switching, do not switch silently, and handle open dialogs, edits and unsaved coverage
  using the existing guards. If a safe transition cannot be established, cancel the switch. Show
  the resulting operator/observer and connection state; never automatically re-engage steering or
  sections. Test with steering and sections active using the simulator, not on live equipment.
- If modern initialization, a layout or local storage fails, preserve a clear route back to Classic.
  Do not hide critical messages behind a broken overlay. Classic behavior and presentation must
  remain unaffected when Modern is disabled.

### Modules and layouts

Define a small internal registry of **trusted, built-in** UI modules—not arbitrary executable
plugins. Each module should have a stable ID, translated name, supported placement/size, minimum
dimensions, visibility rules, dependencies, setup/cleanup and access to existing read-only state
and command actions. Examples: map, guidance readouts, GPS/status, section controls, field/job,
tracks, camera and supported VT/web cards. Avoid duplicating an upstream component's state or
listeners. Respect host feature switches and show unsupported/unavailable features honestly.

- Provide usable presets and an edit mode for moving, resizing, showing and hiding eligible modules
  by touch and keyboard. Normal operation must not accidentally rearrange controls. Include reset,
  undo/cancel and a clear way to leave edit mode; do not require drag-and-drop alone.
- Keep safety-critical indicators, connection/operator role, warnings, confirmations and essential
  control access visible and reachable; they cannot be removed, obscured or made misleading by a
  layout. Define the precise mandatory set during the parity and safety inventory.
- Store only presentation preferences in a versioned, fork-namespaced browser-local schema. Validate
  restored data, constrain positions/sizes to the viewport, migrate known versions, ignore unknown
  modules and fall back safely for corrupt/unavailable storage, changed screen size or rotation.
  Do not overwrite upstream local-storage keys or save passwords, fields, profiles or machine state.
  Web storage is origin/profile-specific and may be cleared or unavailable; no cross-device sync is
  implied. Consider optional validated layout export/import later, without credentials or code.
- Reuse existing card-pane, VT and web-card behavior where feasible; preserve observer covers and
  feature gating. Do not expand iframe/add-on permissions or introduce remote script execution.

### Themes, readability and accessibility

- Define semantic design tokens for surfaces, text, controls, focus, selection, warnings and state;
  implement at least a light, dark and high-contrast theme. Keep themes separate from layout.
- Upstream's day/night setting currently affects both CSS and CanvasKit map colors via host config.
  Explicitly map modern theme choices to this existing behavior: a local chrome theme must not
  silently change the host-wide map/day setting. If map palettes are extended, keep canvas paints,
  map overlays, labels and contrast consistent and test both modes.
- Test daylight/glare and darkness, color-vision differences, text scaling, visible focus, screen
  reader labels and keyboard access. Never communicate an important state through color alone.
  Keep labels understandable without hover; confirm destructive and safety-sensitive actions as the
  original does. Target at least 40 CSS px for touch controls, matching the upstream harness, with
  larger targets where practical and no overlaps. Aim for at least 4.5:1 contrast for normal text
  and 3:1 for large text and meaningful controls/graphics; document and fix exceptions.
- The first supported target is upstream's 10-inch landscape tablet at 1280×800 CSS px, including
  upstream UI scaling, safe areas and long translations. Larger screens must remain usable; smaller
  screens, portrait and phones need an explicit design and acceptance tests before being promised.

### Internationalization, offline operation and performance

Reuse upstream translations, `tr()` and `Tools/i18n-extract.py`; avoid changing existing English
keys unnecessarily, since that loses their translations. New text must have an English fallback, use
placeholders correctly and be tested in German and a long-label language as well as English. Define
a fork translation workflow without assuming that upstream Weblate translates fork-only strings.
Follow [Docs/TRANSLATIONS.md](Docs/TRANSLATIONS.md) and the existing extraction/fit checks.

The UI must start and operate without an internet connection to the extent upstream does. Bundle
approved assets locally, avoid external fonts/CDNs, and verify packaging, PWA start URL, caches and
upgrade/rollback behavior. Keep the existing 100 Hz control loop and client/host separation intact;
measure page startup, input latency, CPU/memory and map frame rate against Classic on the reference
hardware and with realistic fields. Do not introduce a rendering or network loop per module.
Use the upstream 24 FPS floor as a starting acceptance target on the reference screen, recording
the test hardware, workload and Classic comparison rather than claiming performance from a desktop
browser alone.

## Feature parity inventory

The baseline is upstream commit [`a89a4b08`](https://github.com/AgOpenGPS-Official/AgOpenWeb/commit/a89a4b080d7b4bc6d8602a83f22607e17c2660ab).
The inventory below is a **starting checklist, not proof of completeness or implementation**. Before
building replacements, enumerate individual controls, commands, states, permissions and scenarios
from the baseline UI and maintain a detailed matrix with source, Modern equivalent, tests, status and
known gaps. Compare outcomes and machine commands, not just the presence of buttons. A feature is
complete only when its positive, negative, observer, failure and persistence paths are covered.

| Area to inventory | Examples | Modern status |
|---|---|---|
| Guidance and map | Camera, zoom/tilt, map layers, guidance/track readouts, light bar, position and status | Not inventoried |
| Steering and turns | AutoSteer, Free Drive, U-turns, lateral/nudge, disengagement and module state | Not inventoried |
| Sections and machine | Master and per-section Off/Auto/On, tool state, section/headland behavior | Not inventoried |
| Tracks | Create/record/draw/import/select/edit/delete, curves, Ref Nudge and Smooth Curve | Not inventoried |
| Fields and jobs | Open/resume/close, coverage guards, boundaries, obstacles, headlands, tram and Field Builder | Not inventoried |
| Configuration and setup | Vehicle/tool profiles, settings, network/NTRIP, wizards, calibration, units and scale | Not inventoried |
| Alerts and operations | GPS/link/module failures, prompts, sounds, confirmations, simulator and hotkeys | Not inventoried |
| Integrations | VT and web cards, AgShare and other feature-switched capabilities | Not inventoried |
| General UI | Language, accessibility, fullscreen, cards, diagnostics, about and bug reporting | Not inventoried |

Inventory changes as upstream adds, removes or fixes functionality. Features disabled by upstream
configuration must remain correctly disabled; permissions and defaults must match upstream. Until a
replacement is verified, use the original panel or explicitly mark the feature incomplete. The
inventory must include edge cases such as save/cancel, destructive actions, reconnect, role change,
multiple clients, interrupted workflows and state restored after restart.

## Roadmap and acceptance gates

All items below are planned, not complete. Progress is gated by working software and evidence, not
by visual mockups alone.

- [ ] **0 — Baseline and inventory.** Record the upstream baseline, run the existing Classic tests,
      enumerate the full parity/safety matrix and capture screenshots, translations, performance and
      known upstream defects. Establish an upstream integration branch/workflow and the update ledger.
      Audit inherited GitHub Actions, scheduled jobs, releases, external services and secrets before
      enabling them on the fork; avoid publishing upstream releases, touching upstream Weblate or
      consuming a self-hosted runner without explicit authorization. Define fork-specific CI,
      permissions, release names and build provenance.
- [ ] **1 — Architecture proof of concept.** Prove isolated presentation hooks, the safe Classic ↔
      Modern switch, independent recovery, storage failure handling and one connection/renderer.
      Test page load and Classic regressions on all supported heads. Classic remains the default.
- [ ] **2 — Design foundation.** Build accessible tokens and light/dark/high-contrast themes; verify
      map/day-night interactions, translations, scaling, contrast, offline assets and performance.
- [ ] **3 — Layout foundation.** Add the built-in module registry, safe presets, layout editor,
      per-browser persistence, schema migration and reset/recovery; lock critical UI in place.
- [ ] **4 — Incremental parity.** Migrate one feature group at a time against the inventory, reusing
      existing panels where appropriate. Add behavioral, visual and observer/failure tests for each;
      keep missing items explicitly tracked. Add Modern-only features only without regressing parity.
- [ ] **5 — Integration and field readiness.** Complete all parity items, upstream-update entries
      and safety checks; verify both UIs and multi-client scenarios, offline packaging, platform heads,
      realistic performance and simulator/bench behavior. Fix or explicitly approve non-safety gaps;
      no unresolved safety-critical gap is acceptable.
- [ ] **6 — Release.** Publish fork-specific build and recovery/rollback instructions, known issues
      and the exact upstream baseline. Keep Classic available. Any decision to make Modern the
      default requires separate maintainer agreement and completion of the preceding gates.

### Test and release checklist

- Run upstream build and unit/integration checks, including `CodePathContinuityTests`, changed JS
  `node --check`, `python Tools/i18n-extract.py --check` and the relevant translation-fit checks.
  Do not weaken existing guards just to make a new UI pass.
- Extend the upstream web-client scenario harness to exercise **both** presentations: reference
  tablet layout, Classic parity, each theme, controls, field/track/section flows, saved/invalid
  layouts, switch/reload, connection loss, observer control and recovery. Preserve upstream scenarios.
  The existing harness reports many findings rather than failing the test: inspect and archive its
  report/screenshots and enforce or explicitly review findings; a green test alone is not proof of
  safety or parity. Run scenario harnesses on the designated harness host, not a developer machine;
  see [Docs/HARNESSES.md](Docs/HARNESSES.md) and the harness README.
- Test two or more clients with different modes/themes/layouts: one operator, observers, takeover,
  slow/lost link, backgrounding and reconnect. Verify fail-safe steering/sections and no stale or
  misleading role/state; do not assume the switch keeps control or ongoing work alive.
- Check touchscreen and keyboard, long translations, size/zoom and safe-area changes, offline
  startup, WebView2/WKWebView/WebKitGTK/Android WebView as applicable, and a real reference tablet.
  Perform machine-output checks with simulator/bench safeguards before any real-world validation.
- For a release, review the parity matrix and update ledger, document approved backend exceptions,
  record test evidence and known limitations, and provide a tested route back to Classic and to a
  previous build. Upstream issues are not automatically fork issues, or vice versa.

## Upstream synchronization and UI update ledger

The source is [`AgOpenGPS-Official/AgOpenWeb`](https://github.com/AgOpenGPS-Official/AgOpenWeb),
branch `develop`. In a fork clone, `origin` should point to this fork and `upstream` to that source.
The last upstream commit integrated into the local starting point is
[`a89a4b080d7b4bc6d8602a83f22607e17c2660ab`](https://github.com/AgOpenGPS-Official/AgOpenWeb/commit/a89a4b080d7b4bc6d8602a83f22607e17c2660ab).
This is also the starting review boundary; the full baseline parity inventory is still **pending**.
Upstream commits after that boundary have not yet been reviewed here. An empty ledger is not proof
that no upstream updates exist.

For every upstream sync:

1. On a clean integration branch, `git fetch upstream`, note the old reviewed SHA and the candidate
   `upstream/develop` SHA, and review `git log --oneline <old-reviewed-sha>..upstream/develop` and
   `git diff --stat <old-reviewed-sha>..upstream/develop`. Inspect the actual changes and linked
   PRs, including UI, translations, feature flags, commands/contracts, safety behavior and tests—not
   only files under `wwwroot/`. Do not advance the review boundary before completing this review.
2. Merge `upstream/develop` into the integration branch, resolve UI conflicts deliberately, and
   apply the approval rule to any fork-authored backend conflict resolution. Preserve both the
   upstream fix and the fork's behavior; test the merged result before merging the integration
   branch into the fork's `develop`. Do not rewrite shared history or force-push by default.
3. Add a row below for **each** relevant upstream feature, behavior change, bug fix or removal,
   including fixes without a visible new button. Record what Classic received, Modern impact,
   owner/issue, tests and state. If there are no relevant changes, record the reviewed SHA range and
   that conclusion rather than leaving a silent gap. A fix is not `Verified` merely because its
   upstream commit merged.
4. Update the **last integrated** and **last reviewed** SHAs separately. Keep every Modern item
   `Pending` or `In progress` until implemented or deliberately reused and tested; retain completed
   entries for traceability. If Modern cannot support an item yet, retain Classic access and expose
   the gap in release notes. Triage safety fixes before other work; never ship with an unresolved
   safety-critical parity regression.

**Last integrated upstream SHA:** `a89a4b080d7b4bc6d8602a83f22607e17c2660ab`

**Last reviewed upstream SHA:** `a89a4b080d7b4bc6d8602a83f22607e17c2660ab` (starting boundary only; baseline inventory pending)

| Upstream commit / PR / reviewed range | Classic change and impact | Modern action / issue / owner | Status | Evidence / fork PR |
|---|---|---|---|---|
| Baseline `a89a4b08` | Original UI at the starting boundary | Complete baseline inventory and tests | Pending | — |

Use `Pending`, `In progress`, `Verified`, or `Not applicable` (with a reason); never remove a row
until its history is preserved elsewhere and linked here. Maintainers are responsible for updating
this ledger as part of each sync; this is a manual process until an automation is implemented and
verified. Resolve README conflicts by preserving upstream information **and** this fork's plan and
ledger.

---

## Original AgOpenWeb information

The following describes the upstream project. Its CI badges, beta releases, Weblate project and
contribution links refer to upstream; a fork-specific release, if produced, will be identified
separately.

[![CI](https://github.com/AgOpenGPS-Official/AgOpenWeb/actions/workflows/build-and-release.yml/badge.svg?branch=develop)](https://github.com/AgOpenGPS-Official/AgOpenWeb/actions/workflows/build-and-release.yml)
[![Translation status](https://hosted.weblate.org/widget/agopengps/agopenweb/svg-badge.svg)](https://hosted.weblate.org/projects/agopengps/agopenweb/)

[![Beta build](https://img.shields.io/github/release-date-pre/AgOpenGPS-Official/AgOpenWeb?label=beta%20build&style=for-the-badge&color=brightgreen)](https://github.com/AgOpenGPS-Official/AgOpenWeb/releases/tag/beta)

> **⬇️ Download the [Beta build](https://github.com/AgOpenGPS-Official/AgOpenWeb/releases/tag/beta). It is rebuilt from `develop` as fixes land and has all the latest fixes. Please install it, and check the problem still happens on it, before you open an issue.**

Cross-platform agricultural GPS guidance — a rewrite of [AgOpenGPS](https://github.com/farmerbriantee/AgOpenGPS) using HTML/JS, .NET 10, and C#. The UI is a web page served up by the backend host and shown in each platform's own web view.

## Download & run

Get the upstream [**Beta**](https://github.com/AgOpenGPS-Official/AgOpenWeb/releases/tag/beta) build. It is rebuilt from `develop` on demand and
daily when there are changes, and it is the build to use and report issues against. Everything is a self-contained app (no .NET install needed). Pick the set that matches how you'll run it — in
every mode the host also serves `http://<host>:5174` on the LAN, so cab phones/tablets connect
in a browser.

**🖥️ Desktop** — a window with the guidance UI (host runs in-process):

| OS | Download | Run |
|---|---|---|
| Windows x64 | `agopenweb-win-x64.zip` | run `AgOpenWeb.Desktop.exe` |
| macOS (Apple silicon) | `agopenweb-macos-arm64.dmg` | drag to Applications, launch |
| Linux x64 / arm64 | `agopenweb-launcher-linux-<arch>.tar.gz` | `./run.sh` |

**🛰️ Headless** (Linux + Windows) — no window; UI in a browser at `http://<host>:5174`, auto-starts
on boot (for an in-cab mini-PC / SBC):

| OS | Download | Install |
|---|---|---|
| Linux x64 / arm64 | `agopenweb-linux-<arch>.tar.gz` | `sudo ./install.sh --from app` (systemd) |
| Windows x64 | `agopenweb-win-x64.zip` | `install-service.cmd` → Run as administrator (Windows Service) |

**📱 Mobile** — all-in-one (host + UI on the device):

| Device | Download | Install |
|---|---|---|
| Android | `agopenweb-android.apk` | sideload |

Each download's bundled `README` lists the prerequisites (e.g. the WebView2 Runtime on Windows,
WebKitGTK on Linux).

## Platforms

- Windows x64
- macOS x64 / ARM64
- Linux x64 / ARM64
- Android
- iOS (sideload)

## Tech stack

- **UI:** HTML/JS web client with CanvasKit (Skia WebAssembly); shown in WebView2 / WKWebView / WebKitGTK on desktop (Photino.NET), WKWebView on iOS, WebView on Android
- **Control brain:** `MainViewModel` with CommunityToolkit.Mvvm, driven by the web client
- **Runtime:** .NET 10
- **Architecture:** shared backend on every platform; the platform projects are thin web-view shells
- **Testing:** NUnit, NSubstitute

## Building from source

Prerequisites: .NET 10 SDK

```bash
# Desktop (Windows/macOS/Linux)
dotnet build Platforms/AgOpenWeb.Desktop
dotnet run --project Platforms/AgOpenWeb.Desktop

# Android
dotnet build Platforms/AgOpenWeb.Android

# Run tests
dotnet test
```

See [BUILD.md](BUILD.md) for platform-specific setup, and `deploy/{linux,windows,macos}/` for the
packaging scripts that produce the release bundles above.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the architecture overview, feature list, and how to get
started.

To help translate the UI, no code is needed: join in on [Weblate](https://hosted.weblate.org/projects/agopengps/agopenweb/). See [Docs/TRANSLATIONS.md](Docs/TRANSLATIONS.md).

## License

[Apache License 2.0](LICENSE.md)
