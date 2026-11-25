// AgOpenWeb
// Copyright (C) 2024-2026 AgOpenWeb Contributors
// SPDX-License-Identifier: Apache-2.0

using System;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;

namespace AgOpenWeb.Services.Tests;

/// <summary>
/// Guard rails for the opt-in Modern presentation (the right AB-line rail and labeled left
/// menu). Classic must stay the default and recoverable without modern.css, the Modern shell
/// must reuse existing commands instead of inventing a second control path, and the whole
/// layer must stay presentation-only. These are source-regression checks. Browser-level behavior
/// (overlap, gestures, keyboard, scaling, switch/reset guards) was checked with author-run headless
/// Chromium sessions against the simulator, not by a committed scenario harness; these tests pin
/// the source structure that supports those checks.
/// </summary>
[TestFixture]
public class ModernUiPresentationTests
{
    private static string Www() => Path.Combine(RepoRoot(), "Shared", "AgOpenWeb.RemoteServer", "wwwroot");

    private static string ReadWww(params string[] parts) =>
        File.ReadAllText(Path.Combine(new[] { Www() }.Concat(parts).ToArray()));

    [Test]
    public void ModernUi_IsOptIn_ClassicIsDefault_AndRecoveryIsDocumentedInCode()
    {
        var html = ReadWww("index.html");
        var mode = ReadWww("js", "ui-mode.js");
        var modern = ReadWww("js", "modern-ui.js");
        var baseCss = ReadWww("css", "base.css");

        // The presentation is chosen before the body paints, and before the client starts.
        Assert.That(html, Does.Contain("<script src=\"/js/ui-mode.js\"></script>"),
            "index.html must load js/ui-mode.js in the head so the presentation is set before the body paints.");
        Assert.That(html.IndexOf("/js/ui-mode.js", StringComparison.Ordinal),
            Is.LessThan(html.IndexOf("/js/core.js", StringComparison.Ordinal)),
            "ui-mode.js must load before the client scripts.");
        Assert.That(html, Does.Contain("href=\"/css/modern.css\""),
            "index.html must load css/modern.css (the Modern rules are scoped there).");

        // Precedence: explicit URL, then this browser's saved choice, then Classic.
        Assert.That(mode, Does.Contain("const CLASSIC = 'classic'"));
        Assert.That(mode, Does.Contain("const MODERN = 'modern'"));
        Assert.That(mode, Does.Contain("new URLSearchParams(location.search).get('ui')"));
        Assert.That(mode, Does.Contain("asked || storedMode() || CLASSIC"),
            "The resolved presentation must fall back to Classic, not Modern.");
        Assert.That(mode, Does.Contain("agopenweb.modernui.presentation"),
            "The fork's presentation preference uses the reserved agopenweb.modernui.* namespace.");
        Assert.That(mode, Does.Contain("localStorage"),
            "The choice is remembered per browser, not as machine state.");

        // The baseline stylesheet hides the shell, so a missing modern.css cannot expose it in
        // Classic. The Modern elements also start hidden as a no-script fallback.
        Assert.That(baseCss, Does.Match(@"#modern-rail,\s*#mod-menu\s*\{\s*display:\s*none;"),
            "base.css must hide the Modern shell unless modern.css successfully shows it.");
        Assert.That(html, Does.Match(@"<aside id=""modern-rail""[^>]*\bhidden\b"));
        Assert.That(html, Does.Match(@"<button id=""mod-menu""[^>]*\bhidden\b"));

        // A failed Modern script must not leave a half-built shell: init is a two-stage gate
        // (data-ui-init for CSS, data-ui-ready only after the map-area sync), and ui-mode.js
        // falls back to Classic on timeout.
        Assert.That(modern, Does.Contain("data-ui-init"));
        Assert.That(modern, Does.Contain("modernMenuShown"));
        var start = modern.Substring(modern.IndexOf("function modernStart", StringComparison.Ordinal));
        var syncAt = start.IndexOf("syncModernMapArea();", StringComparison.Ordinal);
        var readyAt = start.IndexOf("markReady", syncAt, StringComparison.Ordinal);
        Assert.That(syncAt, Is.GreaterThan(0), "modernStart must sync the map area.");
        Assert.That(readyAt, Is.GreaterThan(syncAt),
            "the map-area sync must run before markReady reports a successful init.");
        Assert.That(mode, Does.Contain("data-ui-ready"));
        Assert.That(mode, Does.Contain("setTimeout"), "The unresolved Modern start must time out to Classic.");
        Assert.That(ReadWww("js", "frame.js"), Does.Contain("typeof renderModernUi === 'function'"));

        // Reset is a no-op only when reliably determinable (Classic, no ui query, readable and
        // absent storage); otherwise it keeps the warning/reload path.
        Assert.That(mode, Does.Contain("function storedRaw"));
        Assert.That(mode, Does.Contain("isResetNoop"));
        Assert.That(modern, Does.Contain("isResetNoop"));
        var resetStart = modern.Substring(modern.IndexOf("function modernResetPresentation", StringComparison.Ordinal));
        Assert.That(resetStart.IndexOf("isResetNoop", StringComparison.Ordinal),
            Is.LessThan(resetStart.IndexOf("modernSwitchBlocked()", StringComparison.Ordinal)),
            "Reset must skip the reload for a reliable no-op before it asks for confirmation.");

        // Both modes expose the switch and the reset; the recovery URL is in the head comment.
        Assert.That(html, Does.Contain("id=\"fm-ui-switch\""));
        Assert.That(html, Does.Contain("id=\"fm-ui-reset\""));
        Assert.That(html, Does.Contain("?ui=classic"));
    }

