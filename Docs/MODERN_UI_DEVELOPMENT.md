# Modern UI development and upstream sync

This document holds the fork's development rules, acceptance gates and upstream-update ledger.
The [README](../README.md) is the user-facing introduction; the detailed implementation checkpoints
are in [MODERN_UI_IMPLEMENTATION_PLAN.md](../Plans/MODERN_UI_IMPLEMENTATION_PLAN.md), and unresolved
host requirements are in [MODERN_UI_HOST_CHANGES.md](../Plans/MODERN_UI_HOST_CHANGES.md).

## Current preview

- Classic is the default and remains recoverable with `?ui=classic`. Modern is enabled explicitly
  with `?ui=modern` or the interface switch; the choice is stored per browser.
- The right rail uses host-confirmed lines and existing track, field, job, nudge and AutoSteer
  commands. The All lines column links to the original Tracks Manager and Quick AB. The Settings
  hub and on-map controls reuse existing handlers; they are not a second backend or command path.
- Selecting a named line while AutoSteer is engaged asks for confirmation, but `track.select` does
  not disengage it. The confirmation is based on a client snapshot, not an atomic interlock.
  Previous/Next retain the host's cycle semantics. The original Tracks Manager and Quick AB retain
  their Classic behavior.
- Field chips use browser-local pinned/recent order, then host distance, and recheck local guards.
  The host can still close a field and discard a recording that this browser cannot see after a
  reload. Recording cards and discard confirmation are client-local, not host-confirmed after a
  reconnect. See H1–H4 in the [host backlog](../Plans/MODERN_UI_HOST_CHANGES.md).
- The independent AutoSteer dock remains available during recording. Ref Nudge uses the existing
  panel and host session. Optional on-map controls and Auto UI Size are per-browser presentation
  preferences; manual UI sizes still use the host configuration.
- Primary line, recording and nudge targets are at least 56×56 CSS px; the lateral nudge buttons
  are 64×64. Real tablet, WebView/PWA, multi-client, accessibility, performance and hardware
  acceptance remain outstanding. Screenshots are documentation, not safety evidence.
- The reference target is a 1280×800 CSS-pixel landscape tablet with safe areas and UI scaling;
  smaller screens, portrait and phones need explicit design and acceptance tests. Contrast goals
  are at least 4.5:1 for normal text and 3:1 for large text and meaningful controls.

## Fork rules

1. **UI first.** Put presentation changes in `Shared/AgOpenWeb.RemoteServer/wwwroot/`; keep guidance,
   machine control and domain calculations in the existing backend. Tests and documentation may be
   added as needed.
2. **Classic remains usable.** Both interfaces must be selectable and recoverable on the same host;
   unfinished Modern functionality must remain reachable through Classic.
3. **Parity is a release gate.** Every original workflow, setting, status, warning, confirmation and
   supported integration must be reachable and behave equivalently in Modern. Inventory positive,
   negative, observer, failure, reconnect and persistence paths; do not treat a visible control as
   proof of parity.
4. **No unapproved backend divergence.** An upstream change merged unchanged is not a fork-specific
   backend change. Fork-authored changes to host, services, models, ViewModels, platform shells,
   persistence, API, commands, protocol or wire-affecting `transport.js` need maintainer approval
   and an entry in the register below *before implementation*. The same applies to fork-authored
   backend conflict resolutions. Do not weaken existing tests to evade this rule.
5. **Safety before appearance.** Do not weaken authority, observer restrictions, the deadman,
   warnings, confirmations or the distinction between displayed and actual machine state. Never
   automatically re-engage AutoSteer or sections.
6. **Keep the fork mergeable.** Prefer isolated, reversible additions and shared upstream controls
   over a copied backend or UI. Preserve upstream license notices.

### Backend exception and approval register

No fork-specific production backend changes are approved or implemented. A proposal is not
approval; obtain the fork maintainer's agreement before adding an exception. Untouched upstream
changes do not belong in this register.

| ID / status | Files and interfaces | Need and UI-only alternatives | Approval and date | Tests, compatibility and migration | Upstream PR / removal plan |
|---|---|---|---|---|---|
| None | — | — | — | — | — |

For each exception, record behavior, protocol and stored-data impact, platforms, safety tests,
merge risks, rollback and upstream/removal plans. The screenshot-only helper under `Tools/` uses a
no-op module transport; it is not a production host or a backend exception.

## Architecture and implementation

