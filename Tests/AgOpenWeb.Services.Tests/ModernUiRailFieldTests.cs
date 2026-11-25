// AgOpenWeb
// Copyright (C) 2024-2026 AgOpenWeb Contributors
// SPDX-License-Identifier: Apache-2.0

using System;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;

namespace AgOpenWeb.Services.Tests;

/// <summary>
/// Source guard rails for the Modern rail: one-tap named-line selection through the existing
/// track.select command, a guarded entry into Fields and Jobs, and a recording takeover built
/// only from this browser's client-local AB/curve flow. Nearby field chips reuse the existing
/// field.openOnly command behind the local guard; the rail must not add another field command, a
/// second host recording command, or a host-confirmed recording claim. Browser/device behavior is
/// not covered here. Host changes that remain are listed in Plans/MODERN_UI_HOST_CHANGES.md.
/// </summary>
[TestFixture]
public class ModernUiRailFieldTests
{
    private static string Www() => Path.Combine(RepoRoot(), "Shared", "AgOpenWeb.RemoteServer", "wwwroot");

    private static string ReadWww(params string[] parts) =>
        File.ReadAllText(Path.Combine(new[] { Www() }.Concat(parts).ToArray())).Replace("\r\n", "\n");

    [Test]
    public void FieldSwitch_ReusesTheExistingFieldsAndJobsPanel_AndAddsNoFieldCommand()
    {
        var html = ReadWww("index.html");
        var src = ReadWww("js", "modern-ui.js");
        var css = ReadWww("css", "modern.css");

        Assert.That(html, Does.Contain("id=\"mod-field-switch\""),
            "The rail must offer the field entry as a labeled control.");
        Assert.That(html, Does.Contain("id=\"mod-field-switch\" class=\"mod-field-btn\""),
            "The current field's name is the chooser trigger.");
        Assert.That(html, Does.Contain("<span id=\"mod-field-name\">No field</span>"),
            "The field button shows the field name, not a separate chooser label.");
        Assert.That(html, Does.Contain("aria-controls=\"fieldsandjobs\""),
            "The rail entry must point at the existing Fields and Jobs panel.");
        Assert.That(src, Does.Contain("function modernOpenFields"),
            "The field entry must be a named, reviewable helper.");
        Assert.That(src, Does.Contain("openFieldsAndJobs()"),
            "The safe field entry is the existing Fields and Jobs chain panel.");
        Assert.That(src, Does.Contain("lnOpen('fieldops', 'ln-fieldops'"),
            "If the chain helper is unavailable, fall back to the existing Field Operations panel.");

        // This is a navigation shortcut: if the chooser is already open, leave its form alone;
        // if another field form has typed text, keep it; otherwise navigate to Fields and Jobs.
        var openStart = src.IndexOf("function modernOpenFields", StringComparison.Ordinal);
        Assert.That(openStart, Is.GreaterThanOrEqualTo(0));
        var openEnd = src.IndexOf("\n}", openStart, StringComparison.Ordinal);
        var openBody = src.Substring(openStart, openEnd - openStart);
        Assert.That(openBody, Does.Contain("if (modernFieldsAndJobsOpen()) return;"),
            "The already-open Fields and Jobs chooser must keep its form.");
        Assert.That(openBody, Does.Contain("if (modernFieldEntryBlocked()) return;"),
            "A typed field form must be blocked with a visible reason, not silently ignored.");
        Assert.That(openBody, Does.Contain("openFieldsAndJobs()"),
            "From Field Operations (or an empty form) the entry navigates to the existing chooser.");
        Assert.That(openBody, Does.Not.Contain("lnCloseAll()"),
            "The rail field entry must not close an open field form itself.");

        // The chooser itself still sends no field command. The nearby chips are the one direct
        // shortcut, and they reuse only the existing field.openOnly command behind the same guard;
        // they must not add delete/resume/start or any other field action.
        Assert.That(src, Does.Contain("transport.send('field.openOnly|' + name)"),
            "A nearby field chip opens the existing host field command.");
        Assert.That(src, Does.Contain("agopenweb.modernui.recentFields"),
            "The recent-field order is fork-local and validated against the host list.");
        Assert.That(src, Does.Contain("agopenweb.modernui.pinnedFields"),
            "Pinned fields are a separate fork-local list.");
        Assert.That(src, Does.Contain("function modernTogglePin"),
            "The pin control must be one named local-preference helper.");
        Assert.That(src, Does.Contain("transport.send('field.resumeJob|' + fieldName + '\\t' + taskName)"),
            "Resume reuses the existing field.resumeJob command, not a new path.");
        Assert.That(src, Does.Contain("Switch to field {name}?"),
            "Switching while AutoSteer/sections are on warns before stopping them.");
        var fieldCommands = Regex.Matches(src,
                @"transport\.send\(\s*['""](field\.[A-Za-z]+)")
            .Select(m => m.Groups[1].Value)
            .Distinct()
            .OrderBy(x => x)
            .ToArray();
        Assert.That(fieldCommands, Is.EqualTo(new[] { "field.openOnly", "field.resumeJob" }),
            "The rail may send only the existing field.openOnly and field.resumeJob commands; " +
            "field close/delete/start stay in the existing panels.");

        var fieldBtn = Regex.Match(css, @"\.mod-field-btn\s*\{([^}]*)\}").Groups[1].Value;
        Assert.That(fieldBtn, Does.Match(@"min-height:\s*48px"),
            "The field name stays a touch-sized target.");
        Assert.That(css, Does.Contain("#mod-field-switch.mod-field-btn.active"),
            "The open chooser still gets the active outline.");
    }

    [Test]
    public void FieldSwitch_IsGuardedByThisScreensLocalEditOrRecording()
    {
        var src = ReadWww("js", "modern-ui.js");
        var html = ReadWww("index.html");

        Assert.That(src, Does.Contain("if (modernFieldEntryBlocked()) return;"),
            "modernOpenFields must re-check the field guard, not rely on the disabled attribute.");
        Assert.That(src, Does.Contain("MODERN_EL.fieldSwitch.disabled = fieldBlocked"),
            "The visible field entry must be disabled while this screen is recording or editing.");
        Assert.That(src, Does.Contain("Finish or cancel the current edit or recording before switching fields."),
            "The operator's disabled state must state the reason inline.");
        Assert.That(src, Does.Contain("Observer: view only. Another screen may be recording or editing; the host rejects field actions."),
            "An observer must be told this is view-only, not asked to finish another screen's work.");
        Assert.That(src, Does.Contain("Reconnect to control this screen before switching fields; another screen may be recording or editing."),
            "A disconnected/unknown role must keep a conservative reconnect reason.");
        Assert.That(src, Does.Contain("This field form has unsaved text. Close or cancel it before choosing another field."),
            "A typed form must disable the entry with an inline reason, not be silently inert.");
        Assert.That(src, Does.Contain("if (modernTypedFieldFormBusy()) return true;"),
            "modernFieldEntryBlocked must include typed field forms.");
        Assert.That(src, Does.Not.Contain("Changing field can cancel unsaved work."),
            "The idle field warning text is removed from the rail.");
        Assert.That(src, Does.Contain("MODERN_EL.fieldNote.textContent = fieldBlocked"),
            "The blocked/observer reason still fills the note.");
        Assert.That(html, Does.Contain("id=\"mod-field-note\""),
            "The reason still has a visible place next to the field entry.");

        // Local work always blocks. Host-projected work blocks the operator; a paused boundary
        // still holds unsaved points, Ref Nudge pending is an actual move, and Smooth block only
        // starts at SmoothCount > 0 (the panel opens clean at 0).
        foreach (var known in new[] { "abFlow", "boundary", "recPath", "editSession" })
            Assert.That(src, Does.Contain(known),
                $"modernLocalFlowBusy must keep covering the client-local flow '{known}'.");
        foreach (var known in new[] { "boundary.isRecording || boundary.isPaused", "recPath.isRecording",
                     "op.refNudgePending", "op.smoothOpen && (op.smoothCount || 0) > 0" })
            Assert.That(src, Does.Contain(known),
                $"modernOperatorHostBusy must keep covering '{known}'.");
        Assert.That(src, Does.Contain("lastControl.held"),
            "No operator (lastControl.held false) must not be treated as an observer.");
        Assert.That(src, Does.Contain("lastControl.holderId !== myClientId"),
            "An observer needs a known holder that is a different client.");
        Assert.That(src, Does.Contain("!!myClientId && !!lastControl.holderId"),
            "A missing client id must keep the role unknown/conservative.");
    }