    [Test]
    public void ModernShell_SelectsThroughTrackSelect_AndDelegatesCycling()
    {
        var src = ReadWww("js", "modern-ui.js");
        Assert.That(src, Does.Contain("transport.send('track.select|' + t.index)"),
            "A line row selects through the existing track.select command.");
        Assert.That(src, Does.Contain("function modernSelectLine"),
            "The select handler must be one named, reviewable helper.");
        Assert.That(src, Does.Contain("Change line while AutoSteer is engaged?"),
            "The non-disengaging select must ask first while AutoSteer is engaged.");
        Assert.That(src, Does.Contain("Previous/Next stop guidance first."),
            "The confirmation must explain the safer cycle alternative.");
        Assert.That(src, Does.Contain("'track.cycleBack'"),
            "Previous line must use the existing track.cycleBack command.");
        Assert.That(src, Does.Contain("openTracksManager()"),
            "The Tracks Manager remains the fallback if the full-list column is missing.");
        Assert.That(src, Does.Contain("function modernCycleAvailable"));
        Assert.That(src, Does.Not.Contain("Cycling a line may stop guidance."),
            "The idle cycling hint is removed; only the disabled reasons remain.");
        Assert.That(src, Does.Contain("Two visible lines are needed to cycle."),
            "The disabled cycling reason is still explained.");

        // A line row is a real button inside a listitem wrapper; the active marker still comes
        // only from the host scene list.
        Assert.That(src, Does.Contain("function modernLineRow"));
        Assert.That(src, Does.Contain("document.createElement('button')"));
        Assert.That(src, Does.Contain("modernActivate(row, () => modernSelectLine(t))"));
        Assert.That(src, Does.Contain("if (t.active) return;"),
            "Tapping the active row must not send a redundant select.");
        Assert.That(src, Does.Contain("showConfirm(tr('Change line while AutoSteer is engaged?')"));

        // One renderer/loop: the existing frame loop calls it, and it early-outs in Classic.
        Assert.That(ReadWww("js", "frame.js"), Does.Contain("renderModernUi();"));
        Assert.That(src, Does.Contain("if (!isModernUi() || !MODERN_EL.rail || !MODERN_EL.list) return;"));
        Assert.That(src, Does.Contain("t.active"),
            "The active marker must come from host state (scene.trackList), not a local tap.");
        Assert.That(Regex.IsMatch(src, @"tick\.op\.autoSteer"),
            "Record availability and the line-change confirmation use the latest AutoSteer snapshot.");
        Assert.That(src, Does.Contain("not an atomic host interlock"),
            "The local AutoSteer check must be documented as a client snapshot, not a host interlock.");
        Assert.That(src, Does.Contain("Contour guidance is active"),
            "Contour mode must not offer a line change that does not turn contour off.");
        Assert.That(src, Does.Contain("MODERN_NON_GUIDANCE"),
            "Path and Contour entries are not guidance lines and must not appear as AB choices.");
        Assert.That(src, Does.Contain("name.translate = false"),
            "A user-provided line name must not be treated as a translation key.");
        Assert.That(src, Does.Contain("modernCardPaneOpen"),
            "The rail must step aside while the card pane owns the right edge.");

        // Keyboard activation and map-gesture isolation are part of the shell.
        Assert.That(src, Does.Contain("function modernActivate"));
        Assert.That(src, Does.Contain("e.detail === 0"), "A keyboard click must activate once, not twice.");
        Assert.That(src, Does.Contain("addEventListener('keydown'"),
            "Space must reach the focused button, not the simulator's Stop hotkey.");
        Assert.That(src, Does.Contain("MODERN_EL.rail.addEventListener('pointerdown'"),
            "A rail press must not reach the window map gesture.");
        Assert.That(src, Does.Contain("MODERN_EL.rail.addEventListener('wheel'"),
            "A rail wheel must not zoom the map.");
        Assert.That(src, Does.Contain("zoomRect(MODERN_EL.rail)"),
            "The rail width must use zoomRect for older WebKit's zoomed rects.");

        // Switch and reset share the same generic guard; reset rechecks after its confirmation.
        Assert.That(src, Does.Contain("function modernSwitchBlocked"));
        Assert.That(src, Does.Contain("ignoreConfirm"));
        Assert.That(src, Does.Contain("document.getElementById('dialoghost')"));
        Assert.That(Regex.Matches(src, @"if \(modernSwitchBlocked\(\)\)").Count, Is.GreaterThanOrEqualTo(2),
            "Both switch and reset must refuse while a recording/dialog is already open.");
        Assert.That(Regex.Matches(src, @"if \(modernSwitchBlocked\(true\)\)").Count, Is.GreaterThanOrEqualTo(2),
            "Both confirm callbacks must recheck before reloading.");
        Assert.That(src, Does.Not.Contain("Turn AutoSteer off to change the line"),
            "Do not claim a toast from a disabled button; the visible lock note is the explanation.");
    }

