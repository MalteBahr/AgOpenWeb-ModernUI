#!/usr/bin/env node
// AgOpenWeb
// Copyright (C) 2024-2026 AgOpenWeb Contributors
// SPDX-License-Identifier: Apache-2.0
//
// Behavioral regression harness for the opt-in Modern UI presentation.
//
// It executes the real Shared/AgOpenWeb.RemoteServer/wwwroot/js/ui-mode.js and
// js/modern-ui.js in a Node `vm` context with a small stub DOM. This is a script-level
// behavioral test, NOT a browser, WebView or real-device test: it proves mode precedence,
// storage isolation, the headless/init fallback to Classic, the host-confirmed read-only
// line list and active-line header, the field entry's delegation to the existing Fields and
// Jobs chain (including its Field Operations fallback and no direct field.* command),
// client-local edit/recording gating, lastControl role classification (true other-controller
// observer vs no operator/unknown), typed field-form reasons and the Modern menu guard, the rail's
// cycle ownership with the Classic fallback, New AB reliable field/GPS reasons, the All lines count
// label, the concise live status region, Modern menu Escape/focus return, generated English
// coverage and optional German entries with English fallback, old AB flyout close delegation,
// guidance-count cache invalidation, cycling gates, switch/reset guards, pointer isolation and the
// map-area contract as far as a stub DOM can. It also covers the hub's File menu settings,
// diagnostics and recovery cards and the synthetic pointer press/release that keeps repeated hub
// entries working, plus the Modern line adjustment page that hosts the one Classic Ref Nudge
// panel, mirrors its session and reuses its pending-move confirmation. Layout, CSS painting, real
// touch, CanvasKit and multi-client behavior are out of scope.
//
// Run (from the repository root):
//   node Tools/modern-ui-behavior-tests.js
//   node Tools/modern-ui-behavior-tests.js rail-lines
//
// Only Node built-ins are used (fs, path, vm): no downloaded dependencies.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.resolve(__dirname, '..');
const WWW = path.join(REPO_ROOT, 'Shared', 'AgOpenWeb.RemoteServer', 'wwwroot');
const STORAGE_KEY = 'agopenweb.modernui.presentation';

function readWww(...parts) {
  const file = path.join(WWW, ...parts);
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (e) {
    console.error(`Cannot read ${file}: ${e.message}`);
    process.exit(2);
  }
}

const UI_MODE_SOURCE = readWww('js', 'ui-mode.js');
const MODERN_UI_SOURCE = readWww('js', 'modern-ui.js');
const MODERN_CSS_SOURCE = readWww('css', 'modern.css');
const I18N_SOURCE = readWww('i18n.js');

// ---------------------------------------------------------------------------
// Assertions and test registry
// ---------------------------------------------------------------------------
function fail(message) { throw new Error(message); }

function assert(condition, message) {
  if (!condition) fail(message);
}

function eq(actual, expected, message) {
  if (actual !== expected) {
    fail(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function deepEq(actual, expected, message) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) fail(`${message}: expected ${b}, got ${a}`);
}

function includes(haystack, needle, message) {
  const text = String(haystack == null ? '' : haystack);
  if (!text.includes(needle)) {
    fail(`${message}: expected to contain ${JSON.stringify(needle)}, got ${JSON.stringify(text)}`);
  }
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// ---------------------------------------------------------------------------
// Stub DOM
// ---------------------------------------------------------------------------
function makeClassList() {
  const set = new Set();
  return {
    add(...names) { for (const n of names) set.add(n); },
    remove(...names) { for (const n of names) set.delete(n); },
    contains(name) { return set.has(name); },
    toggle(name, force) {
      const on = force === undefined ? !set.has(name) : !!force;
      if (on) set.add(name); else set.delete(name);
      return on;
    },
    get length() { return set.size; },
    _set: set,
  };
}

function makeElement(id, tagName) {
  const listeners = Object.create(null);
  const attrs = Object.create(null);
  const el = {
    id: id || '',
    tagName: String(tagName || 'div').toUpperCase(),
    nodeType: 1,
    hidden: false,
    disabled: false,
    textContent: '',
    className: '',
    translate: true,
    dataset: {},
    style: {
      _props: {},
      setProperty(k, v) { this._props[k] = String(v); },
      removeProperty(k) { delete this._props[k]; },
      getPropertyValue(k) { return this._props[k] || ''; },
    },
    children: [],
    parentNode: null,
    listeners,
    attrs,
    classList: makeClassList(),
    _ownerDocument: null,
    _rect: { left: 0, top: 0, right: 300, bottom: 800, width: 300, height: 800 },
    _queryResult: null,
    addEventListener(type, fn, options) {
      (listeners[type] || (listeners[type] = [])).push({ fn, options });
    },
    removeEventListener(type, fn) {
      const list = listeners[type];
      if (!list) return;
      const i = list.findIndex(x => x.fn === fn);
      if (i >= 0) list.splice(i, 1);
    },
    dispatch(type, event) {
      const list = listeners[type];
      if (!list) return 0;
      for (const { fn } of list.slice()) fn(event || makeEvent());
      return list.length;
    },
    setAttribute(name, value) {
      attrs[name] = String(value);
      if (name === 'hidden') el.hidden = true;
    },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
    },
    removeAttribute(name) {
      delete attrs[name];
      if (name === 'hidden') el.hidden = false;
    },
    hasAttribute(name) { return Object.prototype.hasOwnProperty.call(attrs, name); },
    appendChild(child) { el.children.push(child); child.parentNode = el; return child; },
    append(...nodes) { for (const n of nodes) el.appendChild(n); },
    insertBefore(child) { el.children.unshift(child); child.parentNode = el; return child; },
    remove() {
      if (!el.parentNode) return;
      const i = el.parentNode.children.indexOf(el);
      if (i >= 0) el.parentNode.children.splice(i, 1);
      el.parentNode = null;
    },
    querySelector(selector) {
      if (selector === '.dlg-card.open' || selector === '.dlg-card') return el._queryResult;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === 'input, textarea' || selector === 'input,textarea') return el._inputs || [];
      if (selector === '.ln-btn' && el._lnBtns) return el._lnBtns;
      if (selector === '.fo-btn' && el._foBtns) return el._foBtns;
      return [];
    },
    closest() { return null; },
    getBoundingClientRect() { return Object.assign({}, el._rect); },
    focus() {
      if (el._ownerDocument) el._ownerDocument.activeElement = el;
    },
    click() { el.dispatch('click', makeEvent({ detail: 1 })); },
  };
  Object.defineProperty(el, 'innerHTML', {
    enumerable: true,
    configurable: true,
    get() { return ''; },
    set(v) { if (v === '') el.children.length = 0; },
  });
  return el;
}

function makeEvent(overrides) {
  return Object.assign({
    detail: 1,
    key: '',
    repeat: false,
    stopped: 0,
    defaultPrevented: false,
    stopPropagation() { this.stopped += 1; },
    preventDefault() { this.defaultPrevented = true; },
  }, overrides || {});
}

let indexMetaCache = null;
function indexMeta() {
  if (indexMetaCache) return indexMetaCache;
  const html = readWww('index.html');
  const ids = [];
  const hidden = new Set();
  const attrsById = new Map();
  const re = /<([a-zA-Z][\w:-]*)\b([^>]*\bid="([^"]+)"[^>]*)>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const id = m[3];
    if (!ids.includes(id)) ids.push(id);
    if (/\shidden(?=\s|$)/.test(m[2])) hidden.add(id);
    const attrs = {};
    const attrRe = /([:\w-]+)="([^"]*)"/g;
    let a;
    while ((a = attrRe.exec(m[2])) !== null) attrs[a[1]] = a[2];
    if (!attrsById.has(id)) attrsById.set(id, attrs);
  }
  indexMetaCache = { ids, hidden, attrsById };
  return indexMetaCache;
}

function makeStorage(initial, options) {
  const map = new Map(Object.entries(initial || {}));
  const opts = options || {};
  return {
    _map: map,
    getItem(key) {
      if (opts.getThrows) throw new Error('storage read denied');
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      if (opts.setThrows) throw new Error('storage write denied');
      map.set(key, String(value));
    },
    removeItem(key) {
      if (opts.removeThrows) throw new Error('storage remove denied');
      map.delete(key);
    },
  };
}

function makeTimers() {
  const timers = new Map();
  let next = 1;
  return {
    _map: timers,
    setTimeout(fn, ms) {
      const id = next++;
      timers.set(id, { fn, ms, cancelled: false, done: false });
      return id;
    },
    clearTimeout(id) {
      const t = timers.get(id);
      if (t) t.cancelled = true;
    },
    fire(ms) {
      let fired = 0;
      for (const t of timers.values()) {
        if (!t.cancelled && !t.done && t.ms === ms) {
          t.done = true;
          t.fn();
          fired += 1;
        }
      }
      return fired;
    },
    pending() {
      return [...timers.values()].filter(t => !t.cancelled && !t.done).length;
    },
  };
}

function makeSandbox(options) {
  const opts = options || {};
  const meta = indexMeta();
  const elements = new Map();
  for (const id of meta.ids) {
    const el = makeElement(id);
    if (meta.hidden.has(id)) { el.hidden = true; el.attrs.hidden = ''; }
    const attrs = meta.attrsById.get(id);
    if (attrs) {
      for (const [name, value] of Object.entries(attrs)) el.attrs[name] = value;
      if (attrs.class) {
        el.className = attrs.class;
        for (const cls of attrs.class.split(/\s+/)) if (cls) el.classList.add(cls);
      }
    }
    elements.set(id, el);
  }
  for (const id of ['cardpane', 'dialoghost', 'dlg-confirm', 'dlg-unsavedcov', 'hostprompt']) {
    if (!elements.has(id)) elements.set(id, makeElement(id));
  }
  const leftnav = elements.get('leftnav');
  if (leftnav) {
    leftnav._lnBtns = [...elements.values()].filter(e => e.classList.contains('ln-btn'));
  }
  const filemenu = elements.get('filemenu');
  if (filemenu) {
    filemenu._foBtns = [...elements.values()].filter(e => e.classList.contains('fo-btn'));
  }
  // The active line row is nested markup in index.html. The flat stub needs the same shape so
  // rows() and the list tests see the row, its name/type and its two controls.
  const activeSlot = elements.get('mod-active-slot');
  if (activeSlot) {
    const inner = makeElement(null, 'div');
    inner.className = 'mod-line mod-line-active active';
    inner.classList.add('mod-line', 'mod-line-active', 'active');
    const mark = makeElement(null, 'span');
    mark.classList.add('mod-line-mark');
    mark.textContent = '\u2713';
    const body = makeElement(null, 'span');
    body.classList.add('mod-line-body');
    const name = elements.get('mod-active-line');
    const type = elements.get('mod-active-type');
    if (name) body.appendChild(name);
    if (type) body.appendChild(type);
    inner.appendChild(mark);
    inner.appendChild(body);
    const adjust = elements.get('mod-line-adjust');
    const auto = elements.get('mod-auto-track');
    if (adjust) inner.appendChild(adjust);
    if (auto) inner.appendChild(auto);
    activeSlot.appendChild(inner);
  }

  const state = {
    mapArea: [],
    sent: [],
    toasts: [],
    confirms: [],
    menus: [],
    tracksManager: [],
    qab: [],
    dialogs: [],
    warnings: [],
    globalListeners: Object.create(null),
    calls: [],
    fieldsOpen: [],
    fieldRenders: [],
    abFlyoutCloses: [],
    cfg: [],
  };

  const timers = makeTimers();
  const search = opts.search || '';
  const location = {
    href: `http://localhost:5174/${search}`,
    search,
    replaced: [],
    replace(url) {
      this.replaced.push(String(url));
      this.href = String(url);
      const parsed = new URL(String(url));
      this.search = parsed.search;
    },
  };

  const documentElement = makeElement(null, 'html');
  const body = makeElement(null, 'body');
  body.classList.add('fs-no-vt');
  const documentListeners = Object.create(null);
  const document = {
    documentElement,
    body,
    activeElement: null,
    getElementById(id) { return elements.get(id) || null; },
    createElement(tag) {
      const child = makeElement(null, tag);
      child._ownerDocument = document;
      return child;
    },
    querySelector() { return null; },
    createTreeWalker() { return { nextNode() { return null; } }; },
    addEventListener(type, fn) {
      (documentListeners[type] || (documentListeners[type] = [])).push(fn);
    },
    removeEventListener(type, fn) {
      const list = documentListeners[type];
      if (!list) return;
      const i = list.indexOf(fn);
      if (i >= 0) list.splice(i, 1);
    },
    dispatchEvent(event) {
      const list = documentListeners[event && event.type] || [];
      for (const fn of list.slice()) fn(event);
    },
  };
  for (const element of elements.values()) element._ownerDocument = document;
  documentElement._ownerDocument = document;
  body._ownerDocument = document;

  function getComputedStyle(el) {
    if (!el) return { display: 'block' };
    if (el.hidden) return { display: 'none' };
    if (el.id === 'modern-rail' || el.id === 'mod-menu') {
      const modern = documentElement.getAttribute('data-ui') === 'modern'
        && documentElement.getAttribute('data-ui-init') === 'modern';
      if (!modern || opts.cssBroken) return { display: 'none' };
      if (el.id === 'modern-rail' && el.classList.contains('suspended')) return { display: 'none' };
      return { display: 'flex' };
    }
    return { display: 'block' };
  }

  const sandbox = {
    document,
    getComputedStyle,
    localStorage: makeStorage(opts.stored, opts.storage || {}),
    location,
    console: {
      log() {},
      info() {},
      warn(...args) { state.warnings.push(args.map(String).join(' ')); },
      error(...args) { state.warnings.push(args.map(String).join(' ')); },
    },
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 },
    NodeFilter: { SHOW_TEXT: 4, SHOW_ELEMENT: 1 },
    MutationObserver: class {
      constructor(callback) { this.callback = callback; }
      observe() {}
      disconnect() {}
    },
    fetch: opts.fetch || (async () => ({ ok: false, json: async () => ({}) })),
    addEventListener(type, fn) {
      (state.globalListeners[type] || (state.globalListeners[type] = [])).push(fn);
    },
    removeEventListener() {},
    dispatchEvent() {},
    transport: {
      send(command) { state.sent.push(String(command)); },
    },
    tr(key, params) {
      return String(key).replace(/\{(\w+)\}/g,
        (m, name) => (params && Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : m));
    },
    isoDate() { return '2026-11-24'; },
    setMapArea(left, right) { state.mapArea.push([left, right]); },
    zoomRect(el) { return el.getBoundingClientRect(); },
    uiZoom: 1,
    innerWidth: 1280,
    innerHeight: 800,
    devicePixelRatio: 1,
    scene: null,
    tick: null,
    lastTick: null,
    fieldOps: null,
    statusBar: null,
    myClientId: 'this-browser',
    lastControl: { held: false, holderId: '', holderName: '' },
    iHoldControl: false,
    connState: 'disconnected',
    wizard: null,
    hostPrompt: null,
    abFlow: null,
    drawPts: [],
    driveStep: 0,
    curveMarks: [],
    recPivot: false,
    hlFlow: null,
    editSession: null,
    boundary: null,
    recPath: null,
    showToast(message) { state.toasts.push(String(message)); },
    showConfirm(title, message, callback, onBack, labels) {
      state.confirms.push({ title, message, callback, onBack, labels });
      if (opts.confirm !== 'manual') callback();
    },
    lnOpen(panel, buttonId, renderer) {
      state.calls.push(`lnOpen:${panel}`);
      state.menus.push(['open', panel, buttonId, renderer]);
      const button = elements.get(buttonId);
      if (button) button.classList.add('active');
      const panelEl = elements.get(panel);
      if (panelEl) panelEl.classList.add('open');
    },
    lnCloseAll() {
      state.calls.push('lnCloseAll');
      state.menus.push(['close']);
      for (const el of elements.values()) el.classList.remove('active', 'open');
    },
    openFieldsAndJobs() {
      state.calls.push('openFieldsAndJobs');
      state.fieldsOpen.push(true);
      sandbox.lnOpen('fieldsandjobs', 'ln-fieldops', sandbox.renderFieldOps);
    },
    renderFieldOps() {
      state.calls.push('renderFieldOps');
      state.fieldRenders.push(true);
    },
    abFlyoutClose() {
      state.calls.push('abFlyoutClose');
      state.abFlyoutCloses.push(true);
    },
    openTracksManager() {
      state.calls.push('openTracksManager');
      state.tracksManager.push(true);
    },
    qabHeadingReset() {
      state.calls.push('qabHeadingReset');
      state.qab.push('heading-reset');
    },
    qabSetSide(side) {
      state.calls.push('qabSetSide');
      state.qab.push(`side:${side}`);
    },
    qabStart(mode) {
      state.calls.push(`qabStart:${mode}`);
      state.qab.push(`start:${mode}`);
    },
    abHint() { return 'Step'; },
    abSetPoint() { state.calls.push('abSetPoint'); },
    abCancel() { state.calls.push('abCancel'); },
    cfgSend(key, val) {
      state.calls.push(`cfgSend:${key}`);
      state.cfg.push(`${key}:${val}`);
    },
    config: { tool: { singleCoverageColor: 0x98FB98, type: 1 }, vehicle: { type: 0 } },
    openDialog(id) {
      state.calls.push('openDialog');
      state.dialogs.push(String(id));
    },
    // js/tracks.js owns the Classic Ref Nudge session and its panel. The harness loads only the
    // Modern shell, so it mirrors that pair: the page must start and end the existing session,
    // not a second one.
    refNudgeOpen: false,
    openRefNudge() {
      state.calls.push('openRefNudge');
      sandbox.refNudgeOpen = true;
    },
    closeRefNudge() {
      state.calls.push('closeRefNudge');
      sandbox.refNudgeOpen = false;
    },
    URL,
    URLSearchParams,
  };
  sandbox.window = sandbox;
  if (opts.cardPane) sandbox.CardPane = { layout: opts.cardPane.layout || 'float' };
  if (opts.paneOpen) elements.get('cardpane').classList.add('show');
  if (opts.noAbFlyout) delete sandbox.abFlyoutClose;
  if (opts.noQabStart) delete sandbox.qabStart;

  Object.defineProperty(sandbox, '__test', { value: { state, timers, elements, documentElement, body }, enumerable: false });
  sandbox.__dispatchGlobal = function (type, event) {
    const list = state.globalListeners[type] || [];
    for (const fn of list) fn(event || makeEvent());
  };
  sandbox.__dispatchDocument = function (type, event) {
    const ev = event || makeEvent();
    if (!ev.type) ev.type = type;
    document.dispatchEvent(ev);
    return ev;
  };
  vm.createContext(sandbox);
  return sandbox;
}

function runScript(sandbox, source, filename) {
  vm.runInContext(source, sandbox, { filename });
}

function loadUiMode(options) {
  const sb = makeSandbox(options || {});
  runScript(sb, UI_MODE_SOURCE, 'wwwroot/js/ui-mode.js');
  return sb;
}

function loadModern(options) {
  const opts = Object.assign({ search: '?ui=modern' }, options || {});
  const sb = makeSandbox(opts);
  runScript(sb, UI_MODE_SOURCE, 'wwwroot/js/ui-mode.js');
  runScript(sb, MODERN_UI_SOURCE, 'wwwroot/js/modern-ui.js');
  return sb;
}

function loadI18n(options) {
  const sb = makeSandbox(options || {});
  runScript(sb, I18N_SOURCE, 'wwwroot/i18n.js');
  return { sb, i18n: vm.runInContext('I18n', sb) };
}

// ---------------------------------------------------------------------------
// Small helpers for interacting with the sandbox
// ---------------------------------------------------------------------------
function el(sb, id) {
  const element = sb.__test.elements.get(id);
  if (!element) fail(`stub DOM has no element #${id}`);
  return element;
}

function items(sb) {
  return sb.__test.state;
}

function press(element) {
  const event = makeEvent({ detail: 1 });
  element.dispatch('pointerdown', event);
  element.dispatch('click', event);
  return event;
}

// Mirrors js/control.js: this page's role comes from the control-state frame, not from an
// iHoldControl guess. "Observer" means another client actually holds control; a connected
// screen with no holder is "No operator", and a lost link is role-unknown.
const ROLE_SELF = 'this-browser';
const ROLE_OTHER = 'other-browser';
function setControlRole(sb, role) {
  sb.myClientId = ROLE_SELF;
  switch (role) {
    case 'operator':
      sb.connState = 'connected';
      sb.lastControl = { held: true, holderId: ROLE_SELF, holderName: 'This screen' };
      sb.iHoldControl = true;
      break;
    case 'observer':
      sb.connState = 'connected';
      sb.lastControl = { held: true, holderId: ROLE_OTHER, holderName: 'Other screen' };
      sb.iHoldControl = false;
      break;
    case 'no-operator':
      sb.connState = 'connected';
      sb.lastControl = { held: false, holderId: '', holderName: '' };
      sb.iHoldControl = false;
      break;
    case 'unknown':
      sb.connState = 'connecting';
      sb.lastControl = { held: false, holderId: '', holderName: '' };
      sb.iHoldControl = false;
      break;
    case 'disconnected':
      sb.connState = 'disconnected';
      sb.lastControl = { held: true, holderId: ROLE_OTHER, holderName: 'Other screen' };
      sb.iHoldControl = false;
      break;
    default:
      fail(`unknown control role ${role}`);
  }
}

function tabs(sb, overrides) {
  sb.scene = Object.assign({
    hasField: true,
    fieldName: 'Field',
    trackList: [
      { index: 0, name: 'A', type: 'Line', visible: true, active: true },
      { index: 1, name: 'B', type: 'Curve', visible: true, active: false },
    ],
  }, (overrides && overrides.scene) || {});
  sb.tick = Object.assign({
    op: { autoSteer: false, contour: false },
    activeTrackName: 'A',
  }, (overrides && overrides.tick) || {});
  if (overrides && overrides.role) {
    setControlRole(sb, overrides.role);
    if (overrides.connState) sb.connState = overrides.connState;
  } else if (overrides && overrides.connState && overrides.connState !== 'connected') {
    setControlRole(sb, 'unknown');
    sb.connState = overrides.connState;
  } else if (overrides && overrides.iHoldControl === false) {
    setControlRole(sb, 'observer');
  } else {
    setControlRole(sb, 'operator');
  }
  if (overrides && Object.prototype.hasOwnProperty.call(overrides, 'statusBar')) {
    sb.statusBar = overrides.statusBar;
  }
  return sb;
}