    [Test]
    public void ObserverHostFlow_DoesNotBlockRecoveryOrTheViewOnlyChooser()
    {
        var src = ReadWww("js", "modern-ui.js");

        Assert.That(src, Does.Contain("function modernIsObserverNow"),
            "Observer status must be explicit, not inferred from missing control alone.");
        Assert.That(src, Does.Contain("function modernFieldEntryBlocked"));
        Assert.That(src, Does.Contain("function modernSwitchResetFlowBusy"));
        Assert.That(src, Does.Contain("return !modernIsObserverNow() && modernOperatorHostBusy();"),
            "Both the field chooser and switch/reset must exclude a definite observer from host-flow blocks.");
        Assert.That(src, Does.Contain("Observer: view only. Another screen may be recording or editing; the host rejects field actions."),
            "An observer may open the panel and must see that the host rejects field actions.");
        Assert.That(src, Does.Contain("modernLocalFlowBusy()"),
            "Local unsaved flows must still block an observer's switch/reset.");

        // The field action guard and the switch/reset guard are separate helpers, so a future
        // change cannot accidentally lock observers out of recovery.
        Assert.That(src, Does.Contain("function modernFieldEntryBlocked"));
        Assert.That(src, Does.Contain("function modernSwitchResetFlowBusy"));
        Assert.That(src, Does.Not.Contain("function modernRecordingBusy"));
    }

    [Test]
    public void Rail_RecordingSurface_IsLocalAndReusesExistingActions()
    {
        var html = ReadWww("index.html");
        var src = ReadWww("js", "modern-ui.js");

        Assert.That(html, Does.Contain("id=\"mod-recording\""),
            "The rail must provide a recording takeover surface.");
        Assert.That(html, Does.Contain("This browser is recording. After a reconnect, check the map toolbar; the host may still be recording."),
            "The recording surface must not claim a host-confirmed state it cannot see.");
        Assert.That(src, Does.Contain("function modernRecordingState"),
            "The takeover must derive its state from the existing client-local flow.");
        Assert.That(src, Does.Contain("function modernRenderRecording"),
            "The takeover needs one named renderer.");
        Assert.That(src, Does.Contain("function modernRecordingConsequence"),
            "The card must state what Set Point and Cancel do.");
        Assert.That(src, Does.Contain("Elapsed {time}"),
            "The card may show local elapsed time while recording.");
        Assert.That(src, Does.Contain("function modernCancelRecording"),
            "Cancel needs one named helper for the discard guard.");
        Assert.That(src, Does.Contain("Discard this recording?"),
            "Cancel after captured data must ask before discarding.");
        Assert.That(src, Does.Contain("Keep recording"),
            "The safe default label must be Keep recording, not an ambiguous Cancel.");
        Assert.That(src, Does.Contain("abSetPoint()"),
            "The primary action must reuse the existing set-point action, not add a command.");
        Assert.That(src, Does.Contain("abCancel()"),
            "Cancel must reuse the existing cancel action, not add a command.");
        Assert.That(Regex.IsMatch(src, @"track\.(setABGps|drawCancel|finishCurve|recordCurve|aPlus|driveAB)"),
            Is.False, "The rail must not add a direct host recording command; qabStart/the existing flow owns it.");
        Assert.That(src, Does.Contain("typeof qabStart === 'function'"),
            "The record starts must use the shared Quick AB dispatcher and tolerate an older client.");
    }

    [Test]
    public void RailRenderKey_CoversTheTotalGuidanceCount()
    {
        var src = ReadWww("js", "modern-ui.js");
        var keyStart = src.IndexOf("const key = [", StringComparison.Ordinal);
        Assert.That(keyStart, Is.GreaterThanOrEqualTo(0), "renderModernUi must keep its rebuild key.");
        var keyEnd = src.IndexOf("].join('~');", keyStart, StringComparison.Ordinal);
        Assert.That(keyEnd, Is.GreaterThan(keyStart));
        var key = src.Substring(keyStart, keyEnd - keyStart);

        // The "Choose a line"/"All lines" label and the empty-state text depend on the total
        // guidance count, which visible.map(...) alone does not carry (hidden lines are absent).
        Assert.That(key, Does.Contain("guidance.length"),
            "The rail rebuild key must include the total guidance count, not only visible rows.");
        Assert.That(key, Does.Contain("visible.map("),
            "The key must still rebuild on visible row changes.");
    }

    [Test]
    public void AbEntries_CloseTheClassicFlyoutFirst()
    {
        var src = ReadWww("js", "modern-ui.js");
        Assert.That(src, Does.Contain("function modernCloseAbFlyout"));
        Assert.That(src, Does.Contain("if (typeof abFlyoutClose === 'function') abFlyoutClose();"),
            "The rail must reuse the Classic flyout close, and tolerate the stub harness without it.");

        static void AssertCloseBeforeOpen(string source, string functionName, string openCall)
        {
            var start = source.IndexOf("function " + functionName + "(", StringComparison.Ordinal);
            Assert.That(start, Is.GreaterThanOrEqualTo(0), functionName + " must exist.");
            var body = source.Substring(start);
            var closeAt = body.IndexOf("modernCloseAbFlyout();", StringComparison.Ordinal);
            var openAt = body.IndexOf(openCall, StringComparison.Ordinal);
            Assert.That(closeAt, Is.GreaterThanOrEqualTo(0), functionName + " must close the flyout.");
            Assert.That(openAt, Is.GreaterThan(closeAt),
                functionName + " must close the AB flyout before " + openCall + ".");
        }
        AssertCloseBeforeOpen(src, "modernOpenAllLines", "modernOpenAllLinesPanel()");
        AssertCloseBeforeOpen(src, "modernStartRecord", "qabStart(mode)");
        Assert.That(src, Does.Contain("openDialog('dlg-quickab')"),
            "An older client without qabStart must still fall back to the existing Quick AB hub.");
        // The old Tracks Manager is now only the fallback if the full-list column is missing.
        var panelStart = src.IndexOf("function modernOpenAllLinesPanel", StringComparison.Ordinal);
        Assert.That(panelStart, Is.GreaterThanOrEqualTo(0));
        var panelBody = src.Substring(panelStart, 800);
        Assert.That(panelBody, Does.Contain("openTracksManager()"),
            "A page without the full-list column still reaches the existing Tracks Manager.");
    }

    [Test]
    public void SwitchAndReset_UseTheSharedNonIdleGuardBeforeAndAfterConfirm()
    {
        var src = ReadWww("js", "modern-ui.js");

        var blockedStart = src.IndexOf("function modernSwitchBlocked", StringComparison.Ordinal);
        Assert.That(blockedStart, Is.GreaterThanOrEqualTo(0));
        var blockedEnd = src.IndexOf("\n}", blockedStart, StringComparison.Ordinal);
        var blockedBody = src.Substring(blockedStart, blockedEnd - blockedStart);
        Assert.That(blockedBody, Does.Contain("if (modernSwitchResetFlowBusy()) return true;"),
            "The switch/reset guard must use its own local+operator-host guard, not the field guard.");
        Assert.That(src, Does.Contain("if (modernTypedFieldFormBusy()) return true;"),
            "A typed field form is local unsaved input and must still block switch/reset.");
        Assert.That(src, Does.Contain("String(notes.value || '').trim()"),
            "Fields and Jobs notes/work type are local unsaved input.");
        Assert.That(src, Does.Contain("taskValue !== isoDate()"),
            "The auto-filled job date alone must not count as a typed form.");
        Assert.That(src, Does.Contain("Finish the current recording or edit, or close the open confirmation, before switching interfaces"),
            "The refusal must mention edits as well as recordings.");
        Assert.That(src, Does.Not.Contain("Finish the current recording or confirmation before switching interfaces"),
            "The old recording-only refusal must stay replaced.");

        foreach (var name in new[] { "modernSwitchPresentation", "modernResetPresentation" })
        {
            var start = src.IndexOf("function " + name, StringComparison.Ordinal);
            Assert.That(start, Is.GreaterThanOrEqualTo(0), name + " must exist.");
            var next = src.IndexOf("\nfunction ", start + 10, StringComparison.Ordinal);
            var body = src.Substring(start, next - start);
            var before = body.IndexOf("if (modernSwitchBlocked())", StringComparison.Ordinal);
            var confirm = body.IndexOf("showConfirm(", StringComparison.Ordinal);
            var after = body.IndexOf("if (modernSwitchBlocked(true))", StringComparison.Ordinal);
            Assert.That(before, Is.GreaterThanOrEqualTo(0), name + " must check before confirming.");
            Assert.That(confirm, Is.GreaterThan(before), name + " must confirm after the first check.");
            Assert.That(after, Is.GreaterThan(confirm), name + " must recheck inside its confirmation.");
        }
    }