    [Test]
    public void ModernCss_CannotOverlayPanelsOrChangeClassic()
    {
        var css = ReadWww("css", "modern.css");
        var panels = ReadWww("css", "panels.css");

        // The rail must sit below the light-dismiss scrim, which is below panels and dialogs.
        var rail = Regex.Match(css, @"#modern-rail\s*\{([^}]*display:\s*none;[^}]*)\}").Groups[1].Value;
        Assert.That(rail, Does.Match(@"z-index:\s*29"),
            "The rail must be below .ln-scrim (30) so a panel/scrim blocks it.");
        Assert.That(panels, Does.Match(@"\.ln-scrim\s*\{[^}]*z-index:\s*30"));
        Assert.That(panels, Does.Match(@"\.ln-panel\s*\{[^}]*z-index:\s*31"));
        Assert.That(rail, Does.Contain("overflow-y: auto"),
            "The rail must scroll at a large UI scale so its record controls stay reachable.");

        // The layout rules are gated on a successful init; the un-gated base rules only define
        // the Modern elements themselves, which base.css keeps hidden by default.
        Assert.That(css, Does.Contain("html[data-ui=\"modern\"][data-ui-init=\"modern\"] #modern-rail"));
        Assert.That(css, Does.Contain("html[data-ui=\"modern\"][data-ui-init=\"modern\"] #mod-menu"));
        Assert.That(css, Does.Contain("html[data-ui=\"modern\"][data-ui-init=\"modern\"] #ln-filemenu { display: none; }"),
            "Modern has one labeled menu entry; the Classic icon entry is hidden there.");
        Assert.That(css, Does.Contain("#modern-rail {\n  display: none;"),
            "The rail must be hidden in Classic (the default).");
        Assert.That(css, Does.Contain("#mod-menu {\n  display: none;"),
            "The labeled Modern menu entry must be hidden in Classic.");
        Assert.That(css, Does.Contain("#mod-menu.active"),
            "The Modern menu entry must show when its panel chain is open.");
    }