The UI is a single HTML/CSS/JavaScript client in `wwwroot/`, served by the shared host on every
platform. Classic scripts share one scope; `index.html` loads the scripts and styles, and
`js/frame.js` starts asynchronous work. There is one renderer and one transport per page. Reuse
upstream markup, IDs, handlers, state and dialogs wherever possible, and do not duplicate guidance
logic or change a wire contract for presentation alone. See [WEB_CLIENT.md](WEB_CLIENT.md),
[ARCHITECTURE.md](ARCHITECTURE.md) and [CONTRIBUTING.md](../CONTRIBUTING.md).

The preview's namespaced preferences are `agopenweb.modernui.presentation`, `.pinnedFields`,
`.recentFields` and `.mapControls`; Auto UI Size is `agopenweb.uiScaleAuto`. Validate restored
values and do not store passwords, field contents, profiles or machine state. Local storage is
browser/origin-specific and may be unavailable. Switch/reset operations warn about reload and
control loss, refuse active local work and recheck after confirmation. A connected observer can
still use the view-only recovery path; an unknown or disconnected role stays conservative.

Use the existing translation hooks and regenerate `wwwroot/i18n/en.json` with
`python Tools/i18n-extract.py`. Non-English files are Weblate-owned; do not hand-edit them. See
[TRANSLATIONS.md](TRANSLATIONS.md). Do not assume upstream Weblate translates fork-only strings or
push to it without authorization. Preserve upstream feature switches, offline behavior and the
Classic fallback. Do not expand iframe/add-on permissions or introduce remote script execution.

## Feature parity inventory

This is a starting checklist, not proof of completeness. The detailed implementation plan tracks
individual controls, commands, states and known gaps; preserve the Classic path until verified.

| Area | Examples to inventory | Status |
|---|---|---|
| Guidance and map | Camera, layers, line readouts, light bar and position | Not fully inventoried |
| Steering and turns | AutoSteer, Free Drive, U-turns, nudge and disengagement | Not fully inventoried |
| Sections and machine | Master and per-section modes, tool and headland behavior | Not fully inventoried |
| Tracks | Create, record, draw, import, select, edit, delete, Ref Nudge and Smooth Curve | Not fully inventoried |
| Fields and jobs | Open/resume/close, coverage guards, boundaries and Field Builder | Not fully inventoried |
| Configuration | Vehicle/tool profiles, NTRIP, wizards, calibration, units and scale | Not fully inventoried |
| Alerts and operations | GPS/link/module failures, prompts, sounds, simulator and hotkeys | Not fully inventoried |
| Integrations | VT, web cards, AgShare and feature-switched capabilities | Not fully inventoried |
| General UI | Language, accessibility, fullscreen, diagnostics and bug reports | Not fully inventoried |

## Roadmap and acceptance gates

These gates are not complete; the numbered details and per-stage evidence are in the
[implementation plan](../Plans/MODERN_UI_IMPLEMENTATION_PLAN.md).

0. **Baseline and inventory:** record Classic behavior, build/test evidence, parity and safety
   matrix, upstream boundary, known defects and fork-specific CI/release permissions. Audit inherited
   workflows, scheduled jobs, releases, external services, secrets and runners; do not publish
   upstream releases or use upstream Weblate/self-hosted runners without authorization.
1. **Architecture proof:** prove isolated presentation hooks, switching/recovery, storage failure
   handling and a single connection/renderer across supported heads.
2. **Design foundation:** validate themes, map/day-night interaction, contrast, translations,
   touch, scaling, offline assets and performance.
3. **Layout foundation:** validate trusted built-in modules, safe presets, layout editing,
   per-browser persistence/migration and mandatory safety UI.
4. **Incremental parity:** migrate features against the inventory and test behavior, accessibility,
   observers and failures; leave missing items explicitly tracked.
5. **Integration and field readiness:** complete parity and safety checks, multi-client scenarios,
   packaging, realistic performance, simulator/bench and supported-device evidence. Do not ship an
   unresolved safety-critical gap.
6. **Release:** document fork-specific build provenance, known issues and tested recovery/rollback.
   Making Modern the default requires separate maintainer agreement.

Run the upstream build and unit/integration checks, `CodePathContinuityTests`, changed JS syntax
checks, `python Tools/i18n-extract.py --check`, license checks and translation-fit checks. Run the
scenario harnesses only on the designated harness host, not a development machine; see
[HARNESSES.md](HARNESSES.md). Test at least two clients, control takeover/loss and reconnect, and
perform machine-output checks with simulator/bench safeguards before real-world validation. Measure
performance against Classic on the reference hardware; the upstream 24 FPS floor is a starting point,
not evidence of acceptable in-cab performance.

### Regenerating screenshots

Install .NET 10, Python 3 and Playwright's browser, then run:

```bash
python -m pip install -r Tools/requirements-screenshots.txt
python -m playwright install chromium
python Tools/generate-readme-screenshots.py
```