    [Test]
    public void ModernMenu_WarnsBeforeClosingATypedFieldForm()
    {
        var src = ReadWww("js", "modern-ui.js");
        var start = src.IndexOf("function modernOpenMenu", StringComparison.Ordinal);
        Assert.That(start, Is.GreaterThanOrEqualTo(0));
        var end = src.IndexOf("\n}", start, StringComparison.Ordinal);
        var body = src.Substring(start, end - start);
        Assert.That(body, Does.Contain("modernTypedFieldFormBusy()"),
            "Opening the menu would otherwise close a typed field form before the switch guard runs.");
        Assert.That(body, Does.Contain("showConfirm("),
            "The Modern menu must warn and offer Cancel before discarding typed text.");
        Assert.That(body, Does.Contain("modernShowMenu"),
            "After the warning, the menu must still open through the existing chain.");
        Assert.That(src, Does.Contain("Opening the settings menu closes the open field form and its unsaved text. Cancel keeps the form open."),
            "The warning must say what is lost and that Cancel keeps the form.");
        Assert.That(src, Does.Contain("function modernShowMenu"),
            "The menu open/close logic stays one helper for both entry paths.");
    }

    [Test]
    public void ActiveLineHeader_UsesHostStateAndHandlesContour()
    {
        var html = ReadWww("index.html");
        var src = ReadWww("js", "modern-ui.js");

        Assert.That(html, Does.Contain("id=\"mod-active-line\""),
            "The rail must show the active line without scrolling the list.");
        Assert.That(src, Does.Contain("tick.activeTrackName"),
            "The active-line readout must come from the host's tick, not a local tap.");
        Assert.That(src, Does.Contain("contour ? tr('Contour guidance') : (activeName || tr('No active line'))"),
            "Contour guidance must not be shown as an active AB line.");
        Assert.That(src, Does.Contain("MODERN_EL.activeLine.setAttribute('translate', 'no')"),
            "A user-provided line name must not be treated as a translation key.");
    }

    [Test]
    public void NewAbLine_ExplainsFieldGpsAndSteeringBlocks_AndRechecksThem()
    {
        var src = ReadWww("js", "modern-ui.js");

        Assert.That(src, Does.Contain("function modernRecordState"));
        Assert.That(src, Does.Contain("function modernGpsMissing"));
        Assert.That(src, Does.Contain("statusBar.gpsLost"),
            "A lost GPS stream is a reliable host-projected signal.");
        Assert.That(src, Does.Contain("Number(statusBar.fixQuality) > 0"),
            "No fix quality means no position; with no status frame yet nothing is claimed.");
        Assert.That(src, Does.Contain("if (!statusBar) return false;"),
            "Do not invent a GPS state before the first status frame.");
        foreach (var reason in new[]
                 {
                     "Observer: view only",
                     "Open a field first: a new line is saved in a field.",
                     "No GPS fix: a new line needs a position.",
                     "Client view: AutoSteer is engaged, so starting a line is paused here. The host remains the authority.",
                 })
            Assert.That(src, Does.Contain(reason), "The disabled state must state its reason inline.");
        Assert.That(src, Does.Contain("MODERN_EL.recordLine.disabled = record.disabled"),
            "The visible A+ button follows the same record state.");
        Assert.That(src, Does.Contain("MODERN_EL.recordAb.disabled = record.disabled"),
            "The Drive A→B shortcut follows the same record state.");
        Assert.That(src, Does.Contain("MODERN_EL.recordCurve.disabled = record.disabled"),
            "The Curve shortcut follows the same record state.");
        Assert.That(src, Does.Contain("if (modernRecordState().disabled) return;"),
            "modernStartRecord must recheck, because a disabled button is only a visual gate.");
        Assert.That(src, Does.Not.Contain("gps ==="),
            "Only the host's own status fields may be used; do not invent a host state.");
    }

    [Test]
    public void LineListAction_ShowsTheHostGuidanceCount()
    {
        var src = ReadWww("js", "modern-ui.js");
        Assert.That(src, Does.Contain("tr('All lines ({n})', { n: guidance.length })"),
            "The line-list action names the host's total guidance-line count.");
        Assert.That(src, Does.Contain("guidance.length"),
            "The count is the total guidance lines, not only the visible rows.");
        Assert.That(src, Does.Contain(": tr('All lines');"),
            "An empty list keeps the plain label (the manager explains the empty state).");
    }

    [Test]
    public void Rail_NudgeControls_AreTouchSized_AndAutoTrackMovesIntoTheRail()
    {
        var html = ReadWww("index.html");
        var src = ReadWww("js", "modern-ui.js");
        var css = ReadWww("css", "modern.css");

        foreach (var id in new[] { "mod-nudge-left", "mod-nudge-right", "mod-nudge-value",
                     "mod-auto-track", "mod-steer", "mod-xte", "mod-xte-value" })
            Assert.That(html, Does.Contain($"id=\"{id}\""), $"The rail/top bar must expose {id}.");
        foreach (var command in new[] { "track.nudgeLeft", "track.nudgeRight", "track.autoTrack",
                     "autosteer.toggle" })
            Assert.That(src, Does.Contain(command),
                $"The rail must reuse the existing {command} command, not a new path.");
        Assert.That(src, Does.Not.Contain("track.halfNudgeLeft"));
        Assert.That(src, Does.Not.Contain("track.halfNudgeRight"));
        Assert.That(src, Does.Not.Contain("track.resetNudge"),
            "The rail must not offer an accidental one-tap nudge reset.");
        Assert.That(html, Does.Contain("aria-label=\"Nudge line left by the snap distance\""));
        Assert.That(html, Does.Contain("aria-label=\"Nudge line right by the snap distance\""));
        Assert.That(css, Does.Match(@"\.mod-nudge-btn\s*\{[^}]*width:\s*64px;[^}]*height:\s*64px;"),
            "Nudge buttons must be large touch targets for a moving tractor.");
        Assert.That(css, Does.Match(@"\.mod-nudge-value\s*\{[^}]*min-height:\s*64px;"),
            "The read-only nudge value must match the control height.");
        Assert.That(css, Does.Match(@"\.mod-auto\s*\{[^}]*min-width:\s*56px;[^}]*min-height:\s*56px;"),
            "The Auto control is a primary touch target.");
        Assert.That(css, Does.Match(@"\.mod-start\s*\{[^}]*min-height:\s*56px;"),
            "Record starts are primary touch targets.");
        Assert.That(src, Does.Contain("tick.tools.autoTrack"),
            "The Auto control must come from the host Tick's tools frame, not a local guess.");
        Assert.That(html, Does.Contain("Auto track: pick the closest track"),
            "The Auto control must say what it does.");
        Assert.That(html, Does.Contain("id=\"rn-autotrack\""),
            "The Classic Auto track control must stay in the markup for fallback.");
        Assert.That(html, Does.Contain("id=\"rn-steer\""),
            "The Classic AutoSteer control must stay in the markup for fallback.");
        Assert.That(css, Does.Contain(".mod-rail-live #rn-autotrack"));
        Assert.That(css, Does.Contain(".mod-rail-live #rn-steer"),
            "Modern must own AutoSteer only while the rail is actually visible.");
        Assert.That(src, Does.Not.Contain("track.autoTrack|"),
            "Do not invent an auto-track command; use the existing one.");
        Assert.That(css, Does.Contain("right: calc(var(--map-r) + 8px);"),
            "Settings panels must stop short of the right rail.");
        Assert.That(css, Does.Contain(".ln-scrim.open { right: var(--map-r); }"),
            "The scrim must leave the rail usable while settings are open.");
        Assert.That(css, Does.Contain("#mod-xte"),
            "The top bar must keep the cross-track error visible in Modern.");
    }

