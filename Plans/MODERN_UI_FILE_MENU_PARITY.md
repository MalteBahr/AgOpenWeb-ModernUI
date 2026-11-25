# Modern UI — File / Application Menu parity

The Modern Settings hub is the large, labeled surface for settings, diagnostics and recovery.
It already lists every Classic left-nav entry. This inventory records how the File / Application
Menu's own entries are exposed there without copying any handler.

## Rule

- The File / Application Menu (`#filemenu`) stays in the hub's Navigation grid, so the complete
  flyout is still one tap away and remains the fallback.
- Each File menu entry that is useful while the map is covered is also a direct card in the hub's
  **Application & Recovery** section.
- A hub card dispatches the original `.fo-btn` `pointerdown` handler. The File menu owns the
  action, its panel chain, its guards and its translations.
- The hub's own **User Interface** section already owns the Classic/Modern switch and Reset UI
  preferences, so those two File menu entries are not duplicated.

## Inventory

| File menu entry | ID | Hub location | Existing action | Notes |
| --- | --- | --- | --- | --- |
| Language | `fm-language` | Application & Recovery | `lnOpen('language', 'ln-filemenu', renderLanguage)` | Language list and selection stay in the existing panel. |
| Reset All Settings | `fm-reset` | Application & Recovery | `showConfirm(..., () => transport.send('app.resetSettings'))` | The existing confirmation is still the guard; the hub closes first. |
| Modern UI | `fm-ui-switch` | User Interface (hub-owned) | `modernSwitchPresentation()` | The hub card is the same guarded switch, not a second command. |
| Reset UI preferences | `fm-ui-reset` | User Interface (hub-owned) | `modernResetPresentation()` | The hub card is the same guarded reset. |
| App Settings | `fm-appsettings` | Application & Recovery | `lnOpen('appsettings', 'ln-filemenu', renderAppSettings)` | Units, device toggles and app directories stay in the existing panel. |
| View All Settings | `fm-viewsettings` | Application & Recovery | `lnOpen('viewsettings', 'ln-filemenu', renderViewSettings)` | Read-only settings overview. |
| Log Viewer | `fm-logviewer` | Application & Recovery | `lnOpen('logviewer', 'ln-filemenu', renderLogViewer)` | `logViewerParent` still returns Back to the File menu. |
| Hotkeys | `fm-hotkeys` | Application & Recovery | `lnOpen('hotkeys', 'ln-filemenu', renderHotkeys)` | Capture/reset behaviour stays in the existing panel. |
| Simulator | `fm-simulator` | Application & Recovery | `transport.send('sim.togglePanel'); lnCloseAll()` | No new simulator command. |
| Help | `fm-help` | Application & Recovery | `lnOpen('help', 'ln-filemenu')` | Static help panel. |
| About | `fm-about` | Application & Recovery | `lnOpen('about', 'ln-filemenu', renderAbout)` | Build/version information. |
| Bug Report Dump | `fm-bugreport` | Application & Recovery | `lnOpen('bugreport', 'ln-filemenu', renderBugReport)` | The existing no-scrim diagnostic panel; it stays open while driving. |

## Entry activation

The hub does not call `lnOpen` itself. It dispatches the original button's `pointerdown` handler
through `modernDispatchPointer`. That hand-off uses a fresh synthetic pointer id and then releases
it with a matching `pointerup`, because the map input guard treats a second press with an id it
still believes is down as a ghost press and stops it. Without the release, the first entry press
works and the next one is swallowed.

## Verification

- `Tools/modern-ui-behavior-tests.js` checks that the hub builds the expected application cards,
  skips the two hub-owned UI entries, dispatches the original File menu handler, and releases each
  synthetic pointer press so repeated opens reach the handler.
- `Tests/AgOpenWeb.Services.Tests/ModernUiRailFieldTests.cs` checks the markup, the runtime build
  from `.fo-btn`, the handler reuse and this inventory's coverage.
- This is a presentation change. It adds no host command and no wire field. Real tablet/WebView,
  PWA, two-browser and shaky-hand evidence is still outstanding.

## Open items

- The File menu itself is unchanged and still the fallback.
- If a future File menu entry needs a host-side guard (for example a destructive recovery action),
  record it in `Plans/MODERN_UI_HOST_CHANGES.md` rather than adding a second client path here.