    [Test]
    public void RailIsTheOneVisibleCyclePair_ClassicFallbackStaysForSuspensionAndClassic()
    {
        var src = ReadWww("js", "modern-ui.js");
        var css = ReadWww("css", "modern.css");
        var html = ReadWww("index.html");

        // The Classic right-nav fallback is not removed: its markup and wiring stay untouched.
        Assert.That(html, Does.Contain("id=\"rn-cycle\""));
        Assert.That(html, Does.Contain("id=\"rn-cycleback\""));
        Assert.That(src, Does.Contain("function syncModernClassicCycleFallback"));

        // Only while the rail is actually shown is the duplicate pair hidden, gated on the
        // successful-init marker and the live class.
        Assert.That(css, Does.Contain("html[data-ui=\"modern\"][data-ui-init=\"modern\"].mod-rail-live #rn-cycle"));
        Assert.That(css, Does.Contain("html[data-ui=\"modern\"][data-ui-init=\"modern\"].mod-rail-live #rn-cycleback"));
        var hide = Regex.Match(css,
            @"\.mod-rail-live #rn-cycle,[\s\S]*?\.mod-rail-live #rn-steer\s*\{\s*display:\s*none\s*!important;");
        Assert.That(hide.Success, Is.True,
            "renderRightNav writes inline display values, so the modern-only hide must outrank them.");
        Assert.That(src, Does.Contain("const live = isModernUi() && !modernRailSuspended && modernRailShown();"),
            "The rail's cycle pair is hidden only while the rail is actually on screen.");
        Assert.That(src, Does.Contain("document.documentElement.classList.toggle('mod-rail-live', live)"),
            "The class is added and removed with the rail's visibility, so suspension restores Classic's pair.");
        Assert.That(src, Does.Contain("syncModernClassicCycleFallback(); // Classic keeps its right-nav cycle pair"),
            "A failed Modern init must also restore the Classic cycle pair.");
    }

    [Test]
    public void Cycling_MatchesTheHostRule_AndAutoTrackStaysReachable()
    {
        var src = ReadWww("js", "modern-ui.js");
        var css = ReadWww("css", "modern.css");
        var start = src.IndexOf("function modernCycleAvailable", StringComparison.Ordinal);
        var end = src.IndexOf("\n}", start, StringComparison.Ordinal);
        var body = src.Substring(start, end - start);
        Assert.That(body, Does.Not.Contain("!!activeName"),
            "The host's CycleTrack selects the first visible guidance track when none is active; " +
            "requiring an active line would disable a cycle the host can perform safely.");
        Assert.That(body, Does.Contain("guidance.length > 1"),
            "Two or more visible guidance lines are the documented host capability.");
        Assert.That(src, Does.Not.Contain("if (!activeName) return tr('No active line');"),
            "No active line is not a cycle refusal; the host picks the first visible line.");

        // The rail owns the cycle pair and Auto track while it is visible; the Classic markup and
        // wiring stay, and both return when the rail is suspended or the page is Classic.
        Assert.That(css, Does.Contain(".mod-rail-live #rn-autotrack"),
            "The Classic Auto track control is hidden only while the rail owns it.");
        Assert.That(css, Does.Contain(".mod-rail-live #rn-cycleback"));
        Assert.That(Regex.IsMatch(css,
                @"\.mod-rail-live #rn-cycle,[\s\S]*?display:\s*none\s*!important;"),
            Is.True, "The Classic cycle pair and Auto track share the rail-live hide rule.");
        Assert.That(ReadWww("index.html"), Does.Contain("id=\"rn-autotrack\""),
            "The Classic Auto track control must remain in the markup for fallback.");
    }