    [Test]
    public void SettingsHub_CoversTheClassicLeftNav_AndKeepsTheClassicFallback()
    {
        var html = ReadWww("index.html");
        var src = ReadWww("js", "modern-ui.js");
        var css = ReadWww("css", "modern.css");

        foreach (var id in new[] { "modern-settings", "mod-settings-grid", "mod-settings-apps",
                     "mod-settings-app-section", "mod-settings-close",
                     "mod-settings-switch", "mod-settings-reset" })
            Assert.That(html, Does.Contain($"id=\"{id}\""), $"The hub must expose {id}.");
        foreach (var id in new[] { "ln-filemenu", "ln-screenalerts", "ln-tools", "ln-vehicle",
                     "ln-autosteer", "ln-fieldops", "ln-fieldtools", "ln-web", "ln-network" })
            Assert.That(html, Does.Contain($"id=\"{id}\""),
                "Every Classic left-nav entry must remain in the markup for the hub and fallback.");
        Assert.That(css, Does.Contain("position: absolute; visibility: hidden; pointer-events: none;"),
            "Modern removes the icon rail visually and from focus while keeping it for the hub.");
        Assert.That(css, Does.Contain("html[data-ui=\"modern\"][data-ui-init=\"modern\"] #leftnav > .ln-btn"),
            "The hidden icon rail is scoped to a successfully initialized Modern page.");
        Assert.That(src, Does.Contain("nav.querySelectorAll('.ln-btn')"),
            "The hub must be built from the existing nav buttons, not a copied panel list.");
        Assert.That(src, Does.Contain("function modernOpenSettings"),
            "The hub needs one open helper.");
        Assert.That(src, Does.Contain("function modernCloseSettings"),
            "The hub needs one close helper.");
        Assert.That(src, Does.Contain("function modernDispatchPointer"),
            "An entry must reuse the existing nav pointerdown handler.");
        Assert.That(src, Does.Contain("function modernBuildAppSettings"),
            "The File menu settings, diagnostics and recovery entries need one named builder.");
        Assert.That(src, Does.Contain("menu.querySelectorAll('.fo-btn')"),
            "Application entries must be built from the existing File menu buttons.");
        Assert.That(src, Does.Contain("MODERN_FILE_MENU_SKIP = new Set(['fm-ui-switch', 'fm-ui-reset'])"),
            "The hub owns the UI switch and reset, so those File menu entries are not duplicated.");
        Assert.That(src, Does.Contain("pointerId"),
            "The synthetic hand-off needs its own pointer id so the map ghost guard cannot swallow it.");
        Assert.That(src, Does.Contain("make('pointerup'"),
            "The synthetic hand-off must release its pointer id after pressing the existing handler.");
        Assert.That(src, Does.Not.Contain("lnOpen('language'"),
            "The hub must not copy the existing panel handlers.");
        Assert.That(src, Does.Not.Contain("lnOpen('screenalerts'"),
            "The hub must not copy the existing panel handlers.");
    }

    [Test]
    public void FileMenuParity_InventoryCoversEveryEntry_AndTheHubSkipsItsOwnUiEntries()
    {
        var html = ReadWww("index.html");
        var src = ReadWww("js", "modern-ui.js");
        var doc = File.ReadAllText(Path.Combine(RepoRoot(), "Plans", "MODERN_UI_FILE_MENU_PARITY.md"));

        foreach (var id in new[] { "fm-language", "fm-reset", "fm-ui-switch", "fm-ui-reset",
                     "fm-appsettings", "fm-viewsettings", "fm-logviewer", "fm-hotkeys",
                     "fm-simulator", "fm-help", "fm-about", "fm-bugreport" })
        {
            Assert.That(html, Does.Contain($"id=\"{id}\""),
                $"The File menu entry {id} must stay in the markup as the source of truth.");
            Assert.That(doc, Does.Contain($"`{id}`"),
                $"The parity inventory must record {id}.");
        }

        Assert.That(doc, Does.Contain("## Entry activation"),
            "The inventory must explain how a hub card reaches the existing File menu handler.");
        Assert.That(doc, Does.Contain("fresh synthetic pointer id"),
            "The inventory must record why the hand-off releases its pointer press.");
        Assert.That(src, Does.Contain("MODERN_FILE_MENU_SKIP"),
            "The hub must not duplicate its own UI switch and reset.");
    }

    [Test]
    public void NewStrings_AreInTheGeneratedEnglishSource_AndHtmlHasNoDuplicateIds()
    {
        var en = ReadWww("i18n", "en.json");
        foreach (var key in new[]
                 {
                     "Active line",
                     "Active line: {name}",
                     "All lines ({n})",
                     "Contour guidance",
                     "No GPS fix: a new line needs a position.",
                     "Open a field first: a new line is saved in a field.",
                     "{n} lines",
                     "Finish or cancel the current edit or recording before switching fields.",
                     "Observer: view only. Another screen may be recording or editing; the host rejects field actions.",
                     "Reconnect to control this screen before switching fields; another screen may be recording or editing.",
                     "This field form has unsaved text. Close or cancel it before choosing another field.",
                     "Settings",
                     "Settings and application menu",
                     "Classic remains the default.",
                     "Navigation",
                     "Application & Recovery",
                     "Close settings",
                     "Open the settings menu?",
                     "Opening the settings menu closes the open field form and its unsaved text. Cancel keeps the form open.",
                     "Finish the current recording or edit, or close the open confirmation, before switching interfaces",
                     "Change line while AutoSteer is engaged?",
                     "This activates the line without disengaging AutoSteer. Previous/Next stop guidance first. Continue?",
                     "Record new",
                     "A+ here",
                     "Drive A→B",
                     "Curve",
                     "Recording",
                     "Drive A to B",
                     "Water pivot",
                     "Set Point A",
                     "Set Point B",
                     "Cancel recording",
                     "No points yet",
                     "{n} point",
                     "{n} points",
                     "Recording {mode} in {field}: {step}",
                     "This browser is recording. After a reconnect, check the map toolbar; the host may still be recording.",
                     "Client view: AutoSteer is engaged, so starting a line is paused here. The host remains the authority.",
                     "Recent and nearby fields",
                     "Open field {name}",
                     "Open field {name} ({distance} away)",
                     "Jobs…",
                     "Resume",
                     "Pin field",
                     "Unpin field",
                     "Auto",
                     "Auto track",
                     "Auto track: pick the closest track",
                     "Line nudge",
                     "Nudge line left by the snap distance",
                     "Nudge line right by the snap distance",
                     "Nudge offset: {value}",
                     "Cross-track error",
                     "XTE",
                     "AutoSteer: {state}. Tap to change.",
                     "Switch to field {name}?",
                     "The current field closes and AutoSteer and the sections are turned off. Continue?",
                     "Stay",
                     "Switch field",
                     "Elapsed {time}",
                     "Discard this recording?",
                     "The captured points will be discarded and no line will be saved. Keep recording to continue.",
                     "Keep recording",
                     "Discard recording",
                     "Start begins recording. Cancel saves nothing.",
                     "Set Point A starts the line. Cancel saves nothing.",
                     "Finish completes the line and makes it active. Cancel discards the recording.",
                     "Set Point B completes the line and makes it active. Cancel discards the recording.",
                     "Adjust line",
                     "Line adjustment",
                     "Moves the saved line. Save keeps it; Undo puts it back.",
                     "Close line adjustment",
                     "Observer: view only. Another screen holds control, so the host rejects line changes.",
                     "Open a field first. A line belongs to a field.",
                     "Smooth Curve is open. Finish or cancel it, then adjust the line.",
                     "Contour guidance cannot be adjusted. Choose a saved AB line.",
                     "No active line. Choose a line, then adjust it.",
                     "Moved {value} — not saved yet. Save keeps it; Undo puts it back.",
                     "Moves the saved line itself, not the guidance offset. Save keeps the move; Undo puts it back.",
                     "Snap to pivot",
                     "Line options",
                     "AB line options",
                     "Smooth curve",
                     "Delete contours",
                     "Extend A",
                     "Extend B",
                     "Shorten A",
                     "Shorten B",
                     "Half width left",
                     "Half width right",
                     "Pass left",
                     "Pass right",
                     "Observer: view only. Line options need control.",
                     "Contour guidance has no AB line options.",
                     "Choose a line to use these options.",
                     "Auto sections",
                     "Manual sections",
                     "Auto U-turn",
                     "ISOBUS section control",
                     "Contour lock",
                     "Locked",
                     "Unlocked",
                     "No implement",
                     "{name}: {state}. Tap to change.",
                     "Roll",
                     "Heading up",
                     "North up",
                     "Map view",
                     "Center view",
                     "Camera mode: {mode}. Tap to change.",
                 })
        {
            Assert.That(en, Does.Contain("\"" + key + "\": \"" + key + "\""),
                $"The generated English source must contain '{key}'.");
        }

        var html = ReadWww("index.html");
        var duplicateIds = Regex.Matches(html, "\\bid=\"([^\"]+)\"")
            .Select(m => m.Groups[1].Value)
            .GroupBy(id => id)
            .Where(g => g.Count() > 1)
            .Select(g => g.Key)
            .ToArray();
        Assert.That(duplicateIds, Is.Empty,
            "index.html must not gain duplicate element IDs: " + string.Join(", ", duplicateIds));
    }

