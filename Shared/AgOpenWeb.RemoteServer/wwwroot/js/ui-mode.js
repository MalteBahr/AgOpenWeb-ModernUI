// AgOpenWeb
// Copyright (C) 2024-2026 AgOpenWeb Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The interface presentation choice: Classic (default) or the Modern preview. Loaded in the
// page head so the presentation is set before the body paints.

// ---- Opt-in presentation ---------------------------------------------------
// Classic is the application default. Modern is a presentation layer over the same client,
// transport, commands and host state; it needs no backend or wire change.
//
// Order of precedence for this page:
//   1. ?ui=modern / ?ui=classic  (explicit, and remembered, so a recovery URL is sticky)
//   2. localStorage             (the operator's earlier explicit choice)
//   3. Classic                  (the default, including corrupt/unavailable storage)
//
// The key is fork-namespaced (agopenweb.modernui.*) and holds only this presentation choice;
// upstream keys are never read or written here. The recovery URL is ?ui=classic. "Reset UI
// preferences" in the File / Application Menu removes the key.
(function () {
  const KEY = 'agopenweb.modernui.presentation';
  const CLASSIC = 'classic';
  const MODERN = 'modern';
  const root = document.documentElement;

  function storedMode() {
    try {
      const v = localStorage.getItem(KEY);
      return v === MODERN || v === CLASSIC ? v : null;
    } catch (_) { return null; } // private mode, disabled storage, corrupt values: Classic
  }
  function storedRaw() {
    try { return localStorage.getItem(KEY); } catch (_) { return undefined; } // undefined = unreadable
  }
  function queryMode() {
    try {
      const v = new URLSearchParams(location.search).get('ui');
      return v === MODERN || v === CLASSIC ? v : null;
    } catch (_) { return null; }
  }
  function remember(mode) {
    try { localStorage.setItem(KEY, mode); } catch (_) { } // the URL still carries the choice
  }
  function urlFor(mode) {
    const u = new URL(location.href);
    if (mode === MODERN || mode === CLASSIC) u.searchParams.set('ui', mode);
    else u.searchParams.delete('ui');
    return u.toString();
  }

  const asked = queryMode();
  if (asked) remember(asked);
  const mode = asked || storedMode() || CLASSIC;
  root.setAttribute('data-ui', mode);
  // The styles that show the Modern shell require this marker as well, so a Modern UI script
  // that fails to load or initialize cannot leave a half-built shell over the map. The timer
  // falls back to Classic if js/modern-ui.js never reports in; the page then behaves as Classic
  // (the Classic menu and every existing control are untouched).
  let readyTimer = setTimeout(() => {
    if (root.getAttribute('data-ui-ready') === MODERN) return;
    if (root.getAttribute('data-ui') === MODERN) {
      root.setAttribute('data-ui', CLASSIC);
      root.removeAttribute('data-ui-init');
      const rail = document.getElementById('modern-rail');
      const menu = document.getElementById('mod-menu');
      if (rail) rail.hidden = true;
      if (menu) menu.hidden = true;
      // If the failed script had already reserved the rail's inset, give the map its width back
      // (unless a card pane owns it).
      const pane = document.getElementById('cardpane');
      const paneOpen = typeof CardPane !== 'undefined' && CardPane.layout !== 'float'
        && pane && pane.classList.contains('show');
      if (!paneOpen && typeof setMapArea === 'function') setMapArea(0, 0);
    }
    root.setAttribute('data-ui-ready', CLASSIC);
  }, 4000);

  // The one API the rest of the client uses. set()/reset() reload because the presentation
  // changes layout and map area; the page then reconnects and re-acquires an operator seat.
  window.AgOpenWebUiMode = {
    key: KEY,
    classic: CLASSIC,
    modern: MODERN,
    get mode() { return root.getAttribute('data-ui') === MODERN ? MODERN : CLASSIC; },
    isModern() { return this.mode === MODERN; },
    // Reset is a true no-op only when this page is already Classic with no ?ui query and a
    // reliably readable, absent preference. If storage cannot be read, keep the warning/reload
    // path rather than guess.
    isResetNoop() {
      return this.mode === CLASSIC && queryMode() === null && storedRaw() === null;
    },
    markReady() {
      clearTimeout(readyTimer);
      root.setAttribute('data-ui-ready', this.mode === MODERN ? MODERN : CLASSIC);
    },
    set(next) {
      if (next !== MODERN && next !== CLASSIC) return;
      remember(next);
      location.replace(urlFor(next));
    },
    reset() {
      try { localStorage.removeItem(KEY); } catch (_) { }
      location.replace(urlFor(null));
    },
    urlFor,
  };
})();