    [Test]
    public void RailLineList_IsNotALiveRegion_AndUsesADedicatedStatus()
    {
        var html = ReadWww("index.html");
        var src = ReadWww("js", "modern-ui.js");
        var railStart = html.IndexOf("id=\"modern-rail\"", StringComparison.Ordinal);
        var railEnd = html.IndexOf("</aside>", railStart, StringComparison.Ordinal);
        var rail = html.Substring(railStart, railEnd - railStart);
        var listTag = Regex.Match(rail, @"<div id=""mod-rail-list""[^>]*>").Value;

        Assert.That(listTag, Does.Not.Contain("aria-live="),
            "A rebuilt list must not be a live region: every row would be re-read on each change.");
        Assert.That(listTag, Does.Contain("role=\"list\""),
            "The selectable rows need list semantics for a screen reader.");
        Assert.That(listTag, Does.Not.Contain("tabindex=\"0\""),
            "The line window no longer scrolls, so the list itself is not a focus stop; " +
            "its rows are real buttons.");
        Assert.That(listTag, Does.Contain("aria-labelledby=\"mod-lines-title\""),
            "The list is named by the visible rail heading.");

        var statusTag = Regex.Match(rail, @"<div id=""mod-status""[^>]*>").Value;
        Assert.That(statusTag, Does.Contain("role=\"status\""),
            "A small dedicated status region announces the state change.");
        Assert.That(statusTag, Does.Contain("aria-live=\"polite\""));
        Assert.That(statusTag, Does.Contain("aria-atomic=\"true\""),
            "The whole short summary is announced, not fragments.");
        Assert.That(src, Does.Contain("function modernAnnounce(summary)"));
        Assert.That(src, Does.Contain("summary === modernStatusLast"),
            "The status text is only rewritten when the summarized state actually changes.");
        Assert.That(src, Does.Contain("item.setAttribute('role', 'listitem')"),
            "Each selectable row is wrapped in a list item, with a real button inside.");
        Assert.That(ReadWww("css", "modern.css"), Does.Contain(".mod-status"),
            "The status region is visually hidden without leaving the accessibility tree.");

        // The field entry's own note is no longer live, so its disabled reason is announced here.
        Assert.That(src, Does.Contain("fieldReason"));
        Assert.That(src, Does.Contain("Field entry blocked: {reason}"),
            "A disabled field entry must state its reason in the dedicated status region too.");
    }

    [Test]
    public void ModernMenu_EscapeClosesTheChainAndReturnsFocus()
    {
        var src = ReadWww("js", "modern-ui.js");

        Assert.That(src, Does.Contain("if (e.key !== 'Escape' || e.defaultPrevented || !isModernUi()) return;"),
            "Escape handling must be Modern-only and must not take an already-handled key.");
        Assert.That(src, Does.Contain("classicEntry.classList.contains('active')"),
            "Escape closes the File/Application Menu chain only while that chain is open.");
        Assert.That(src, Does.Contain("function modernEscapeOwnedElsewhere"));
        foreach (var owner in new[]
                 {
                     "wizard && !wizard.closed", "hostPrompt && hostPrompt.kind", "isTyping()",
                     "abFlow", "hlFlow", "editSession", "satBnd", "mapTap",
                     "'dlg-unsavedcov', 'hostprompt', 'dialoghost'",
                 })
            Assert.That(src, Does.Contain(owner),
                $"A dialog/prompt/wizard, typing or an active map/drawing flow must keep Escape: {owner}.");
        Assert.That(src, Does.Contain("if (modernEscapeOwnedElsewhere()) return;"),
            "The menu must not close behind an open dialog or an active drawing flow.");
        Assert.That(src, Does.Contain("lnCloseAll();"),
            "The chain is closed through the existing left-nav helper.");
        Assert.That(src, Does.Contain("modernSyncMenuState(true)"),
            "The labeled Menu's expanded/active state is refreshed after Escape.");
        Assert.That(src, Does.Contain("MODERN_EL.menu.focus()"),
            "Focus returns to the labeled Menu trigger.");
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
