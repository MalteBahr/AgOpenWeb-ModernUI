// AgOpenWeb
// Copyright (C) 2024-2026 AgOpenWeb Contributors
// SPDX-License-Identifier: Apache-2.0

using System;
using System.Diagnostics;
using System.IO;

namespace AgOpenWeb.Services.Tests;

/// <summary>
/// Runs the Modern UI behavioral harness (<c>Tools/modern-ui-behavior-tests.js</c>) against the
/// real <c>wwwroot/js/ui-mode.js</c> and <c>wwwroot/js/modern-ui.js</c> in a Node <c>vm</c> with a
/// stub DOM. This is script-level behavior, not a browser, WebView or real-device test. It covers
/// Classic precedence/recovery and fork-only storage, the safe init/fallback path, the selectable
/// host-confirmed line list and active-line header (including contour, no-line and no-field
/// states), the field entry's delegation to the existing Fields and Jobs chain plus recent/nearby
/// chips that reuse only <c>field.openOnly</c> and a last-job Resume that reuses only
/// <c>field.resumeJob</c> (Field Operations to chooser navigation, typed-form preservation with a
/// visible reason, AutoSteer/section field-switch warning, and no other direct field/job command),
/// the host Auto Track toggle, the touch-sized lateral nudge through the existing commands, the
/// rail AutoSteer control and top-bar XTE readout, the large Settings hub built from the Classic
/// nav entries plus the File menu's settings, diagnostics and recovery cards (with the synthetic
/// pointer press/release that keeps repeated hub entries working), the line adjustment page that
/// hosts the one Classic Ref Nudge panel and mirrors its session, the Modern menu's confirmation
/// before closing a typed field form,
/// client-local edit/recording gating with its inline reason, host-projected boundary recording
/// (including paused), recorded path, pending ref nudge and non-zero Smooth changes blocking the
/// field entry and switch/reset for operator, no-operator and unknown seats, while only a
/// connected screen whose <c>lastControl</c> names a different holder is exempt; a clean Smooth
/// panel (count 0) and an auto-filled job date do not block, New AB line reasons from reliable
/// field/GPS signals only, the rail owning the cycle pair through <c>mod-rail-live</c> with the
/// Classic fallback restored when suspended, the <c>All lines</c> count label, the dedicated
/// concise status region (including a field-blocked reason), Modern menu Escape/focus return
/// without swallowing the map Escape path, generated English source coverage and policy-correct
/// optional German entries with English fallback, including the recheck after a confirmation,
/// observer behavior, the old AB flyout close before Tracks Manager/Quick AB, guidance-count
/// cache invalidation, cycling and observer gates, switch/reset guards and pointer isolation. If
/// Node.js is not on PATH the tests are skipped explicitly rather than failing unrelated CI; no
/// npm packages or network access are used.
/// </summary>
[TestFixture]
[Category("ModernUi")]
[NonParallelizable]
public class ModernUiBehaviorTests
{
    private const int HarnessTimeoutMs = 120_000;

    [TestCase("mode-precedence")]
    [TestCase("init-fallback")]
    [TestCase("rail-lines")]
    [TestCase("line-adjust")]
    [TestCase("settings")]
    [TestCase("map-controls")]
    [TestCase("cycle-gates")]
    [TestCase("switch-reset")]
    [TestCase("card-pane")]
    [TestCase("map-area")]
    [TestCase("input-isolation")]
    [TestCase("ui-scale")]
    public void ModernUiBehavior_GroupPasses(string group)
    {
        var node = FindNode();
        if (node is null)
        {
            Assert.Ignore(
                "Node.js was not found on PATH; the Modern UI behavioral harness is skipped. " +
                "Install Node.js or run Tools/modern-ui-behavior-tests.js directly.");
            return;
        }

        var harness = Path.Combine(RepoRoot(), "Tools", "modern-ui-behavior-tests.js");
        Assert.That(File.Exists(harness), Is.True, $"Missing Modern UI behavior harness: {harness}");

        var start = new ProcessStartInfo(node)
        {
            WorkingDirectory = RepoRoot(),
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };
        start.ArgumentList.Add(harness);
        start.ArgumentList.Add(group);

        using var process = Process.Start(start);
        Assert.That(process, Is.Not.Null, "Could not start the Modern UI behavior harness.");

        var stdoutTask = process!.StandardOutput.ReadToEndAsync();
        var stderrTask = process.StandardError.ReadToEndAsync();
        if (!process.WaitForExit(HarnessTimeoutMs))
        {
            try { process.Kill(entireProcessTree: true); } catch { /* best effort */ }
            Assert.Fail($"Modern UI behavior harness group '{group}' timed out after {HarnessTimeoutMs} ms.");
        }
        process.WaitForExit();

        var stdout = stdoutTask.GetAwaiter().GetResult();
        var stderr = stderrTask.GetAwaiter().GetResult();

        Assert.That(process.ExitCode, Is.Zero,
            $"Modern UI behavior group '{group}' failed.\n--- stdout ---\n{stdout}\n--- stderr ---\n{stderr}");
        Assert.That(stdout, Does.Contain($"PASS {group}/"),
            $"The harness did not run any tests for group '{group}'.\n--- stdout ---\n{stdout}");
        Assert.That(stdout, Does.Not.Contain("FAIL "),
            $"The harness reported a failure in group '{group}'.\n--- stdout ---\n{stdout}");
        Assert.That(stderr.Trim(), Is.Empty,
            $"The harness wrote to stderr in group '{group}'.\n--- stderr ---\n{stderr}");
    }

    private static string? FindNode()
    {
        foreach (var candidate in new[] { "node", "nodejs" })
        {
            try
            {
                var start = new ProcessStartInfo(candidate, "--version")
                {
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                };
                using var process = Process.Start(start);
                if (process is null) continue;
                process.StandardOutput.ReadToEnd();
                process.StandardError.ReadToEnd();
                if (process.WaitForExit(15_000) && process.ExitCode == 0) return candidate;
            }
            catch (Exception)
            {
                // Not installed under this name; try the next one.
            }
        }
        return null;
    }

    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "AgOpenWeb.sln")))
            dir = dir.Parent;
        Assert.That(dir, Is.Not.Null, "Could not locate the repository root (AgOpenWeb.sln) from the test base directory.");
        return dir!.FullName;
    }
}