function render(sb) {
  sb.renderModernUi();
}

function rows(sb) {
  // A line row is a listitem wrapper around a real button; return the button so assertions
  // keep targeting the control, while an empty-state div is returned unchanged.
  return Array.from(el(sb, 'mod-rail-list').children)
    .map(child => String(child.className || '').split(/\s+/).includes('mod-line-item')
      ? child.children[0] : child);
}

function rowByName(sb, name) {
  return rows(sb).find(r => r.children[1] && r.children[1].children[0]
    && r.children[1].children[0].textContent === name);
}

// The implementation keeps the chain-panel ids in one array. Reading it from the real source
// covers every existing panel without duplicating (and drifting from) that list.
function fieldPanelIds() {
  const match = /const MODERN_FIELD_PANELS = \[([\s\S]*?)\];/.exec(MODERN_UI_SOURCE);
  assert(match, 'modern-ui.js must declare MODERN_FIELD_PANELS for the field entry');
  const ids = [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1]);
  assert(ids.length > 0, 'MODERN_FIELD_PANELS must list at least one existing panel');
  return ids;
}

function typedFieldFormIds() {
  return fieldPanelIds().filter(id => id !== 'fieldops' && id !== 'fieldsandjobs');
}

function allLinesBaseLabel(sb) {
  const match = /tr\('(All lines)'\)/.exec(MODERN_UI_SOURCE);
  assert(match, 'modern-ui.js must keep the base All lines label');
  return sb.tr(match[1]);
}

function assertAllLinesLabel(sb, count, label) {
  const text = el(sb, 'mod-all-lines').textContent;
  const base = allLinesBaseLabel(sb);
  assert(text.startsWith(base), `${label}: expected label starting with ${base}, got ${text}`);
  if (count > 0) {
    assert(text.includes(String(count)), `${label}: expected the count ${count} in ${text}`);
  } else {
    eq(text, base, `${label}: no count when there are no guidance lines`);
  }
}