    [Test]
    public void RailLineWindow_IsConstantAndNeverScrolls()
    {
        var css = ReadWww("css", "modern.css");
        var list = Regex.Match(css, @"\.mod-lines\s*\{([^}]*)\}").Groups[1].Value;
        Assert.That(list, Does.Contain("flex: 0 0 auto"),
            "The four-row window does not give way to the rail's other controls.");
        Assert.That(list, Does.Contain("overflow: visible"),
            "The window itself never scrolls.");
        Assert.That(list, Does.Not.Contain("overflow-y"));
        Assert.That(list, Does.Not.Contain("min-height: 120px"),
            "The old scrollable-list height must not creep back in.");
        Assert.That(css, Does.Contain(".mod-lines.mod-empty-list { min-height: 0; }"),
            "An empty window is the one-line message, not a reserved block.");
        Assert.That(css, Does.Contain(".mod-surface"),
            "The normal and recording surfaces must be separate flex columns.");
        Assert.That(css, Does.Match(@"#modern-rail\s*\{[^}]*overflow-y:\s*auto"),
            "The rail is the one outer scroll container when the content is tall.");
    }

    [Test]
    public void HiddenElementsInsideTheRail_StayHidden()
    {
        var css = ReadWww("css", "modern.css");
        Assert.That(css, Does.Match(@"\.mod-job\s*\{[^}]*display:\s*flex"),
            "The job row is a flex layout, which would otherwise override the hidden attribute.");
        Assert.That(css, Does.Contain("#modern-rail [hidden] { display: none; }"),
            "Layout rules such as .mod-job set display, so an explicit descendant rule is needed " +
            "for the hidden attribute to keep working.");
    }

    [Test]
    public void LineAdjustmentPage_HostsTheOneRefNudgePanel_AndReusesItsHandlers()
    {
        var html = ReadWww("index.html");
        var src = ReadWww("js", "modern-ui.js");
        var css = ReadWww("css", "modern.css");
        var hud = ReadWww("css", "map-hud.css");

        foreach (var id in new[]
                 {
                     "mod-line-adjust", "mod-lineadjust", "mod-la-close", "mod-la-host",
                     "mod-la-name", "mod-la-field", "mod-la-empty", "mod-la-empty-text",
                     "mod-la-all-lines", "mod-la-note",
                 })
            Assert.That(html, Does.Contain($"id=\"{id}\""), $"The line adjustment page must expose {id}.");

        Assert.That(html, Does.Match(@"id=""mod-line-adjust""[^>]*aria-controls=""mod-lineadjust"""),
            "The rail cog must point at the page it opens.");
        Assert.That(html, Does.Match(@"id=""mod-lineadjust"" class=""ln-panel"),
            "The page uses the shared panel stacking, not an ad-hoc fixed layer.");

        // One panel, one session, one command path.
        Assert.That(src, Does.Contain("function modernHostRefPanel"),
            "The page must move the existing Ref Nudge panel, not rebuild it.");
        Assert.That(src, Does.Contain("host.appendChild(panel)"),
            "The one Classic panel is the page's content.");
        Assert.That(src, Does.Contain("function modernRestoreRefPanel"),
            "The panel must return for Classic and for a suspended rail.");
        Assert.That(src, Does.Contain("typeof openRefNudge === 'function'"),
            "Opening the page reuses the Classic session entry instead of sending a second Begin.");
        Assert.That(src, Does.Contain("modernDispatchPointer(document.getElementById('rf-exit'))"),
            "Closing the page reuses the Classic pending-move confirmation and Save.");
        Assert.That(src, Does.Contain("if (modernLineAdjustOpen() || modernRefSessionOpen())"),
            "Opening the hub must defer to the page's own guarded close.");
        Assert.That(src, Does.Contain("modernSyncLineAdjust();"),
            "The page mirrors the session from the one frame loop.");
        Assert.That(src, Does.Contain("MODERN_EL.lineAdjust.contains(active)"),
            "Closing the page returns focus to the cog instead of leaving it on a hidden control.");
        Assert.That(src, Does.Not.Contain("transport.send('track.refNudge"),
            "The page must not copy any Ref Nudge command; the panel's handlers own them.");
        Assert.That(src, Does.Not.Contain("track.refNudgeLeft"),
            "The page must not re-implement the move buttons.");
        Assert.That(src, Does.Not.Contain("Reference Line Nudge"),
            "The page must not copy the pending-move dialog.");

        var panelIds = Regex.Matches(html, "\\bid=\"(refnudge|rf-step|rf-save|rf-undo|rf-exit)\"")
            .Select(m => m.Groups[1].Value).ToArray();
        Assert.That(panelIds, Is.EquivalentTo(new[] { "refnudge", "rf-step", "rf-save", "rf-undo", "rf-exit" }),
            "The Ref Nudge controls must exist exactly once in the markup.");

        Assert.That(Regex.Matches(html, "class=\"rf-lab\"").Count, Is.EqualTo(7),
            "Every Ref Nudge button gets a visible label for the large page.");

        // Touch policy and a full-map layout that still leaves the rail usable.
        var hostedButtons = Regex.Match(css, @"#mod-lineadjust #refnudge \.rf-btn\s*\{([^}]*)\}").Groups[1].Value;
        Assert.That(hostedButtons, Does.Match(@"width:\s*104px; height:\s*104px"),
            "The moved controls grow on the page; they are not left at the Classic 84 px.");
        var pageRule = Regex.Match(css,
            @"html\[data-ui=""modern""\]\[data-ui-init=""modern""\] #mod-lineadjust\.open\s*\{([^}]*)\}").Groups[1].Value;
        Assert.That(pageRule, Does.Contain("right: calc(var(--map-r) + 8px);"),
            "The page covers the map and stops at the rail, so the rail stays usable.");
        Assert.That(pageRule, Does.Contain("display: flex;"),
            "The page is a column, not the default panel block flow.");
        Assert.That(hud, Does.Contain(".rf-lab { display: none; }"),
            "Classic keeps the bare icon buttons; the label is a Modern page affordance.");
        Assert.That(css, Does.Contain("#mod-lineadjust #refnudge .rf-lab"),
            "The Modern page shows the button labels.");
    }

