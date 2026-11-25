// AgOpenWeb
// Copyright (C) 2024-2026 AgOpenWeb Contributors
// SPDX-License-Identifier: Apache-2.0

using System;
using System.IO;
using System.Linq;

namespace AgOpenWeb.Services.Tests;

/// <summary>
/// The UI Size setting keeps its manual host presets and adds a per-browser Auto choice.
/// Auto must fit the existing 1280x720 layout box without shrinking the 56 px touch targets,
/// and the host's persisted size must not overwrite it on every config frame. These are
/// source-regression checks for that wiring; the preset choice itself was exercised in a
/// headless Chromium session.
/// </summary>
[TestFixture]
public class DisplayUiScaleTests
{
    private static string ReadWww(params string[] parts)
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null && !File.Exists(Path.Combine(dir.FullName, "AgOpenWeb.sln")))
            dir = dir.Parent;
        Assert.That(dir, Is.Not.Null, "Could not locate repo root (AgOpenWeb.sln) from test base dir.");
        return File.ReadAllText(Path.Combine(new[] { dir!.FullName, "Shared", "AgOpenWeb.RemoteServer", "wwwroot" }
            .Concat(parts).ToArray()));
    }

    [Test]
    public void AutoUiSize_IsOfferedAndStaysPerBrowser()
    {
        var html = ReadWww("index.html");
        var setup = ReadWww("js", "skia-setup.js");
        var settings = ReadWww("js", "settings-panels.js");
        var core = ReadWww("js", "core.js");

        Assert.That(html, Does.Contain("data-scale=\"auto\""),
            "Screen & Alerts must offer Auto beside the manual presets.");
        Assert.That(html, Does.Contain("sa-uiscale5"),
            "The five buttons need their own column count; the card-layout row must not change.");
        Assert.That(setup, Does.Contain("const UI_SCALE_PRESETS = [100, 115, 130, 150]"),
            "Auto picks from the host-supported presets rather than inventing zoom levels.");
        Assert.That(setup, Does.Contain("function railFitPct"),
            "Modern Auto must measure the live rail instead of using a fixed resolution table.");
        Assert.That(setup, Does.Contain("railNaturalHeight"),
            "The fit comes from the rail's real content height.");
        Assert.That(setup, Does.Contain("fullLineWindowHeight"),
            "A one-line field must not inflate Auto; the window is measured at four rows.");
        Assert.That(setup, Does.Contain("function designBoxUiScale"),
            "Classic (no rail) keeps a documented fallback rather than guessing.");
        Assert.That(setup, Does.Contain("localStorage.getItem(UI_SCALE_AUTO_KEY)"),
            "Auto belongs to this display/browser, not to the host's shared setting.");
        Assert.That(setup, Does.Contain("addEventListener('resize'"),
            "A rotation or resize must re-pick the preset.");
        Assert.That(ReadWww("js", "modern-ui.js"), Does.Contain("refreshAutoUiScale()"),
            "A rail content change must re-measure Auto, not wait for a reload.");
        Assert.That(settings, Does.Contain("setUiScaleAuto(true)"),
            "The Auto button must apply the fit immediately.");
        Assert.That(settings, Does.Contain("setUiScaleManual(+b.dataset.scale)"),
            "A preset click must leave Auto mode and apply the chosen size.");
        Assert.That(core, Does.Contain("applyConfiguredUiScale"),
            "Config frames must go through the Auto-aware entry point.");
        Assert.That(core, Does.Not.Contain("applyUiScale(c && c.display"),
            "A raw applyUiScale would overwrite Auto on every config frame.");
    }
}