The generator builds a dedicated screenshot host in a temporary build tree, creates fictional
fields, a job and five lines in a temporary data directory, and uses the real simulator and web
client with **module UDP disabled**. It uses a fresh browser context, verifies its host's identity
and a per-run WebSocket path, captures both 1920×1080 images into `Docs/screenshots/`, and stops
only its own host. It does not touch an operator's fields, settings or running app. Pass
`--browser /path/to/chrome` to use an existing Chromium/Chrome executable.

Like the normal app, the demo web server listens on an ephemeral port on all network interfaces
until it exits. Its identity check prevents accidental port collisions; it is not network
authentication. To test fixture and isolation behavior separately, build
`Tools/ReadmeScreenshotHost/ReadmeScreenshotHost.csproj` with `-p:DesktopOnly=true`, then run
`python Tools/test_generate_readme_screenshots.py`.

## Upstream synchronization and UI update ledger

The source is [AgOpenGPS-Official/AgOpenWeb](https://github.com/AgOpenGPS-Official/AgOpenWeb),
branch `develop`. `origin` points to the fork and `upstream` to that source. The starting boundary
was [`a89a4b08`](https://github.com/AgOpenGPS-Official/AgOpenWeb/commit/a89a4b080d7b4bc6d8602a83f22607e17c2660ab);
the full baseline parity inventory remains pending.

For each sync, fetch and inspect the commit range, changed files and linked PRs—including safety,
UI, translations, feature flags, commands, contracts and tests. Merge on a clean integration branch,
resolve conflicts deliberately, retain upstream fixes and Classic/Modern behavior, and test before
merging into the fork's `develop`. Do not rewrite shared history or force-push by default. Record
each relevant feature, behavior change, bug fix or removal below with its owner/issue, tests and
status; update integrated and fully reviewed boundaries separately. `Verified` requires evidence,
not merely a successful merge.

**Last integrated upstream SHA:** `0e2c7e8d1704ed799a2db357068f0189b01ee78d`

**Last fully reviewed upstream SHA:** `a89a4b080d7b4bc6d8602a83f22607e17c2660ab` (starting
boundary only; complete parity, hardware and linked-PR review of the later range remains pending).

| Upstream change | Classic impact | Modern action and evidence | Owner / issue | Status |
|---|---|---|---|---|
| Baseline `a89a4b08` | Original UI | Complete baseline inventory and tests | — | Pending |
| `a03b16ee`, PR #932 | Remaining field percentage uses boundary area, clamped to zero | Shared status readout; 716 ViewModels tests passed; verify with a real field | — | Pending |
| `bd9f3e38`, `a2ceabee`, PRs #934–#935 | Tool configuration labels and layout corrected | Shared panels reused; desktop build passed; check tablet and translations | — | Pending |
| `56eb24af`, `26ba3022`, PRs #937 and #944 | Data-quality sensors, status fix rate, diagnostics and append-only status data | Shared status reused; All lines header clears the bar. At 1000 px/manual 115%, status can extend over the rail edge. Sensor tests and browser smoke passed; verify hardware | — | Pending |
| `ca2fe8a1`, PR #938 | ISOBUS task controller receives speed, distance and deviation in PGN 242 | No fork-specific command or wire change; service/ViewModels tests passed; verify real controller | — | Pending |
| `cc3e434b`, PR #939 | All Edges supports map-drawn boundaries; tram tab reports automatic lines | Shared Quick AB and Field Builder reused; Models/ViewModels tests passed; verify real field | — | Pending |
| `c704cc7c`, PR #940 | A+ works at the field origin; host reports absent GPS | Shared dispatcher retains fix; browser dispatch and UI harness passed; verify device | — | Pending |
| `ac422c45`–`96e24318`, PR #941 | Upstream Weblate translations updated | Preserve translation files; English extraction passed; translation-fit check pending | — | Pending |
| `ccf62a92`, PR #942 | AutoSteer and NTRIP panels scroll within the viewport | Shared panels reused; PanelFit 2/2 passed; verify tablet at enlarged scales | — | Pending |
| `55b22d66`, PR #947 | Wide U-turn follows the shorter turn-line path at acute corners | Upstream geometry and unit tests passed; field/hardware validation pending | — | Pending |
| `cae822d6`, PR #948 | iOS Home Screen web app uses the full screen | Shared viewport logic; desktop build passed; verify iOS safe areas and resizing | — | Pending |

Use `Pending`, `In progress`, `Verified` or `Not applicable` with a reason; retain history. Do not
advance the review boundary or ship an unresolved safety-critical parity regression.