    [Test]
    public void BottomBarLineControls_MoveToThePageAndRail_WithoutCopyingCommands()
    {
        var html = ReadWww("index.html");
        var src = ReadWww("js", "modern-ui.js");
        var css = ReadWww("css", "modern.css");

        foreach (var id in new[] { "mod-snap-pivot", "mod-la-options", "mod-la-options-note",
                     "bn-smooth", "bn-delcontours", "bn-extend-a", "bn-extend-b",
                     "bn-shorten-a", "bn-shorten-b", "bn-half-left", "bn-half-right",
                     "bn-pass-left", "bn-pass-right" })
            Assert.That(html, Does.Contain($"id=\"{id}\""), $"The bottom-bar rework must expose {id}.");

        // The originals stay in the Classic flyout and are the source of truth.
        Assert.That(src, Does.Contain("const MODERN_LINE_OPTION_DEFS"),
            "The page's line options need one named list.");
        Assert.That(src, Does.Contain("modernDispatchPointer(src)"),
            "Each page option hands its press to the original bottom-bar button.");
        Assert.That(src, Does.Contain("track.snapPivot"),
            "Snap to pivot reuses the existing command in the rail.");
        foreach (var cmd in new[]
                 {
                     "track.extendA", "track.extendB", "track.shrinkA", "track.shrinkB",
                     "track.halfNudgeLeft", "track.halfNudgeRight",
                     "track.snapLeft", "track.snapRight",
                     "track.smoothBegin", "track.deleteContours",
                 })
            Assert.That(src, Does.Not.Contain($"transport.send('{cmd}"),
                $"The page must not copy {cmd}; the bottom-bar button owns it.");

        // The Modern bottom bar gives these up only while the rail is live.
        Assert.That(css, Does.Contain(
            "html[data-ui=\"modern\"][data-ui-init=\"modern\"].mod-rail-live #bottomnav { display: none !important; }"),
            "The whole Classic bottom bar leaves Modern while the rail is on screen; Classic keeps it.");

        var option = Regex.Match(css, @"\.mod-la-option\s*\{([^}]*)\}").Groups[1].Value;
        Assert.That(option, Does.Match(@"min-height:\s*56px"),
            "The labeled line options keep the 56 px touch target.");
        Assert.That(css, Does.Contain(".mod-la-options {\n  display: grid;"),
            "The options are a grid, not a dense icon row.");
    }

    [Test]
    public void GuidanceSettingsAndOnMapControls_ReuseHostStateAndTheOriginalButtons()
    {
        var html = ReadWww("index.html");
        var src = ReadWww("js", "modern-ui.js");
        var css = ReadWww("css", "modern.css");

        foreach (var id in new[]
                 {
                     "mod-set-tram", "mod-set-skipmode", "mod-set-skiprows", "mod-set-colors",
                     "mod-set-map-flags", "mod-set-map-headland", "mod-set-map-sections",
                     "mod-set-map-contour", "mod-set-map-sections-auto", "mod-set-map-sections-manual",
                     "mod-set-map-youturn", "mod-set-map-isobus", "mod-set-map-contourlock",
                     "mod-set-mode-trailing", "mod-set-mode-always", "mod-set-mode-never",
                     "mod-map-controls", "mod-map-flags", "mod-map-headland",
                     "mod-map-headland-state", "mod-map-sections", "mod-map-sections-state",
                     "mod-map-toolheading", "bn-reset-heading",
                     "mod-map-controls-right", "mod-map-contour", "mod-map-contour-ic",
                     "mod-map-contour-state", "mod-map-sections-auto", "mod-map-sections-manual",
                     "mod-map-youturn", "mod-map-isobus", "mod-map-contourlock",
                 })
            Assert.That(html, Does.Contain($"id=\"{id}\""), $"The bottom-bar rework must expose {id}.");

        // Guidance rows reuse the cycle-only host commands, with the host state in the label.
        Assert.That(src, Does.Contain("transport.send('tram.cycle')"), "Tram lines reuses tram.cycle.");
        Assert.That(src, Does.Contain("transport.send('youturn.skipToggle')"),
            "U-Turn skip mode reuses youturn.skipToggle.");
        Assert.That(src, Does.Contain("transport.send('youturn.skipCycle')"),
            "U-Turn skip rows reuses youturn.skipCycle.");
        Assert.That(src, Does.Contain("cfgSend('tool.singleCoverageColor'"),
            "A mapping-colour swatch writes the same config key as the Classic button.");
        Assert.That(src, Does.Contain("agopenweb.modernui.mapControls"),
            "The on-map choice needs its own fork-local key.");

        // The cluster dispatches the original bar buttons; it must not copy their commands.
        Assert.That(src, Does.Contain("modernDispatchPointer(document.getElementById('bn-headland'))"),
            "Headland hands the press to the classic button.");
        Assert.That(src, Does.Contain("modernDispatchPointer(document.getElementById('bn-secheadland'))"),
            "Sections in headland hands the press to the classic button.");
        Assert.That(src, Does.Contain("modernDispatchPointer(document.getElementById('bn-reset-heading'))"),
            "Reset tool heading hands the press to the classic button.");
        Assert.That(src, Does.Not.Contain("transport.send('headland."),
            "The cluster must not copy the headland commands.");
        Assert.That(src, Does.Not.Contain("transport.send('tool.resetHeading')"),
            "The cluster must not copy the reset-tool-heading command.");
        Assert.That(src, Does.Contain("modernDispatchPointer(document.getElementById(srcId))"),
            "The guidance cluster hands each press to the Classic right-nav button.");
        foreach (var id in new[]
                 {
                     "rn-contour", "rn-auto", "rn-manual", "rn-youturn",
                     "rn-isobus", "rn-contourlock",
                 })
            Assert.That(src, Does.Contain($"'{id}'"),
                $"The guidance cluster must reference the Classic {id} button.");
        foreach (var cmd in new[]
                 {
                     "contour.toggle", "contour.lock", "section.manual", "section.master",
                     "youturn.toggle", "isobus.sectionControl",
                 })
            Assert.That(src, Does.Not.Contain($"transport.send('{cmd}')"),
                $"The guidance cluster must not copy {cmd}.");

        // One flags flyout, moved in and back; nothing is rebuilt.
        Assert.That(src, Does.Contain("function modernHostFlagFlyout"),
            "The one Classic flags flyout is hosted by the cluster.");
        Assert.That(src, Does.Contain("function modernRestoreFlagFlyout"),
            "The flyout returns when the rail steps aside or Classic is shown.");
        Assert.That(src, Does.Contain("modernSyncMapControls"),
            "The move is driven from the one frame loop.");
        Assert.That(html, Does.Contain("id=\"bn-flyout-flags\""),
            "The Classic flags flyout must stay in the markup as the source of truth.");

        var mapButton = Regex.Match(css, @"\.mod-map-btn\s*\{([^}]*)\}").Groups[1].Value;
        Assert.That(mapButton, Does.Match(@"min-height:\s*56px"),
            "The on-map controls keep the 56 px touch target.");
        var swatch = Regex.Match(css, @"\.mod-set-swatch\s*\{([^}]*)\}").Groups[1].Value;
        Assert.That(swatch, Does.Match(@"width:\s*48px; height:\s*48px"),
            "The swatches are secondary targets at 48 px.");
        Assert.That(css, Does.Contain("#mod-map-controls #bn-flyout-flags"),
            "The moved flags flyout is anchored to the cluster.");
        Assert.That(css, Does.Contain(".mod-map-controls[hidden] { display: none; }"),
            "The cluster's flex display must not defeat the hidden attribute.");
        Assert.That(css, Does.Contain(
            "html[data-ui=\"modern\"][data-ui-init=\"modern\"].mod-rail-live #bottomnav { display: none !important; }"),
            "The Classic bottom bar is removed in Modern only while the rail is live.");
        Assert.That(css, Does.Contain(
            "html[data-ui=\"modern\"][data-ui-init=\"modern\"].mod-rail-live #rightnav {"),
            "The Classic right nav is replaced in Modern while the rail is live.");
        Assert.That(Regex.IsMatch(css,
                @"\.mod-rail-live #lowerright \{[\s\S]*?top: calc\(var\(--bar-bottom\) \+ 10px\);[\s\S]*?bottom: auto;"),
            Is.True, "The roll gauge and camera pad take the top-right corner in Modern.");
        Assert.That(css, Does.Contain(
            "html[data-ui=\"modern\"][data-ui-init=\"modern\"].mod-rail-live #uturn-indicator {\n  position: static; top: auto; right: auto;"),
            "The auto U-turn panel is a stack item in Modern, not a fixed overlay.");
        Assert.That(src, Does.Contain("function modernHostUturnIndicator"),
            "The auto U-turn panel is moved into the top-left stack, not duplicated.");
        Assert.That(src, Does.Contain("host.appendChild(ind)"),
            "The direction switch sits at the bottom of the U-turn/Lateral stack.");
        Assert.That(src, Does.Contain("function modernRestoreUturnIndicator"),
            "Classic and a suspended rail get the original top-right indicator back.");
        Assert.That(css, Does.Contain(".mod-map-controls-right { left: auto; right: calc(8px + var(--sar)); }"),
            "The guidance cluster sits bottom-right, mirroring the field cluster.");
    }