function placeholders(text) {
  return [...String(text).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
}

function trKeysInFunction(name) {
  const start = MODERN_UI_SOURCE.indexOf(`function ${name}`);
  assert(start >= 0, `modern-ui.js must define ${name}`);
  const end = MODERN_UI_SOURCE.indexOf('\n}', start);
  assert(end > start, `${name} must have a closed body`);
  return [...MODERN_UI_SOURCE.slice(start, end).matchAll(/tr\('([^']+)'/g)].map(m => m[1]);
}

// Labels introduced or changed by this pass: the status summary, New AB reasons, the typed-form
// reason and the All lines count. Deriving them from the real source keeps copy changes out of
// the test while letting the optional German entries be checked only where Weblate supplied one.
function changedModernTrKeys() {
  const keys = [
    ...trKeysInFunction('modernStatusSummary'),
    ...trKeysInFunction('modernRecordState'),
    ...trKeysInFunction('modernFieldBlockedReason'),
  ];
  const start = MODERN_UI_SOURCE.indexOf('MODERN_EL.allLines.textContent');
  assert(start >= 0, 'modern-ui.js must assign the All lines label');
  const end = MODERN_UI_SOURCE.indexOf(';', start);
  keys.push(...[...MODERN_UI_SOURCE.slice(start, end).matchAll(/tr\('([^']+)'/g)].map(m => m[1]));
  return [...new Set(keys)];
}

function addTextInput(panel, value) {
  const input = makeElement(null, 'input');
  input.type = 'text';
  input.value = value;
  (panel._inputs || (panel._inputs = [])).push(input);
  return input;
}

// Host-projected work an operator/unknown seat must treat as non-idle. A clean Smooth panel
// (SmoothCount 0, "as saved") and a non-pending nudge are deliberately not in this list.
const HOST_WORK_CASES = [
  ['boundary recording', sb => { sb.boundary = { isRecording: true, isPaused: false }; }],
  ['boundary paused', sb => { sb.boundary = { isRecording: false, isPaused: true }; }],
  ['recorded path recording', sb => { sb.recPath = { isRecording: true }; }],
  ['ref nudge pending', sb => { sb.tick.op = Object.assign({}, sb.tick.op, { refNudgePending: true }); }],
  ['smooth pending', sb => {
    sb.tick.op = Object.assign({}, sb.tick.op, { smoothOpen: true, smoothCount: 4 });
  }],
];

const OPERATOR_CLEAR_HOST_CASES = [
  ['clean smooth panel', sb => {
    sb.tick.op = Object.assign({}, sb.tick.op, { smoothOpen: true, smoothCount: 0 });
  }],
  ['nudge not pending', sb => {
    sb.tick.op = Object.assign({}, sb.tick.op, { refNudgePending: false });
  }],
  ['smooth closed with a stale count', sb => {
    sb.tick.op = Object.assign({}, sb.tick.op, { smoothOpen: false, smoothCount: 4 });
  }],
];

function assertNoFieldCommands(sb, label) {
  for (const command of items(sb).sent) {
    assert(!/^field\./i.test(command), `${label}: the rail must not send a direct field command, got ${command}`);
  }
}

function assertNoControlCommands(sb, label, allowSelect) {
  for (const command of items(sb).sent) {
    const guidance = command === 'track.cycle' || command === 'track.cycleBack'
      || (allowSelect && /^track\.select\|\d+$/.test(command));
    assert(guidance,
      `${label}: only existing guidance commands may be sent, got ${command}`);
    assert(!/autosteer|section/i.test(command),
      `${label}: no AutoSteer/section command may be sent, got ${command}`);
  }
}

// ===========================================================================
// Mode precedence, persistence and recovery (js/ui-mode.js)
// ===========================================================================
test('mode-precedence/classic is the default with no query and no saved choice', () => {
  const sb = loadUiMode();
  eq(sb.document.documentElement.getAttribute('data-ui'), 'classic', 'default presentation');
  eq(sb.AgOpenWebUiMode.mode, 'classic', 'mode getter');
  eq(sb.AgOpenWebUiMode.isModern(), false, 'isModern');
  eq(sb.AgOpenWebUiMode.isResetNoop(), true, 'reset is a true no-op here');
  eq(sb.AgOpenWebUiMode.key, STORAGE_KEY, 'fork-namespaced key');
  eq(sb.AgOpenWebUiMode.classic, 'classic', 'classic constant');
  eq(sb.AgOpenWebUiMode.modern, 'modern', 'modern constant');
  eq(sb.localStorage.getItem(STORAGE_KEY), null, 'no preference is written by default');
});

test('mode-precedence/?ui=modern wins and is remembered', () => {
  const sb = loadUiMode({ search: '?ui=modern&keep=1' });
  eq(sb.document.documentElement.getAttribute('data-ui'), 'modern', 'query selects Modern');
  eq(sb.localStorage.getItem(STORAGE_KEY), 'modern', 'explicit query is remembered');
  eq(sb.AgOpenWebUiMode.isModern(), true, 'isModern');
});

test('mode-precedence/?ui=classic overrides a saved Modern choice', () => {
  const sb = loadUiMode({ search: '?ui=classic', stored: { [STORAGE_KEY]: 'modern' } });
  eq(sb.document.documentElement.getAttribute('data-ui'), 'classic', 'recovery query wins');
  eq(sb.localStorage.getItem(STORAGE_KEY), 'classic', 'recovery query is remembered');
});

test('mode-precedence/a saved choice is used without a query', () => {
  const sb = loadUiMode({ stored: { [STORAGE_KEY]: 'modern' } });
  eq(sb.document.documentElement.getAttribute('data-ui'), 'modern', 'stored Modern is restored');
});

test('mode-precedence/corrupt saved values fall back to Classic but are not treated as absent', () => {
  const sb = loadUiMode({ stored: { [STORAGE_KEY]: 'yes-please' } });
  eq(sb.document.documentElement.getAttribute('data-ui'), 'classic', 'corrupt value -> Classic');
  eq(sb.AgOpenWebUiMode.isResetNoop(), false,
    'a corrupt stored value must still offer the reset path, not silently look like no preference');
});

test('mode-precedence/unreadable storage falls back to Classic and keeps the reset path', () => {
  const sb = loadUiMode({ storage: { getThrows: true } });
  eq(sb.document.documentElement.getAttribute('data-ui'), 'classic', 'unreadable storage -> Classic');
  eq(sb.AgOpenWebUiMode.isModern(), false, 'not Modern');
  eq(sb.AgOpenWebUiMode.isResetNoop(), false, 'unreadable storage is not a reliable no-op');
});

test('mode-precedence/an unknown ?ui value neither selects Modern nor erases a saved choice', () => {
  const sb = loadUiMode({ search: '?ui=turbo', stored: { [STORAGE_KEY]: 'modern' } });
  eq(sb.document.documentElement.getAttribute('data-ui'), 'modern', 'saved choice still applies');
  eq(sb.localStorage.getItem(STORAGE_KEY), 'modern', 'saved choice unchanged');
});

test('mode-precedence/a denied storage write still keeps the URL choice', () => {
  const sb = loadUiMode({ search: '?ui=modern', storage: { setThrows: true } });
  eq(sb.document.documentElement.getAttribute('data-ui'), 'modern', 'URL still carries Modern');
  eq(sb.AgOpenWebUiMode.isModern(), true, 'no exception escapes the load');
});

test('mode-precedence/set() remembers the choice and replaces the URL, preserving other parts', () => {
  const sb = loadUiMode({ search: '?keep=1#anchor' });
  const replaced = sb.location.replaced;
  sb.AgOpenWebUiMode.set('modern');
  eq(sb.localStorage.getItem(STORAGE_KEY), 'modern', 'stored target');
  eq(replaced.length, 1, 'one reload');
  const modern = new URL(replaced[0]);
  eq(modern.searchParams.get('ui'), 'modern', 'target in URL');
  eq(modern.searchParams.get('keep'), '1', 'unrelated query preserved');
  eq(modern.hash, '#anchor', 'hash preserved');
  eq(sb.document.documentElement.getAttribute('data-ui'), 'classic',
    'set() only reloads; it must not repaint the current page');

  sb.AgOpenWebUiMode.set('classic');
  eq(new URL(replaced[1]).searchParams.get('ui'), 'classic', 'classic target');
  eq(sb.localStorage.getItem(STORAGE_KEY), 'classic', 'stored classic');

  sb.AgOpenWebUiMode.set('bogus');
  eq(replaced.length, 2, 'an unknown target is ignored (no third reload)');
});

test('mode-precedence/reset() removes only the fork key and clears ?ui', () => {
  const sb = loadUiMode({
    search: '?ui=modern&keep=1',
    stored: { [STORAGE_KEY]: 'modern', 'other.owner.key': 'keep-me' },
  });
  sb.AgOpenWebUiMode.reset();
  eq(sb.localStorage.getItem(STORAGE_KEY), null, 'fork preference removed');
  eq(sb.localStorage.getItem('other.owner.key'), 'keep-me', 'other storage keys untouched');
  eq(sb.location.replaced.length, 1, 'one reload');
  const url = new URL(sb.location.replaced[0]);
  eq(url.searchParams.get('ui'), null, 'ui query removed');
  eq(url.searchParams.get('keep'), '1', 'unrelated query preserved');
});

test('mode-precedence/the 4s fallback returns an unresolved Modern page to Classic', () => {
  const sb = loadUiMode({ search: '?ui=modern' });
  const rail = el(sb, 'modern-rail');
  const menu = el(sb, 'mod-menu');
  rail.hidden = false;
  menu.hidden = false;
  const timers = sb.__test.timers;
  eq(timers.fire(4000), 1, 'the one 4s fallback timer fired');
  eq(sb.document.documentElement.getAttribute('data-ui'), 'classic', 'presentation falls back');
  eq(sb.document.documentElement.getAttribute('data-ui-ready'), 'classic', 'ready reports Classic');
  eq(sb.document.documentElement.getAttribute('data-ui-init'), null, 'init marker removed');
  eq(rail.hidden, true, 'rail hidden');
  eq(menu.hidden, true, 'menu hidden');
  deepEq(items(sb).mapArea.slice(-1)[0], [0, 0], 'map width returned unless a card pane owns it');
});

test('mode-precedence/markReady() cancels the fallback and reports Modern', () => {
  const sb = loadUiMode({ search: '?ui=modern' });
  const timers = sb.__test.timers;
  sb.AgOpenWebUiMode.markReady();
  eq(sb.document.documentElement.getAttribute('data-ui-ready'), 'modern', 'ready Modern');
  eq(timers.pending(), 0, 'fallback cancelled');
  timers.fire(4000);
  eq(sb.document.documentElement.getAttribute('data-ui'), 'modern', 'late timer must not flip a ready page');
});

test('mode-precedence/markReady() reports Classic in Classic and leaves Modern hidden', () => {
  const sb = loadUiMode();
  sb.AgOpenWebUiMode.markReady();
  eq(sb.document.documentElement.getAttribute('data-ui-ready'), 'classic', 'ready Classic');
  eq(sb.document.documentElement.getAttribute('data-ui'), 'classic', 'still Classic');
});

test('mode-precedence/the fallback leaves the map inset alone while a split card pane is open', () => {
  const sb = loadUiMode({
    search: '?ui=modern',
    cardPane: { layout: 'split' },
    paneOpen: true,
  });
  el(sb, 'modern-rail').hidden = false;
  sb.__test.timers.fire(4000);
  eq(sb.document.documentElement.getAttribute('data-ui'), 'classic', 'still falls back to Classic');
  eq(items(sb).mapArea.length, 0, 'the card pane keeps owning the map area');
});

// ===========================================================================
// Safe headless init / fallback (js/modern-ui.js)
// ===========================================================================
test('init-fallback/a healthy Modern load shows the shell, syncs the map and reports ready', () => {
  const sb = loadModern();
  const root = sb.document.documentElement;
  eq(root.getAttribute('data-ui'), 'modern', 'Modern presentation');
  eq(root.getAttribute('data-ui-init'), 'modern', 'successful init marker');
  eq(root.getAttribute('data-ui-ready'), 'modern', 'ready after the map sync');
  eq(el(sb, 'modern-rail').hidden, false, 'rail shown');
  eq(el(sb, 'mod-menu').hidden, false, 'labeled menu shown');
  deepEq(items(sb).mapArea, [[0, 300]], 'rail width claimed through setMapArea');
  eq(el(sb, 'fm-ui-switch').textContent, 'Classic UI', 'switch label offers Classic');
  includes(el(sb, 'fm-ui-hint').textContent, 'preview', 'Modern preview hint');
});

test('init-fallback/a missing Modern stylesheet restores the Classic shell instead of a half-built rail', () => {
  const sb = loadModern({ cssBroken: true });
  const root = sb.document.documentElement;
  eq(root.getAttribute('data-ui'), 'classic', 'presentation restored to Classic');
  eq(root.getAttribute('data-ui-init'), null, 'init marker removed');
  eq(root.getAttribute('data-ui-ready'), 'classic', 'ready reports Classic');
  eq(el(sb, 'modern-rail').hidden, true, 'rail hidden');
  eq(el(sb, 'mod-menu').hidden, true, 'menu hidden');
  deepEq(items(sb).mapArea.slice(-1)[0], [0, 0], 'rail inset released');
  includes(items(sb).warnings.join('\n'), 'initialization failed', 'failure is reported');
});

test('init-fallback/Classic loads do not initialize or render the Modern shell', () => {
  const sb = loadModern({ search: '' });
  const root = sb.document.documentElement;
  eq(root.getAttribute('data-ui'), 'classic', 'Classic');
  eq(root.getAttribute('data-ui-init'), null, 'no Modern init marker');
  eq(root.getAttribute('data-ui-ready'), 'classic', 'ready Classic');
  eq(el(sb, 'modern-rail').hidden, true, 'rail stays hidden from markup');
  eq(el(sb, 'mod-menu').hidden, true, 'menu stays hidden from markup');
  eq(items(sb).mapArea.length, 0, 'no Modern map inset in Classic');
  el(sb, 'mod-field-name').textContent = 'SENTINEL';
  sb.renderModernUi();
  eq(el(sb, 'mod-field-name').textContent, 'SENTINEL', 'renderModernUi is a no-op in Classic');
});

test('init-fallback/a split card pane open at load keeps the rail out of the map area', () => {
  const sb = loadModern({ cardPane: { layout: 'split' }, paneOpen: true });
  eq(sb.document.documentElement.getAttribute('data-ui-ready'), 'modern', 'Modern ready');
  eq(el(sb, 'modern-rail').classList.contains('suspended'), true, 'rail suspended');
  eq(items(sb).mapArea.length, 0, 'the pane owns the right edge');
});

// ===========================================================================
// Host-confirmed, read-only named line list
// ===========================================================================
test('rail-lines/no field shows the empty list and disables line actions', () => {
  const sb = loadModern();
  tabs(sb, { scene: { hasField: false, fieldName: '', trackList: [] } });
  render(sb);
  const list = rows(sb);
  eq(list.length, 1, 'one empty row');
  eq(list[0].className, 'mod-empty', 'empty row style');
  eq(list[0].textContent, 'Open a field first', 'empty text');
  eq(el(sb, 'mod-field-name').textContent, 'No field', 'field name placeholder');
  eq(el(sb, 'mod-field-name').hasAttribute('translate'), false, 'placeholder is translatable');
  eq(el(sb, 'mod-prev').disabled, true, 'Previous disabled');
  eq(el(sb, 'mod-next').disabled, true, 'Next disabled');
  eq(el(sb, 'mod-all-lines').textContent, allLinesBaseLabel(sb), 'no lines to choose');
  eq(el(sb, 'mod-rail-list').classList.contains('mod-empty-list'), true,
    'the empty list does not reserve two row-heights');
  eq(el(sb, 'mod-record-help').hidden, true,
    'the disabled reason replaces the generic record help');
});

test('rail-lines/rows follow the host line list and the host active marker', () => {
  const sb = loadModern();
  tabs(sb, {
    scene: {
      trackList: [
        { index: 3, name: 'Headland A', type: 'Line', visible: true, active: true },
        { index: 4, name: 'Curve B', type: 'Curve', visible: true, active: false },
        { index: 5, name: 'Path', type: 'Path', visible: true, active: false },
        { index: 6, name: 'Contour', type: 'Contour', visible: true, active: false },
      ],
    },
    tick: { activeTrackName: 'Headland A' },
  });
  render(sb);
  const list = rows(sb);
  eq(list.length, 2, 'only visible guidance lines are rows');
  eq(list[0].dataset.modLine, '4', 'the previous line comes first');
  assert(!String(list[0].className).split(/\s+/).includes('active'),
    'the previous row is not marked active');
  eq(list[1].dataset.modLine, '3', 'the active line is the second row');
  includes(list[1].className, 'active', 'host-confirmed active row');
  eq(list[1].getAttribute('aria-current'), 'true', 'active row exposed to assistive tech');
  eq(list[1].children[0].textContent, '\u2713', 'active marker');
  eq(list[1].children[1].children[0].textContent, 'Headland A', 'host name');
  eq(el(sb, 'mod-active-line').getAttribute('translate'), 'no',
    'user line name is not a translation key');
  eq(list[1].children[1].children[1].textContent, 'Line', 'type beside the active name');
  eq(list[0].getAttribute('aria-current'), null, 'previous row has no current marker');
  eq(list[0].children[0].textContent, '\u25cb', 'inactive marker');
  eq(list[0].children[1].children[1].textContent, 'Curve', 'previous row type');
  eq(rowByName(sb, 'Path'), undefined, 'Path is not a guidance line');
  eq(rowByName(sb, 'Contour'), undefined, 'Contour is not a guidance line');
});

test('rail-lines/a line row selects through the existing track.select command', () => {
  const sb = loadModern();
  tabs(sb);
  render(sb);
  const row = rows(sb)[0];   // B, the line one Previous would switch to
  eq(row.tagName, 'BUTTON', 'a selectable line is a real button');
  press(row);
  deepEq(items(sb).sent, ['track.select|1'], 'sends the host index through track.select');
  eq(items(sb).tracksManager.length, 0, 'one tap does not open the manager');
  eq(items(sb).confirms.length, 0, 'no confirmation while AutoSteer is off');
});

test('rail-lines/a line change while AutoSteer is engaged asks first', () => {
  const sb = loadModern();
  tabs(sb, { tick: { op: { autoSteer: true, contour: false } } });
  render(sb);
  press(rows(sb)[0]);
  eq(items(sb).confirms.length, 1, 'the client asks before a non-disengaging line change');
  includes(items(sb).confirms[0].title, 'AutoSteer', 'the confirmation names the state');
  deepEq(items(sb).sent, ['track.select|1'], 'Continue still uses the existing select command');
});

test('rail-lines/line confirmation rejects a changed field, target or control', () => {
  for (const change of [
    sb => { sb.scene.fieldName = 'Other'; },
    sb => { sb.scene.trackList[1] = { index: 1, name: 'Different', type: 'Curve', visible: true }; },
    sb => { sb.scene.trackList[1].visible = false; },
    sb => setControlRole(sb, 'observer'),
    sb => { sb.tick.op.contour = true; },
  ]) {
    const sb = loadModern({ confirm: 'manual' });
    tabs(sb, { tick: { op: { autoSteer: true, contour: false }, activeTrackName: 'A' } });
    render(sb);
    press(rows(sb)[0]);
    change(sb);
    items(sb).confirms[0].callback();
    deepEq(items(sb).sent, [], 'stale confirmation sends no selection');
  }
});

test('rail-lines/an observer or contour row is not selectable', () => {
  const observer = loadModern();
  tabs(observer, { role: 'observer' });
  render(observer);
  eq(rows(observer)[0].disabled, true, 'observer rows are disabled');
  press(rows(observer)[0]);
  eq(items(observer).sent.length, 0, 'an observer sends no selection');

  const contour = loadModern();
  tabs(contour, { tick: { op: { autoSteer: false, contour: true } } });
  render(contour);
  eq(rows(contour)[0].disabled, true, 'contour rows are disabled');
  press(rows(contour)[0]);
  eq(items(contour).sent.length, 0, 'contour sends no selection');
});

test('rail-lines/the line window is previous, active, next, next-next', () => {
  const sb = loadModern();
  const trackList = [];
  for (let i = 0; i < 7; i += 1) {
    trackList.push({ index: i, name: `L${i}`, type: 'Line', visible: true, active: i === 6 });
  }
  tabs(sb, { scene: { trackList } });
  render(sb);
  const list = rows(sb);
  eq(list.length, 4, 'the window has at most four rows');
  eq(list[0].dataset.modLine, '5', 'first row is the Previous target');
  eq(list[1].dataset.modLine, '6', 'second row is the active line');
  includes(list[1].className, 'active', 'the active row keeps its marker');
  eq(list[2].dataset.modLine, '0', 'third row is the next line (wrapping)');
  eq(list[3].dataset.modLine, '1', 'fourth row is two Next presses away');

  // Fewer lines than the window: no repeated rows.
  const two = loadModern();
  tabs(two);
  render(two);
  eq(rows(two).length, 2, 'two lines fill two rows, not four');
  eq(rows(two)[0].dataset.modLine, '1', 'the other line is the Previous target');
  eq(rows(two)[1].dataset.modLine, '0', 'the active line is second');
});

test('rail-lines/hidden and non-guidance tracks get honest empty states', () => {
  const sb = loadModern();
  tabs(sb, {
    scene: {
      trackList: [
        { index: 0, name: 'Hidden A', type: 'Line', visible: false, active: false },
        { index: 1, name: 'Hidden B', type: 'Curve', visible: false, active: false },
      ],
    },
  });
  render(sb);
  eq(rows(sb)[0].textContent, 'No visible AB lines', 'hidden guidance lines');
  const onlyPath = loadModern();
  tabs(onlyPath, {
    scene: { trackList: [{ index: 0, name: 'Path', type: 'Path', visible: true, active: false }] },
  });
  render(onlyPath);
  eq(rows(onlyPath)[0].textContent, 'No tracks in this field', 'Path is not an AB choice');
});

test('rail-lines/observer state comes from the live connection and control state', () => {
  const sb = loadModern();
  tabs(sb, { iHoldControl: false, connState: 'connected' });
  render(sb);
  eq(el(sb, 'mod-observer').hidden, false, 'connected observer is shown');
  tabs(sb, { iHoldControl: true, connState: 'connected' });
  render(sb);
  eq(el(sb, 'mod-observer').hidden, true, 'operator hides observer note');
  tabs(sb, { iHoldControl: false, connState: 'disconnected' });
  render(sb);
  eq(el(sb, 'mod-observer').hidden, true, 'a disconnected observer note is not claimed');
});

test('rail-lines/New AB line is paused for AutoSteer and explains contour mode', () => {
  const sb = loadModern();
  tabs(sb, { tick: { op: { autoSteer: true, contour: false } } });
  render(sb);
  eq(el(sb, 'mod-record-line').disabled, true, 'paused while AutoSteer is engaged');
  eq(el(sb, 'mod-lock-note').hidden, false, 'lock note shown');
  includes(el(sb, 'mod-lock-note').textContent, 'AutoSteer is engaged', 'AutoSteer reason');
  tabs(sb, { tick: { op: { autoSteer: false, contour: true } } });
  render(sb);
  eq(el(sb, 'mod-record-line').disabled, false, 'contour alone does not disable recording');
  includes(el(sb, 'mod-lock-note').textContent, 'Contour guidance is active', 'contour reason');
  tabs(sb, { tick: { op: { autoSteer: false, contour: false } } });
  render(sb);
  eq(el(sb, 'mod-lock-note').hidden, true, 'no lock note when clear');
});

test('rail-lines/quick AB, All lines and the labeled Menu reuse the existing surfaces', () => {
  const sb = loadModern();
  tabs(sb);
  render(sb);
  // The All lines label carries the host's total guidance count; don't pin the exact phrase.
  assertAllLinesLabel(sb, 2, 'All lines entry');
  eq(el(sb, 'mod-all-lines-panel').hidden, true, 'the full list starts closed');
  press(el(sb, 'mod-all-lines'));
  eq(el(sb, 'mod-all-lines-panel').hidden, false, 'All lines opens the full list');
  eq(el(sb, 'mod-all-lines').getAttribute('aria-expanded'), 'true', 'the toggle reports open');
  eq(items(sb).tracksManager.length, 0, 'the old Tracks Manager entry is no longer used');
  eq(items(sb).sent.length, 0, 'opening the list sends no line command');
  press(el(sb, 'mod-all-lines'));
  eq(el(sb, 'mod-all-lines-panel').hidden, true, 'a second press closes it');
  eq(el(sb, 'mod-all-lines').getAttribute('aria-expanded'), 'false');

  press(el(sb, 'mod-record-line'));
  deepEq(items(sb).dialogs, [], 'A+ starts directly through the shared Quick AB dispatcher');
  deepEq(items(sb).qab, ['heading-reset', 'side:right', 'start:aPlus'],
    'Quick AB starts in the existing state');
  eq(items(sb).sent.length, 0, 'the rail itself sends no line command');

  press(el(sb, 'mod-menu'));
  eq(el(sb, 'modern-settings').classList.contains('open'), true, 'Settings hub opened');
  eq(el(sb, 'mod-menu').getAttribute('aria-expanded'), 'true', 'menu reports expanded');
  eq(el(sb, 'mod-menu').classList.contains('active'), true, 'menu active style');
  press(el(sb, 'mod-menu'));
  eq(el(sb, 'modern-settings').classList.contains('open'), false, 'second press closes the hub');
  eq(el(sb, 'mod-menu').getAttribute('aria-expanded'), 'false', 'menu reports collapsed');
});

test('rail-lines/All lines shows every guidance line, stays open, and grows the map inset', () => {
  const sb = loadModern();
  tabs(sb, { scene: { trackList: [
    { index: 0, name: 'A', type: 'Line', visible: true, active: true },
    { index: 1, name: 'B', type: 'Curve', visible: true, active: false },
    { index: 2, name: 'C hidden', type: 'Line', visible: false, active: false },
    { index: 3, name: 'Path', type: 'Path', visible: true, active: false },
  ] } });
  render(sb);
  const panel = el(sb, 'mod-all-lines-panel');
  press(el(sb, 'mod-all-lines'));
  eq(panel.hidden, false, 'the full list opens');
  const list = el(sb, 'mod-all-lines-list');
  eq(list.children.length, 3, 'every guidance line, hidden included; Path excluded');
  eq(el(sb, 'mod-all-lines-count').textContent, '3 lines');
  const names = [...list.children].map(item => item.children[0].children[1].children[0].textContent);
  deepEq(names, ['A', 'B', 'C hidden']);
  assert(list.children[0].children[0].className.includes('active'), 'the active line is marked');
  const hiddenRow = list.children[2].children[0];
  includes(hiddenRow.className, 'mod-line-hidden', 'a hidden line is dimmed');
  includes(hiddenRow.children[1].children[1].textContent, 'Hidden', 'and labelled Hidden');
  deepEq(items(sb).mapArea[items(sb).mapArea.length - 1], [0, 600],
    'the map area grows by the All lines width');

  // Selecting a line keeps the list open.
  press(list.children[1].children[0]);
  deepEq(items(sb).sent, ['track.select|1'], 'the row reuses track.select');
  eq(panel.hidden, false, 'selecting does not close the list');
  press(el(sb, 'mod-prev'));
  eq(panel.hidden, false, 'Previous does not close the list');

  // The close button and Escape close it and restore the inset.
  press(el(sb, 'mod-all-lines-close'));
  eq(panel.hidden, true, 'the close button closes it');
  deepEq(items(sb).mapArea[items(sb).mapArea.length - 1], [0, 300],
    'the map inset returns to the rail width');

  press(el(sb, 'mod-all-lines'));
  eq(panel.hidden, false, 'reopened');
  sb.__dispatchGlobal('keydown', makeEvent({ key: 'Escape' }));
  eq(panel.hidden, true, 'Escape closes it');
});

test('rail-lines/quick AB and record stay inert for observers and engaged AutoSteer', () => {
  const observer = loadModern();
  tabs(observer, { iHoldControl: false });
  render(observer);
  press(el(observer, 'mod-record-line'));
  eq(items(observer).dialogs.length, 0, 'observer cannot start Quick AB from the rail');

  const steering = loadModern();
  tabs(steering, { tick: { op: { autoSteer: true, contour: false } } });
  render(steering);
  press(el(steering, 'mod-record-line'));
  eq(items(steering).dialogs.length, 0, 'engaged AutoSteer pauses Quick AB');
});

test('rail-lines/record starts use the shared dispatcher and recording takes over the rail', () => {
  const ab = loadModern();
  tabs(ab);
  render(ab);
  press(el(ab, 'mod-record-ab'));
  press(el(ab, 'mod-record-curve'));
  deepEq(items(ab).qab, [
    'heading-reset', 'side:right', 'start:driveAB',
    'heading-reset', 'side:right', 'start:recordCurve',
  ], 'both driven shortcuts use the same Quick AB dispatcher');

  const rec = loadModern();
  tabs(rec);
  render(rec);
  rec.abFlow = 'driveAB';
  rec.driveStep = 0;
  rec.drawPts = [];
  rec.curveMarks = [];
  render(rec);
  eq(el(rec, 'mod-normal-surface').hidden, true, 'normal line surface yields');
  eq(el(rec, 'mod-recording').hidden, false, 'recording surface shows');
  eq(el(rec, 'mod-rec-mode').textContent, 'Drive A to B', 'mode is named');
  eq(el(rec, 'mod-rec-step').textContent, 'Step', 'step comes from the existing flow hint');
  eq(el(rec, 'mod-rec-stats').textContent, 'No points yet', 'no progress before A');
  eq(el(rec, 'mod-rec-primary').textContent, 'Set Point A', 'primary sets A');
  includes(el(rec, 'mod-rec-consequence').textContent, 'starts the line', 'start consequence is named');
  press(el(rec, 'mod-rec-primary'));
  eq(items(rec).calls.slice(-1)[0], 'abSetPoint', 'primary reuses the existing set-point action');
  press(el(rec, 'mod-rec-cancel'));
  eq(items(rec).calls.slice(-1)[0], 'abCancel', 'cancel reuses the existing cancel action');

  const curve = loadModern();
  tabs(curve);
  render(curve);
  curve.abFlow = 'recordCurve';
  curve.driveStep = 1;
  curve.curveMarks = [{}, {}];
  render(curve);
  eq(el(curve, 'mod-rec-mode').textContent, 'Curve', 'curve mode is named');
  includes(el(curve, 'mod-rec-stats').textContent, '2 points',
    'curve progress from the sampled marks');
  includes(el(curve, 'mod-rec-stats').textContent, 'Elapsed ',
    'the card shows local elapsed time while recording');
  eq(el(curve, 'mod-rec-primary').textContent, 'Set Point B', 'primary completes the curve');
  includes(el(curve, 'mod-rec-consequence').textContent, 'completes the line',
    'finish consequence is named');
  curve.driveStep = 0;
  curve.curveMarks = [];
  render(curve);
  eq(el(curve, 'mod-rec-primary').textContent, 'Set Point A', 'curve start action');

  const one = loadModern();
  tabs(one);
  render(one);
  one.abFlow = 'driveAB';
  one.driveStep = 1;
  one.drawPts = [{}];
  render(one);
  includes(el(one, 'mod-rec-stats').textContent, '1 point', 'one captured point is singular');
  eq(el(one, 'mod-rec-primary').textContent, 'Set Point B', 'one point advances to B');
});

test('rail-lines/cancel asks before discarding captured recording data', () => {
  const fresh = loadModern();
  tabs(fresh);
  render(fresh);
  fresh.abFlow = 'driveAB';
  fresh.driveStep = 0;
  fresh.drawPts = [];
  render(fresh);
  press(el(fresh, 'mod-rec-cancel'));
  eq(items(fresh).confirms.length, 0, 'cancel before the first point is immediate');
  eq(items(fresh).calls.slice(-1)[0], 'abCancel', 'fresh cancel uses the existing cancel action');

  const sb = loadModern({ confirm: 'manual' });
  tabs(sb);
  render(sb);
  sb.abFlow = 'recordCurve';
  sb.driveStep = 1;
  sb.curveMarks = [{}, {}];
  render(sb);
  press(el(sb, 'mod-rec-cancel'));
  eq(items(sb).confirms.length, 1, 'a recording with data asks before discarding');
  includes(items(sb).confirms[0].title, 'Discard', 'the confirmation names the discard');
  eq(items(sb).confirms[0].labels.cancel, 'Keep recording', 'Keep is the safe default label');
  eq(items(sb).confirms[0].labels.confirm, 'Discard recording', 'Discard is explicit');
  eq(items(sb).calls.includes('abCancel'), false, 'Cancel/Keep does not discard');
  items(sb).confirms[0].callback();
  eq(items(sb).calls.slice(-1)[0], 'abCancel', 'Confirm reuses the existing cancel action');
});

test('rail-lines/recording keeps AutoSteer and gates local steps on control', () => {
  const sb = loadModern({ confirm: 'manual' });
  tabs(sb, { tick: { op: { autoSteer: false, autoSteerAvail: true, contour: false }, activeTrackName: 'A' } });
  sb.abFlow = 'driveAB'; sb.driveStep = 1; sb.drawPts = [{}];
  render(sb);
  eq(el(sb, 'mod-recording').hidden, false, 'recording card is visible');
  sb.tick.op.autoSteer = true;
  render(sb);
  eq(el(sb, 'mod-steer').getAttribute('aria-pressed'), 'true', 'separate dock reflects steering during recording');
  eq(el(sb, 'mod-rec-primary').disabled, true, 'point setting is paused while steering');
  press(el(sb, 'mod-rec-primary'));
  assert(!items(sb).calls.includes('abSetPoint'), 'no optimistic point while steering');
  press(el(sb, 'mod-steer'));
  deepEq(items(sb).sent, ['autosteer.toggle'], 'steering can be turned off from the recording surface');
  setControlRole(sb, 'observer');
  render(sb);
  eq(el(sb, 'mod-rec-primary').disabled, true, 'observer cannot advance');
  eq(el(sb, 'mod-rec-cancel').disabled, true, 'observer cannot clear local state');
  press(el(sb, 'mod-rec-primary')); press(el(sb, 'mod-rec-cancel'));
  assert(!items(sb).calls.includes('abSetPoint') && !items(sb).calls.includes('abCancel'), 'no local advancement after control loss');
  eq(items(sb).confirms.length, 0, 'no discard prompt without control');
  sb.iHoldControl = true; sb.connState = 'disconnected';
  press(el(sb, 'mod-rec-primary')); press(el(sb, 'mod-rec-cancel'));
  assert(!items(sb).calls.includes('abSetPoint') && !items(sb).calls.includes('abCancel'),
    'a stale control flag on a disconnected link cannot advance or discard');
});

test('rail-lines/disconnected stale authority cannot start a recording', () => {
  const sb = loadModern(); tabs(sb);
  sb.connState = 'disconnected'; sb.iHoldControl = true;
  render(sb);
  eq(el(sb, 'mod-record-ab').disabled, true, 'record start is disabled without a link');
  press(el(sb, 'mod-record-ab'));
  assert(!items(sb).calls.includes('qabStart:driveAB'), 'no optimistic recording starts offline');
});

test('rail-lines/recording discard confirmation rechecks control and flow', () => {
  const sb = loadModern({ confirm: 'manual' });
  tabs(sb); sb.abFlow = 'driveAB'; sb.driveStep = 1; sb.drawPts = [{}];
  render(sb); press(el(sb, 'mod-rec-cancel'));
  setControlRole(sb, 'observer');
  items(sb).confirms[0].callback();
  assert(!items(sb).calls.includes('abCancel'), 'lost control leaves the local flow intact');
});

test('rail-lines/field and job come from host state', () => {
  const sb = loadModern();
  tabs(sb, {
    scene: { fieldName: 'North 40', trackList: [] },
    statusBar: { jobName: 'Spray job 7' },
  });
  render(sb);
  eq(el(sb, 'mod-field-name').textContent, 'North 40', 'host field name');
  eq(el(sb, 'mod-field-name').getAttribute('translate'), 'no', 'user field name is not translated');
  eq(el(sb, 'mod-field-job').hidden, false, 'job row shown');
  eq(el(sb, 'mod-field-job-name').textContent, 'Spray job 7', 'host job name');
  sb.statusBar = { jobName: '' };
  render(sb);
  eq(el(sb, 'mod-field-job').hidden, true, 'job row hidden without a job');
});

test('rail-lines/nearby field chips switch through the existing field.openOnly command', () => {
  const fields = [
    { name: 'Alpha', hasDistance: true, distanceKm: 0.1, areaHa: 1 },
    { name: 'Charlie', hasDistance: true, distanceKm: 2.5, areaHa: 2 },
    { name: 'Bravo', hasDistance: true, distanceKm: 1.2, areaHa: 3 },
    { name: 'Delta', hasDistance: false, distanceKm: Number.NaN, areaHa: 4 },
    { name: 'Echo', hasDistance: true, distanceKm: 0.5, areaHa: 5 },
  ];
  const sb = loadModern();
  sb.fieldOps = { activeField: 'Alpha', fields };
  tabs(sb, { scene: { fieldName: 'Alpha', trackList: [] } });
  render(sb);
  const chips = Array.from(el(sb, 'mod-field-chips').children);
  deepEq(chips.map(c => c.textContent), ['Echo', 'Bravo', 'Charlie'],
    'nearest fields, active excluded, capped at three');
  eq(el(sb, 'mod-field-chips').hidden, false, 'the nearby strip is visible with alternatives');
  press(chips[0]);
  deepEq(items(sb).sent, ['field.openOnly|Echo'],
    'a chip reuses the existing field.openOnly command');

  const observer = loadModern();
  observer.fieldOps = { activeField: 'Alpha', fields };
  tabs(observer, { role: 'observer', scene: { fieldName: 'Alpha', trackList: [] } });
  render(observer);
  const observerChip = Array.from(el(observer, 'mod-field-chips').children)[0];
  eq(observerChip.disabled, true, 'an observer cannot switch fields from a chip');
  press(observerChip);
  eq(items(observer).sent.length, 0, 'an observer chip sends no field command');

  const busy = loadModern();
  busy.fieldOps = { activeField: 'Alpha', fields };
  tabs(busy, { scene: { fieldName: 'Alpha', trackList: [] } });
  busy.abFlow = {};
  render(busy);
  const busyChip = Array.from(el(busy, 'mod-field-chips').children)[0];
  eq(busyChip.disabled, true, 'a local unsaved flow disables the field chips');
  press(busyChip);
  eq(items(busy).sent.length, 0, 'a blocked chip sends no field command');
});

test('rail-lines/recent fields lead the chip strip and invalid names are dropped', () => {
  const fields = [
    { name: 'Alpha', hasDistance: true, distanceKm: 0.1, areaHa: 1 },
    { name: 'Bravo', hasDistance: true, distanceKm: 1.2, areaHa: 2 },
    { name: 'Charlie', hasDistance: true, distanceKm: 2.5, areaHa: 3 },
    { name: 'Delta', hasDistance: false, distanceKm: Number.NaN, areaHa: 4 },
  ];
  const sb = loadModern({
    stored: { 'agopenweb.modernui.recentFields': JSON.stringify(['Charlie', 'Deleted', 'Alpha']) },
  });
  sb.fieldOps = { activeField: 'Alpha', fields, jobs: [] };
  tabs(sb, { scene: { fieldName: 'Alpha', trackList: [] } });
  render(sb);
  deepEq(Array.from(el(sb, 'mod-field-chips').children).map(c => c.textContent),
    ['Charlie', 'Bravo', 'Delta'],
    'recent fields lead, the active field and deleted names are dropped, then nearest fill');
  includes(sb.localStorage.getItem('agopenweb.modernui.recentFields'), 'Alpha',
    'the open field is remembered under the fork-local key');
});

test('rail-lines/pinned fields lead the strip and the pin toggles locally', () => {
  const fields = [
    { name: 'Alpha', hasDistance: true, distanceKm: 0.1, areaHa: 1 },
    { name: 'Bravo', hasDistance: true, distanceKm: 1.2, areaHa: 2 },
    { name: 'Charlie', hasDistance: true, distanceKm: 2.5, areaHa: 3 },
    { name: 'Delta', hasDistance: false, distanceKm: Number.NaN, areaHa: 4 },
  ];
  const sb = loadModern({
    stored: {
      'agopenweb.modernui.pinnedFields': JSON.stringify(['Charlie']),
      'agopenweb.modernui.recentFields': JSON.stringify(['Bravo']),
    },
  });
  sb.fieldOps = { activeField: 'Alpha', fields, jobs: [] };
  tabs(sb, { scene: { fieldName: 'Alpha', trackList: [] } });
  render(sb);
  deepEq(Array.from(el(sb, 'mod-field-chips').children).map(c => c.textContent),
    ['Charlie', 'Bravo', 'Delta'], 'pinned first, then recent, then nearest');
  eq(el(sb, 'mod-field-pin').hidden, false, 'the active field has a pin control');
  eq(el(sb, 'mod-field-pin').getAttribute('aria-pressed'), 'false', 'Alpha is not pinned');
  press(el(sb, 'mod-field-pin'));
  render(sb);
  eq(el(sb, 'mod-field-pin').getAttribute('aria-pressed'), 'true', 'the pin is local and immediate');
  includes(sb.localStorage.getItem('agopenweb.modernui.pinnedFields'), 'Alpha',
    'the pinned field is stored under the fork-local key');

  sb.scene.fieldName = 'Bravo';
  sb.tick.activeTrackName = 'Bravo';
  render(sb);
  const chips = Array.from(el(sb, 'mod-field-chips').children).map(c => c.textContent);
  eq(chips[0], 'Alpha', 'a pinned field leads the strip when another field is active');
  eq(chips.includes('Bravo'), false, 'the active field is never a chip');
});

test('rail-lines/job row resumes the last job or opens the existing chooser', () => {
  const fields = [{ name: 'Alpha', hasDistance: true, distanceKm: 0.1, areaHa: 1 }];
  const jobs = [
    { fieldName: 'Alpha', taskName: 'Spray old', workType: 'Spraying', status: 1, lastOpened: '2026-11-20 10:00' },
    { fieldName: 'Alpha', taskName: 'Spray 7', workType: 'Spraying', status: 0, lastOpened: '2026-11-24 09:00' },
  ];
  const sb = loadModern();
  sb.fieldOps = { activeField: 'Alpha', fields, jobs };
  tabs(sb, { scene: { fieldName: 'Alpha', trackList: [] }, statusBar: { jobName: '' } });
  render(sb);
  eq(el(sb, 'mod-field-job').hidden, false, 'last job is visible');
  eq(el(sb, 'mod-field-job-name').textContent, 'Spraying',
    'the row shows the work type, not the task date/name');
  eq(el(sb, 'mod-field-job-name').getAttribute('translate'), 'no',
    'the work type is user data, not a translation key');
  eq(el(sb, 'mod-job-action').textContent, 'Resume', 'last job offers Resume');
  press(el(sb, 'mod-job-action'));
  deepEq(items(sb).sent, ['field.resumeJob|Alpha\tSpray 7'],
    'Resume reuses the existing field.resumeJob command');

  const active = loadModern();
  active.fieldOps = { activeField: 'Alpha', fields, jobs };
  tabs(active, { scene: { fieldName: 'Alpha', trackList: [] }, statusBar: { jobName: 'Spray 7' } });
  render(active);
  eq(el(active, 'mod-field-job-name').textContent, 'Spraying',
    'the active job shows the same work type');
  eq(el(active, 'mod-job-action').textContent, 'Jobs…', 'active job opens the chooser');
  press(el(active, 'mod-job-action'));
  eq(items(active).fieldsOpen.length, 1, 'Jobs… opens the existing Fields and Jobs chain');

  const observer = loadModern();
  observer.fieldOps = { activeField: 'Alpha', fields, jobs };
  tabs(observer, { role: 'observer', scene: { fieldName: 'Alpha', trackList: [] }, statusBar: { jobName: '' } });
  render(observer);
  eq(el(observer, 'mod-job-action').disabled, true, 'an observer cannot resume a job');
  press(el(observer, 'mod-job-action'));
  eq(items(observer).sent.length, 0, 'an observer Resume sends nothing');
});

test('rail-lines/field chips warn before stopping AutoSteer or sections', () => {
  const fields = [{ name: 'Alpha', hasDistance: true, distanceKm: 0.1, areaHa: 1 },
    { name: 'Bravo', hasDistance: true, distanceKm: 1.2, areaHa: 2 }];

  const steering = loadModern({ confirm: 'manual' });
  steering.fieldOps = { activeField: 'Alpha', fields, jobs: [] };
  tabs(steering, { scene: { fieldName: 'Alpha', trackList: [] },
    tick: { op: { autoSteer: true, contour: false } } });
  render(steering);
  press(Array.from(el(steering, 'mod-field-chips').children)[0]);
  eq(items(steering).confirms.length, 1, 'AutoSteer prompts before a field switch');
  includes(items(steering).confirms[0].title, 'Switch to field', 'the prompt names the field');
  eq(items(steering).confirms[0].labels.cancel, 'Stay', 'Stay is the safe default label');
  eq(items(steering).confirms[0].labels.confirm, 'Switch field', 'Switch is explicit');
  eq(items(steering).sent.length, 0, 'nothing is sent before the confirmation');
  items(steering).confirms[0].callback();
  deepEq(items(steering).sent, ['field.openOnly|Bravo'], 'Confirm uses field.openOnly');

  const sections = loadModern({ confirm: 'manual' });
  sections.fieldOps = { activeField: 'Alpha', fields, jobs: [] };
  tabs(sections, { scene: { fieldName: 'Alpha', trackList: [] } });
  sections.tick.sections = [2];
  render(sections);
  press(Array.from(el(sections, 'mod-field-chips').children)[0]);
  eq(items(sections).confirms.length, 1, 'a live section also prompts before a field switch');
});

test('rail-lines/field confirmation rechecks recording, field and authority', () => {
  for (const change of [
    sb => { sb.boundary = { isRecording: true }; },
    sb => { sb.scene.fieldName = 'Changed'; },
    sb => { sb.fieldOps.fields = [{ name: 'Alpha' }]; },
    sb => setControlRole(sb, 'observer'),
  ]) {
    const sb = loadModern({ confirm: 'manual' });
    sb.fieldOps = { fields: [{ name: 'Alpha' }, { name: 'Bravo' }], jobs: [] };
    tabs(sb, { scene: { fieldName: 'Alpha' }, tick: { op: { autoSteer: true } } });
    sb.modernSwitchField('Bravo');
    eq(items(sb).confirms.length, 1, 'switch prompts');
    change(sb);
    items(sb).confirms[0].callback();
    deepEq(items(sb).sent, [], 'stale field switch is not sent');
  }
});

test('rail-lines/All lines links delegate to the existing track tools', () => {
  const sb = loadModern(); tabs(sb); render(sb);
  el(sb, 'bn-tracks').addEventListener('pointerdown', () => sb.openTracksManager());
  el(sb, 'bn-quickab').addEventListener('pointerdown', () => sb.openDialog('dlg-quickab'));
  press(el(sb, 'mod-all-lines'));
  press(el(sb, 'mod-tracks-manager')); press(el(sb, 'mod-quick-ab'));
  eq(items(sb).tracksManager.length, 1, 'Tracks Manager uses its original button');
  deepEq(items(sb).dialogs, ['dlg-quickab'], 'Quick AB uses its original button');
  sb.abFlow = 'driveAB';
  press(el(sb, 'mod-tracks-manager')); press(el(sb, 'mod-quick-ab'));
  eq(items(sb).tracksManager.length, 1, 'manager cannot replace a local recording');
  eq(items(sb).dialogs.length, 1, 'Quick AB cannot replace a local recording');
});

test('rail-lines/auto track button follows host state and reuses track.autoTrack', () => {
  const sb = loadModern();
  tabs(sb, { tick: { op: { autoSteer: false, contour: false }, activeTrackName: 'A',
    tools: { autoTrack: true } } });
  render(sb);
  eq(el(sb, 'mod-auto-track').hidden, false, 'the Auto control follows tick.tools.autoTrack');
  eq(el(sb, 'mod-auto-track').getAttribute('aria-pressed'), 'true', 'Auto reports its on state');
  includes(el(sb, 'mod-status').textContent, 'Auto track', 'the status region names Auto track');
  press(el(sb, 'mod-auto-track'));
  deepEq(items(sb).sent, ['track.autoTrack'], 'the rail reuses the existing Auto track command');

  sb.tick.tools.autoTrack = false;
  render(sb);
  eq(el(sb, 'mod-auto-track').hidden, false, 'the Auto control stays available when off');
  eq(el(sb, 'mod-auto-track').getAttribute('aria-pressed'), 'false', 'Auto reports its off state');

  sb.scene.hasField = false;
  sb.scene.fieldName = '';
  sb.tick.tools.autoTrack = true;
  render(sb);
  eq(el(sb, 'mod-auto-track').hidden, true, 'Auto track is not offered without a field');

  const observer = loadModern();
  tabs(observer, { role: 'observer',
    tick: { op: { autoSteer: false, contour: false }, activeTrackName: 'A',
      tools: { autoTrack: false } } });
  render(observer);
  eq(el(observer, 'mod-auto-track').disabled, true, 'an observer cannot toggle Auto track');
  press(el(observer, 'mod-auto-track'));
  eq(items(observer).sent.length, 0, 'an observer Auto press sends nothing');
});

test('rail-lines/lateral nudge uses simple large ± controls and the host readout', () => {
  const sb = loadModern();
  tabs(sb);
  sb.tick.op.nudgeOffset = -0.12;
  render(sb);
  eq(el(sb, 'mod-nudge-value').textContent, '12L', 'host nudge offset is shown as left cm');
  includes(el(sb, 'mod-nudge-value').getAttribute('aria-label'), '12 cm left',
    'the value label carries the unit and side');
  press(el(sb, 'mod-nudge-left'));
  press(el(sb, 'mod-nudge-right'));
  deepEq(items(sb).sent, ['track.nudgeLeft', 'track.nudgeRight'],
    'the two controls reuse the existing small-nudge commands');

  const observer = loadModern();
  tabs(observer, { role: 'observer' });
  render(observer);
  eq(el(observer, 'mod-nudge-left').disabled, true, 'an observer cannot nudge');
  press(el(observer, 'mod-nudge-left'));
  eq(items(observer).sent.length, 0, 'an observer nudge sends nothing');

  const noLine = loadModern();
  tabs(noLine, { tick: { op: { autoSteer: false, contour: false }, activeTrackName: '' } });
  render(noLine);
  eq(el(noLine, 'mod-nudge-left').disabled, true, 'nudge needs an active line');
});

// ---- Line adjustment page: the Classic Ref Nudge panel, hosted in a full map page -------
function openAdjust(sb) {
  press(el(sb, 'mod-line-adjust'));
}

test('line-adjust/the rail cog opens the full-map page and starts the existing Ref Nudge session', () => {
  const sb = loadModern();
  tabs(sb);
  render(sb);
  eq(el(sb, 'mod-lineadjust').classList.contains('open'), false, 'the page starts closed');
  openAdjust(sb);
  eq(el(sb, 'mod-lineadjust').classList.contains('open'), true, 'the cog opens the page');
  eq(el(sb, 'mod-line-adjust').getAttribute('aria-expanded'), 'true', 'the cog reports expanded');
  eq(sb.refNudgeOpen, true, 'the existing Ref Nudge session starts');
  assert(items(sb).calls.includes('openRefNudge'),
    'the page reuses the Classic openRefNudge, not a second session');
  eq(el(sb, 'mod-la-host').children.length, 1, 'one panel is hosted, not a copy');
  eq(el(sb, 'mod-la-host').children[0].id, 'refnudge', 'the Classic panel itself moves in');
  eq(el(sb, 'mod-la-name').textContent, 'A', 'the host line name is shown in the page header');
  eq(el(sb, 'mod-la-host').classList.contains('is-blocked'), false,
    'an operator with an active line can adjust');
});

test('line-adjust/the page mirrors the existing session and returns the panel when the rail steps aside', () => {
  const sb = loadModern();
  tabs(sb);
  render(sb);
  openAdjust(sb);
  // Save/Undo/Exit in the Classic panel ends the session; the page follows on the next frame.
  sb.closeRefNudge();
  render(sb);
  eq(el(sb, 'mod-lineadjust').classList.contains('open'), false, 'the page mirrors the session');
  eq(el(sb, 'mod-la-host').children.length, 1,
    'the panel stays hosted while the rail is live (the page, not the panel, carries the state)');

  // The Classic bottom-bar Ref Nudge button remains an entry: the page follows its session.
  sb.openRefNudge();
  render(sb);
  eq(el(sb, 'mod-lineadjust').classList.contains('open'), true,
    'a Ref Nudge started from the bottom bar still opens the page');

  // A full card pane takes the right edge: Modern is suspended, so Classic gets the panel back.
  sb.CardPane = { layout: 'full' };
  el(sb, 'cardpane').classList.add('show');
  render(sb);
  eq(el(sb, 'mod-lineadjust').classList.contains('open'), false,
    'the page does not float over a suspended rail');
  // The stub's appendChild does not detach like the real DOM does, so check the real contract:
  // the one panel is reparented out of the page.
  eq(el(sb, 'refnudge').parentNode, sb.__test.body,
    'the Classic panel is back in the page body for the Classic layout');
});

test('line-adjust/closing a moved line reuses the Classic pending-move confirmation', () => {
  const sb = loadModern({ confirm: 'manual' });
  tabs(sb, { tick: { op: { autoSteer: false, contour: false, refNudgePending: true, refNudgeMoved: 0.12 }, activeTrackName: 'A' } });
  render(sb);
  openAdjust(sb);
  render(sb);
  includes(el(sb, 'mod-la-note').textContent, 'not saved yet',
    'the page says the move is not saved');
  let exits = 0;
  el(sb, 'rf-exit').addEventListener('pointerdown', () => { exits += 1; });
  press(el(sb, 'mod-la-close'));
  eq(exits, 1, 'the page hands the close to the Classic Exit handler');
  eq(el(sb, 'mod-lineadjust').classList.contains('open'), true,
    'the page waits for that handler and its confirmation');
  eq(sb.refNudgeOpen, true, 'the session is untouched until the question is answered');
  eq(items(sb).sent.length, 0, 'closing asks first; nothing is saved before confirmation');
});

test('line-adjust/observer and no-line states explain the block and stay disabled', () => {
  const observer = loadModern();
  tabs(observer, { role: 'observer' });
  render(observer);
  openAdjust(observer);
  render(observer);
  eq(el(observer, 'mod-la-host').classList.contains('is-blocked'), true,
    'an observer cannot press the moved-line controls');
  eq(el(observer, 'mod-la-host').getAttribute('aria-disabled'), 'true',
    'the block is announced, not only painted');
  includes(el(observer, 'mod-la-empty-text').textContent, 'Observer: view only',
    'the page gives the observer the same reason as the rail');
  eq(el(observer, 'mod-la-empty').hidden, false, 'the empty state explains it');

  const noLine = loadModern();
  tabs(noLine, { tick: { op: { autoSteer: false, contour: false }, activeTrackName: '' } });
  render(noLine);
  openAdjust(noLine);
  render(noLine);
  eq(el(noLine, 'mod-la-name').textContent, 'No active line', 'the header says there is no line');
  includes(el(noLine, 'mod-la-empty-text').textContent, 'Choose a line',
    'the page says what to do next');
  eq(el(noLine, 'mod-la-all-lines').hidden, false,
    'the existing Tracks Manager is offered instead of a dead control');
  eq(el(noLine, 'mod-la-host').classList.contains('is-blocked'), true,
    'a move without a line is disabled');
});

test('line-adjust/opening the hub or pressing Escape defers to the guarded page close', () => {
  const hub = loadModern({ confirm: 'manual' });
  tabs(hub, { tick: { op: { autoSteer: false, contour: false, refNudgePending: true }, activeTrackName: 'A' } });
  render(hub);
  openAdjust(hub);
  let exits = 0;
  el(hub, 'rf-exit').addEventListener('pointerdown', () => { exits += 1; });
  press(el(hub, 'mod-menu'));
  eq(exits, 1, 'the hub defers to the page close');
  eq(el(hub, 'modern-settings').classList.contains('open'), false,
    'the hub does not cover a live adjustment with a pending move');

  const esc = loadModern();
  tabs(esc);
  render(esc);
  openAdjust(esc);
  let escExits = 0;
  el(esc, 'rf-exit').addEventListener('pointerdown', () => { escExits += 1; });
  esc.__dispatchGlobal('keydown', makeEvent({ key: 'Escape' }));
  eq(escExits, 1, 'Escape reuses the guarded close');
  eq(el(esc, 'mod-lineadjust').classList.contains('open'), true,
    'Escape keeps the page while the session is live');
  esc.closeRefNudge();
  render(esc);
  eq(el(esc, 'mod-lineadjust').classList.contains('open'), false,
    'the page closes once the session has ended');
});

test('rail-lines/snap to pivot reuses track.snapPivot under the nudge gates', () => {
  const sb = loadModern();
  tabs(sb);
  render(sb);
  eq(el(sb, 'mod-snap-pivot').disabled, false, 'available with control and an active line');
  press(el(sb, 'mod-snap-pivot'));
  deepEq(items(sb).sent, ['track.snapPivot'], 'reuses the existing snap-to-pivot command');

  const observer = loadModern();
  tabs(observer, { role: 'observer' });
  render(observer);
  eq(el(observer, 'mod-snap-pivot').disabled, true, 'an observer cannot snap the line');
  press(el(observer, 'mod-snap-pivot'));
  eq(items(observer).sent.length, 0, 'an observer press sends nothing');

  const noLine = loadModern();
  tabs(noLine, { tick: { op: { autoSteer: false, contour: false }, activeTrackName: '' } });
  render(noLine);
  eq(el(noLine, 'mod-snap-pivot').disabled, true, 'snap to pivot needs an active line');
});

test('line-adjust/line options dispatch the original AB-flyout buttons', () => {
  const sb = loadModern();
  tabs(sb);
  render(sb);
  openAdjust(sb);
  render(sb);
  const opts = el(sb, 'mod-la-options');
  eq(opts.children.length, 11, 'every AB-flyout line option is listed');
  eq(opts.children[0].textContent, 'Smooth curve', 'the page shows a word, not an icon alone');
  eq(opts.children[0].disabled, false, 'with control and a line they are usable');

  let smooth = 0, del = 0;
  el(sb, 'bn-smooth').addEventListener('pointerdown', () => { smooth += 1; });
  el(sb, 'bn-delcontours').addEventListener('pointerdown', () => { del += 1; });
  press(opts.children[0]);
  press(opts.children[1]);
  eq(smooth, 1, 'the page handed the press to the existing bottom-bar button');
  eq(del, 1, 'the existing confirmation-owning handler is reused');
  eq(items(sb).sent.length, 0, 'the page copies no command of its own');

  const observer = loadModern();
  tabs(observer, { role: 'observer' });
  render(observer);
  openAdjust(observer);
  render(observer);
  eq(el(observer, 'mod-la-options').children[0].disabled, true,
    'an observer cannot use the line options');
  includes(el(observer, 'mod-la-options-note').textContent, 'Observer: view only',
    'the page says why');
});

test('settings/guidance state and the mapping colour reuse the existing commands', () => {
  const sb = loadModern();
  tabs(sb, { tick: {
    op: { autoSteer: false, contour: false }, activeTrackName: 'A',
    tools: { tramMode: 2, skipMode: 1, skipRows: 4, headlandOn: true, sectionInHeadland: false },
  } });
  render(sb);
  eq(el(sb, 'mod-set-tram').textContent, 'Tram lines: Lines', 'tram mode is host state');
  eq(el(sb, 'mod-set-skipmode').textContent, 'U-Turn skip mode: Alternative', 'skip mode is host state');
  eq(el(sb, 'mod-set-skiprows').textContent, 'U-Turn skip rows: 4', 'skip rows are host state');
  press(el(sb, 'mod-set-tram'));
  press(el(sb, 'mod-set-skipmode'));
  press(el(sb, 'mod-set-skiprows'));
  deepEq(items(sb).sent, ['tram.cycle', 'youturn.skipToggle', 'youturn.skipCycle'],
    'the cycle-only host commands are reused, with the state in the label');

  const observer = loadModern();
  tabs(observer, { role: 'observer' });
  render(observer);
  eq(el(observer, 'mod-set-tram').disabled, true, 'an observer cannot change the tram mode');
  eq(el(observer, 'mod-set-skipmode').disabled, true, 'an observer cannot change the skip mode');
  eq(el(observer, 'mod-set-skiprows').disabled, true, 'an observer cannot change skip rows');
  press(el(observer, 'mod-set-tram'));
  eq(items(observer).sent.length, 0, 'an observer press sends nothing');

  const colors = el(sb, 'mod-set-colors');
  eq(colors.children.length, 8, 'the eight mapping-colour presets are offered');
  eq(colors.children[0].classList.contains('selected'), true, 'the host colour is marked');
  press(colors.children[2]);
  deepEq(items(sb).cfg, ['tool.singleCoverageColor:FFD700'],
    'a swatch writes the same config key the Classic bottom-bar button changes');
});

test('map-controls/the optional cluster shows host state and dispatches the original buttons', () => {
  const sb = loadModern();
  tabs(sb, { tick: {
    op: { autoSteer: false, contour: false }, activeTrackName: 'A',
    tools: { tramMode: 0, skipMode: 0, skipRows: 0, headlandOn: true, sectionInHeadland: true },
  } });
  render(sb);
  const host = el(sb, 'mod-map-controls');
  eq(host.hidden, false, 'a field with the rail live shows the cluster');
  eq(el(sb, 'mod-map-flags').hidden, false, 'Flags is on by default');
  eq(el(sb, 'mod-map-headland').hidden, false, 'Headland is on by default');
  eq(el(sb, 'mod-map-sections').hidden, false, 'Sections in headland is on by default');
  eq(el(sb, 'mod-map-toolheading').hidden, true,
    'Reset tool heading defaults to a trailing implement only');
  eq(el(sb, 'mod-map-headland-state').textContent, 'On', 'the headland state is host state');
  eq(el(sb, 'mod-map-sections-state').textContent, 'Auto-off',
    'sectionInHeadland means sections are turned off in the headland');
  eq(el(sb, 'mod-map-headland').getAttribute('aria-pressed'), 'true', 'the state is announced');

  let flags = 0, headland = 0, reset = 0;
  el(sb, 'bn-flags').addEventListener('pointerdown', () => { flags += 1; });
  el(sb, 'bn-headland').addEventListener('pointerdown', () => { headland += 1; });
  el(sb, 'bn-reset-heading').addEventListener('pointerdown', () => { reset += 1; });
  press(el(sb, 'mod-map-flags'));
  press(el(sb, 'mod-map-headland'));
  press(el(sb, 'mod-set-mode-always'));   // Always
  render(sb);
  eq(el(sb, 'mod-map-toolheading').hidden, false, 'Always shows the reset action');
  press(el(sb, 'mod-map-toolheading'));
  eq(flags, 1, 'Flags hands the press to the Classic flags button');
  eq(headland, 1, 'Headland hands the press to the Classic bottom-bar button');
  eq(reset, 1, 'Reset tool heading hands the press to the Classic bottom-bar button');
  eq(items(sb).sent.length, 0, 'the cluster copies no command of its own');

  // A preference hides a control and survives in fork-local storage.
  press(el(sb, 'mod-set-map-flags'));
  eq(el(sb, 'mod-map-flags').hidden, true, 'the settings switch hides the on-map button');
  eq(JSON.parse(sb.localStorage.getItem('agopenweb.modernui.mapControls')).flags, false,
    'the choice is stored, not just applied');

  // The trailing-tool default follows the tool type (TBT / Trailing), not the vehicle type.
  const trailing = loadModern();
  trailing.config.tool.type = 3;
  tabs(trailing);
  render(trailing);
  eq(el(trailing, 'mod-map-toolheading').hidden, false,
    'a trailing tool shows Reset tool heading by default');
  trailing.config.tool.type = 2;
  render(trailing);
  eq(el(trailing, 'mod-map-toolheading').hidden, false, 'a TBT tool does too');
  trailing.config.tool.type = 1;
  render(trailing);
  eq(el(trailing, 'mod-map-toolheading').hidden, true,
    'a fixed rear tool hides it by default');
});

test('map-controls/the flags flyout moves with the rail and returns on suspend', () => {
  const sb = loadModern();
  tabs(sb);
  render(sb);
  const fly = el(sb, 'bn-flyout-flags');
  eq(fly.parentNode, el(sb, 'mod-map-controls'),
    'the one Classic flyout is hosted by the cluster, not copied');

  sb.CardPane = { layout: 'full' };
  el(sb, 'cardpane').classList.add('show');
  render(sb);
  eq(el(sb, 'mod-map-controls').hidden, true, 'a suspended rail has no cluster');
  eq(fly.parentNode, el(sb, 'bottomnav'),
    'the flyout is back in the Classic bottom bar');
});

test('map-controls/the auto U-turn panel joins the U-turn stack and returns on suspend', () => {
  const sb = loadModern();
  tabs(sb);
  render(sb);
  const ind = el(sb, 'uturn-indicator');
  eq(ind.parentNode, el(sb, 'onscreenbtns'),
    'the one auto U-turn panel moves into the top-left stack, not copied');

  sb.CardPane = { layout: 'full' };
  el(sb, 'cardpane').classList.add('show');
  render(sb);
  eq(ind.parentNode, sb.__test.body,
    'a suspended rail returns the indicator to the page body for Classic');
});

test('map-controls/the guidance cluster replaces the right nav and dispatches its buttons', () => {
  const sb = loadModern();
  tabs(sb, { tick: {
    op: { autoSteer: false, contour: false, sectionAuto: true, sectionManual: false, youturn: true },
    activeTrackName: 'A',
  } });
  render(sb);
  const host = el(sb, 'mod-map-controls-right');
  eq(host.hidden, false, 'a field with the rail live shows the guidance cluster');
  eq(el(sb, 'mod-map-contour').hidden, false, 'Contour is on by default');
  eq(el(sb, 'mod-map-sections-auto').hidden, false, 'Auto sections is on by default');
  eq(el(sb, 'mod-map-sections-manual').hidden, false, 'Manual sections is on by default');
  eq(el(sb, 'mod-map-youturn').hidden, false, 'Auto U-turn is on by default');
  eq(el(sb, 'mod-map-isobus').hidden, true, 'ISOBUS only when the host reports it');
  eq(el(sb, 'mod-map-contourlock').hidden, true, 'Contour lock only in contour mode');
  eq(el(sb, 'mod-map-sections-auto-state').textContent, 'On', 'the section mode is host state');
  eq(el(sb, 'mod-map-sections-manual-state').textContent, 'Off', 'each mode has its own state');
  eq(el(sb, 'mod-map-youturn-state').textContent, 'On', 'auto U-turn is host state');

  let contour = 0, auto = 0, manual = 0, youturn = 0;
  el(sb, 'rn-contour').addEventListener('pointerdown', () => { contour += 1; });
  el(sb, 'rn-auto').addEventListener('pointerdown', () => { auto += 1; });
  el(sb, 'rn-manual').addEventListener('pointerdown', () => { manual += 1; });
  el(sb, 'rn-youturn').addEventListener('pointerdown', () => { youturn += 1; });
  press(el(sb, 'mod-map-contour'));
  press(el(sb, 'mod-map-sections-auto'));
  press(el(sb, 'mod-map-sections-manual'));
  press(el(sb, 'mod-map-youturn'));
  eq(contour, 1, 'Contour hands the press to the Classic right-nav button');
  eq(auto, 1, 'Auto sections hands the press to the right-nav button');
  eq(manual, 1, 'Manual sections hands the press to the right-nav button');
  eq(youturn, 1, 'Auto U-turn hands the press to the right-nav button');
  eq(items(sb).sent.length, 0, 'the cluster copies no command of its own');

  // Contour mode: auto U-turn is not applicable, contour lock becomes available.
  sb.tick.op.contour = true;
  sb.scene.contourLocked = true;
  render(sb);
  eq(el(sb, 'mod-map-youturn').hidden, true, 'auto U-turn hides in contour mode, as in the nav');
  eq(el(sb, 'mod-map-contourlock').hidden, false, 'contour lock appears in contour mode');
  eq(el(sb, 'mod-map-contourlock-state').textContent, 'Locked', 'lock state is host state');

  // ISOBUS appears only while its heartbeat is heard.
  sb.tick.op.contour = false;
  sb.statusBar = { isobus: { sections: 3, sectionControl: true } };
  render(sb);
  eq(el(sb, 'mod-map-isobus').hidden, false, 'ISOBUS shows when the host reports it');
  eq(el(sb, 'mod-map-isobus-state').textContent, 'On', 'ISOBUS section state is host state');

  // An observer gets disabled controls, and a preference hides one for good.
  sb.iHoldControl = false;
  render(sb);
  eq(el(sb, 'mod-map-contour').disabled, true, 'an observer cannot change contour mode');
  press(el(sb, 'mod-map-contour'));
  eq(contour, 1, 'an observer press sends nothing');
  sb.iHoldControl = true;
  press(el(sb, 'mod-set-map-contour'));
  eq(el(sb, 'mod-map-contour').hidden, true, 'the settings switch hides the contour button');
  eq(JSON.parse(sb.localStorage.getItem('agopenweb.modernui.mapControls')).contour, false,
    'the choice is stored');
});

test('rail-lines/rendering is gated on host-state changes', () => {
  const sb = loadModern();
  tabs(sb);
  render(sb);
  el(sb, 'mod-field-name').textContent = 'SENTINEL';
  render(sb);
  eq(el(sb, 'mod-field-name').textContent, 'SENTINEL',
    'an unchanged state must not rebuild the rail (no second render path)');
  sb.statusBar = { jobName: 'Job 9' };
  render(sb);
  eq(el(sb, 'mod-field-name').textContent, 'Field', 'a host-state change rebuilds the rail');
});

test('rail-lines/the field entry opens the existing Fields and Jobs chain without a field command', () => {
  const sb = loadModern();
  tabs(sb);
  render(sb);
  const button = el(sb, 'mod-field-switch');
  eq(button.disabled, false, 'field entry is available without a local edit/recording');
  eq(button.getAttribute('aria-expanded'), 'false', 'panel starts collapsed');
  eq(button.classList.contains('active'), false, 'entry not marked active');
  eq(el(sb, 'mod-field-note').textContent, '', 'no idle field warning clutters the rail');

  press(button);
  eq(items(sb).fieldsOpen.length, 1, 'the existing openFieldsAndJobs handler is used');
  eq(items(sb).calls.includes('openFieldsAndJobs'), true, 'delegated to the existing handler');
  eq(items(sb).sent.length, 0, 'the rail itself sends nothing');
  assertNoFieldCommands(sb, 'field entry');

  // The stub's existing handler opens the chain panel, so the rail reflects that open state.
  render(sb);
  eq(button.getAttribute('aria-expanded'), 'true', 'entry reports the open existing panel');
  eq(button.classList.contains('active'), true, 'entry shown active with the panel');
});

test('rail-lines/the field entry falls back to the existing Field Operations panel', () => {
  const sb = loadModern();
  tabs(sb);
  render(sb);
  delete sb.openFieldsAndJobs;
  press(el(sb, 'mod-field-switch'));
  const opened = items(sb).menus.slice(-1)[0];
  eq(opened[0], 'open', 'a chain panel was opened');
  eq(opened[1], 'fieldops', 'the existing Field Operations panel is the fallback');
  eq(opened[2], 'ln-fieldops', 'the existing left-nav entry owns the chain');
  eq(opened[3], sb.renderFieldOps, 'the existing renderer is passed when available');
  eq(items(sb).sent.length, 0, 'the fallback sends nothing');
  assertNoFieldCommands(sb, 'field fallback');

  const noRenderer = loadModern();
  tabs(noRenderer);
  render(noRenderer);
  delete noRenderer.openFieldsAndJobs;
  delete noRenderer.renderFieldOps;
  press(el(noRenderer, 'mod-field-switch'));
  const openedWithoutRenderer = items(noRenderer).menus.slice(-1)[0];
  eq(openedWithoutRenderer[1], 'fieldops', 'fallback panel still used');
  eq(openedWithoutRenderer[3], undefined, 'a missing renderer is tolerated explicitly');
});

test('rail-lines/an open fieldops panel goes to the existing Fields and Jobs chooser', () => {
  const sb = loadModern();
  tabs(sb);
  render(sb);
  const button = el(sb, 'mod-field-switch');
  const panel = el(sb, 'fieldops');
  panel.classList.add('open');
  render(sb);
  eq(button.getAttribute('aria-expanded'), 'true', 'the entry reports the open Field Operations panel');
  eq(button.classList.contains('active'), true, 'the entry is shown active');

  press(button);
  eq(items(sb).fieldsOpen.length, 1, 'the existing Fields and Jobs chooser is opened');
  eq(items(sb).calls.includes('openFieldsAndJobs'), true, 'the existing chooser helper is used');
  eq(items(sb).calls.includes('lnCloseAll'), false, 'the rail does not dismiss the chain itself');
  eq(items(sb).sent.length, 0, 'navigating to the chooser sends no field command');
  assertNoFieldCommands(sb, 'fieldops navigation');
});

test('rail-lines/the chooser and typed field forms are left untouched by the field entry', () => {
  const chooser = loadModern();
  tabs(chooser);
  render(chooser);
  el(chooser, 'fieldsandjobs').classList.add('open');
  render(chooser);
  press(el(chooser, 'mod-field-switch'));
  eq(items(chooser).fieldsOpen.length, 0, 'the chooser is not reopened');
  eq(items(chooser).calls.length, 0, 'opening the chooser twice calls no helper');
  eq(items(chooser).sent.length, 0, 'the chooser path sends nothing');
  eq(el(chooser, 'mod-field-switch').getAttribute('aria-expanded'), 'true',
    'the entry still reports the open chooser');

  for (const id of typedFieldFormIds()) {
    const sb = loadModern();
    tabs(sb);
    render(sb);
    const panel = el(sb, id);
    const button = el(sb, 'mod-field-switch');
    const note = el(sb, 'mod-field-note');
    panel.classList.add('open');
    render(sb);
    const standing = note.textContent;
    const input = addTextInput(panel, 'typed value');
    render(sb);
    eq(button.getAttribute('aria-expanded'), 'true', `#${id}: entry reports the open form`);
    eq(button.classList.contains('active'), true, `#${id}: entry shown active`);
    eq(button.disabled, true, `#${id}: a typed form disables the field entry instead of leaving it inert`);
    assert(note.textContent.trim().length > 0, `#${id}: the typed-form block states a reason`);
    assert(note.textContent !== standing, `#${id}: the reason replaces the standing warning`);
    assert(/form|unsaved|close|cancel|edit/i.test(note.textContent), `#${id}: the reason names the form`);

    press(button);
    eq(items(sb).fieldsOpen.length, 0, `#${id}: a typed form is not navigated away from`);
    eq(items(sb).calls.length, 0, `#${id}: no panel helper or close chain is called`);
    eq(items(sb).sent.length, 0, `#${id}: a typed form path sends nothing`);
    eq(panel.classList.contains('open'), true, `#${id}: the form stays open`);
    eq(button.getAttribute('aria-expanded'), 'true', `#${id}: entry still reports the open form`);

    // Clearing the unsaved text restores the normal field-entry path and its standing warning.
    input.value = '';
    render(sb);
    eq(button.disabled, false, `#${id}: clearing the form re-enables the field entry`);
    eq(note.textContent, standing, `#${id}: the standing warning returns`);
    press(button);
    eq(items(sb).fieldsOpen.length, 1, `#${id}: the chooser is reachable after clearing`);
  }
});

test('rail-lines/the Modern menu asks before closing a typed field form', () => {
  const sb = loadModern({ confirm: 'manual' });
  tabs(sb);
  render(sb);
  const panel = el(sb, 'newfield');
  panel.classList.add('open');
  addTextInput(panel, 'unsaved note');
  render(sb);

  press(el(sb, 'mod-menu'));
  eq(items(sb).confirms.length, 1, 'a confirmation is offered before the menu can close the form');
  eq(items(sb).calls.length, 0, 'the menu chain is not opened before the answer');
  eq(el(sb, 'mod-menu').getAttribute('aria-expanded'), 'false', 'the menu stays closed');
  eq(panel.classList.contains('open'), true, 'cancel would keep the form open');
  assert(/form|unsaved|close|menu/i.test(items(sb).confirms[0].message),
    'the menu warning names the form and the close');

  // Cancel: the callback is simply not run, so the form and menu state stay put.
  eq(items(sb).calls.length, 0, 'cancel leaves the panel chain untouched');
  eq(panel.classList.contains('open'), true, 'cancel keeps the form open');

  // Confirm: the hub opens and closes the form through the existing chain helper.
  items(sb).confirms[0].callback();
  eq(items(sb).calls.includes('lnCloseAll'), true, 'confirm clears the existing panel chain');
  eq(el(sb, 'modern-settings').classList.contains('open'), true, 'confirm opens the Settings hub');
  eq(el(sb, 'mod-menu').getAttribute('aria-expanded'), 'true', 'the menu reports open after confirm');

  const normal = loadModern();
  tabs(normal);
  render(normal);
  press(el(normal, 'mod-menu'));
  eq(items(normal).confirms.length, 0, 'no warning when no typed form is open');
  eq(el(normal, 'modern-settings').classList.contains('open'), true,
    'normal Menu opens the hub immediately');
  eq(el(normal, 'mod-menu').getAttribute('aria-expanded'), 'true', 'the menu reports open immediately');
});

test('switch-reset/a clean Fields-and-Jobs form does not block, but typed text does', () => {
  const clean = loadModern();
  tabs(clean);
  el(clean, 'fieldsandjobs').classList.add('open');
  el(clean, 'fj-taskname').value = clean.isoDate();
  clean.modernSwitchPresentation();
  eq(items(clean).confirms.length, 1, 'auto-filled job date alone still offers the switch warning');
  eq(clean.location.replaced.length, 1, 'auto-filled job date alone allows the switch');
  eq(clean.localStorage.getItem(STORAGE_KEY), 'classic', 'clean date form: Classic remembered');

  const cleanReset = loadModern();
  tabs(cleanReset);
  el(cleanReset, 'fieldsandjobs').classList.add('open');
  el(cleanReset, 'fj-taskname').value = cleanReset.isoDate();
  cleanReset.modernResetPresentation();
  eq(items(cleanReset).confirms.length, 1, 'auto-filled job date alone allows reset');
  eq(cleanReset.location.replaced.length, 1, 'auto-filled job date alone reloads for reset');
  eq(cleanReset.localStorage.getItem(STORAGE_KEY), null, 'clean date form: preference cleared');

  const typed = loadModern();
  tabs(typed);
  el(typed, 'fieldsandjobs').classList.add('open');
  el(typed, 'fj-taskname').value = typed.isoDate();
  el(typed, 'fj-notes').value = 'unsaved note';
  render(typed);
  const button = el(typed, 'mod-field-switch');
  eq(button.disabled, true, 'typed job notes disable the field entry with a reason');
  assert(/form|unsaved|close|cancel|edit/i.test(el(typed, 'mod-field-note').textContent),
    'typed job notes explain why field switching is blocked');
  press(button);
  eq(items(typed).fieldsOpen.length, 0, 'typed job notes keep the chooser untouched');
  typed.modernSwitchPresentation();
  eq(items(typed).confirms.length, 0, 'typed job notes refuse switch before asking');
  eq(typed.location.replaced.length, 0, 'typed job notes do not reload for switch');
  typed.modernResetPresentation();
  eq(items(typed).confirms.length, 0, 'typed job notes refuse reset before asking');
  eq(typed.location.replaced.length, 0, 'typed job notes do not reload for reset');
  eq(items(typed).sent.length, 0, 'typed job notes send no command');

  const changed = loadModern();
  tabs(changed);
  el(changed, 'fieldsandjobs').classList.add('open');
  el(changed, 'fj-taskname').value = 'A different job name';
  render(changed);
  eq(el(changed, 'mod-field-switch').disabled, true, 'a changed job name disables the field entry');
  changed.modernSwitchPresentation();
  eq(items(changed).confirms.length, 0, 'a changed job name refuses switch');
  eq(changed.location.replaced.length, 0, 'a changed job name does not reload');
});

test('rail-lines/active client edits, local flows, host recordings and a map tap disable the field entry', () => {
  const cases = [
    ['abFlow (client-local)', sb => { sb.abFlow = {}; }],
    ['hlFlow (client-local)', sb => { sb.hlFlow = {}; }],
    ['editSession (client-local)', sb => { sb.editSession = {}; }],
    ['boundary recording (host frame)', sb => { sb.boundary = { isRecording: true }; }],
    ['recorded path (host frame)', sb => { sb.recPath = { isRecording: true }; }],
    ['map tap (client-local)', sb => { sb.__test.body.classList.add('maptap'); }],
  ];
  let blockedNote = '';
  for (const [label, setup] of cases) {
    const sb = loadModern();
    tabs(sb);
    setup(sb);
    render(sb);
    const button = el(sb, 'mod-field-switch');
    const note = el(sb, 'mod-field-note');
    eq(button.disabled, true, `${label}: field entry is disabled`);
    eq(note.hidden, false, `${label}: inline reason stays visible`);
    assert(note.textContent.trim().length > 0, `${label}: inline reason is not empty`);
    assert(/finish|cancel/i.test(note.textContent), `${label}: reason says to finish/cancel`);
    assert(/edit|record/i.test(note.textContent), `${label}: reason names the edit/recording`);
    blockedNote = blockedNote || note.textContent;

    press(button);
    eq(items(sb).fieldsOpen.length, 0, `${label}: a queued/programmatic tap cannot open fields`);
    eq(items(sb).calls.length, 0, `${label}: no panel helper is called`);
    eq(items(sb).sent.length, 0, `${label}: no command is sent`);
  }

  const clear = loadModern();
  tabs(clear);
  render(clear);
  const clearNote = el(clear, 'mod-field-note').textContent;
  eq(el(clear, 'mod-field-switch').disabled, false, 'clear screen enables the field entry');
  eq(clearNote, '', 'a clear screen has no idle field warning');

  // The same page transitions both ways: the rebuild key carries the combined guard state.
  const live = loadModern();
  tabs(live);
  render(live);
  const liveClearNote = el(live, 'mod-field-note').textContent;
  live.boundary = { isRecording: true };
  render(live);
  eq(el(live, 'mod-field-switch').disabled, true, 'recording starting disables the entry');
  assert(el(live, 'mod-field-note').textContent !== liveClearNote, 'inline reason appears on start');
  live.boundary = null;
  render(live);
  eq(el(live, 'mod-field-switch').disabled, false, 'recording ending re-enables the entry');
  eq(el(live, 'mod-field-note').textContent, liveClearNote, 'standing warning returns on stop');

  // The guard is not just the disabled attribute: a direct helper call rechecks too.
  const recheck = loadModern();
  tabs(recheck);
  render(recheck);
  recheck.abFlow = {};
  recheck.modernOpenFields();
  eq(items(recheck).fieldsOpen.length, 0, 'modernOpenFields rechecks the local guard');
  eq(items(recheck).calls.length, 0, 'the recheck does not reach the panel helper');
});

test('rail-lines/a paused host boundary recording blocks the field entry', () => {
  const sb = loadModern();
  tabs(sb);
  render(sb);
  const button = el(sb, 'mod-field-switch');
  const note = el(sb, 'mod-field-note');
  eq(button.disabled, false, 'clear host frame enables the field entry');
  const clearNote = note.textContent;

  // isPaused is the host-projected paused state; a paused recording still owns unsaved points.
  const states = [
    ['paused boundary', { isRecording: false, isPaused: true }, true],
    ['recording boundary', { isRecording: true, isPaused: false }, true],
    ['recording and paused', { isRecording: true, isPaused: true }, true],
    ['inactive boundary frame', { isRecording: false, isPaused: false }, false],
  ];
  for (const [label, frame, blocked] of states) {
    sb.boundary = frame;
    render(sb);
    eq(button.disabled, blocked, `${label}: field entry disabled=${blocked}`);
    if (blocked) {
      assert(note.textContent.trim().length > 0, `${label}: inline reason is not empty`);
      assert(/record|boundary|pause/i.test(note.textContent),
        `${label}: reason names the recording instead of a generic state`);
      assert(note.textContent !== clearNote, `${label}: blocked reason replaces the standing warning`);
    } else {
      eq(note.textContent, clearNote, `${label}: standing warning returns`);
    }
  }

  sb.boundary = null;
  render(sb);
  eq(button.disabled, false, 'no boundary frame enables the field entry');
  eq(note.textContent, clearNote, 'no boundary frame restores the standing warning');

  sb.boundary = { isRecording: false, isPaused: true };
  render(sb);
  press(button);
  eq(items(sb).fieldsOpen.length, 0, 'a paused recording refuses the picker even on a queued tap');
  eq(items(sb).calls.length, 0, 'no panel helper is called while paused');
  eq(items(sb).sent.length, 0, 'no field command is sent while paused');
  sb.modernOpenFields();
  eq(items(sb).fieldsOpen.length, 0, 'the helper rechecks the paused host state');
  eq(items(sb).calls.length, 0, 'the helper does not reach the panel while paused');

  // The rebuild key must carry the host-recording block, not just the local flags.
  el(sb, 'mod-field-name').textContent = 'SENTINEL';
  sb.boundary = null;
  render(sb);
  eq(el(sb, 'mod-field-name').textContent, 'Field',
    'the paused recording ending invalidates the cached render');
});

test('rail-lines/an observer can reach the existing field picker but sends no field command', () => {
  const sb = loadModern();
  tabs(sb, { iHoldControl: false, connState: 'connected' });
  render(sb);
  eq(el(sb, 'mod-observer').hidden, false, 'observer state is shown');
  eq(el(sb, 'mod-field-switch').disabled, false,
    'the existing field panel owns observer handling, not the rail');
  eq(el(sb, 'mod-active-line').textContent, 'A', 'observer sees the host active line');
  press(el(sb, 'mod-field-switch'));
  eq(items(sb).fieldsOpen.length, 1, 'observer reaches the existing panel');
  eq(items(sb).sent.length, 0, 'the rail sends no field command for an observer');
  assertNoFieldCommands(sb, 'observer field entry');
});

test('rail-lines/an observer keeps the field picker across host-global recordings and edits', () => {
  // Deliberately no abFlow/hlFlow/editSession: an observer cannot know another browser's
  // client-local AB flow. Only host-projected work is set here.
  for (const [label, setup] of HOST_WORK_CASES) {
    const sb = loadModern();
    tabs(sb, { iHoldControl: false, connState: 'connected' });
    render(sb);
    const button = el(sb, 'mod-field-switch');
    const note = el(sb, 'mod-field-note');
    const clearNote = note.textContent;
    eq(button.disabled, false, `${label}: observer field entry is clear without host work`);

    setup(sb);
    render(sb);
    eq(el(sb, 'mod-observer').hidden, false, `${label}: observer state remains visible`);
    eq(button.disabled, false, `${label}: host work does not lock the observer field entry`);
    const hostNote = note.textContent;
    assert(hostNote.trim().length > 0, `${label}: observer gets an inline explanation`);
    assert(/observer|view only/i.test(hostNote), `${label}: explanation names the observer role`);
    assert(/another screen|host|remote/i.test(hostNote),
      `${label}: explanation acknowledges the work may belong to another screen`);
    assert(/record|edit/i.test(hostNote), `${label}: explanation names the host work`);
    assert(!/finish or cancel/i.test(hostNote),
      `${label}: an observer is not told to finish another screen's work`);
    assert(!/\bAB\b|AB line|AB recording/i.test(hostNote),
      `${label}: explanation must not claim knowledge of a host-local AB recording`);
    assert(hostNote !== clearNote, `${label}: the standing warning is replaced by the observer note`);

    press(button);
    eq(items(sb).fieldsOpen.length, 1, `${label}: observer opens the existing view-only panel`);
    eq(items(sb).sent.length, 0, `${label}: the observer field path sends no command`);
    assertNoFieldCommands(sb, `observer ${label}`);
  }
});

test('rail-lines/an observer is still blocked by this page local unsaved work', () => {
  const sb = loadModern();
  tabs(sb, { iHoldControl: false, connState: 'connected' });
  sb.abFlow = {};
  render(sb);
  eq(el(sb, 'mod-field-switch').disabled, true, 'local AB work blocks the observer field entry');
  assert(el(sb, 'mod-field-note').textContent.trim().length > 0, 'the block still explains itself');
  press(el(sb, 'mod-field-switch'));
  eq(items(sb).fieldsOpen.length, 0, 'a local flow cannot be navigated around');
  eq(items(sb).sent.length, 0, 'the blocked local flow sends nothing');
});

test('rail-lines/lastControl distinguishes a true observer from no operator and unknown roles', () => {
  const cases = [
    ['true observer', sb => setControlRole(sb, 'observer'), false, true],
    ['no operator', sb => setControlRole(sb, 'no-operator'), true, false],
    ['missing local client id', sb => { setControlRole(sb, 'observer'); sb.myClientId = ''; }, true, false],
    ['unknown with a stale holder', sb => {
      setControlRole(sb, 'unknown');
      sb.connState = 'connecting';
      sb.lastControl = { held: true, holderId: ROLE_OTHER, holderName: 'Other screen' };
    }, true, false],
  ];
  for (const [label, setup, blocked, observer] of cases) {
    const sb = loadModern();
    tabs(sb);
    setup(sb);
    sb.boundary = { isRecording: false, isPaused: true };
    render(sb);
    const button = el(sb, 'mod-field-switch');
    eq(button.disabled, blocked, `${label}: field entry blocked=${blocked}`);
    if (observer) {
      eq(el(sb, 'mod-observer').hidden, false, `${label}: the true other-controller shows the observer banner`);
    }
    assert(el(sb, 'mod-field-note').textContent.trim().length > 0, `${label}: inline state is explained`);
    if (observer) {
      assert(/observer|view only/i.test(el(sb, 'mod-field-note').textContent),
        `${label}: the note names the observer role`);
    }
    press(button);
    eq(items(sb).fieldsOpen.length, observer ? 1 : 0,
      `${label}: only a true other-controller reaches the view-only chooser`);
    eq(items(sb).sent.length, 0, `${label}: field path sends no command`);
  }

  // No operator is conservative only while host work is active; with a clear host it recovers.
  const clear = loadModern();
  tabs(clear, { role: 'no-operator' });
  render(clear);
  eq(el(clear, 'mod-field-switch').disabled, false, 'no operator: clear field entry');
  press(el(clear, 'mod-field-switch'));
  eq(items(clear).fieldsOpen.length, 1, 'no operator: clear chooser is reachable');
});

test('rail-lines/the active-line header is host-confirmed for active, contour, no line and no field', () => {
  const sb = loadModern();
  tabs(sb);
  render(sb);
  const header = el(sb, 'mod-active-line');
  eq(header.textContent, 'A', 'host tick.activeTrackName is shown');
  eq(header.getAttribute('translate'), 'no', 'a user line name is not translated');
  eq(el(sb, 'mod-active-type').textContent, 'Line', 'the line type is shown before the name');
  eq(el(sb, 'mod-active-type').hidden, false, 'the type is visible with an active line');
  press(rows(sb)[1]);
  eq(header.textContent, 'A', 'a local row press cannot change the host readout');

  sb.tick.activeTrackName = 'Headland North';
  render(sb);
  eq(header.textContent, 'Headland North', 'header follows the host name');
  eq(header.getAttribute('translate'), 'no', 'changed user name stays untranslated');

  sb.tick.activeTrackName = 'A';
  sb.tick.op = { autoSteer: false, contour: true };
  render(sb);
  assert(/contour/i.test(header.textContent), 'contour mode is named instead of an AB line');
  assert(header.textContent !== 'A', 'contour mode does not claim an active AB line');
  eq(header.getAttribute('translate'), null, 'a generated contour label remains translatable');

  sb.tick.op = { autoSteer: false, contour: false };
  sb.tick.activeTrackName = '';
  render(sb);
  assert(/no active line/i.test(header.textContent), 'no host line has an explicit empty state');
  eq(header.getAttribute('translate'), null, 'the empty state remains translatable');

  sb.scene.hasField = false;
  sb.scene.fieldName = '';
  render(sb);
  assert(/no field/i.test(header.textContent), 'no field has an explicit empty state');
  eq(header.getAttribute('translate'), null, 'the no-field state remains translatable');
});

test('rail-lines/All lines and Quick AB close the old AB flyout first', () => {
  const manager = loadModern();
  tabs(manager);
  render(manager);
  press(el(manager, 'mod-all-lines'));
  deepEq(items(manager).calls, ['abFlyoutClose'],
    'All lines closes the Classic flyout before opening the list');
  eq(items(manager).tracksManager.length, 0, 'the full list replaces the manager entry');
  eq(el(manager, 'mod-all-lines-panel').hidden, false, 'the full list is open');
  eq(items(manager).sent.length, 0, 'opening the list sends no line command');

  const quick = loadModern();
  tabs(quick);
  render(quick);
  press(el(quick, 'mod-record-line'));
  deepEq(items(quick).calls, ['abFlyoutClose', 'qabHeadingReset', 'qabSetSide', 'qabStart:aPlus'],
    'A+ closes the Classic flyout before using the shared Quick AB dispatcher');
  deepEq(items(quick).dialogs, [], 'the direct start does not need the hub dialog');
  deepEq(items(quick).qab, ['heading-reset', 'side:right', 'start:aPlus'],
    'existing Quick AB setup preserved');
  eq(items(quick).sent.length, 0, 'the rail itself sends no line command');

  // A page without the Classic flyout hook still opens the full list.
  const noHook = loadModern({ noAbFlyout: true });
  tabs(noHook);
  render(noHook);
  press(el(noHook, 'mod-all-lines'));
  deepEq(items(noHook).calls, [], 'missing flyout hook is tolerated');
  eq(el(noHook, 'mod-all-lines-panel').hidden, false, 'the full list still opens');
  const noHookQuick = loadModern({ noAbFlyout: true, noQabStart: true });
  tabs(noHookQuick);
  render(noHookQuick);
  press(el(noHookQuick, 'mod-record-line'));
  deepEq(items(noHookQuick).calls, ['qabHeadingReset', 'qabSetSide', 'openDialog'],
    'a page without the dispatcher falls back to the existing hub');

  // The paused Quick AB guards return before touching the flyout.
  const observer = loadModern();
  tabs(observer, { iHoldControl: false });
  render(observer);
  press(el(observer, 'mod-record-line'));
  eq(items(observer).abFlyoutCloses.length, 0, 'observer: paused Quick AB leaves the flyout alone');
  const steering = loadModern();
  tabs(steering, { tick: { op: { autoSteer: true, contour: false } } });
  render(steering);
  press(el(steering, 'mod-record-line'));
  eq(items(steering).abFlyoutCloses.length, 0, 'AutoSteer: paused Quick AB leaves the flyout alone');
});

test('rail-lines/the rebuild key includes the total guidance count', () => {
  const sb = loadModern();
  tabs(sb, { scene: { trackList: [] } });
  render(sb);
  eq(rows(sb)[0].textContent, sb.tr('No tracks in this field'), 'no guidance tracks');
  eq(el(sb, 'mod-all-lines').textContent, allLinesBaseLabel(sb), 'no lines to choose');

  // Only guidance.length changes: the visible row map stays empty. Without the total count in
  // the key, the empty state and the All lines label would stay stale.
  el(sb, 'mod-field-name').textContent = 'SENTINEL';
  sb.scene.trackList = [{ index: 0, name: 'Hidden', type: 'Line', visible: false, active: false }];
  render(sb);
  eq(el(sb, 'mod-field-name').textContent, 'Field',
    'a hidden guidance line still invalidates the cached render');
  eq(rows(sb).length, 1, 'a hidden line still renders no row');
  eq(rows(sb)[0].textContent, sb.tr('No visible AB lines'), 'hidden-line empty state updated');
  assertAllLinesLabel(sb, 1, 'guidance now exists, so it is choosable');

  sb.scene.trackList = [];
  render(sb);
  eq(rows(sb)[0].textContent, sb.tr('No tracks in this field'), 'removing the line updates the empty state');
  eq(el(sb, 'mod-all-lines').textContent, allLinesBaseLabel(sb), 'removing the line updates the label');
});

test('rail-lines/the line count label is the host total guidance count', () => {
  const sb = loadModern();
  tabs(sb, {
    scene: {
      trackList: [
        { index: 0, name: 'Alpha', type: 'Line', visible: true, active: true },
        { index: 1, name: 'Beta', type: 'Curve', visible: true, active: false },
        { index: 2, name: 'Gamma', type: 'Line', visible: false, active: false },
        { index: 3, name: 'Path', type: 'Path', visible: true, active: false },
        { index: 4, name: 'Contour', type: 'Contour', visible: true, active: false },
      ],
    },
  });
  render(sb);
  // Path and Contour are not guidance lines; hidden guidance still counts for the manager.
  assertAllLinesLabel(sb, 3, 'three guidance lines');
  eq(rows(sb).length, 2, 'only the two visible guidance lines get rows');

  sb.scene.trackList = sb.scene.trackList.filter(t => t.name !== 'Gamma');
  render(sb);
  assertAllLinesLabel(sb, 2, 'two guidance lines after the hidden one is removed');

  sb.scene.trackList = [];
  render(sb);
  assertAllLinesLabel(sb, 0, 'no guidance lines');
});

test('rail-lines/the live status region is concise and includes the field-blocked reason', () => {
  const sb = loadModern();
  tabs(sb, {
    scene: {
      fieldName: 'North 40',
      trackList: [
        { index: 0, name: 'Alpha', type: 'Line', visible: true, active: true },
        { index: 1, name: 'Beta', type: 'Curve', visible: true, active: false },
        { index: 2, name: 'Gamma', type: 'Line', visible: true, active: false },
        { index: 3, name: 'Delta', type: 'Line', visible: true, active: false },
      ],
    },
    tick: { activeTrackName: 'Alpha' },
  });
  render(sb);
  const live = el(sb, 'mod-status');
  eq(live.getAttribute('role'), 'status', 'dedicated status role');
  eq(live.getAttribute('aria-live'), 'polite', 'polite live region');
  eq(live.getAttribute('aria-atomic'), 'true', 'announces the summary atomically');
  eq(el(sb, 'mod-rail-list').hasAttribute('aria-live'), false,
    'the rebuilt line list is no longer an aria-live region');

  let text = live.textContent;
  assert(text.includes('North 40'), 'summary names the field');
  assert(text.includes('Alpha'), 'summary names the active line');
  assert(text.includes(sb.tr('{n} lines', { n: 4 })), 'summary carries the line count');
  for (const name of ['Beta', 'Gamma', 'Delta']) {
    assert(!text.includes(name), `summary must not read the whole row list (${name})`);
  }

  // A local field block must be announced concisely, not just left on the button/note.
  sb.abFlow = {};
  render(sb);
  text = live.textContent;
  assert(/finish|cancel|recording|edit/i.test(text), 'the field-blocked reason is announced');
  for (const name of ['Beta', 'Gamma', 'Delta']) {
    assert(!text.includes(name), `blocked summary must stay concise (${name})`);
  }

  sb.abFlow = null;
  sb.scene.hasField = false;
  render(sb);
  assert(/no field/i.test(live.textContent), 'the live summary follows no-field state');
});

test('rail-lines/the rail is the sole visible cycle owner and the Classic pair returns when suspended', () => {
  assert(/\.mod-rail-live[\s\S]*#rn-cycle[\s\S]*#rn-cycleback[\s\S]*display:\s*none\s*!important/
      .test(MODERN_CSS_SOURCE),
    'Modern CSS must hide both Classic cycle buttons while the rail owns cycling');

  const sb = loadModern();
  tabs(sb);
  render(sb);
  const root = sb.document.documentElement;
  eq(root.classList.contains('mod-rail-live'), true, 'visible rail owns cycling');
  eq(el(sb, 'mod-prev').disabled, false, 'rail Previous is available');
  eq(el(sb, 'mod-next').disabled, false, 'rail Next is available');

  // The script must not touch the Classic pair's inline state; CSS owns the hide/restore.
  el(sb, 'rn-cycle').style.display = 'inline-block';
  el(sb, 'rn-cycleback').style.display = 'inline-block';
  render(sb);
  eq(el(sb, 'rn-cycle').style.display, 'inline-block', 'Classic Next inline state is untouched');
  eq(el(sb, 'rn-cycleback').style.display, 'inline-block', 'Classic Previous inline state is untouched');

  sb.CardPane = { layout: 'split' };
  el(sb, 'cardpane').classList.add('show');
  render(sb);
  eq(root.classList.contains('mod-rail-live'), false, 'suspended rail returns cycle ownership to Classic');
  eq(el(sb, 'modern-rail').classList.contains('suspended'), true, 'the rail is suspended');

  el(sb, 'cardpane').classList.remove('show');
  render(sb);
  eq(root.classList.contains('mod-rail-live'), true, 'the visible rail takes cycling back');

  el(sb, 'modern-rail').hidden = true;
  render(sb);
  eq(root.classList.contains('mod-rail-live'), false, 'a hidden/failed rail leaves the Classic fallback');
  el(sb, 'modern-rail').hidden = false;
  render(sb);
  eq(root.classList.contains('mod-rail-live'), true, 'a restored rail takes cycling back');

  const classic = loadModern({ search: '' });
  eq(classic.document.documentElement.classList.contains('mod-rail-live'), false,
    'Classic never hides its cycle pair');
  const failed = loadModern({ cssBroken: true });
  eq(failed.document.documentElement.classList.contains('mod-rail-live'), false,
    'a failed Modern init leaves the Classic cycle pair');
  const paneAtLoad = loadModern({ cardPane: { layout: 'split' }, paneOpen: true });
  eq(paneAtLoad.document.documentElement.classList.contains('mod-rail-live'), false,
    'a pane open at load leaves the Classic cycle pair');
});

test('rail-lines/New AB line uses only reliable field and GPS signals for its disabled reason', () => {
  const sb = loadModern();
  tabs(sb, { scene: { hasField: true } });
  render(sb);
  const record = el(sb, 'mod-record-line');
  const note = el(sb, 'mod-lock-note');
  eq(record.disabled, false, 'field + unknown GPS (no status frame) does not claim No GPS');
  eq(note.hidden, true, 'no blocked reason when available');

  sb.statusBar = { gpsLost: false, fixQuality: 2 };
  render(sb);
  eq(record.disabled, false, 'a good fix leaves New AB line available');
  eq(note.hidden, true, 'good fix has no reason');

  sb.statusBar = { gpsLost: true, fixQuality: 0 };
  render(sb);
  eq(record.disabled, true, 'gpsLost disables New AB line');
  assert(/gps|fix|position/i.test(note.textContent), 'gpsLost reason names the GPS state');
  press(record);
  eq(items(sb).dialogs.length, 0, 'a disabled New AB line cannot open Quick AB');

  const fixZero = loadModern();
  tabs(fixZero, { scene: { hasField: true } });
  fixZero.statusBar = { gpsLost: false, fixQuality: 0 };
  render(fixZero);
  eq(el(fixZero, 'mod-record-line').disabled, true, 'fixQuality 0 is a reliable no-fix state');
  assert(/gps|fix|position/i.test(el(fixZero, 'mod-lock-note').textContent), 'fix-quality reason');

  const noField = loadModern();
  tabs(noField, { scene: { hasField: false }, statusBar: { gpsLost: false, fixQuality: 2 } });
  render(noField);
  eq(el(noField, 'mod-record-line').disabled, true, 'no field disables New AB line');
  assert(/field/i.test(el(noField, 'mod-lock-note').textContent), 'no-field reason names the field');
  press(el(noField, 'mod-record-line'));
  eq(items(noField).dialogs.length, 0, 'no-field New AB line cannot open Quick AB');

  const observer = loadModern();
  tabs(observer, { iHoldControl: false });
  render(observer);
  eq(el(observer, 'mod-record-line').disabled, true, 'observer cannot start Quick AB from the rail');
  assert(/observer|view only/i.test(el(observer, 'mod-lock-note').textContent), 'observer reason');

  const steering = loadModern();
  tabs(steering, { tick: { op: { autoSteer: true, contour: false } } });
  render(steering);
  eq(el(steering, 'mod-record-line').disabled, true, 'engaged AutoSteer pauses New AB line');
  assert(/autosteer|steer/i.test(el(steering, 'mod-lock-note').textContent), 'AutoSteer reason');

  const contour = loadModern();
  tabs(contour, { tick: { op: { autoSteer: false, contour: true } } });
  render(contour);
  eq(el(contour, 'mod-record-line').disabled, false, 'contour leaves New AB line available');
  assert(/contour/i.test(el(contour, 'mod-lock-note').textContent), 'contour consequence is explained');
});

test('rail-lines/Escape closes the Modern menu, returns focus and leaves the map Escape path', () => {
  const sb = loadModern();
  tabs(sb);
  render(sb);
  press(el(sb, 'mod-menu'));
  const menu = el(sb, 'mod-menu');
  eq(menu.getAttribute('aria-expanded'), 'true', 'menu starts open');
  const previous = el(sb, 'mod-all-lines');
  previous.focus();
  const mapSeen = [];
  sb.addEventListener('keydown', e => mapSeen.push(e));

  const escapeOpen = makeEvent({ type: 'keydown', key: 'Escape' });
  sb.__dispatchGlobal('keydown', escapeOpen);
  eq(menu.getAttribute('aria-expanded'), 'false', 'Escape closes the Modern menu');
  eq(items(sb).calls.includes('lnCloseAll'), true, 'the existing menu chain is closed');
  eq(sb.document.activeElement, menu, 'focus returns to the Modern Menu button');
  eq(escapeOpen.defaultPrevented, true, 'the handled Escape is consumed');
  eq(escapeOpen.stopped, 0, 'Escape is not stopped from reaching the map handler');
  eq(mapSeen.length, 1, 'the map Escape listener still sees the event');

  previous.focus();
  const escapeClosed = makeEvent({ type: 'keydown', key: 'Escape' });
  sb.__dispatchGlobal('keydown', escapeClosed);
  eq(menu.getAttribute('aria-expanded'), 'false', 'closed menu stays closed');
  eq(sb.document.activeElement, previous, 'closed menu does not steal focus');
  eq(escapeClosed.defaultPrevented, false, 'an unhandled Escape is not consumed');
  eq(escapeClosed.stopped, 0, 'the map Escape path is untouched');
  eq(mapSeen.length, 2, 'the map Escape listener still runs when the menu is closed');

  const classic = loadModern({ search: '' });
  const classicEscape = makeEvent({ type: 'keydown', key: 'Escape' });
  classic.__dispatchGlobal('keydown', classicEscape);
  eq(classicEscape.defaultPrevented, false, 'Classic Escape handling is untouched');
});

test('rail-lines/settings hub lists existing nav entries and reuses their handlers', () => {
  const sb = loadModern();
  tabs(sb);
  render(sb);
  press(el(sb, 'mod-menu'));
  eq(el(sb, 'modern-settings').classList.contains('open'), true, 'the settings hub opens');
  eq(el(sb, 'mod-menu').getAttribute('aria-expanded'), 'true', 'the trigger reports expanded');
  eq(el(sb, 'mod-settings-switch').textContent, 'Classic UI', 'the UI switch names its target');
  const items = Array.from(el(sb, 'mod-settings-grid').children);
  const navIds = items.map(item => item.dataset.nav);
  for (const id of ['ln-filemenu', 'ln-screenalerts', 'ln-tools', 'ln-vehicle',
    'ln-autosteer', 'ln-fieldops', 'ln-fieldtools', 'ln-network']) {
    assert(navIds.includes(id), `the hub must include ${id}`);
  }
  assert(!navIds.includes('ln-vt'), 'a feature-hidden nav entry is not offered');
  assert(navIds.includes('ln-web'), 'a visible feature entry is offered');

  let opened = null;
  el(sb, 'ln-tools').addEventListener('pointerdown', () => { opened = 'ln-tools'; });
  const toolsItem = items.find(item => item.dataset.nav === 'ln-tools');
  press(toolsItem);
  eq(opened, 'ln-tools', 'the hub dispatches the existing nav handler');
  eq(el(sb, 'modern-settings').classList.contains('open'), false,
    'the hub closes before the existing panel opens');

  press(el(sb, 'mod-menu'));
  press(el(sb, 'ln-scrim'));
  eq(el(sb, 'modern-settings').classList.contains('open'), false,
    'the shared scrim closes the hub');
});

test('rail-lines/settings hub exposes File menu settings, diagnostics and recovery entries', () => {
  const sb = loadModern();
  tabs(sb);
  render(sb);
  press(el(sb, 'mod-menu'));
  const apps = Array.from(el(sb, 'mod-settings-apps').children);
  const appIds = apps.map(item => item.dataset.nav);
  for (const id of ['fm-language', 'fm-reset', 'fm-appsettings', 'fm-viewsettings',
    'fm-logviewer', 'fm-hotkeys', 'fm-simulator', 'fm-help', 'fm-about', 'fm-bugreport']) {
    assert(appIds.includes(id), `the hub must include the File menu entry ${id}`);
  }
  assert(!appIds.includes('fm-ui-switch'),
    'the hub owns the Classic/Modern switch in its User Interface section');
  assert(!appIds.includes('fm-ui-reset'),
    'the hub owns Reset UI preferences in its User Interface section');
  eq(el(sb, 'mod-settings-app-section').hidden, false, 'the application section is shown');
  eq(apps.find(item => item.dataset.nav === 'fm-language').textContent, 'Language',
    'the card uses the File menu label');

  let opened = '';
  el(sb, 'fm-logviewer').addEventListener('pointerdown', () => { opened = 'fm-logviewer'; });
  press(apps.find(item => item.dataset.nav === 'fm-logviewer'));
  eq(opened, 'fm-logviewer', 'the app entry dispatches the original File menu handler');
  eq(el(sb, 'modern-settings').classList.contains('open'), false,
    'the hub closes before the File menu panel opens');
});

test('rail-lines/a repeated hub entry press reaches the handler and releases its pointer', () => {
  const sb = loadModern();
  tabs(sb);
  render(sb);
  let opened = 0;
  const seen = [];
  el(sb, 'ln-tools').addEventListener('pointerdown', e => {
    opened += 1;
    seen.push(['down', e.pointerId]);
  });
  el(sb, 'ln-tools').addEventListener('pointerup', e => seen.push(['up', e.pointerId]));

  for (let i = 0; i < 2; i++) {
    press(el(sb, 'mod-menu'));
    const item = Array.from(el(sb, 'mod-settings-grid').children)
      .find(candidate => candidate.dataset.nav === 'ln-tools');
    press(item);
  }

  eq(opened, 2, 'the second hub entry press is not swallowed');
  deepEq(seen.map(entry => entry[0]), ['down', 'up', 'down', 'up'],
    'each hand-off presses and releases the synthetic pointer');
  eq(seen[0][1], seen[1][1], 'the press and release use the same pointer id');
  assert(seen[0][1] !== 0, 'the synthetic press uses a non-zero pointer id');
  assert(seen[2][1] !== seen[0][1], 'a later hand-off uses a fresh pointer id');
});

test('rail-lines/AutoSteer button follows host state and reuses autosteer.toggle', () => {
  const sb = loadModern();
  tabs(sb, { tick: { op: { autoSteer: true, autoSteerAvail: true, contour: false }, activeTrackName: 'A' } });
  render(sb);
  eq(el(sb, 'mod-steer').disabled, false, 'engaged AutoSteer stays actionable');
  eq(el(sb, 'mod-steer').getAttribute('aria-pressed'), 'true', 'the button reports engaged');
  eq(el(sb, 'mod-steer-state').textContent, 'On', 'the state is named On');
  press(el(sb, 'mod-steer'));
  deepEq(items(sb).sent, ['autosteer.toggle'], 'disengage reuses the existing command');

  const available = loadModern();
  tabs(available, { tick: { op: { autoSteer: false, autoSteerAvail: true, contour: false }, activeTrackName: 'A' } });
  render(available);
  eq(el(available, 'mod-steer').disabled, false, 'available AutoSteer can be engaged');
  eq(el(available, 'mod-steer-state').textContent, 'Off', 'the state is named Off');
  press(el(available, 'mod-steer'));
  deepEq(items(available).sent, ['autosteer.toggle'], 'engage reuses the same command');

  const observer = loadModern();
  tabs(observer, { role: 'observer',
    tick: { op: { autoSteer: true, autoSteerAvail: true, contour: false }, activeTrackName: 'A' } });
  render(observer);
  eq(el(observer, 'mod-steer').disabled, true, 'an observer cannot toggle AutoSteer');
  press(el(observer, 'mod-steer'));
  eq(items(observer).sent.length, 0, 'an observer AutoSteer press sends nothing');

  const unavailable = loadModern();
  tabs(unavailable, { tick: { op: { autoSteer: false, autoSteerAvail: false, contour: false }, activeTrackName: '' } });
  render(unavailable);
  eq(el(unavailable, 'mod-steer').disabled, true,
    'no active/available AutoSteer is not offered as an enabled control');
});

test('rail-lines/the top bar shows cross-track error while the map is covered', () => {
  const sb = loadModern();
  tabs(sb, { tick: { op: { autoSteer: false, contour: false }, activeTrackName: 'A',
    guidanceActive: true, crossTrackError: -0.12 } });
  render(sb);
  eq(el(sb, 'mod-xte-value').textContent, '12 cm L', 'cross-track error has a unit and side');
  sb.tick.crossTrackError = 0;
  render(sb);
  eq(el(sb, 'mod-xte-value').textContent, '0 cm', 'zero cross-track error has no side suffix');
  sb.tick.guidanceActive = false;
  render(sb);
  eq(el(sb, 'mod-xte-value').textContent, '—', 'no guidance has an explicit empty state');
});

test('rail-lines/Modern tr keys exist in generated en.json', () => {
  const en = JSON.parse(readWww('i18n', 'en.json'));
  const keys = [...new Set([...MODERN_UI_SOURCE.matchAll(/tr\('([^']+)'/g)].map(m => m[1]))];
  assert(keys.length > 20, 'the Modern shell should expose its labels');
  for (const key of keys) {
    eq(en[key], key, `Generated English source must contain ${JSON.stringify(key)} as its key`);
  }
});

test('rail-lines/existing German entries keep placeholders; missing keys fall back to English', async () => {
  const de = JSON.parse(readWww('i18n', 'de.json'));
  const keys = changedModernTrKeys();
  assert(keys.length >= 8, 'the changed Modern surfaces should expose several labels');

  // Weblate owns de.json: a missing entry is policy-correct and must stay English. Only check
  // the entries that a translator has actually supplied.
  for (const key of keys) {
    if (typeof de[key] === 'string' && de[key].trim()) {
      deepEq(placeholders(de[key]), placeholders(key),
        `Placeholder mismatch in German translation for ${JSON.stringify(key)}`);
    }
  }

  // Exercise the real loader with a partial German dictionary: translated keys resolve, while
  // missing keys (including one with parameters) fall back to the English key/text.
  const fakeDe = { 'All lines': 'Alle Linien' };
  const { i18n } = loadI18n({
    fetch: async url => (url.includes('/i18n/de.json')
      ? { ok: true, json: async () => fakeDe }
      : { ok: false, json: async () => ({}) }),
  });
  await i18n.setLanguage('de');
  eq(i18n.language, 'de', 'German dictionary loaded');
  eq(i18n.text('All lines'), 'Alle Linien', 'a supplied translation is used');
  const missingKey = 'No GPS fix: a new line needs a position.';
  eq(i18n.text(missingKey), missingKey, 'a missing key falls back to its English text');
  eq(i18n.t(missingKey), missingKey, 'tr() returns the English key when no translation exists');
  eq(i18n.t('{n} lines', { n: 3 }), '3 lines',
    'a missing parameterized key falls back to English with its values filled');
});

test('rail-lines/long labels have explicit truncation or wrapping support', () => {
  assert(/#mod-field-name\s*\{[^}]*text-overflow:\s*ellipsis/.test(MODERN_CSS_SOURCE),
    'the field name truncates on its single row');
  assert(/#mod-field-job-name\s*\{[^}]*text-overflow:\s*ellipsis/.test(MODERN_CSS_SOURCE),
    'the job work type truncates on its single row');
  assert(/\.mod-line-name\s*\{[^}]*overflow-wrap:\s*anywhere/.test(MODERN_CSS_SOURCE),
    'line names still wrap inside the list rows');
});

// ===========================================================================
// Cycling gates and the no-new-control-path invariant
// ===========================================================================
test('cycle-gates/Previous and Next delegate to the existing cycle commands', () => {
  const sb = loadModern();
  tabs(sb);
  render(sb);
  eq(el(sb, 'mod-prev').disabled, false, 'Previous available');
  eq(el(sb, 'mod-next').disabled, false, 'Next available');
  eq(el(sb, 'mod-cycle-note').textContent, '', 'the idle cycling hint is gone');
  press(el(sb, 'mod-next'));
  press(el(sb, 'mod-prev'));
  deepEq(items(sb).sent, ['track.cycle', 'track.cycleBack'], 'existing host commands only');
  assertNoControlCommands(sb, 'cycling');
});

test('cycle-gates/an observer cannot cycle', () => {
  const sb = loadModern();
  tabs(sb, { iHoldControl: false });
  render(sb);
  eq(el(sb, 'mod-prev').disabled, true, 'Previous disabled');
  eq(el(sb, 'mod-next').disabled, true, 'Next disabled');
  eq(el(sb, 'mod-cycle-note').textContent, 'Observer: view only', 'reason');
  press(el(sb, 'mod-next'));
  eq(items(sb).sent.length, 0, 'no command from an observer');
});

test('cycle-gates/no field, contour and too few visible lines refuse', () => {
  const noField = loadModern();
  tabs(noField, { scene: { hasField: false, trackList: [] } });
  render(noField);
  eq(el(noField, 'mod-cycle-note').textContent, 'Open a field first', 'no field reason');
  press(el(noField, 'mod-next'));
  eq(items(noField).sent.length, 0, 'no field sends nothing');

  const contour = loadModern();
  tabs(contour, { tick: { op: { contour: true, autoSteer: false } } });
  render(contour);
  eq(el(contour, 'mod-cycle-note').textContent, 'Contour guidance: cycling is unavailable.', 'contour reason');
  press(el(contour, 'mod-prev'));
  eq(items(contour).sent.length, 0, 'contour sends nothing');

  const oneLine = loadModern();
  tabs(oneLine, {
    scene: {
      trackList: [
        { index: 0, name: 'A', type: 'Line', visible: true, active: true },
        { index: 1, name: 'Hidden B', type: 'Curve', visible: false, active: false },
      ],
    },
  });
  render(oneLine);
  eq(el(oneLine, 'mod-cycle-note').textContent, 'Two visible lines are needed to cycle.', 'one visible line');
  press(el(oneLine, 'mod-next'));
  eq(items(oneLine).sent.length, 0, 'one visible line sends nothing');

  const pathDoesNotCount = loadModern();
  tabs(pathDoesNotCount, {
    scene: {
      trackList: [
        { index: 0, name: 'A', type: 'Line', visible: true, active: true },
        { index: 1, name: 'Path', type: 'Path', visible: true, active: false },
      ],
    },
  });
  render(pathDoesNotCount);
  eq(el(pathDoesNotCount, 'mod-cycle-note').textContent, 'Two visible lines are needed to cycle.',
    'Path is not a cyclable guidance line');
  press(el(pathDoesNotCount, 'mod-next'));
  eq(items(pathDoesNotCount).sent.length, 0, 'Path does not enable cycling');
});

test('cycle-gates/two visible guidance lines cycle even with no active line', () => {
  const sb = loadModern();
  tabs(sb, { tick: { activeTrackName: '' } });
  render(sb);
  eq(el(sb, 'mod-prev').disabled, false, 'Previous is available without a host active line');
  eq(el(sb, 'mod-next').disabled, false, 'Next is available without a host active line');
  assert(!/no active line/i.test(el(sb, 'mod-cycle-note').textContent),
    'the rail does not claim no active line blocks cycling');
  press(el(sb, 'mod-next'));
  press(el(sb, 'mod-prev'));
  deepEq(items(sb).sent, ['track.cycle', 'track.cycleBack'],
    'the host can choose from two visible lines without an active one');
  assertNoControlCommands(sb, 'cycling without an active line');
});

test('cycle-gates/row, cycle, record, manager and menu surfaces send no new control command', () => {
  const sb = loadModern();
  tabs(sb);
  render(sb);
  press(rows(sb)[1]);
  press(el(sb, 'mod-prev'));
  press(el(sb, 'mod-next'));
  press(el(sb, 'mod-all-lines'));
  press(el(sb, 'mod-record-line'));
  press(el(sb, 'mod-menu'));
  assertNoControlCommands(sb, 'all rail surfaces', true);
  for (const command of items(sb).sent) {
    eq(command === 'track.select|1' || command === 'track.cycle' || command === 'track.cycleBack',
      true, `unexpected rail command ${command}`);
  }
});

// ===========================================================================
// Switch and reset guards
// ===========================================================================
test('switch-reset/reset in untouched Classic is a true no-op', () => {
  const sb = loadModern({ search: '' });
  sb.modernResetPresentation();
  eq(items(sb).confirms.length, 0, 'no confirmation');
  eq(sb.location.replaced.length, 0, 'no reload');
  includes(items(sb).toasts.join('\n'), 'no saved UI preference', 'explains why nothing happened');
});

test('switch-reset/reset with a saved or corrupt choice warns and reloads', () => {
  const saved = loadModern({ search: '', stored: { [STORAGE_KEY]: 'garbage' } });
  saved.modernResetPresentation();
  eq(items(saved).confirms.length, 1, 'confirmation shown');
  includes(items(saved).confirms[0].message, 'reloads', 'warns about the reload');
  includes(items(saved).confirms[0].message, 'AutoSteer', 'warns about AutoSteer');
  includes(items(saved).confirms[0].message, 'sections', 'warns about sections');
  eq(saved.localStorage.getItem(STORAGE_KEY), null, 'fork key removed');
  eq(saved.location.replaced.length, 1, 'reloaded');
  eq(new URL(saved.location.replaced[0]).searchParams.get('ui'), null, 'back to the default URL');
});

test('switch-reset/reset in Modern warns and reloads to Classic', () => {
  const sb = loadModern();
  sb.modernResetPresentation();
  eq(items(sb).confirms.length, 1, 'confirmation shown');
  eq(items(sb).confirms[0].title, 'Reset UI preferences', 'existing dialog title');
  includes(items(sb).confirms[0].message, 'only resets the Modern UI preference', 'scope of reset');
  eq(sb.localStorage.getItem(STORAGE_KEY), null, 'preference removed');
  eq(sb.location.replaced.length, 1, 'reloaded');
  eq(items(sb).sent.length, 0, 'reset sends no machine or guidance command');
});

test('switch-reset/unreadable or unwritable storage keeps the warning/reload path', () => {
  const sb = loadModern({ search: '', storage: { getThrows: true, removeThrows: true } });
  sb.modernResetPresentation();
  eq(items(sb).confirms.length, 1, 'still asks instead of guessing');
  eq(sb.location.replaced.length, 1, 'still reloads');
});

test('switch-reset/switching from Modern to Classic warns and remembers Classic', () => {
  const sb = loadModern();
  sb.modernSwitchPresentation();
  eq(items(sb).confirms.length, 1, 'confirmation shown');
  eq(items(sb).confirms[0].title, 'Switch interface', 'existing dialog title');
  includes(items(sb).confirms[0].message, 'reloads', 'warns about the reload');
  includes(items(sb).confirms[0].message, 'AutoSteer', 'warns about AutoSteer');
  includes(items(sb).confirms[0].message, 'sections', 'warns about sections');
  eq(sb.localStorage.getItem(STORAGE_KEY), 'classic', 'Classic remembered');
  eq(sb.location.replaced.length, 1, 'reloaded');
  eq(new URL(sb.location.replaced[0]).searchParams.get('ui'), 'classic', 'Classic in the URL');
  eq(sb.document.documentElement.getAttribute('data-ui'), 'modern',
    'the current page is not repainted by set(): the reload does it');
});

test('switch-reset/switching from Classic to Modern keeps Classic as the documented default', () => {
  const sb = loadModern({ search: '' });
  sb.modernSwitchPresentation();
  eq(items(sb).confirms.length, 1, 'confirmation shown');
  includes(items(sb).confirms[0].message, 'Classic remains the default', 'Classic stays the default');
  eq(sb.localStorage.getItem(STORAGE_KEY), 'modern', 'Modern remembered');
  eq(new URL(sb.location.replaced[0]).searchParams.get('ui'), 'modern', 'Modern in the URL');
});

test('switch-reset/every active recording, wizard, prompt and dialog refuses switching and reset', () => {
  const cases = [
    ['abFlow', sb => { sb.abFlow = {}; }],
    ['hlFlow', sb => { sb.hlFlow = {}; }],
    ['editSession', sb => { sb.editSession = {}; }],
    ['boundary recording', sb => { sb.boundary = { isRecording: true }; }],
    ['recorded path', sb => { sb.recPath = { isRecording: true }; }],
    ['map tap', sb => { sb.__test.body.classList.add('maptap'); }],
    ['wizard', sb => { sb.wizard = { closed: false }; }],
    ['host prompt state', sb => { sb.hostPrompt = { kind: 'unsaved' }; }],
    ['unsaved coverage dialog', sb => { el(sb, 'dlg-unsavedcov').classList.add('open'); }],
    ['host prompt element', sb => { el(sb, 'hostprompt').classList.add('open'); }],
    ['another dialog', sb => { el(sb, 'dialoghost').classList.add('open'); }],
  ];
  for (const [label, setup] of cases) {
    const sb = loadModern();
    setup(sb);
    sb.modernSwitchPresentation();
    eq(items(sb).confirms.length, 0, `${label}: switch asks for no confirmation`);
    eq(sb.location.replaced.length, 0, `${label}: switch does not reload`);
    eq(sb.localStorage.getItem(STORAGE_KEY), 'modern', `${label}: switch keeps the preference`);
    includes(items(sb).toasts.join('\n'), 'Finish the current recording', `${label}: switch refusal is explained`);

    const toastsBeforeReset = items(sb).toasts.length;
    sb.modernResetPresentation();
    eq(items(sb).confirms.length, 0, `${label}: reset asks for no confirmation`);
    eq(sb.location.replaced.length, 0, `${label}: reset does not reload`);
    eq(sb.localStorage.getItem(STORAGE_KEY), 'modern', `${label}: reset keeps the preference`);
    assert(items(sb).toasts.slice(toastsBeforeReset).length > 0, `${label}: reset refusal is explained`);
    eq(items(sb).sent.length, 0, `${label}: refusal sends no command`);
  }
});

test('switch-reset/operator host work blocks switch/reset except a clean Smooth panel or non-pending nudge', () => {
  for (const [label, setup] of HOST_WORK_CASES) {
    const sb = loadModern();
    tabs(sb);
    setup(sb);
    render(sb);
    eq(el(sb, 'mod-field-switch').disabled, true, `${label}: field entry is blocked`);
    const note = el(sb, 'mod-field-note').textContent;
    assert(note.trim().length > 0, `${label}: field block explains itself`);
    assert(/finish|record|edit|nudge|smooth/i.test(note), `${label}: field reason names the work`);

    sb.modernSwitchPresentation();
    eq(items(sb).confirms.length, 0, `${label}: switch refuses before asking`);
    eq(sb.location.replaced.length, 0, `${label}: switch does not reload`);
    eq(sb.localStorage.getItem(STORAGE_KEY), 'modern', `${label}: switch keeps the preference`);
    assert(/record|confirmation|finish|nudge|smooth/i.test(items(sb).toasts.join('\n')),
      `${label}: switch refusal explains the work`);

    const toastsBeforeReset = items(sb).toasts.length;
    sb.modernResetPresentation();
    eq(items(sb).confirms.length, 0, `${label}: reset refuses before asking`);
    eq(sb.location.replaced.length, 0, `${label}: reset does not reload`);
    eq(sb.localStorage.getItem(STORAGE_KEY), 'modern', `${label}: reset keeps the preference`);
    assert(/record|confirmation|finish|nudge|smooth/i.test(items(sb).toasts.slice(toastsBeforeReset).join('\n')),
      `${label}: reset refusal explains the work`);
    eq(items(sb).sent.length, 0, `${label}: refusal sends no command`);
  }

  for (const [label, setup] of OPERATOR_CLEAR_HOST_CASES) {
    const field = loadModern();
    tabs(field);
    setup(field);
    render(field);
    eq(el(field, 'mod-field-switch').disabled, false, `${label}: field entry stays enabled`);
    press(el(field, 'mod-field-switch'));
    eq(items(field).fieldsOpen.length, 1, `${label}: the existing chooser opens`);
    eq(items(field).sent.length, 0, `${label}: the field path sends nothing`);
    assertNoFieldCommands(field, label);

    const sw = loadModern();
    tabs(sw);
    setup(sw);
    sw.modernSwitchPresentation();
    eq(items(sw).confirms.length, 1, `${label}: switch offers its warning`);
    eq(sw.location.replaced.length, 1, `${label}: switch reloads`);
    eq(sw.localStorage.getItem(STORAGE_KEY), 'classic', `${label}: switch targets Classic`);

    const rs = loadModern();
    tabs(rs);
    setup(rs);
    rs.modernResetPresentation();
    eq(items(rs).confirms.length, 1, `${label}: reset offers its warning`);
    eq(rs.location.replaced.length, 1, `${label}: reset reloads`);
    eq(rs.localStorage.getItem(STORAGE_KEY), null, `${label}: reset clears the preference`);
  }
});

test('switch-reset/an observer may switch and reset across host-global work', () => {
  for (const [label, setup] of HOST_WORK_CASES) {
    for (const action of ['switch', 'reset']) {
      const sb = loadModern();
      tabs(sb, { iHoldControl: false, connState: 'connected' });
      setup(sb);
      render(sb);
      eq(el(sb, 'mod-field-switch').disabled, false, `${label} ${action}: observer field entry stays clear`);

      if (action === 'switch') sb.modernSwitchPresentation();
      else sb.modernResetPresentation();
      eq(items(sb).confirms.length, 1, `${label} ${action}: observer gets the normal warning`);
      eq(sb.location.replaced.length, 1, `${label} ${action}: observer reload is allowed`);
      eq(items(sb).toasts.length, 0, `${label} ${action}: host work must not refuse an observer`);
      eq(items(sb).sent.length, 0, `${label} ${action}: observer sends no command`);
      if (action === 'switch') {
        eq(sb.localStorage.getItem(STORAGE_KEY), 'classic', `${label} switch: Classic remembered`);
      } else {
        eq(sb.localStorage.getItem(STORAGE_KEY), null, `${label} reset: preference cleared`);
      }
    }
  }
});

test('switch-reset/no operator and unknown roles stay conservative around host work', () => {
  const roles = [
    ['no operator', sb => setControlRole(sb, 'no-operator')],
    ['missing local client id', sb => { setControlRole(sb, 'observer'); sb.myClientId = ''; }],
    ['unknown with a stale holder', sb => {
      setControlRole(sb, 'unknown');
      sb.connState = 'connecting';
      sb.lastControl = { held: true, holderId: ROLE_OTHER, holderName: 'Other screen' };
    }],
    ['disconnected with a stale holder', sb => setControlRole(sb, 'disconnected')],
  ];
  for (const [role, setup] of roles) {
    const sb = loadModern();
    tabs(sb);
    setup(sb);
    sb.boundary = { isRecording: false, isPaused: true };
    render(sb);
    eq(el(sb, 'mod-field-switch').disabled, true, `${role}: field entry stays blocked`);
    const note = el(sb, 'mod-field-note').textContent;
    assert(note.trim().length > 0, `${role}: field block explains itself`);
    assert(/reconnect|control|record|another screen|operator|finish|edit/i.test(note),
      `${role}: reason names the role/state`);

    press(el(sb, 'mod-field-switch'));
    eq(items(sb).fieldsOpen.length, 0, `${role}: field shortcut cannot open the chooser`);
    eq(items(sb).sent.length, 0, `${role}: field shortcut sends nothing`);

    sb.modernSwitchPresentation();
    eq(items(sb).confirms.length, 0, `${role}: switch refuses`);
    eq(sb.location.replaced.length, 0, `${role}: switch does not reload`);
    assert(items(sb).toasts.length > 0, `${role}: switch refusal is explained`);

    sb.modernResetPresentation();
    eq(items(sb).confirms.length, 0, `${role}: reset refuses`);
    eq(sb.location.replaced.length, 0, `${role}: reset does not reload`);
    eq(sb.localStorage.getItem(STORAGE_KEY), 'modern', `${role}: preference unchanged`);
  }

  // With a clear host, no operator is not permanently locked out of recovery.
  const sw = loadModern();
  tabs(sw, { role: 'no-operator' });
  sw.modernSwitchPresentation();
  eq(items(sw).confirms.length, 1, 'no operator clear host: switch offers its warning');
  eq(sw.location.replaced.length, 1, 'no operator clear host: switch reloads');
  eq(sw.localStorage.getItem(STORAGE_KEY), 'classic', 'no operator clear host: Classic remembered');

  const rs = loadModern();
  tabs(rs, { role: 'no-operator' });
  rs.modernResetPresentation();
  eq(items(rs).confirms.length, 1, 'no operator clear host: reset offers its warning');
  eq(rs.location.replaced.length, 1, 'no operator clear host: reset reloads');
  eq(rs.localStorage.getItem(STORAGE_KEY), null, 'no operator clear host: preference cleared');
});

test('switch-reset/an observer still cannot switch/reset over local unsaved work or dialogs', () => {
  const cases = [
    ['abFlow', sb => { sb.abFlow = {}; }],
    ['hlFlow', sb => { sb.hlFlow = {}; }],
    ['editSession', sb => { sb.editSession = {}; }],
    ['map tap', sb => { sb.__test.body.classList.add('maptap'); }],
    ['another dialog', sb => { el(sb, 'dialoghost').classList.add('open'); }],
    ['wizard', sb => { sb.wizard = { closed: false }; }],
    ['host prompt state', sb => { sb.hostPrompt = { kind: 'unsaved' }; }],
    ['unsaved coverage dialog', sb => { el(sb, 'dlg-unsavedcov').classList.add('open'); }],
    ['host prompt element', sb => { el(sb, 'hostprompt').classList.add('open'); }],
  ];
  for (const [label, setup] of cases) {
    const sb = loadModern();
    tabs(sb, { iHoldControl: false, connState: 'connected' });
    setup(sb);
    sb.modernSwitchPresentation();
    eq(items(sb).confirms.length, 0, `${label}: observer switch refuses`);
    eq(sb.location.replaced.length, 0, `${label}: observer switch does not reload`);
    eq(sb.localStorage.getItem(STORAGE_KEY), 'modern', `${label}: switch keeps the preference`);
    assert(items(sb).toasts.length > 0, `${label}: switch refusal is explained`);

    sb.modernResetPresentation();
    eq(items(sb).confirms.length, 0, `${label}: observer reset refuses`);
    eq(sb.location.replaced.length, 0, `${label}: observer reset does not reload`);
    eq(sb.localStorage.getItem(STORAGE_KEY), 'modern', `${label}: reset keeps the preference`);
    eq(items(sb).sent.length, 0, `${label}: refusal sends no command`);
  }

  // A local flow that appears while the observer's confirmation is open still wins the recheck.
  for (const action of ['switch', 'reset']) {
    const sb = loadModern({ confirm: 'manual' });
    tabs(sb, { iHoldControl: false, connState: 'connected' });
    if (action === 'switch') sb.modernSwitchPresentation();
    else sb.modernResetPresentation();
    eq(items(sb).confirms.length, 1, `${action}: observer confirmation opened`);
    sb.abFlow = {};
    items(sb).confirms[0].callback();
    eq(sb.location.replaced.length, 0, `${action}: local flow blocks the observer recheck`);
    eq(sb.localStorage.getItem(STORAGE_KEY), 'modern', `${action}: preference unchanged`);
    assert(items(sb).toasts.length > 0, `${action}: late local refusal is explained`);
  }
});

test('switch-reset/a local flow that appears during confirmation is caught by both rechecks', () => {
  for (const action of ['switch', 'reset']) {
    const sb = loadModern({ confirm: 'manual' });
    if (action === 'switch') sb.modernSwitchPresentation();
    else sb.modernResetPresentation();
    eq(items(sb).confirms.length, 1, `${action}: confirmation opened`);
    sb.abFlow = {};
    items(sb).confirms[0].callback();
    eq(sb.location.replaced.length, 0, `${action}: recheck refused the reload`);
    eq(sb.localStorage.getItem(STORAGE_KEY), 'modern', `${action}: preference unchanged`);
    includes(items(sb).toasts.join('\n'), 'Finish the current recording', `${action}: late refusal is explained`);
  }
});

test('switch-reset/a paused host boundary recording starting during confirmation blocks only the operator', () => {
  for (const action of ['switch', 'reset']) {
    const operator = loadModern({ confirm: 'manual' });
    tabs(operator);
    render(operator);
    if (action === 'switch') operator.modernSwitchPresentation();
    else operator.modernResetPresentation();
    eq(items(operator).confirms.length, 1, `operator ${action}: confirmation opened while clear`);
    const replacedBefore = operator.location.replaced.length;
    operator.boundary = { isRecording: false, isPaused: true };
    items(operator).confirms[0].callback();
    eq(operator.location.replaced.length, replacedBefore, `operator ${action}: recheck refused the reload`);
    eq(operator.localStorage.getItem(STORAGE_KEY), 'modern', `operator ${action}: preference unchanged`);
    assert(/record|confirmation|finish|boundary/i.test(items(operator).toasts.join('\n')),
      `operator ${action}: late refusal explains the recording`);
  }

  // The observer cannot resolve another browser's paused recording; host work must not trap it.
  for (const action of ['switch', 'reset']) {
    const observer = loadModern({ confirm: 'manual' });
    tabs(observer, { iHoldControl: false, connState: 'connected' });
    render(observer);
    if (action === 'switch') observer.modernSwitchPresentation();
    else observer.modernResetPresentation();
    eq(items(observer).confirms.length, 1, `observer ${action}: confirmation opened while clear`);
    observer.boundary = { isRecording: false, isPaused: true };
    items(observer).confirms[0].callback();
    eq(observer.location.replaced.length, 1, `observer ${action}: host work does not block recovery`);
    eq(items(observer).toasts.length, 0, `observer ${action}: no refusal toast`);
    if (action === 'switch') {
      eq(observer.localStorage.getItem(STORAGE_KEY), 'classic', 'observer switch targets Classic');
    } else {
      eq(observer.localStorage.getItem(STORAGE_KEY), null, 'observer reset clears the preference');
    }
  }
});

test('switch-reset/the recheck only tolerates the confirmation card itself', () => {
  const allowed = loadModern({ confirm: 'manual' });
  allowed.modernSwitchPresentation();
  el(allowed, 'dialoghost').classList.add('open');
  el(allowed, 'dialoghost')._queryResult = { id: 'dlg-confirm' };
  items(allowed).confirms[0].callback();
  eq(allowed.location.replaced.length, 1, 'its own confirmation does not block the switch');

  const blocked = loadModern({ confirm: 'manual' });
  blocked.modernSwitchPresentation();
  el(blocked, 'dialoghost').classList.add('open');
  el(blocked, 'dialoghost')._queryResult = { id: 'dlg-quickab' };
  items(blocked).confirms[0].callback();
  eq(blocked.location.replaced.length, 0, 'another dialog blocks the switch');
  includes(items(blocked).toasts.join('\n'), 'Finish the current recording', 'explains the refusal');
});

test('switch-reset/switch labels describe the target without changing the default', () => {
  const classic = loadModern({ search: '' });
  eq(el(classic, 'fm-ui-switch').textContent, 'Modern UI', 'Classic offers Modern');
  eq(el(classic, 'fm-ui-hint').textContent, 'Classic is the default. Modern is a preview.', 'Classic hint');
  const modern = loadModern();
  eq(el(modern, 'fm-ui-switch').textContent, 'Classic UI', 'Modern offers Classic');
  eq(el(modern, 'fm-ui-hint').textContent, 'Modern UI is a preview. Classic is the default.', 'Modern hint');
});

test('switch-reset/reset and switch never send guidance, steering or section commands', () => {
  const sb = loadModern();
  sb.modernResetPresentation();
  eq(items(sb).sent.length, 0, 'reset sends nothing');
  const switching = loadModern();
  switching.modernSwitchPresentation();
  eq(items(switching).sent.length, 0, 'switch sends nothing');
});

// ===========================================================================
// Card pane suspension and the map-area contract
// ===========================================================================
test('card-pane/a split pane suspends the rail and restores its inset when closed', () => {
  const sb = loadModern();
  tabs(sb);
  sb.CardPane = { layout: 'split' };
  el(sb, 'cardpane').classList.add('show');
  const before = items(sb).mapArea.length;
  render(sb);
  eq(el(sb, 'modern-rail').classList.contains('suspended'), true, 'rail steps aside');
  eq(items(sb).mapArea.length, before, 'no competing inset while the pane owns the edge');
  el(sb, 'cardpane').classList.remove('show');
  render(sb);
  eq(el(sb, 'modern-rail').classList.contains('suspended'), false, 'rail returns');
  deepEq(items(sb).mapArea.slice(-1)[0], [0, 300], 'rail inset restored');
});

test('card-pane/a floating card pane does not suspend the rail', () => {
  const sb = loadModern();
  tabs(sb);
  sb.CardPane = { layout: 'float' };
  el(sb, 'cardpane').classList.add('show');
  render(sb);
  eq(el(sb, 'modern-rail').classList.contains('suspended'), false, 'float layout leaves the rail in place');
});

test('map-area/the rail claims its measured width and follows resize and UI zoom', () => {
  const sb = loadModern();
  deepEq(items(sb).mapArea, [[0, 300]], 'initial rail width');
  el(sb, 'modern-rail')._rect.width = 260.4;
  sb.__dispatchGlobal('resize');
  deepEq(items(sb).mapArea.slice(-1)[0], [0, 260], 'rounded measured width');
  sb.__dispatchGlobal('uizoom');
  deepEq(items(sb).mapArea.slice(-1)[0], [0, 260], 'UI zoom re-syncs the same measured width');
});

test('map-area/hidden rails and Classic do not touch the map area, and a zero rect uses the 300px default', () => {
  const sb = loadModern();
  const before = items(sb).mapArea.length;
  el(sb, 'modern-rail').hidden = true;
  sb.__dispatchGlobal('resize');
  eq(items(sb).mapArea.length, before, 'hidden rail claims nothing');

  el(sb, 'modern-rail').hidden = false;
  el(sb, 'modern-rail')._rect.width = 0;
  sb.__dispatchGlobal('resize');
  deepEq(items(sb).mapArea.slice(-1)[0], [0, 300], 'an unmeasurable rect falls back to the designed width');

  const classic = loadModern({ search: '' });
  classic.__dispatchGlobal('resize');
  eq(items(classic).mapArea.length, 0, 'Classic never claims a Modern inset');
});

// ===========================================================================
// Pointer, wheel and keyboard isolation
// ===========================================================================
test('input-isolation/a rail press and wheel are kept from the map gesture', () => {
  const sb = loadModern();
  const rail = el(sb, 'modern-rail');
  const down = makeEvent();
  rail.dispatch('pointerdown', down);
  eq(down.stopped, 1, 'pointerdown stopped at the rail');
  eq(down.defaultPrevented, false, 'pointerdown is not prevented');
  const wheel = makeEvent();
  rail.dispatch('wheel', wheel);
  eq(wheel.stopped, 1, 'wheel stopped at the rail');
  const wheelListener = rail.listeners.wheel[0];
  eq(wheelListener.options && wheelListener.options.passive, true, 'wheel listener stays passive');
});

test('input-isolation/a rail button activates once per pointer tap, never twice', () => {
  const sb = loadModern();
  tabs(sb);
  render(sb);
  const next = el(sb, 'mod-next');
  const down = makeEvent();
  next.dispatch('pointerdown', down);
  eq(down.stopped, 1, 'button press does not reach the window map gesture');
  eq(items(sb).sent.length, 1, 'pointerdown activates');
  next.dispatch('click', makeEvent({ detail: 1 }));
  eq(items(sb).sent.length, 1, 'the compatibility click does not activate twice');
  next.dispatch('click', makeEvent({ detail: 0 }));
  eq(items(sb).sent.length, 2, 'a keyboard-style click activates');
});

test('input-isolation/Space and Enter reach a focused rail button without the Stop hotkey', () => {
  const sb = loadModern();
  tabs(sb);
  render(sb);
  const next = el(sb, 'mod-next');
  for (const key of [' ', 'Enter']) {
    const event = makeEvent({ key, repeat: false });
    next.dispatch('keydown', event);
    eq(event.stopped, 1, `${key} is stopped before the simulator hotkey`);
    eq(event.defaultPrevented, false, `${key} keeps native activation`);
  }
  const repeat = makeEvent({ key: ' ', repeat: true });
  next.dispatch('keydown', repeat);
  eq(repeat.defaultPrevented, true, 'a held Space does not repeat-activate');
  const other = makeEvent({ key: 's' });
  next.dispatch('keydown', other);
  eq(other.stopped, 0, 'unrelated keys are not swallowed');
});

// ---------------------------------------------------------------------------
// Regression checks for the real Classic toolbar and Escape dispatchers. Extract just their
// listener registrations so the same code runs with the stubbed Modern recording flow.
test('rail-lines/toolbar and Escape cannot bypass the recording guard', () => {
  const sb = loadModern({ confirm: 'manual' });
  tabs(sb); sb.abFlow = 'driveAB'; sb.driveStep = 1; sb.drawPts = [{}];
  sb.drawBar = el(sb, 'draw-toolbar'); sb.satBnd = null; sb.mapTap = null;
  const tracks = readWww('js', 'tracks.js');
  const begin = tracks.indexOf("drawBar.addEventListener('pointerdown'");
  const end = tracks.indexOf('// Touch cancel for bare map-tap flows', begin);
  assert(begin >= 0 && end > begin, 'Classic toolbar listener source found');
  runScript(sb, tracks.slice(begin, end), 'toolbar-listeners.js');
  press(el(sb, 'draw-cancel'));
  eq(items(sb).confirms.length, 1, 'toolbar cancel requests confirmation');
  assert(!items(sb).calls.includes('abCancel'), 'toolbar does not directly discard');

  const map = readWww('js', 'map-input.js');
  const kb = map.indexOf("addEventListener('keydown', e => {");
  const kbEnd = map.indexOf('// ---- sim drive keys', kb);
  assert(kb >= 0 && kbEnd > kb, 'map Escape listener source found');
  runScript(sb, map.slice(kb, kbEnd), 'map-key-listener.js');
  const escape = items(sb).globalListeners.keydown.slice(-1)[0];
  el(sb, 'dialoghost').classList.add('open');
  escape(makeEvent({ key: 'Escape' }));
  eq(items(sb).confirms.length, 1, 'Escape does not replace an open confirmation');
  assert(!items(sb).calls.includes('abCancel'), 'Escape does not discard behind the confirmation');
  el(sb, 'dialoghost').classList.remove('open');
  escape(makeEvent({ key: 'Escape' }));
  eq(items(sb).confirms.length, 2, 'Escape requests the same confirmation');
  setControlRole(sb, 'observer');
  press(el(sb, 'draw-setpoint'));
  assert(!items(sb).calls.includes('abSetPoint'), 'toolbar cannot advance after loss of control');

  const classic = loadModern({ search: '?ui=classic' });
  tabs(classic); classic.abFlow = 'driveAB'; classic.driveStep = 1; classic.drawPts = [{}];
  classic.drawBar = el(classic, 'draw-toolbar'); classic.satBnd = null; classic.mapTap = null;
  runScript(classic, tracks.slice(begin, end), 'classic-toolbar-listeners.js');
  press(el(classic, 'draw-cancel'));
  assert(items(classic).calls.includes('abCancel'), 'Classic keeps its existing cancel behavior');
});

test('input-isolation/All lines background and wheel do not reach the map', () => {
  const sb = loadModern(); tabs(sb); render(sb);
  const panel = el(sb, 'mod-all-lines-panel');
  const down = makeEvent(), wheel = makeEvent();
  panel.dispatch('pointerdown', down); panel.dispatch('wheel', wheel);
  assert(down.stopped && wheel.stopped, 'column isolates map gestures');
  eq(down.defaultPrevented, false, 'native interaction is preserved');
  eq(wheel.defaultPrevented, false, 'native scrolling is preserved');
});

function loadScaleForTest() {
  const sb = makeSandbox();
  const source = readWww('js', 'skia-setup.js');
  const start = source.indexOf('let uiZoom = 1;');
  const end = source.indexOf('function calibrateZoom()');
  assert(start >= 0 && end > start, 'scale implementation found');
  runScript(sb, source.slice(start, end), 'scale-implementation.js');
  sb.appliedScales = [];
  runScript(sb, 'applyUiScale = function(pct) { uiZoom = pct / 100; appliedScales.push(pct); };', 'scale-stubs.js');
  return sb;
}

test('ui-scale/a pending Auto update cannot override a manual choice', () => {
  const sb = loadScaleForTest(); sb.innerWidth = 1920; sb.innerHeight = 1080;
  sb.setUiScaleAuto(true);
  sb.refreshAutoUiScale();
  const pending = [...sb.__test.timers._map.values()].find(t => t.ms === 150);
  assert(pending, 'automatic measurement was queued');
  sb.setUiScaleManual(115);
  sb.__test.timers.fire(150);
  pending.fn(); // also covers a callback already queued when the timer was cancelled
  deepEq(sb.appliedScales, [150, 115], 'manual scale remains authoritative');
  eq(sb.isUiScaleAuto(), false, 'Auto is disabled');
});

test('ui-scale/each actual line row contributes to the fit', () => {
  const sb = loadScaleForTest();
  sb.getComputedStyle = el => el._computed || { display: 'block' };
  const list = makeElement('list');
  list._computed = { display: 'block', rowGap: '6px', paddingTop: '6px', paddingBottom: '6px' };
  for (const [height, active] of [[72, true], [56, false], [60, false], [112, false]]) {
    const row = makeElement(); row._rect.height = height;
    const line = makeElement(); line._computed = { display: 'flex', minHeight: '56px' };
    row.querySelector = s => s === '.mod-line' ? line : s === '.mod-line-active' && active ? line : null;
    list.appendChild(row);
  }
  eq(sb.fullLineWindowHeight(list), 330, 'all four different row heights are measured');
  list.children.splice(1);
  eq(sb.fullLineWindowHeight(list), 270, 'three missing rows retain the minimum reservation');
});

test('ui-scale/rail measurement includes the separate steering dock', () => {
  const sb = loadScaleForTest();
  sb.getComputedStyle = el => el._computed || { display: 'block' };
  const rail = makeElement('rail'), surface = makeElement('surface'), child = makeElement('child'), dock = makeElement('dock');
  rail._computed = { display: 'flex', rowGap: '8px', paddingTop: '7px', paddingBottom: '7px' };
  surface._computed = { display: 'flex', paddingBottom: '0px' }; surface._rect.top = 0;
  child._rect.bottom = 300; dock._rect.height = 63; dock._computed = { display: 'block', marginTop: '2px' };
  surface.appendChild(child); rail.querySelector = () => dock;
  el(sb, 'mod-rail-list').hidden = true;
  eq(sb.railNaturalHeight(rail, surface), 387, 'dock and its rail gap are measured outside the surface');
});

// Runner
// ---------------------------------------------------------------------------
const filter = process.argv[2] || '';
const selected = filter
  ? tests.filter(t => t.name === filter || t.name.startsWith(`${filter}/`))
  : tests;

console.log(`Modern UI behavior harness (stub DOM, no browser): ${filter || 'all groups'}`);
if (!selected.length) {
  console.log(`No tests matched ${JSON.stringify(filter)}`);
  process.exit(2);
}

(async () => {
  let failed = 0;
  for (const t of selected) {
    try {
      await t.fn();
      console.log(`PASS ${t.name}`);
    } catch (e) {
      failed += 1;
      console.log(`FAIL ${t.name}`);
      console.log(`  ${e && e.stack ? e.stack.split('\n').join('\n  ') : e}`);
    }
  }

  console.log(`\n${selected.length - failed} passed, ${failed} failed (${filter || 'all'})`);
  process.exit(failed ? 1 : 0);
})();