    [Test]
    public void OnScreenTurnControlsAndClock_UseTheModernPanelLanguage()
    {
        var html = ReadWww("index.html");
        var css = ReadWww("css", "modern.css");
        var hud = ReadWww("css", "map-hud.css");

        // The labels are in the shared markup; Classic hides them so the bare glyphs stay.
        Assert.That(Regex.Matches(html, "class=\"osb-label\"").Count, Is.EqualTo(2),
            "Both on-screen rows get a title: U-turn and Lateral.");
        Assert.That(html, Does.Contain("class=\"uti-title\""),
            "The auto U-turn indicator gets a title in the same language.");
        Assert.That(hud, Does.Contain(".osb-label { display: none; }"),
            "Classic keeps the bare AgOpenGPS glyphs.");
        Assert.That(hud, Does.Contain(".uti-title { display: none; }"),
            "Classic keeps the bare indicator.");

        // The commands and handlers are untouched: only the presentation changes.
        Assert.That(html, Does.Contain("data-cmd=\"youturn.manualLeft\""));
        Assert.That(html, Does.Contain("data-cmd=\"youturn.manualRight\""));
        Assert.That(html, Does.Contain("data-cmd=\"track.snapLeft\""));
        Assert.That(html, Does.Contain("data-cmd=\"track.snapRight\""));

        // Modern: panel + title, and the clock leaves the bottom-right corner.
        Assert.That(css, Does.Contain(".mod-rail-live #onscreenbtns .osb-label"),
            "The row titles show in Modern.");
        Assert.That(css, Does.Contain(".mod-rail-live #onscreenbtns .osb-row:not([hidden])"),
            "The panel rule must not defeat the rows' hidden attribute.");
        Assert.That(css, Does.Contain(".mod-rail-live .uti-title"),
            "The auto U-turn indicator title shows in Modern.");
        Assert.That(css, Does.Contain(
            "html[data-ui=\"modern\"][data-ui-init=\"modern\"] #clock { display: none; }"),
            "The clock is removed from Modern.");
        Assert.That(ReadWww("css", "map-side.css"), Does.Contain("#clock { position: fixed;"),
            "Classic keeps its clock.");
    }

    [Test]
    public void RollInTheTopBarAndModernCameraPad_KeepTheClassicLayout()
    {
        var html = ReadWww("index.html");
        var css = ReadWww("css", "modern.css");
        var side = ReadWww("css", "map-side.css");
        var bar = ReadWww("css", "map-hud.css");
        var hud = ReadWww("js", "hud-tools.js");

        // Roll: a modern-only top-bar readout; the gauge markup stays for Classic.
        foreach (var id in new[] { "sb-roll-wrap", "sb-roll", "campad", "rollgauge" })
            Assert.That(html, Does.Contain($"id=\"{id}\""), $"The instrument area must expose {id}.");
        Assert.That(html, Does.Contain("class=\"sb-rolllabel\""));
        Assert.That(bar, Does.Contain(".sb-roll-wrap { display: none;"),
            "Classic keeps its gauge and hides the top-bar roll readout.");
        Assert.That(css, Does.Contain(
            "html[data-ui=\"modern\"][data-ui-init=\"modern\"] #rollgauge { display: none; }"),
            "Modern shows roll in the top bar instead of the gauge.");
        Assert.That(css, Does.Contain(
            "html[data-ui=\"modern\"][data-ui-init=\"modern\"] .sb-roll-wrap { display: flex; }"),
            "The modern top-bar roll readout is visible.");
        Assert.That(hud, Does.Contain("document.getElementById('sb-roll')"),
            "The top-bar roll readout uses the same tick.roll frame as the gauge.");

        // Camera pad: the compact classic cross, no labels or text, only a modern button surface.
        Assert.That(side, Does.Contain("#campad { display: grid; grid-template-columns: 44px 44px 44px;"),
            "The Classic cross pad stays the base layout.");
        Assert.That(html, Does.Not.Contain("class=\"cp-word\""),
            "The camera pad has no text labels.");
        Assert.That(html, Does.Not.Contain("class=\"cp-title\""),
            "The camera pad has no panel title.");
        Assert.That(html, Does.Not.Contain("id=\"rollpanel\""),
            "The roll panel wrapper is gone.");

        var pad = Regex.Match(css, @"\.mod-rail-live #campad \{([\s\S]*?)\}").Groups[1].Value;
        Assert.That(pad, Does.Contain("grid-template-columns: repeat(3, 48px);"),
            "Modern keeps the cross shape, with a slightly larger target.");
        Assert.That(pad, Does.Not.Contain("grid-template-areas"),
            "No label rows on the pad.");
        var padBtn = Regex.Match(css, @"\.mod-rail-live #campad button \{([^}]*)\}").Groups[1].Value;
        Assert.That(padBtn, Does.Contain("border: 1px solid var(--border-2);"));
        Assert.That(padBtn, Does.Contain("border-radius: 8px;"));
        Assert.That(padBtn, Does.Contain("background: rgba(var(--ov),0.08);"));
        Assert.That(padBtn, Does.Not.Contain("font:"),
            "The pad buttons stay glyph-only; no text styling is needed.");

        Assert.That(hud, Does.Contain("function camModeName"),
            "The mode button still announces its word state for screen readers.");
        Assert.That(hud, Does.Contain("Camera mode: {mode}. Tap to change."));
    }

    [Test]
    public void CompactRailHead_OrderAndConstantLineWindow_AndAutoSteerLast()
    {
        var html = ReadWww("index.html");
        var src = ReadWww("js", "modern-ui.js");
        var css = ReadWww("css", "modern.css");

        var headStart = html.IndexOf("id=\"mod-rail-head\"", StringComparison.Ordinal);
        var headEnd = html.IndexOf("id=\"mod-observer\"", StringComparison.Ordinal);
        Assert.That(headStart, Is.GreaterThan(0));
        Assert.That(headEnd, Is.GreaterThan(headStart));
        var head = html.Substring(headStart, headEnd - headStart);

        var fieldAt = head.IndexOf("id=\"mod-field-switch\"", StringComparison.Ordinal);
        var chipsAt = head.IndexOf("id=\"mod-field-chips\"", StringComparison.Ordinal);
        var jobAt = head.IndexOf("id=\"mod-field-job\"", StringComparison.Ordinal);
        Assert.That(fieldAt, Is.GreaterThanOrEqualTo(0), "the field row comes first");
        Assert.That(chipsAt, Is.GreaterThan(fieldAt), "the field chips follow the field");
        Assert.That(jobAt, Is.GreaterThan(chipsAt), "the job row follows the chips");

        Assert.That(head, Does.Not.Contain("id=\"mod-job-label\""),
            "No FIELD/LAST JOB descriptor; the value speaks for itself.");
        Assert.That(head, Does.Not.Contain("mod-rail-headline"),
            "The old AB lines title row is gone.");
        Assert.That(head, Does.Not.Contain("mod-active-row"),
            "The active line is a list row now, not a header row.");
        Assert.That(html, Does.Contain("id=\"mod-lines-title\" class=\"mod-sr-only\""),
            "The list keeps an accessible name without the visible title row.");

        // The one active-row node carries the name, type, Adjust and Auto; it is moved into the list.
        var slotStart = html.IndexOf("id=\"mod-active-slot\"", StringComparison.Ordinal);
        var slotEnd = html.IndexOf("id=\"mod-all-lines\"", StringComparison.Ordinal);
        Assert.That(slotStart, Is.GreaterThan(0));
        Assert.That(slotEnd, Is.GreaterThan(slotStart));
        var slot = html.Substring(slotStart, slotEnd - slotStart);
        foreach (var id in new[] { "mod-active-line", "mod-active-type", "mod-line-adjust", "mod-auto-track" })
            Assert.That(slot, Does.Contain($"id=\"{id}\""), $"The active row must carry {id}.");
        Assert.That(slot, Does.Contain("class=\"mod-line mod-line-active active\""),
            "The active row uses the list-row surface.");

        // The list is above the cycle buttons and below All lines; it is a fixed four-row window.
        var allLinesAt = html.IndexOf("id=\"mod-all-lines\"", StringComparison.Ordinal);
        var listAt = html.IndexOf("id=\"mod-rail-list\"", StringComparison.Ordinal);
        var prevAt = html.IndexOf("id=\"mod-prev\"", StringComparison.Ordinal);
        Assert.That(allLinesAt, Is.GreaterThan(0));
        Assert.That(listAt, Is.GreaterThan(allLinesAt), "All lines sits above the line window.");
        Assert.That(prevAt, Is.GreaterThan(listAt), "Previous/Next stay below the window.");
        Assert.That(src, Does.Contain("for (const off of [-1, 0, 1, 2])"),
            "The window is previous, active, next and next-next.");
        Assert.That(src, Does.Contain("MODERN_EL.activeSlot"),
            "The active row is moved in, not rebuilt.");
        Assert.That(src, Does.Contain("MODERN_EL.activeSlot.children"),
            "The active row's index is stamped for the row tests and assistive tech.");

        Assert.That(src, Does.Contain("function modernJobEntry"),
            "The active job's work type comes from the existing job list.");
        Assert.That(src, Does.Contain("activeJobEntry.workType"));
        Assert.That(src, Does.Contain("lastJob.workType"),
            "Both the active and last job rows show the work type, not the task date.");
        Assert.That(src, Does.Contain("guidance.find(t => t.name === activeName)"),
            "The active line type is matched from the host scene by name.");

        var recordAt = html.IndexOf("id=\"mod-record-curve\"", StringComparison.Ordinal);
        var steerAt = html.IndexOf("id=\"mod-steer\"", StringComparison.Ordinal);
        var recordingAt = html.IndexOf("id=\"mod-recording\"", StringComparison.Ordinal);
        var dockAt = html.IndexOf("class=\"mod-steer-dock\"", StringComparison.Ordinal);
        var footAt = html.IndexOf("class=\"mod-foot\"", StringComparison.Ordinal);
        Assert.That(recordAt, Is.GreaterThan(0));
        Assert.That(steerAt, Is.GreaterThan(recordAt), "AutoSteer sits below the record starts.");
        Assert.That(dockAt, Is.GreaterThan(recordingAt), "AutoSteer is outside both replaceable surfaces.");
        Assert.That(footAt, Is.LessThan(0), "The rail ends with AutoSteer; no preview footnote below it.");

        var pin = Regex.Match(css, @"\.mod-pin\s*\{([^}]*)\}").Groups[1].Value;
        Assert.That(pin, Does.Contain("width: 40px; height: 40px;"),
            "The favourite star is the smaller preference control.");
        var jobBtn = Regex.Match(css, @"\.mod-job-btn\s*\{([^}]*)\}").Groups[1].Value;
        Assert.That(jobBtn, Does.Match(@"min-height:\s*40px"),
            "The Resume/Jobs button is compact.");
        var rowBtn = Regex.Match(css, @"\.mod-row-btn\s*\{([^}]*)\}").Groups[1].Value;
        Assert.That(rowBtn, Does.Contain("width: 48px; height: 48px;"),
            "Adjust line is a compact button inside the active row.");
    }

    [Test]
    public void AllLinesPanel_IsAFullHeightScrollableColumn_AndKeepsTheMapInset()
    {
        var html = ReadWww("index.html");
        var src = ReadWww("js", "modern-ui.js");
        var css = ReadWww("css", "modern.css");

        foreach (var id in new[] { "mod-all-lines-panel", "mod-all-lines-list", "mod-all-lines-close", "mod-all-lines-count" })
            Assert.That(html, Does.Contain($"id=\"{id}\""), $"The All lines column must expose {id}.");
        Assert.That(html, Does.Contain("aria-controls=\"mod-all-lines-panel\""),
            "The All lines button names the column it toggles.");

        Assert.That(css, Does.Contain("position: fixed; top: 0; right: 300px; bottom: 0; width: 300px;"),
            "The column runs top to bottom, immediately left of the rail.");
        Assert.That(css, Does.Contain("padding: calc(var(--bar-bottom) + 8px) 10px"),
            "Its header clears the measured status bar and the GPS-quality indicator.");
        Assert.That(css, Does.Contain("#mod-all-lines-panel[hidden] { display: none; }"));
        Assert.That(Regex.Match(css, @"#mod-all-lines-list \{([^}]*)\}").Groups[1].Value,
            Does.Contain("overflow-y: auto"), "The full list itself scrolls.");
        Assert.That(css, Does.Contain("#mod-all-lines-panel { right: 260px; width: 260px; }"),
            "The column matches the narrower rail at small widths.");

        Assert.That(src, Does.Contain("function modernAllLinesShown"));
        Assert.That(src, Does.Contain("function modernRenderAllLines"));
        Assert.That(src, Does.Contain("modernLineRow(Object.assign({}, t, { active: isActive(t) }), true)"),
            "The full list reuses the rail row and marks hidden lines.");
        Assert.That(src, Does.Contain("tr('Hidden')"), "A hidden guidance line is labelled.");
        Assert.That(src, Does.Contain("setMapArea(0, modernAllLinesShown() ? w * 2 : w)"),
            "Opening the column moves the map inset (and the on-screen controls) by its width.");
        Assert.That(src, Does.Contain("modernCloseAllLines(true)"),
            "The close button and Escape close it.");
        Assert.That(src, Does.Contain("if (suspended) modernCloseAllLines(false)"),
            "A suspended rail (card pane) does not leave the column floating.");
    }

    [Test]
    public void LineWindowMove_IsASmallAnimation_AndHonoursReducedMotion()
    {
        var src = ReadWww("js", "modern-ui.js");
        var css = ReadWww("css", "modern.css");

        Assert.That(src, Does.Contain("function modernCaptureLineRows"));
        Assert.That(src, Does.Contain("function modernAnimateLineRows"));
        Assert.That(src, Does.Contain("prefers-reduced-motion: reduce"),
            "The window move is skipped for reduced-motion users.");
        Assert.That(src, Does.Contain("requestAnimationFrame"),
            "The rows are released on the next frame so the transition runs.");
        Assert.That(src, Does.Contain("translateY(' + delta.toFixed(1) + 'px)"),
            "Rows start at their old offset and glide to the new one.");
        Assert.That(src, Does.Contain("modernAnimateLineRows(lineRowsBefore)"),
            "The list build captures positions before the rebuild and animates after it.");

        var list = Regex.Match(css, @"\.mod-lines\s*\{([^}]*)\}").Groups[1].Value;
        Assert.That(list, Does.Contain("background: rgba(var(--ov), 0.045)"),
            "A soft inset sets the list apart without a hard border.");
        Assert.That(list, Does.Not.Contain("border:"),
            "No major border around the list.");
        Assert.That(css, Does.Contain(".mod-line-hidden { opacity: 0.68; }"));
    }

    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null && !File.Exists(Path.Combine(dir.FullName, "AgOpenWeb.sln")))
            dir = dir.Parent;
        Assert.That(dir, Is.Not.Null, "Could not locate repo root (AgOpenWeb.sln) from test base dir.");
        return dir!.FullName;
    }
}
