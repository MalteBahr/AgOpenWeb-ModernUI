// AgOpenWeb
// Copyright (C) 2024-2026 AgOpenWeb Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The Modern presentation shell: a persistent right-hand AB-line rail and a labeled left
// menu. Presentation only — every action reuses the existing menu, Tracks Manager, Quick AB
// creator and field operations, and every active marker comes from the host.

// ---- Modern presentation (opt-in; Classic is the default) -------------------
// The rail shows the named, visible guidance lines the host already sends in scene.trackList.
// A line card selects that line with the existing track.select command, and Previous/Next use
// the existing cycle commands. The marker follows the host (t.active/tick.activeTrackName), so a
// rejected command or a lost link cannot leave a local highlight.
//
// track.select does not disengage AutoSteer today. The rail therefore asks before sending it in
// this browser while the latest Tick says AutoSteer is engaged. That confirmation is a client
// convenience, not an atomic host interlock; the later host change is recorded in
// Plans/MODERN_UI_HOST_CHANGES.md (H1). Previous/Next keep the host cycle semantics, which
// disengage AutoSteer and report when the track changes.
//
// The record shortcuts use the same Quick AB helpers as the existing dialog (qabStart): A+ uses
// the current heading, Drive A→B and Curve start their client-local steps. While one of those
// two driven flows is active the rail takes over with a recording card built only from this
// browser's abFlow/driveStep/curveMarks state. It is deliberately labelled as this-browser-only;
// reliable state after reload/reconnect needs the host projection in H3.
const MODERN_RAIL_PX = 300;
const MODERN_MAX_LINES = 4;
const MODERN_NON_GUIDANCE = new Set(['Path', 'Contour']);
const MODERN_RECENT_FIELDS_KEY = 'agopenweb.modernui.recentFields';
const MODERN_PINNED_FIELDS_KEY = 'agopenweb.modernui.pinnedFields';
const MODERN_RECENT_FIELDS_MAX = 5;
const MODERN_EL = {
  rail: document.getElementById('modern-rail'),
  normalSurface: document.getElementById('mod-normal-surface'),
  recording: document.getElementById('mod-recording'),
  fieldName: document.getElementById('mod-field-name'),
  fieldPin: document.getElementById('mod-field-pin'),
  fieldJob: document.getElementById('mod-field-job'),
  fieldJobName: document.getElementById('mod-field-job-name'),
  jobAction: document.getElementById('mod-job-action'),
  activeLine: document.getElementById('mod-active-line'),
  activeType: document.getElementById('mod-active-type'),
  activeSlot: document.getElementById('mod-active-slot'),
  autoTrack: document.getElementById('mod-auto-track'),
  fieldSwitch: document.getElementById('mod-field-switch'),
  fieldChips: document.getElementById('mod-field-chips'),
  fieldNote: document.getElementById('mod-field-note'),
  observer: document.getElementById('mod-observer'),
  steer: document.getElementById('mod-steer'),
  steerState: document.getElementById('mod-steer-state'),
  xte: document.getElementById('mod-xte'),
  xteValue: document.getElementById('mod-xte-value'),
  lockNote: document.getElementById('mod-lock-note'),
  status: document.getElementById('mod-status'),
  list: document.getElementById('mod-rail-list'),
  prev: document.getElementById('mod-prev'),
  next: document.getElementById('mod-next'),
  cycleNote: document.getElementById('mod-cycle-note'),
  nudgeLeft: document.getElementById('mod-nudge-left'),
  nudgeRight: document.getElementById('mod-nudge-right'),
  nudgeValue: document.getElementById('mod-nudge-value'),
  snapPivot: document.getElementById('mod-snap-pivot'),
  allLines: document.getElementById('mod-all-lines'),
  allLinesPanel: document.getElementById('mod-all-lines-panel'),
  allLinesList: document.getElementById('mod-all-lines-list'),
  allLinesClose: document.getElementById('mod-all-lines-close'),
  allLinesCount: document.getElementById('mod-all-lines-count'),
  tracksManager: document.getElementById('mod-tracks-manager'),
  quickAb: document.getElementById('mod-quick-ab'),
  recordLine: document.getElementById('mod-record-line'),
  recordAb: document.getElementById('mod-record-ab'),
  recordCurve: document.getElementById('mod-record-curve'),
  recordHelp: document.getElementById('mod-record-help'),
  recMode: document.getElementById('mod-rec-mode'),
  recField: document.getElementById('mod-rec-field'),
  recStep: document.getElementById('mod-rec-step'),
  recStats: document.getElementById('mod-rec-stats'),
  recConsequence: document.getElementById('mod-rec-consequence'),
  recPrimary: document.getElementById('mod-rec-primary'),
  recCancel: document.getElementById('mod-rec-cancel'),
  recNote: document.getElementById('mod-rec-note'),
  menu: document.getElementById('mod-menu'),
  settings: document.getElementById('modern-settings'),
  settingsGrid: document.getElementById('mod-settings-grid'),
  settingsApps: document.getElementById('mod-settings-apps'),
  settingsAppSection: document.getElementById('mod-settings-app-section'),
  setTram: document.getElementById('mod-set-tram'),
  setSkipMode: document.getElementById('mod-set-skipmode'),
  setSkipRows: document.getElementById('mod-set-skiprows'),
  setColors: document.getElementById('mod-set-colors'),
  setMapFlags: document.getElementById('mod-set-map-flags'),
  setMapHeadland: document.getElementById('mod-set-map-headland'),
  setMapSections: document.getElementById('mod-set-map-sections'),
  setMapContour: document.getElementById('mod-set-map-contour'),
  setMapSectionsAuto: document.getElementById('mod-set-map-sections-auto'),
  setMapSectionsManual: document.getElementById('mod-set-map-sections-manual'),
  setMapYouturn: document.getElementById('mod-set-map-youturn'),
  setMapIsobus: document.getElementById('mod-set-map-isobus'),
  setMapContourLock: document.getElementById('mod-set-map-contourlock'),
  setToolHeading: document.getElementById('mod-set-toolheading'),
  setModeTrailing: document.getElementById('mod-set-mode-trailing'),
  setModeAlways: document.getElementById('mod-set-mode-always'),
  setModeNever: document.getElementById('mod-set-mode-never'),
  mapControls: document.getElementById('mod-map-controls'),
  mapFlags: document.getElementById('mod-map-flags'),
  mapHeadland: document.getElementById('mod-map-headland'),
  mapHeadlandIc: document.getElementById('mod-map-headland-ic'),
  mapHeadlandState: document.getElementById('mod-map-headland-state'),
  mapSections: document.getElementById('mod-map-sections'),
  mapSectionsIc: document.getElementById('mod-map-sections-ic'),
  mapSectionsState: document.getElementById('mod-map-sections-state'),
  mapToolHeading: document.getElementById('mod-map-toolheading'),
  mapControlsRight: document.getElementById('mod-map-controls-right'),
  mapContour: document.getElementById('mod-map-contour'),
  mapContourIc: document.getElementById('mod-map-contour-ic'),
  mapContourState: document.getElementById('mod-map-contour-state'),
  mapSectionsAuto: document.getElementById('mod-map-sections-auto'),
  mapSectionsAutoIc: document.getElementById('mod-map-sections-auto-ic'),
  mapSectionsAutoState: document.getElementById('mod-map-sections-auto-state'),
  mapSectionsManual: document.getElementById('mod-map-sections-manual'),
  mapSectionsManualIc: document.getElementById('mod-map-sections-manual-ic'),
  mapSectionsManualState: document.getElementById('mod-map-sections-manual-state'),
  mapYouturn: document.getElementById('mod-map-youturn'),
  mapYouturnIc: document.getElementById('mod-map-youturn-ic'),
  mapYouturnState: document.getElementById('mod-map-youturn-state'),
  mapIsobus: document.getElementById('mod-map-isobus'),
  mapIsobusIc: document.getElementById('mod-map-isobus-ic'),
  mapIsobusState: document.getElementById('mod-map-isobus-state'),
  mapContourLock: document.getElementById('mod-map-contourlock'),
  mapContourLockIc: document.getElementById('mod-map-contourlock-ic'),
  mapContourLockState: document.getElementById('mod-map-contourlock-state'),
  settingsClose: document.getElementById('mod-settings-close'),
  settingsSwitch: document.getElementById('mod-settings-switch'),
  settingsReset: document.getElementById('mod-settings-reset'),
  lineAdjustBtn: document.getElementById('mod-line-adjust'),
  lineAdjust: document.getElementById('mod-lineadjust'),
  lineAdjustClose: document.getElementById('mod-la-close'),
  lineAdjustHost: document.getElementById('mod-la-host'),
  lineAdjustName: document.getElementById('mod-la-name'),
  lineAdjustField: document.getElementById('mod-la-field'),
  lineAdjustEmpty: document.getElementById('mod-la-empty'),
  lineAdjustEmptyText: document.getElementById('mod-la-empty-text'),
  lineAdjustAllLines: document.getElementById('mod-la-all-lines'),
  lineOptions: document.getElementById('mod-la-options'),
  lineOptionsNote: document.getElementById('mod-la-options-note'),
  lineAdjustNote: document.getElementById('mod-la-note'),
  switchBtn: document.getElementById('fm-ui-switch'),
  resetBtn: document.getElementById('fm-ui-reset'),
  hint: document.getElementById('fm-ui-hint'),
};
let modernRailKey = '';
let modernRailSuspended = false;
let modernMenuActive = null;
let modernRecFlow = '';
let modernRecStartedAt = 0;
let modernLastFieldName = '';

function isModernUi() {
  return !!(window.AgOpenWebUiMode && window.AgOpenWebUiMode.isModern());
}

// A split/full card pane owns the map area (Plans/ADD_ON_CARDS_PLAN.md). The cards are switched
// off by default; when one is opened, the Modern rail steps aside rather than fighting the pane
// for the right edge or overlaying its controls. Classic/the card pane is unchanged.
function modernCardPaneOpen() {
  if (typeof CardPane === 'undefined' || CardPane.layout === 'float') return false;
  const pane = document.getElementById('cardpane');
  return !!(pane && pane.classList.contains('show'));
}

function modernRailShown() {
  return !!MODERN_EL.rail && !MODERN_EL.rail.hidden
    && getComputedStyle(MODERN_EL.rail).display !== 'none';
}
function modernMenuShown() {
  return !!MODERN_EL.menu && !MODERN_EL.menu.hidden
    && getComputedStyle(MODERN_EL.menu).display !== 'none';
}

// The rail is the one visible cycle control while it is actually on screen. The Classic
// right-nav pair (js/overlays.js renderRightNav, js/control.js wiring) is left untouched and
// returns as soon as the rail steps aside for a split/full card pane or the page is Classic, so
// no action loses its fallback. CSS hides that pair through .mod-rail-live (see css/modern.css).
let modernRailLive = false;
function syncModernClassicCycleFallback() {
  const live = isModernUi() && !modernRailSuspended && modernRailShown();
  if (live === modernRailLive) return;
  modernRailLive = live;
  document.documentElement.classList.toggle('mod-rail-live', live);
}

// The map gives the rail its width through the existing map-area contract (the same one the
// card pane uses). --sar and every overlay follow from it, so the right nav and the camera
// pad stay left of the rail rather than under it. zoomRect() converts older WebKit's zoomed
// rects to screen pixels, which is what setMapArea takes.
function syncModernMapArea() {
  if (!isModernUi() || !MODERN_EL.rail || modernRailSuspended || modernCardPaneOpen()
      || !modernRailShown() || typeof setMapArea !== 'function') return;
  const r = typeof zoomRect === 'function' ? zoomRect(MODERN_EL.rail) : MODERN_EL.rail.getBoundingClientRect();
  const w = Math.round(r.width || MODERN_RAIL_PX * (typeof uiZoom === 'number' ? uiZoom : 1));
  // The All lines column sits between the map and the rail; the map area grows by its width so
  // the on-screen controls move left instead of sitting under it.
  if (w > 0) setMapArea(0, modernAllLinesShown() ? w * 2 : w);
}

function modernObserver(show) {
  if (MODERN_EL.observer) MODERN_EL.observer.hidden = !show;
}

// Work whose state lives only in this page: do not make it easier to walk away from. Interface
// switching and reset use this as a Modern-only navigation guard; the existing host commands and
// guards are not changed, and Classic stays available.
function modernLocalFlowBusy() {
  if (typeof abFlow !== 'undefined' && abFlow) return true;
  if (typeof hlFlow !== 'undefined' && hlFlow) return true;
  if (typeof editSession !== 'undefined' && editSession) return true;
  return document.body.classList.contains('maptap');
}

// Host-projected work that acts on the line/field. A paused boundary still holds unsaved points;
// refNudgePending is an actual unsaved line move. SmoothOpen alone is only a clean panel: the
// panel opens at SmoothCount 0 and that is "as saved", so it must not block. Any count > 0 is
// unsaved smoothing. This is still only a local navigation guard: it cannot know a host-only AB
// creation that outlived a reconnect.
function modernOperatorHostBusy() {
  if (typeof boundary !== 'undefined' && boundary
      && (boundary.isRecording || boundary.isPaused)) return true;
  if (typeof recPath !== 'undefined' && recPath && recPath.isRecording) return true;
  const op = (tick && tick.op) || {};
  if (op.refNudgePending) return true;
  return !!(op.smoothOpen && (op.smoothCount || 0) > 0);
}

// A connected screen without control is only a definite observer when the host's last control
// frame names a different, known holder. "No operator" (lastControl.held false), a missing client
// id, or a lost link is unknown and stays conservative: the guard never excuses a host flow it
// cannot attribute.
function modernIsObserverNow() {
  if (connState !== 'connected' || iHoldControl) return false;
  if (typeof lastControl === 'undefined' || !lastControl || !lastControl.held) return false;
  return !!myClientId && !!lastControl.holderId && lastControl.holderId !== myClientId;
}

// Field chooser: local unsaved work always blocks. Host-global work blocks an operator/unknown seat
// because a following field action would act on it; a definite observer only opens a view-only
// panel (the host rejects field actions), so another browser's recording/edit must not block it.
function modernFieldEntryBlocked() {
  if (modernLocalFlowBusy()) return true;
  if (modernTypedFieldFormBusy()) return true; // keep the typed form and show why
  return !modernIsObserverNow() && modernOperatorHostBusy();
}

// UI switch/reset: a reload only releases this browser's connection. An observer cannot lose or
// resolve another browser's host flow, so it must not be locked out of recovery by that work.
// Local unsaved flows, typed field forms, dialogs and confirmations still block;
// disconnected/unknown stays conservative.
function modernSwitchResetFlowBusy() {
  if (modernLocalFlowBusy()) return true;
  if (modernTypedFieldFormBusy()) return true;
  return !modernIsObserverNow() && modernOperatorHostBusy();
}

// The rail's field entry is a navigation shortcut to the existing Fields and Jobs chain panel,
// not a field command: it never sends field.openOnly/resumeLast itself. Opening another field can
// cancel an AB or boundary recording unsaved. It cannot detect a host-only AB recording after a
// reload; nothing here claims that.
const MODERN_FIELD_PANELS = ['fieldops', 'fieldsandjobs', 'newfield', 'fromexisting', 'isoimport',
  'kmlimport', 'resumejob', 'agsettings', 'agupload', 'agdownload'];
function modernFieldPanelsOpen() {
  return MODERN_FIELD_PANELS.some(id => {
    const el = document.getElementById(id);
    return !!(el && el.classList.contains('open'));
  });
}
function modernFieldsAndJobsOpen() {
  const el = document.getElementById('fieldsandjobs');
  return !!(el && el.classList.contains('open'));
}
// A field form with typed text has no separate save step. Do not navigate away and close it.
// Fields and Jobs auto-fills its job name with a date, so that untouched default is not unsaved
// work; notes, work type or a changed name are. The chooser itself is handled before this test.
function modernTypedFieldFormBusy() {
  for (const id of MODERN_FIELD_PANELS) {
    const panel = document.getElementById(id);
    if (!panel || !panel.classList.contains('open')) continue;
    if (id === 'fieldsandjobs') {
      const notes = document.getElementById('fj-notes');
      const workType = document.getElementById('fj-worktype');
      if ((notes && String(notes.value || '').trim())
          || (workType && String(workType.value || '').trim())) return true;
      const task = document.getElementById('fj-taskname');
      const taskValue = task ? String(task.value || '').trim() : '';
      if (taskValue && (typeof isoDate !== 'function' || taskValue !== isoDate())) return true;
      continue;
    }
    if (typeof panel.querySelectorAll !== 'function') continue;
    for (const input of panel.querySelectorAll('input, textarea')) {
      if (!input || input.disabled) continue;
      const type = String(input.type || '').toLowerCase();
      if (type === 'checkbox' || type === 'radio' || type === 'hidden'
          || type === 'button' || type === 'submit') continue;
      if (String(input.value || '').trim()) return true;
    }
  }
  return false;
}
function modernFieldBlockedReason() {
  if (modernTypedFieldFormBusy())
    return tr('This field form has unsaved text. Close or cancel it before choosing another field.');
  if (connState !== 'connected')
    return tr('Reconnect to control this screen before switching fields; another screen may be recording or editing.');
  return tr('Finish or cancel the current edit or recording before switching fields.');
}
function modernOpenFields() {
  // A disabled button is only a visual gate: a queued/programmatic call rechecks every block,
  // including a typed field form that must be kept open.
  if (modernFieldEntryBlocked()) return;
  // Fields and Jobs is already the chooser: leave it and any typed job form untouched.
  if (modernFieldsAndJobsOpen()) return;
  // The existing handler in js/fields.js opens the existing panel and asks the host for a list
  // refresh. Fall back to the same panel if the newer chain helper is unavailable.
  if (typeof openFieldsAndJobs === 'function') openFieldsAndJobs();
  else lnOpen('fieldops', 'ln-fieldops', typeof renderFieldOps === 'function' ? renderFieldOps : undefined);
}

// The recent order is browser-local and presentation-only, under the fork's own namespace. It is
// never treated as host truth: names are validated against the FieldOps list on every render,
// unknown/deleted fields are dropped, and storage failures fall back to the host distance order.
function modernRecentFields() {
  try {
    const raw = localStorage.getItem(MODERN_RECENT_FIELDS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter(n => typeof n === 'string' && n) : [];
  } catch (_) {
    return [];
  }
}

function modernRememberField(name) {
  if (!name) return;
  const list = [name, ...modernRecentFields().filter(n => n !== name)]
    .slice(0, MODERN_RECENT_FIELDS_MAX);
  try { localStorage.setItem(MODERN_RECENT_FIELDS_KEY, JSON.stringify(list)); } catch (_) { /* local only */ }
}

function modernPinnedFields() {
  try {
    const raw = localStorage.getItem(MODERN_PINNED_FIELDS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter(n => typeof n === 'string' && n) : [];
  } catch (_) {
    return [];
  }
}

function modernTogglePin() {
  const name = scene && scene.hasField ? scene.fieldName : '';
  if (!name) return;
  const pinned = modernPinnedFields();
  const at = pinned.indexOf(name);
  if (at >= 0) pinned.splice(at, 1);
  else pinned.unshift(name);
  try { localStorage.setItem(MODERN_PINNED_FIELDS_KEY, JSON.stringify(pinned)); } catch (_) { /* local only */ }
}

// A small field strip for one-tap switching: recent fields first, then the nearest remaining
// fields from the host distance. This is a direct existing field.openOnly command, so the same
// local guard as the chooser runs first and an observer sees disabled chips. Host-only recordings
// remain invisible until H2.
function modernNearbyFields(activeName) {
  const fields = (typeof fieldOps !== 'undefined' && fieldOps && fieldOps.fields) || [];
  const byName = new Map(fields.filter(f => f && f.name).map(f => [f.name, f]));
  const pinned = modernPinnedFields()
    .filter(name => name !== activeName && byName.has(name));
  const pinnedSet = new Set(pinned);
  const recent = modernRecentFields()
    .filter(name => name !== activeName && byName.has(name) && !pinnedSet.has(name));
  const recentSet = new Set(recent);
  const nearest = fields
    .filter(f => f && f.name && f.name !== activeName && !pinnedSet.has(f.name) && !recentSet.has(f.name))
    .slice()
    .sort((a, b) => {
      const ad = a.hasDistance ? a.distanceKm : Number.POSITIVE_INFINITY;
      const bd = b.hasDistance ? b.distanceKm : Number.POSITIVE_INFINITY;
      return ad !== bd ? ad - bd : String(a.name).localeCompare(String(b.name));
    });
  return [
    ...pinned.map(name => byName.get(name)),
    ...recent.map(name => byName.get(name)),
    ...nearest,
  ].slice(0, 3);
}

// The most recent job for the open field, used only when no job is active. The host provides
// the preformatted last-opened string, so no local job metadata is stored.
function modernLastJob(fieldName) {
  const jobs = (typeof fieldOps !== 'undefined' && fieldOps && fieldOps.jobs) || [];
  return jobs
    .filter(j => j && j.fieldName === fieldName && j.taskName)
    .slice()
    .sort((a, b) => String(b.lastOpened || '').localeCompare(String(a.lastOpened || '')))[0] || null;
}

// The host reports the active job's task name only. The hub shows the work type ("Seeding"),
// which lives in the existing fieldOps job list; the task name is the fallback.
function modernJobEntry(fieldName, taskName) {
  const jobs = (typeof fieldOps !== 'undefined' && fieldOps && fieldOps.jobs) || [];
  return jobs.find(j => j && j.fieldName === fieldName && j.taskName === taskName) || null;
}

function modernResumeJob(fieldName, taskName) {
  if (!fieldName || !taskName || !iHoldControl || modernFieldEntryBlocked()) return;
  transport.send('field.resumeJob|' + fieldName + '\t' + taskName);
}

function modernJobAction() {
  const fieldName = (scene && scene.hasField && scene.fieldName) || '';
  if (!fieldName) return;
  if (statusBar && statusBar.jobName) {
    modernOpenFields();
    return;
  }
  const job = modernLastJob(fieldName);
  if (job) modernResumeJob(fieldName, job.taskName);
}

function modernSectionsOn() {
  return Array.isArray(tick && tick.sections)
    && tick.sections.some(code => Number(code) !== 0);
}

function modernSwitchField(name) {
  if (!name || !iHoldControl || modernFieldEntryBlocked()) return;
  if (scene && scene.hasField && scene.fieldName === name) return;
  const field = scene && scene.hasField ? scene.fieldName : '';
  const send = () => {
    const current = scene && scene.hasField ? scene.fieldName : '';
    const fields = typeof fieldOps !== 'undefined' && fieldOps && fieldOps.fields;
    if (connState !== 'connected' || !iHoldControl || modernFieldEntryBlocked()
        || current !== field || (Array.isArray(fields) && !fields.some(f => f && f.name === name))) {
      showToast(tr('Field state changed. Check the field and try again.'));
      return;
    }
    transport.send('field.openOnly|' + name);
  };
  // Field close disengages AutoSteer and turns the sections off. Warn only when that would
  // actually stop something; otherwise the chip stays a one-tap switch.
  if ((tick && tick.op && tick.op.autoSteer) || modernSectionsOn()) {
    showConfirm(tr('Switch to field {name}?', { name }),
      tr('The current field closes and AutoSteer and the sections are turned off. Continue?'),
      send, null, { cancel: tr('Stay'), confirm: tr('Switch field') });
    return;
  }
  send();
}

function modernRenderFieldChips(activeName, fieldBlocked) {
  const wrap = MODERN_EL.fieldChips;
  if (!wrap) return;
  const fields = modernNearbyFields(activeName);
  wrap.innerHTML = '';
  wrap.hidden = fields.length === 0;
  for (const f of fields) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'mod-field-chip';
    chip.translate = false; // a user-provided field name is never a translation key
    chip.textContent = f.name;
    const distance = f.hasDistance && f.distanceKm > 0 && typeof fmtUnit === 'function'
      ? fmtUnit(f.distanceKm * 1000, 'm', 0) : '';
    chip.title = distance
      ? tr('Open field {name} ({distance} away)', { name: f.name, distance })
      : tr('Open field {name}', { name: f.name });
    chip.setAttribute('aria-label', chip.title);
    chip.disabled = !iHoldControl || fieldBlocked;
    if (chip.disabled) chip.setAttribute('aria-describedby', 'mod-field-note');
    else modernActivate(chip, () => modernSwitchField(f.name));
    wrap.appendChild(chip);
  }
}

// A generic guard so a switch/reset never replaces an already open dialog or confirmation.
// ignoreConfirm lets the callback recheck after its own confirm has closed, while still
// refusing if another dialog, a recording, a wizard or a host prompt appeared meanwhile.
function modernSwitchBlocked(ignoreConfirm) {
  if (modernSwitchResetFlowBusy()) return true;
  if (typeof wizard !== 'undefined' && wizard && !wizard.closed) return true;
  if (typeof hostPrompt !== 'undefined' && hostPrompt && hostPrompt.kind) return true;
  if (document.getElementById('dlg-unsavedcov').classList.contains('open')) return true;
  if (document.getElementById('hostprompt').classList.contains('open')) return true;
  const host = document.getElementById('dialoghost');
  if (host && host.classList.contains('open')) {
    if (!ignoreConfirm) return true;
    const card = host.querySelector('.dlg-card.open');
    if (card && card.id !== 'dlg-confirm') return true;
  }
  return false;
}

function modernEmptyInto(host, text) {
  if (!host) return;
  const row = document.createElement('div');
  row.className = 'mod-empty';
  row.textContent = text;
  host.appendChild(row);
}

function modernEmpty(text) {
  modernEmptyInto(MODERN_EL.list, text);
}

// One small polite status region instead of aria-live on the rebuilt list: announce the field,
// the host-confirmed active line and any blocked reason once, without re-reading every row.
let modernStatusLast = '';
function modernAnnounce(summary) {
  if (!MODERN_EL.status || !summary || summary === modernStatusLast) return;
  modernStatusLast = summary;
  MODERN_EL.status.textContent = summary;
}
function modernStatusSummary(hasField, fieldName, activeName, contour, count, record, cycleAvailable, cycleNote, fieldReason, autoTrack) {
  const parts = [hasField ? tr('Field: {name}', { name: fieldName || '—' }) : tr('No field')];
  if (contour) parts.push(tr('Contour guidance'));
  else if (activeName) parts.push(tr('Active line: {name}', { name: activeName }));
  else parts.push(tr('No active line'));
  parts.push(tr('{n} lines', { n: count }));
  if (autoTrack) parts.push(tr('Auto track'));
  const blocked = [];
  // The field entry's own inline note is no longer a live region; announce its disabled reason
  // here, concisely, without repeating the rebuilt list.
  if (fieldReason) blocked.push(tr('Field entry blocked: {reason}', { reason: fieldReason }));
  // With no field the cycle and record reasons both say "open a field"; the record wording adds
  // what a line needs, so keep that one.
  if (!cycleAvailable && cycleNote && hasField) blocked.push(cycleNote);
  if (record.disabled && record.note) blocked.push(record.note);
  for (const reason of blocked) if (parts.indexOf(reason) < 0) parts.push(reason);
  return parts.join('. ');
}

// Keyboard and pointer activation without double firing: pointerdown is the touch idiom the
// rest of the client uses; a keyboard press produces a click with detail 0 and no pointerdown.
function modernActivate(el, fn) {
  el.addEventListener('pointerdown', e => { e.stopPropagation(); fn(); });
  el.addEventListener('click', e => { e.stopPropagation(); if (e.detail === 0) fn(); });
  // The simulator reserves Space for Stop in a window keydown listener. Keep a focused
  // button's native Space/Enter activation, but stop that listener from cancelling it.
  el.addEventListener('keydown', e => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.stopPropagation();
    if (e.repeat) e.preventDefault();
  });
}

// Reliable client signals only, from the host's status frame. With no status frame yet we do not
// claim a GPS state. Quick AB cannot create a line without an open field, and its A+ step uses
// the live position; say that inline instead of opening a dialog that cannot finish. The
// AutoSteer pause is still only a client snapshot, not a host interlock.
function modernGpsMissing() {
  if (!statusBar) return false;
  if (statusBar.gpsLost) return true;
  return !(Number(statusBar.fixQuality) > 0);
}

// The rail's record-shortcut availability. A disabled button is a visual gate only;
// modernStartRecord rechecks through this same helper.
function modernRecordState() {
  const autoSteer = !!(tick && tick.op && tick.op.autoSteer);
  const contour = !!(tick && tick.op && tick.op.contour);
  if (connState !== 'connected') {
    return { disabled: true, note: tr('Reconnect to control this screen before starting a recording.') };
  }
  if (!iHoldControl) {
    return { disabled: true, note: tr('Observer: view only') };
  }
  if (!(scene && scene.hasField)) {
    return { disabled: true, note: tr('Open a field first: a new line is saved in a field.') };
  }
  if (modernGpsMissing()) {
    return { disabled: true, note: tr('No GPS fix: a new line needs a position.') };
  }
  if (autoSteer) {
    return { disabled: true, note: tr('Client view: AutoSteer is engaged, so starting a line is paused here. The host remains the authority.') };
  }
  if (contour) {
    return {
      disabled: false,
      note: tr('Contour guidance is active. Starting a line turns contour off; cycling is unavailable.'),
    };
  }
  return { disabled: false, note: '' };
}

// The recording card is built only from this browser's client-local AB/curve flow. It is not a
// host-confirmed state and says so; host projection is H3 in Plans/MODERN_UI_HOST_CHANGES.md.
function modernFormatElapsed(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

function modernRecordingState() {
  const flow = typeof abFlow === 'undefined' ? null : abFlow;
  if (flow !== 'driveAB' && flow !== 'recordCurve') {
    modernRecFlow = '';
    modernRecStartedAt = 0;
    return { active: false };
  }
  if (flow !== modernRecFlow) {
    modernRecFlow = flow;
    modernRecStartedAt = 0;
  }
  const pivot = flow === 'recordCurve' && typeof recPivot !== 'undefined' && !!recPivot;
  const step = typeof driveStep === 'number' ? driveStep : 0;
  if (step > 0 && !modernRecStartedAt) modernRecStartedAt = Date.now();
  else if (step === 0) modernRecStartedAt = 0;
  const elapsedSec = modernRecStartedAt
    ? Math.max(0, Math.floor((Date.now() - modernRecStartedAt) / 1000)) : 0;
  const points = flow === 'recordCurve'
    ? (typeof curveMarks !== 'undefined' && curveMarks ? curveMarks.length : 0)
    : (typeof drawPts !== 'undefined' && drawPts ? drawPts.length : 0);
  return {
    active: true,
    flow,
    pivot,
    step,
    points,
    elapsed: step > 0 ? modernFormatElapsed(elapsedSec) : '',
    elapsedSec,
    mode: flow === 'driveAB' ? tr('Drive A to B') : pivot ? tr('Water pivot') : tr('Curve'),
    stepText: typeof abHint === 'function' ? abHint() : '',
    primary: step === 0
      ? (pivot ? tr('Start') : tr('Set Point A'))
      : (pivot ? tr('Finish') : tr('Set Point B')),
  };
}

function modernRecordingStats(rec) {
  if (!rec.points) return tr('No points yet');
  return rec.points === 1 ? tr('{n} point', { n: rec.points }) : tr('{n} points', { n: rec.points });
}

function modernRecordingProgress(rec) {
  const parts = [modernRecordingStats(rec)];
  if (rec.elapsed) parts.push(tr('Elapsed {time}', { time: rec.elapsed }));
  return parts.join(' · ');
}

function modernRecordingConsequence(rec) {
  if (rec.step === 0) {
    return rec.pivot
      ? tr('Start begins recording. Cancel saves nothing.')
      : tr('Set Point A starts the line. Cancel saves nothing.');
  }
  return rec.pivot
    ? tr('Finish completes the line and makes it active. Cancel discards the recording.')
    : tr('Set Point B completes the line and makes it active. Cancel discards the recording.');
}

function modernRenderRecording(rec) {
  if (MODERN_EL.normalSurface) MODERN_EL.normalSurface.hidden = rec.active;
  if (MODERN_EL.recording) MODERN_EL.recording.hidden = !rec.active;
  if (!rec.active) return;
  if (MODERN_EL.recMode) MODERN_EL.recMode.textContent = rec.mode;
  if (MODERN_EL.recField) {
    const field = (scene && scene.fieldName) || '—';
    MODERN_EL.recField.textContent = tr('Field: {name}', { name: field });
    MODERN_EL.recField.setAttribute('translate', 'no');
  }
  if (MODERN_EL.recStep) MODERN_EL.recStep.textContent = rec.stepText;
  if (MODERN_EL.recStats) MODERN_EL.recStats.textContent = modernRecordingProgress(rec);
  if (MODERN_EL.recConsequence) MODERN_EL.recConsequence.textContent = modernRecordingConsequence(rec);
  if (MODERN_EL.recPrimary) {
    MODERN_EL.recPrimary.textContent = rec.primary;
    MODERN_EL.recPrimary.disabled = !modernRecordingCanSetPoint();
  }
  if (MODERN_EL.recCancel) MODERN_EL.recCancel.disabled = !modernRecordingCanAct();
  if (MODERN_EL.recNote) MODERN_EL.recNote.textContent = !modernRecordingCanAct()
    ? tr('Reconnect and regain control before changing this recording. The host may still be recording.')
    : !modernRecordingCanSetPoint()
      ? tr('Turn AutoSteer off before setting a point. The host remains the authority.')
      : tr('This browser is recording. After a reconnect, check the map toolbar; the host may still be recording.');
}

// The Classic helpers optimistically advance/clear this browser's flow. Never invoke them
// after the link or control is lost: the host may reject the command while the UI advances.
function modernRecordingCanAct() {
  return connState === 'connected' && !!iHoldControl;
}
function modernRecordingCanSetPoint() {
  return modernRecordingCanAct() && !(tick && tick.op && tick.op.autoSteer);
}
function modernRecordingSetPoint() {
  if (!modernRecordingState().active || !modernRecordingCanSetPoint()) return;
  if (typeof abSetPoint === 'function') abSetPoint();
}

// Cancel before the first point is immediate. Once a point exists, ask first and keep recording
// as the safe default; the card is client-local, so this is a local discard guard (H4).
function modernCancelRecording() {
  const rec = modernRecordingState();
  if (!rec.active || !modernRecordingCanAct()) return;
  if (rec.step > 0 || rec.points > 0) {
    const flow = rec.flow;
    const field = scene && scene.hasField ? scene.fieldName : '';
    showConfirm(tr('Discard this recording?'),
      tr('The captured points will be discarded and no line will be saved. Keep recording to continue.'),
      () => {
        const current = modernRecordingState();
        if (current.active && current.flow === flow && current.step === rec.step
            && (scene && scene.hasField ? scene.fieldName : '') === field && modernRecordingCanAct()
            && typeof abCancel === 'function') abCancel();
      },
      null,
      { cancel: tr('Keep recording'), confirm: tr('Discard recording') });
    return;
  }
  if (typeof abCancel === 'function') abCancel();
}

// Select a named line through the existing track.select command. The host remains the marker
// authority. While the latest Tick says AutoSteer is engaged, ask first; track.select does not
// disengage it today, whereas Previous/Next (CycleTrack) does. That is a client confirmation,
// not an atomic interlock: H1 records the host-side fix.
function modernSelectLine(t) {
  if (!iHoldControl || !scene || !scene.hasField) return;
  if (!t || MODERN_NON_GUIDANCE.has(t.type)) return;
  if (!t.visible || (tick && tick.op && tick.op.contour)) return;
  if (t.active) return;
  const field = scene.fieldName;
  const send = () => {
    const current = scene && (scene.trackList || []).find(line => line.index === t.index);
    if (connState !== 'connected' || !iHoldControl || !scene || !scene.hasField
        || scene.fieldName !== field || !current || !current.visible
        || current.name !== t.name || current.type !== t.type
        || (tick && tick.op && tick.op.contour)) {
      showToast(tr('Line state changed. Choose the line again.'));
      return;
    }
    transport.send('track.select|' + t.index);
  };
  if (tick && tick.op && tick.op.autoSteer) {
    showConfirm(tr('Change line while AutoSteer is engaged?'),
      tr('This activates the line without disengaging AutoSteer. Previous/Next stop guidance first. Continue?'),
      send);
    return;
  }
  send();
}

// The host's confirmed line list. A visible guidance row is a button that selects through the
// existing track.select command; an observer/contour row is disabled. The active marker still
// comes only from the host's scene list, never from a local tap.
// Capture the window's row positions before a rebuild, then let the same rows glide to their new
// places. The active row is one persistent node; the others are rebuilt, but keyed by the host's
// line index, so each moved line can be matched. New rows fade in. Reduced-motion users and the
// stub DOM skip the effect.
function modernCaptureLineRows() {
  const out = [];
  if (!MODERN_EL.list) return out;
  for (const item of MODERN_EL.list.children) {
    const row = item && item.children && item.children[0];
    if (!row || !row.dataset) continue;
    const key = row.dataset.modLine;
    if (key == null) continue;
    let top = 0;
    try { top = row.getBoundingClientRect().top; } catch (_) { top = 0; }
    out.push({ key, top });
  }
  return out;
}

function modernAnimateLineRows(before) {
  if (!before || !before.length || !MODERN_EL.list) return;
  if (typeof requestAnimationFrame !== 'function') return;
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const after = modernCaptureLineRows();
  if (before.map(r => r.key).join('|') === after.map(r => r.key).join('|')) return;
  const oldTop = new Map(before.map(r => [r.key, r.top]));
  for (const item of MODERN_EL.list.children) {
    const row = item && item.children && item.children[0];
    if (!row || !row.dataset || !row.style) continue;
    const key = row.dataset.modLine;
    if (key == null) continue;
    if (!oldTop.has(key)) {
      row.style.transition = 'none';
      row.style.opacity = '0';
      continue;
    }
    const delta = oldTop.get(key) - row.getBoundingClientRect().top;
    if (!delta) continue;
    row.style.transition = 'none';
    row.style.transform = 'translateY(' + delta.toFixed(1) + 'px)';
  }
  requestAnimationFrame(() => {
    for (const item of MODERN_EL.list.children) {
      const row = item && item.children && item.children[0];
      if (!row || !row.dataset || !row.style) continue;
      if (row.dataset.modLine == null) continue;
      row.style.transition = 'transform 180ms ease, opacity 180ms ease';
      row.style.transform = '';
      row.style.opacity = '1';
    }
  });
}

function modernLineRow(t, showHidden) {
  const active = !!t.active;
  const item = document.createElement('div');
  item.className = 'mod-line-item';
  item.setAttribute('role', 'listitem');

  const row = document.createElement('button');
  row.type = 'button';
  const hiddenLine = !!(showHidden && !t.visible);
  row.className = 'mod-line' + (active ? ' active' : '') + (hiddenLine ? ' mod-line-hidden' : '');
  row.dataset.modLine = String(t.index);
  if (active) row.setAttribute('aria-current', 'true');

  const mark = document.createElement('span');
  mark.className = 'mod-line-mark';
  mark.setAttribute('aria-hidden', 'true');
  mark.textContent = active ? '✓' : '○';

  const body = document.createElement('span');
  body.className = 'mod-line-body';
  const name = document.createElement('span');
  name.className = 'mod-line-name';
  name.translate = false; // a user-provided line name is never a translation key
  name.textContent = t.name || '—';
  const meta = document.createElement('span');
  meta.className = 'mod-line-meta';
  // Line/Curve/Pivot are existing English keys; a future host label falls back to English.
  const typeLabel = t.type ? tr(t.type) : '';
  let metaText = active
    ? (typeLabel ? typeLabel + ' · ' + tr('Active') : tr('Active'))
    : typeLabel;
  if (showHidden && !t.visible) metaText = metaText ? metaText + ' · ' + tr('Hidden') : tr('Hidden');
  meta.textContent = metaText;
  body.append(name, meta);

  row.append(mark, body);
  // One visible guidance row is one tap for an operator; contour and observer rows stay
  // unavailable with the existing cycle-note reason nearby.
  const contour = !!(tick && tick.op && tick.op.contour);
  const enabled = !!iHoldControl && !contour && !!t.visible;
  row.disabled = !enabled;
  if (!t.visible) row.title = tr('Hidden track: tick it in Tracks to use it');
  else if (!enabled) row.setAttribute('aria-describedby', 'mod-cycle-note');
  else modernActivate(row, () => modernSelectLine(t));
  item.append(row);
  return item;
}

// The host's CycleTrack walks every saved visible guidance track (not only the ones in this
// rail's short list) and, with no active line yet, selects the first one; it disengages AutoSteer
// and the U-turn when the track changes. So two or more visible guidance lines are enough to
// cycle, with or without an active line. This is stricter than Classic's old "any two visible
// types" gate (Path and Contour are not guidance tracks), which is why the rail owns the control
// while it is shown and the Classic pair returns only when the rail is suspended.
function modernCycleAvailable(hasField, guidance, contour) {
  return iHoldControl && hasField && !contour && guidance.length > 1;
}

function modernCycleNote(hasField, guidance, contour) {
  if (!iHoldControl) return tr('Observer: view only');
  if (!hasField) return tr('Open a field first');
  if (contour) return tr('Contour guidance: cycling is unavailable.');
  if (guidance.length < 2) return tr('Two visible lines are needed to cycle.');
  return '';
}

function modernCycle(step) {
  // Existing host commands: CycleTrack disengages AutoSteer and the U-turn when the track
  // changes and reports "Guidance stopped: track changed". We never toggle AutoSteer here.
  if (!iHoldControl || !scene || !scene.hasField) return;
  const visible = (scene.trackList || []).filter(t => t.visible && !MODERN_NON_GUIDANCE.has(t.type));
  const contour = !!(tick && tick.op && tick.op.contour);
  if (!modernCycleAvailable(true, visible, contour)) return;
  transport.send(step > 0 ? 'track.cycle' : 'track.cycleBack');
}

// Lateral nudge is the existing track.nudge* family. The value is host-projected (nudgeOffset);
// the rail only chooses the display unit, exactly like the existing bottom-bar nudge readout.
function modernNudgeReadout() {
  const metres = (tick && tick.op && tick.op.nudgeOffset) || 0;
  const metric = typeof isMetric === 'function' ? isMetric() : true;
  const amount = Math.round(Math.abs(metres) * (metric ? 100 : 39.3701));
  const unit = typeof unitLabel === 'function' ? unitLabel('cm') : 'cm';
  return {
    text: amount === 0 ? '0' : amount + (metres < 0 ? 'L' : 'R'),
    full: amount === 0 ? '0' : amount + ' ' + unit + (metres < 0 ? ' left' : ' right'),
  };
}

function modernNudgeAvailable() {
  const activeName = (tick && tick.activeTrackName) || '';
  const contour = !!(tick && tick.op && tick.op.contour);
  return !!iHoldControl && !!(scene && scene.hasField) && !!activeName && !contour;
}

// Cross-track error readout for the top bar. The map HUD draws the same value, but the large
// settings overlay covers the map; the stripped-down top-bar readout remains visible there.
function modernXteReadout() {
  if (!tick || !tick.guidanceActive) return '—';
  const metres = Number(tick.crossTrackError) || 0;
  const metric = typeof isMetric === 'function' ? isMetric() : true;
  const amount = Math.round(Math.abs(metres) * (metric ? 100 : 39.3701));
  const unit = typeof unitLabel === 'function' ? unitLabel('cm') : 'cm';
  return amount === 0 ? '0 ' + unit : amount + ' ' + unit + (metres < 0 ? ' L' : ' R');
}

function modernSteerAvailable() {
  const op = (tick && tick.op) || {};
  return connState === 'connected' && !!iHoldControl && (!!op.autoSteer || !!op.autoSteerAvail);
}

function modernToggleSteer() {
  if (!modernSteerAvailable()) return;
  transport.send('autosteer.toggle');
}

function modernNudge(command) {
  if (!modernNudgeAvailable()) return;
  transport.send(command);
}

// Snap to pivot is the existing track.snapPivot command, the same availability as a nudge: it
// moves the active line, so it needs control, a field and an active, non-contour line.
function modernSnapPivot() {
  if (!modernNudgeAvailable()) return;
  transport.send('track.snapPivot');
}

// Auto track is the existing right-nav command, moved into the rail while the rail is on screen.
// It needs control and a field; turning it off stays possible even if the line count has dropped.
function modernToggleAutoTrack() {
  const contour = !!(tick && tick.op && tick.op.contour);
  if (!iHoldControl || !(scene && scene.hasField) || contour) return;
  transport.send('track.autoTrack');
}

function modernSettingsOpen() {
  return !!(MODERN_EL.settings && MODERN_EL.settings.classList.contains('open'));
}

function modernSyncMenuState(force) {
  if (!MODERN_EL.menu) return;
  const open = modernSettingsOpen()
    || document.getElementById('ln-filemenu').classList.contains('active');
  if (!force && open === modernMenuActive) return;
  modernMenuActive = open;
  MODERN_EL.menu.classList.toggle('active', open);
  MODERN_EL.menu.setAttribute('aria-expanded', open ? 'true' : 'false');
}

// The hub is built from the existing Classic nav buttons, so every feature switch and its
// pointerdown handler remains the single source of truth. The Classic icon rail is hidden in
// Modern by CSS, but the buttons stay in the DOM for this hub and for Classic fallback.
function modernBuildSettings() {
  const grid = MODERN_EL.settingsGrid;
  if (!grid) return;
  grid.innerHTML = '';
  const nav = document.getElementById('leftnav');
  if (!nav) return;
  for (const btn of nav.querySelectorAll('.ln-btn')) {
    const isFile = btn.id === 'ln-filemenu';
    const inlineStyle = btn.getAttribute ? (btn.getAttribute('style') || '') : '';
    const hiddenByStyle = btn.hidden || btn.style.display === 'none'
      || /display\s*:\s*none/i.test(inlineStyle)
      || getComputedStyle(btn).display === 'none';
    if (!isFile && hiddenByStyle) continue;
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'mod-settings-item';
    item.dataset.nav = btn.id;
    const icon = btn.querySelector('.ln-ic');
    if (icon && typeof icon.cloneNode === 'function') {
      const clone = icon.cloneNode(true);
      clone.removeAttribute('id');
      clone.setAttribute('aria-hidden', 'true');
      item.appendChild(clone);
    }
    const label = document.createElement('span');
    const title = btn.title || (btn.getAttribute && btn.getAttribute('title'))
      || (btn.querySelector('img') && btn.querySelector('img').alt) || btn.id;
    label.textContent = title;
    item.appendChild(label);
    item.setAttribute('aria-label', label.textContent);
    modernActivate(item, () => modernOpenSettingsItem(btn.id));
    grid.appendChild(item);
  }
}

// The File / Application Menu is also a settings, diagnostics and recovery surface. Its entries
// belong in the large hub too, but each still dispatches the original .fo-btn pointerdown handler,
// so the File menu remains the single source of truth and its full flyout stays available. The
// hub's own User Interface section already owns the Classic/Modern switch and UI reset, so those
// two entries are not duplicated here.
const MODERN_FILE_MENU_SKIP = new Set(['fm-ui-switch', 'fm-ui-reset']);
function modernBuildAppSettings() {
  const grid = MODERN_EL.settingsApps;
  const menu = document.getElementById('filemenu');
  if (!grid) return;
  grid.innerHTML = '';
  if (menu && typeof menu.querySelectorAll === 'function') {
    for (const btn of menu.querySelectorAll('.fo-btn')) {
      if (!btn.id || MODERN_FILE_MENU_SKIP.has(btn.id)) continue;
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'mod-settings-item mod-settings-app';
      item.dataset.nav = btn.id;
      const label = (btn.textContent || '').trim()
        || (btn.getAttribute && btn.getAttribute('data-label'))
        || btn.id;
      item.textContent = label;
      item.setAttribute('aria-label', label);
      modernActivate(item, () => modernOpenSettingsItem(btn.id));
      grid.appendChild(item);
    }
  }
  if (MODERN_EL.settingsAppSection)
    MODERN_EL.settingsAppSection.hidden = grid.children.length === 0;
}

function modernCloseSettings(focusMenu) {
  if (!MODERN_EL.settings) return;
  // The hub is a normal left-nav surface: close it through the same chain helper so any panel
  // opened from it, its scrim and the active nav state are cleared together.
  lnCloseAll();
  MODERN_EL.settings.classList.remove('open');
  modernSyncMenuState(true);
  if (focusMenu && MODERN_EL.menu) {
    MODERN_EL.menu.focus();
    // A pointer press focuses the now-hidden close button after this helper runs; put focus back
    // on the trigger on the next task so the close control still fulfils its focus promise.
    setTimeout(() => {
      if (!modernSettingsOpen() && MODERN_EL.menu) MODERN_EL.menu.focus();
    }, 0);
  }
}

function modernOpenSettings() {
  if (!MODERN_EL.settings) return;
  lnCloseAll();
  modernBuildSettings();
  modernBuildAppSettings();
  MODERN_EL.settings.classList.add('open');
  const scrim = document.getElementById('ln-scrim');
  if (scrim) scrim.classList.add('open');
  modernSyncMenuState(true);
  const first = MODERN_EL.settingsGrid && MODERN_EL.settingsGrid.children[0];
  if (first && typeof first.focus === 'function') first.focus();
}

function modernShowMenu() {
  if (modernSettingsOpen()) modernCloseSettings(true);
  else modernOpenSettings();
}

function modernOpenMenu() {
  // The line adjustment page is a live editing surface: open its own guarded close first, so a
  // pending move is saved or kept deliberately. Nothing else changes if that is still open.
  if (modernLineAdjustOpen() || modernRefSessionOpen()) {
    modernLineAdjustFocusBack = false;
    modernRequestCloseLineAdjust();
    if (modernRefSessionOpen() || modernLineAdjustOpen()) return;
  }
  // Opening the hub closes every left-nav panel. A typed field form would be lost before the
  // switch/reset guard ever sees it, so warn first; Cancel keeps the form.
  if (!modernSettingsOpen() && modernTypedFieldFormBusy()) {
    showConfirm(tr('Open the settings menu?'),
      tr('Opening the settings menu closes the open field form and its unsaved text. Cancel keeps the form open.'),
      modernOpenSettings);
    return;
  }
  modernShowMenu();
}

// The map's press guard ignores a pointerdown whose id it still believes is down (a ghost
// press). A synthetic hand-off must therefore use its own pointer id and release it, or the
// second hub entry tap is swallowed as a ghost and the panel never opens.
let modernSyntheticPointer = 1000000;
function modernDispatchPointer(btn) {
  if (!btn) return;
  const id = ++modernSyntheticPointer;
  const rect = typeof btn.getBoundingClientRect === 'function' ? btn.getBoundingClientRect() : null;
  const init = {
    // A real press bubbles. The bottom bar dispatches its commands from one delegated listener on
    // #bottomnav, so a non-bubbling synthetic press would reach the button and do nothing. The
    // receiving button/panel handlers all stop propagation, so this cannot reach the map.
    bubbles: true, cancelable: true,
    pointerId: id, pointerType: 'mouse', isPrimary: true,
    clientX: rect ? (rect.left + rect.width / 2) : 0,
    clientY: rect ? (rect.top + rect.height / 2) : 0,
  };
  const make = (type, extra) => (typeof PointerEvent === 'function'
    ? new PointerEvent(type, Object.assign({}, init, extra))
    : Object.assign({ type, stopPropagation() {}, preventDefault() {} }, init, extra));
  const down = make('pointerdown');
  if (typeof btn.dispatchEvent === 'function') btn.dispatchEvent(down);
  else if (typeof btn.dispatch === 'function') btn.dispatch('pointerdown', down);
  // Release the id so the window-level guard forgets it. Dispatch on the button with bubbling
  // so the window capture listener sees the release in the browser and the stub can observe it.
  const up = make('pointerup', { bubbles: true });
  if (typeof btn.dispatchEvent === 'function') btn.dispatchEvent(up);
  else if (typeof btn.dispatch === 'function') btn.dispatch('pointerup', up);
}

function modernOpenSettingsItem(navId) {
  modernCloseSettings(false);
  modernDispatchPointer(document.getElementById(navId));
}

// ---- Guidance settings and optional on-map controls --------------------------
// The last of the Classic bottom bar belongs in two Modern places: display/guidance state in the
// hub, and the field buttons an operator wants while driving as optional on-map controls. Every
// button still reaches the existing command (some directly, the map buttons through the original
// bottom-bar button), and the hub only labels the state the host already reports.
const MODERN_MAP_CONTROLS_KEY = 'agopenweb.modernui.mapControls';
const MODERN_MAP_COLORS = [
  ['98FB98', () => tr('Green')], ['00CED1', () => tr('Turquoise')],
  ['FFD700', () => tr('Gold')], ['FF8C00', () => tr('Orange')],
  ['FF69B4', () => tr('Pink')], ['87CEEB', () => tr('Blue')],
  ['DDA0DD', () => tr('Plum')], ['F0E68C', () => tr('Khaki')],
];
const MODERN_TRAM_NAMES = [() => tr('Off'), () => tr('All'), () => tr('Lines'), () => tr('Outer')];
const MODERN_SKIP_NAMES = [() => tr('Normal'), () => tr('Alternative'), () => tr('Skip worked')];
const MODERN_FLAG_FLYOUT_HOME = (() => {
  const fly = document.getElementById('bn-flyout-flags');
  return fly ? fly.parentNode : null;
})();
const MODERN_UTURN_HOME = (() => {
  const ind = document.getElementById('uturn-indicator');
  return ind ? ind.parentNode : null;
})();

function modernMapControlPrefs() {
  let p = {};
  try {
    const raw = localStorage.getItem(MODERN_MAP_CONTROLS_KEY);
    if (raw) p = JSON.parse(raw) || {};
  } catch (_) { p = {}; }
  if (!p || typeof p !== 'object') p = {};
  // 'articulated' was the old name for the trailing-tool default; accept it without a migration.
  const toolHeading = p.toolHeading === 'always' || p.toolHeading === 'never'
    ? p.toolHeading : 'trailing';
  return {
    flags: p.flags !== false,
    headland: p.headland !== false,
    sections: p.sections !== false,
    toolHeading,
    contour: p.contour !== false,
    sectionsAuto: p.sectionsAuto !== false,
    sectionsManual: p.sectionsManual !== false,
    youturn: p.youturn !== false,
    isobus: p.isobus !== false,
    contourLock: p.contourLock !== false,
  };
}

function modernSaveMapControlPrefs(prefs) {
  try {
    localStorage.setItem(MODERN_MAP_CONTROLS_KEY, JSON.stringify({
      flags: prefs.flags, headland: prefs.headland, sections: prefs.sections,
      toolHeading: prefs.toolHeading, contour: prefs.contour,
      sectionsAuto: prefs.sectionsAuto, sectionsManual: prefs.sectionsManual,
      youturn: prefs.youturn, isobus: prefs.isobus, contourLock: prefs.contourLock,
    }));
  } catch (_) { /* storage unavailable: keep the session value */ }
}

function modernSetMapControlPref(key, value) {
  const prefs = modernMapControlPrefs();
  prefs[key] = value;
  modernSaveMapControlPrefs(prefs);
  modernRenderMapControls();
  modernRenderMapControlsRight();
}

// Tool heading reset calls IToolPositionService.ResetTrailingState, so the button is useful with a
// trailing implement: tool type 2 (TBT) or 3 (Trailing), not the vehicle's steering type.
function modernTrailingImplement() {
  if (typeof config === 'undefined' || !config || !config.tool) return false;
  const type = config.tool.type | 0;
  return type === 2 || type === 3;
}

function modernToolHeadingVisible(prefs) {
  if (prefs.toolHeading === 'always') return true;
  if (prefs.toolHeading === 'never') return false;
  return modernTrailingImplement();
}

function modernSetIcon(img, name) {
  if (!img) return;
  const src = '/icons/' + name;
  if (typeof img.getAttribute === 'function' && img.getAttribute('src') !== src)
    img.setAttribute('src', src);
}

function modernBuildColorSwatches() {
  const host = MODERN_EL.setColors;
  if (!host || host.children.length) return;
  for (const [hex, name] of MODERN_MAP_COLORS) {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'mod-set-swatch';
    swatch.dataset.hex = hex;
    swatch.style.background = '#' + hex;
    const label = tr('{name} mapping colour', { name: name() });
    swatch.setAttribute('aria-label', label);
    swatch.title = label;
    modernActivate(swatch, () => {
      if (!iHoldControl || typeof cfgSend !== 'function') return;
      cfgSend('tool.singleCoverageColor', hex);
    });
    host.appendChild(swatch);
  }
}

// Runs every frame: the hub may be closed, but its labels must be right the moment it opens.
function modernRenderGuidanceSettings() {
  const tools = (tick && tick.tools) || {};
  const writable = !!iHoldControl;
  if (MODERN_EL.setTram) {
    const state = (MODERN_TRAM_NAMES[tools.tramMode | 0] || MODERN_TRAM_NAMES[0])();
    MODERN_EL.setTram.textContent = tr('Tram lines: {state}', { state });
    MODERN_EL.setTram.disabled = !writable;
  }
  if (MODERN_EL.setSkipMode) {
    const state = (MODERN_SKIP_NAMES[tools.skipMode | 0] || MODERN_SKIP_NAMES[0])();
    MODERN_EL.setSkipMode.textContent = tr('U-Turn skip mode: {state}', { state });
    MODERN_EL.setSkipMode.disabled = !writable;
  }
  if (MODERN_EL.setSkipRows) {
    MODERN_EL.setSkipRows.textContent = tr('U-Turn skip rows: {n}', { n: tools.skipRows | 0 });
    MODERN_EL.setSkipRows.disabled = !writable;
  }
  if (MODERN_EL.setColors) {
    const current = (typeof config !== 'undefined' && config && config.tool)
      ? (config.tool.singleCoverageColor | 0) : null;
    for (const swatch of MODERN_EL.setColors.children) {
      swatch.classList.toggle('selected', current !== null && parseInt(swatch.dataset.hex, 16) === current);
      swatch.disabled = !writable;
    }
  }

  const prefs = modernMapControlPrefs();
  const toggles = [
    [MODERN_EL.setMapFlags, 'flags'],
    [MODERN_EL.setMapHeadland, 'headland'],
    [MODERN_EL.setMapSections, 'sections'],
    [MODERN_EL.setMapContour, 'contour'],
    [MODERN_EL.setMapSectionsAuto, 'sectionsAuto'],
    [MODERN_EL.setMapSectionsManual, 'sectionsManual'],
    [MODERN_EL.setMapYouturn, 'youturn'],
    [MODERN_EL.setMapIsobus, 'isobus'],
    [MODERN_EL.setMapContourLock, 'contourLock'],
  ];
  for (const [btn, key] of toggles) {
    if (btn) btn.setAttribute('aria-pressed', prefs[key] ? 'true' : 'false');
  }
  for (const [mode, btn] of [
    ['trailing', MODERN_EL.setModeTrailing],
    ['always', MODERN_EL.setModeAlways],
    ['never', MODERN_EL.setModeNever],
  ]) {
    if (!btn) continue;
    const on = mode === prefs.toolHeading;
    btn.classList.toggle('selected', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
}

// The optional on-map cluster. Buttons are hidden by preference and disabled for an observer; the
// state is the host's (tick.tools), never a local guess. The Classic flags flyout is moved into the
// cluster while the rail is live so its rows and handlers keep working.
function modernRenderMapControls() {
  const host = MODERN_EL.mapControls;
  if (!host) return;
  const prefs = modernMapControlPrefs();
  const hasField = !!(scene && scene.hasField);
  const showTool = modernToolHeadingVisible(prefs);
  host.hidden = !(modernRailLive && hasField
    && (prefs.flags || prefs.headland || prefs.sections || showTool));
  if (MODERN_EL.mapFlags) MODERN_EL.mapFlags.hidden = !prefs.flags;
  if (MODERN_EL.mapHeadland) MODERN_EL.mapHeadland.hidden = !prefs.headland;
  if (MODERN_EL.mapSections) MODERN_EL.mapSections.hidden = !prefs.sections;
  if (MODERN_EL.mapToolHeading) MODERN_EL.mapToolHeading.hidden = !showTool;

  const writable = !!iHoldControl;
  const tools = (tick && tick.tools) || {};
  if (MODERN_EL.mapFlags) {
    const fly = document.getElementById('bn-flyout-flags');
    MODERN_EL.mapFlags.disabled = !writable;
    MODERN_EL.mapFlags.setAttribute('aria-expanded',
      fly && fly.classList.contains('open') ? 'true' : 'false');
  }
  if (MODERN_EL.mapHeadland) {
    MODERN_EL.mapHeadland.disabled = !writable;
    MODERN_EL.mapHeadland.setAttribute('aria-pressed', tools.headlandOn ? 'true' : 'false');
    const state = tools.headlandOn ? tr('On') : tr('Off');
    MODERN_EL.mapHeadland.setAttribute('aria-label', tr('Headland: {state}. Tap to change.', { state }));
    if (MODERN_EL.mapHeadlandState) MODERN_EL.mapHeadlandState.textContent = state;
    modernSetIcon(MODERN_EL.mapHeadlandIc, tools.headlandOn ? 'HeadlandOn.png' : 'HeadlandOff.png');
  }
  if (MODERN_EL.mapSections) {
    MODERN_EL.mapSections.disabled = !writable;
    MODERN_EL.mapSections.setAttribute('aria-pressed', tools.sectionInHeadland ? 'true' : 'false');
    // sectionInHeadland true means sections are turned OFF in the headland (the host setting).
    const state = tools.sectionInHeadland ? tr('Auto-off') : tr('On');
    MODERN_EL.mapSections.setAttribute('aria-label',
      tr('Sections in headland: {state}. Tap to change.', { state }));
    if (MODERN_EL.mapSectionsState) MODERN_EL.mapSectionsState.textContent = state;
    modernSetIcon(MODERN_EL.mapSectionsIc,
      tools.sectionInHeadland ? 'HeadlandSectionOff.png' : 'HeadlandSectionOn.png');
  }
  if (MODERN_EL.mapToolHeading) MODERN_EL.mapToolHeading.disabled = !writable;
}

// The guidance cluster that replaces the Classic right nav in Modern. Same contract: preference
// decides whether it exists, host state decides what it says, and each button dispatches the
// original right-nav button so the command and its gate are not copied.
function modernRenderMapControlsRight() {
  const host = MODERN_EL.mapControlsRight;
  if (!host) return;
  const prefs = modernMapControlPrefs();
  const hasField = !!(scene && scene.hasField);
  const op = (tick && tick.op) || {};
  const iso = statusBar && statusBar.isobus;
  const writable = !!iHoldControl;
  const show = {
    contour: prefs.contour,
    sectionsAuto: prefs.sectionsAuto,
    sectionsManual: prefs.sectionsManual,
    youturn: prefs.youturn && !op.contour,
    isobus: prefs.isobus && !!iso,
    contourLock: prefs.contourLock && !!op.contour,
  };
  const any = show.contour || show.sectionsAuto || show.sectionsManual
    || show.youturn || show.isobus || show.contourLock;
  host.hidden = !(modernRailLive && hasField && any);

  const paint = (btn, ic, stateEl, visible, pressed, name, stateText, icon) => {
    if (!btn) return;
    btn.hidden = !visible;
    btn.disabled = !writable;
    btn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    btn.setAttribute('aria-label', tr('{name}: {state}. Tap to change.', {
      name, state: stateText,
    }));
    if (stateEl && stateEl.textContent !== stateText) stateEl.textContent = stateText;
    modernSetIcon(ic, icon);
  };

  const onOff = v => (v ? tr('On') : tr('Off'));
  paint(MODERN_EL.mapContour, MODERN_EL.mapContourIc, MODERN_EL.mapContourState,
    show.contour, !!op.contour, tr('Contour'), onOff(!!op.contour),
    op.contour ? 'ContourOn.png' : 'ContourOff.png');
  paint(MODERN_EL.mapSectionsAuto, MODERN_EL.mapSectionsAutoIc, MODERN_EL.mapSectionsAutoState,
    show.sectionsAuto, !!op.sectionAuto, tr('Auto sections'), onOff(!!op.sectionAuto),
    op.sectionAuto ? 'SectionMasterOn.png' : 'SectionMasterOff.png');
  paint(MODERN_EL.mapSectionsManual, MODERN_EL.mapSectionsManualIc, MODERN_EL.mapSectionsManualState,
    show.sectionsManual, !!op.sectionManual, tr('Manual sections'), onOff(!!op.sectionManual),
    op.sectionManual ? 'ManualOn.png' : 'ManualOff.png');
  paint(MODERN_EL.mapYouturn, MODERN_EL.mapYouturnIc, MODERN_EL.mapYouturnState,
    show.youturn, !!op.youturn, tr('Auto U-turn'), onOff(!!op.youturn),
    op.youturn ? 'YouTurnYes.png' : 'YouTurnNo.png');

  const isoSections = !!(iso && iso.sections);
  const isoOn = !!(isoSections && iso.sectionControl);
  const isoState = !isoSections ? tr('No implement') : onOff(isoOn);
  paint(MODERN_EL.mapIsobus, MODERN_EL.mapIsobusIc, MODERN_EL.mapIsobusState,
    show.isobus, isoOn, tr('ISOBUS section control'), isoState,
    !isoSections ? 'IsobusSectionControlIdle.png'
      : isoOn ? 'IsobusSectionControlOn.png' : 'IsobusSectionControlOff.png');

  const locked = !!(scene && scene.contourLocked);
  paint(MODERN_EL.mapContourLock, MODERN_EL.mapContourLockIc, MODERN_EL.mapContourLockState,
    show.contourLock, locked, tr('Contour lock'), locked ? tr('Locked') : tr('Unlocked'),
    locked ? 'ColorLocked.png' : 'ColorUnlocked.png');
}

function modernHostFlagFlyout() {
  const fly = document.getElementById('bn-flyout-flags');
  const host = MODERN_EL.mapControls;
  if (!fly || !host || fly.parentNode === host) return;
  try { host.appendChild(fly); } catch (_) { /* stub DOM */ }
}

function modernRestoreFlagFlyout() {
  const fly = document.getElementById('bn-flyout-flags');
  const host = MODERN_EL.mapControls;
  if (!fly || !host || fly.parentNode !== host) return;
  fly.classList.remove('open');
  const home = MODERN_FLAG_FLYOUT_HOME
    || document.getElementById('bottomnav') || document.body;
  try { home.appendChild(fly); } catch (_) {
    try { document.body.appendChild(fly); } catch (__) { /* stub DOM */ }
  }
}

// The auto U-turn panel joins the manual U-turn/Lateral stack in Modern so every U-turn control is
// in one column, aligned on the left, with the direction switch at the bottom. It is the same node,
// moved, so its swap-on-tap behavior and host-driven state are untouched; Classic keeps it at the
// upper right.
function modernHostUturnIndicator() {
  const ind = document.getElementById('uturn-indicator');
  const host = document.getElementById('onscreenbtns');
  if (!ind || !host || ind.parentNode === host) return;
  try { host.appendChild(ind); } catch (_) { /* stub DOM */ }
}

function modernRestoreUturnIndicator() {
  const ind = document.getElementById('uturn-indicator');
  const host = document.getElementById('onscreenbtns');
  if (!ind || !host || ind.parentNode !== host) return;
  const home = MODERN_UTURN_HOME || document.body;
  try { home.appendChild(ind); } catch (_) {
    try { document.body.appendChild(ind); } catch (__) { /* stub DOM */ }
  }
}

function modernSyncMapControls() {
  if (!modernRailLive) {
    modernRestoreFlagFlyout();
    modernRestoreUturnIndicator();
    modernRenderMapControls();
    modernRenderMapControlsRight();
    return;
  }
  modernHostFlagFlyout();
  modernHostUturnIndicator();
  modernRenderMapControls();
  modernRenderMapControlsRight();
}

// ---- Line adjustment page (the existing Ref Nudge session) ------------------
// Ref Nudge is the heavier line tool: it moves the saved line itself, accumulates the move and
// needs Save or Undo, unlike the rail's −/+, which only offsets guidance. The Classic panel
// (#refnudge) already owns the ids, the pointerdown handlers, the step input and the host
// session. Modern moves that one panel into this page, so there is no second set of controls and
// no second command path; the page adds the line name, the reason when it is blocked, and the
// labels under the existing buttons.
const MODERN_REF_PANEL_HOME = (() => {
  const panel = document.getElementById('refnudge');
  return panel ? panel.parentNode : null;
})();
let modernLineAdjustFocusBack = false;

function modernLineAdjustOpen() {
  return !!MODERN_EL.lineAdjust && MODERN_EL.lineAdjust.classList.contains('open');
}

// The host has no "ref nudge session" flag; the Classic panel's own client flag is the session.
function modernRefSessionOpen() {
  return typeof refNudgeOpen !== 'undefined' && !!refNudgeOpen;
}

function modernRefPanel() {
  return document.getElementById('refnudge');
}

// Moving the node keeps its listeners, its input wiring and its ids: this is still the one panel
// Classic shows beside the right nav, only laid out as the page's content.
function modernHostRefPanel() {
  const panel = modernRefPanel();
  const host = MODERN_EL.lineAdjustHost;
  if (!panel || !host || panel.parentNode === host) return;
  try { host.appendChild(panel); } catch (_) { /* stub DOM */ }
}

function modernRestoreRefPanel() {
  const panel = modernRefPanel();
  const host = MODERN_EL.lineAdjustHost;
  if (!panel || !host || panel.parentNode !== host) return;
  const home = MODERN_REF_PANEL_HOME || document.body;
  try { home.appendChild(panel); } catch (_) {
    try { document.body.appendChild(panel); } catch (__) { /* stub DOM */ }
  }
}

function modernOpenLineAdjust() {
  if (!MODERN_EL.lineAdjust) return;
  // One surface at a time: the hub and this page both cover the map.
  lnCloseAll();
  modernCloseSettings(false);
  modernHostRefPanel();
  MODERN_EL.lineAdjust.classList.add('open');
  if (MODERN_EL.lineAdjustBtn) {
    MODERN_EL.lineAdjustBtn.classList.add('active');
    MODERN_EL.lineAdjustBtn.setAttribute('aria-expanded', 'true');
  }
  // The cog starts a session; following the Classic Ref Nudge button does not (that button
  // already sent track.refNudgeBegin, and a second Begin would only reset the total to zero).
  if (!modernRefSessionOpen() && typeof openRefNudge === 'function') openRefNudge();
  modernRenderLineAdjust();
  const first = MODERN_EL.lineAdjustHost && typeof MODERN_EL.lineAdjustHost.querySelector === 'function'
    ? MODERN_EL.lineAdjustHost.querySelector('button[data-cmd]') : null;
  if (first && typeof first.focus === 'function') first.focus();
}

function modernHideLineAdjust(focusBtn) {
  if (!MODERN_EL.lineAdjust) return;
  // If the page itself held focus, the control that had it is about to be hidden: put focus back
  // on the rail's cog instead of letting it fall to the page body.
  const active = typeof document.activeElement !== 'undefined' ? document.activeElement : null;
  const inside = !!active && active !== document.body
    && typeof MODERN_EL.lineAdjust.contains === 'function'
    && MODERN_EL.lineAdjust.contains(active);
  MODERN_EL.lineAdjust.classList.remove('open');
  if (MODERN_EL.lineAdjustBtn) {
    MODERN_EL.lineAdjustBtn.classList.remove('active');
    MODERN_EL.lineAdjustBtn.setAttribute('aria-expanded', 'false');
  }
  if ((focusBtn || inside) && MODERN_EL.lineAdjustBtn) {
    MODERN_EL.lineAdjustBtn.focus();
    // A pointer press focuses the now-hidden close button after this helper runs; put focus back
    // on the cog on the next task so closing never leaves focus on a hidden control.
    setTimeout(() => {
      if (!modernLineAdjustOpen() && MODERN_EL.lineAdjustBtn) MODERN_EL.lineAdjustBtn.focus();
    }, 0);
  }
  modernLineAdjustFocusBack = false;
}

// Leaving must not drop an unsaved move. The Classic panel's Exit button already asks that
// question and saves only on confirmation, so the page reuses that handler rather than copying
// the dialog. With nothing pending it closes at once.
function modernRequestCloseLineAdjust() {
  if (!modernLineAdjustOpen()) return;
  if (!modernRefSessionOpen()) { modernHideLineAdjust(true); return; }
  modernDispatchPointer(document.getElementById('rf-exit'));
  if (!modernRefSessionOpen()) modernHideLineAdjust(true);
}

// Everything here is host state: moved total and pending flag come from tick.op, the line name
// from tick.activeTrackName, and the step from the panel the host already populates.
function modernRenderLineAdjust() {
  if (!MODERN_EL.lineAdjust) return;
  const hasField = !!(scene && scene.hasField);
  const fieldName = hasField ? (scene.fieldName || '') : '';
  const op = (tick && tick.op) || {};
  const activeName = (tick && tick.activeTrackName) || '';
  const contour = !!op.contour;
  const pending = !!op.refNudgePending;
  const smooth = !!op.smoothOpen;
  const observer = modernIsObserverNow();
  const session = modernRefSessionOpen();

  const nameText = contour ? tr('Contour guidance') : (activeName || tr('No active line'));
  if (MODERN_EL.lineAdjustName && MODERN_EL.lineAdjustName.textContent !== nameText)
    MODERN_EL.lineAdjustName.textContent = nameText;
  const fieldText = hasField ? (fieldName || '—') : tr('No field');
  if (MODERN_EL.lineAdjustField && MODERN_EL.lineAdjustField.textContent !== fieldText)
    MODERN_EL.lineAdjustField.textContent = fieldText;
  if (MODERN_EL.lineAdjustField) {
    if (hasField) MODERN_EL.lineAdjustField.setAttribute('translate', 'no');
    else MODERN_EL.lineAdjustField.removeAttribute('translate');
  }

  const adjustReady = session && !observer && hasField && !contour && !!activeName && !smooth;
  let emptyText = '';
  let showAllLines = false;
  if (observer) emptyText = tr('Observer: view only. Another screen holds control, so the host rejects line changes.');
  else if (!hasField) emptyText = tr('Open a field first. A line belongs to a field.');
  else if (smooth) emptyText = tr('Smooth Curve is open. Finish or cancel it, then adjust the line.');
  else if (contour) emptyText = tr('Contour guidance cannot be adjusted. Choose a saved AB line.');
  else if (!activeName) {
    emptyText = tr('No active line. Choose a line, then adjust it.');
    showAllLines = true;
  }
  if (MODERN_EL.lineAdjustEmpty) MODERN_EL.lineAdjustEmpty.hidden = !emptyText;
  if (MODERN_EL.lineAdjustEmptyText && MODERN_EL.lineAdjustEmptyText.textContent !== emptyText)
    MODERN_EL.lineAdjustEmptyText.textContent = emptyText;
  if (MODERN_EL.lineAdjustAllLines) MODERN_EL.lineAdjustAllLines.hidden = !showAllLines;
  if (MODERN_EL.lineAdjustHost) {
    MODERN_EL.lineAdjustHost.classList.toggle('is-blocked', !adjustReady);
    MODERN_EL.lineAdjustHost.setAttribute('aria-disabled', adjustReady ? 'false' : 'true');
  }

  const movedEl = document.getElementById('rf-moved');
  const moved = (movedEl && movedEl.textContent) ? movedEl.textContent : '0';
  let noteText = '';
  if (adjustReady && pending)
    noteText = tr('Moved {value} — not saved yet. Save keeps it; Undo puts it back.', { value: moved });
  else if (adjustReady)
    noteText = tr('Moves the saved line itself, not the guidance offset. Save keeps the move; Undo puts it back.');
  if (MODERN_EL.lineAdjustNote && MODERN_EL.lineAdjustNote.textContent !== noteText)
    MODERN_EL.lineAdjustNote.textContent = noteText;

  modernRenderLineOptions();
}

// The AB flyout's line commands, in the page. Each page button dispatches the original bottom-bar
// button, so the command, its Tier-2 control gate and the contour-delete confirmation stay in one
// place; the page only adds a word and a large target. The classic bar is hidden in Modern only
// while the rail is live, and is untouched in Classic.
const MODERN_LINE_OPTION_DEFS = [
  ['bn-smooth', () => tr('Smooth curve')],
  ['bn-delcontours', () => tr('Delete contours')],
  ['bn-extend-a', () => tr('Extend A')],
  ['bn-extend-b', () => tr('Extend B')],
  ['bn-shorten-a', () => tr('Shorten A')],
  ['bn-shorten-b', () => tr('Shorten B')],
  ['bn-half-left', () => tr('Half width left')],
  ['bn-half-right', () => tr('Half width right')],
  ['bn-pass-left', () => tr('Pass left')],
  ['bn-pass-right', () => tr('Pass right')],
  ['bn-nudge', () => tr('Reset guidance offset')],
];

function modernLineOptionsAvailable() {
  const activeName = (tick && tick.activeTrackName) || '';
  const contour = !!(tick && tick.op && tick.op.contour);
  return !!iHoldControl && !!activeName && !contour;
}

function modernBuildLineOptions() {
  const host = MODERN_EL.lineOptions;
  if (!host || host.children.length) return;
  for (const [id, label] of MODERN_LINE_OPTION_DEFS) {
    const src = document.getElementById(id);
    if (!src) continue;
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'mod-la-option';
    item.dataset.src = id;
    item.textContent = label();
    modernActivate(item, () => {
      if (!modernLineOptionsAvailable()) return;
      modernDispatchPointer(src);
    });
    host.appendChild(item);
  }
}

function modernRenderLineOptions() {
  if (!MODERN_EL.lineOptions) return;
  const ready = modernLineOptionsAvailable();
  for (const item of MODERN_EL.lineOptions.children) item.disabled = !ready;
  let note = '';
  if (!ready) {
    if (!iHoldControl) note = tr('Observer: view only. Line options need control.');
    else if (tick && tick.op && tick.op.contour) note = tr('Contour guidance has no AB line options.');
    else note = tr('Choose a line to use these options.');
  }
  if (MODERN_EL.lineOptionsNote && MODERN_EL.lineOptionsNote.textContent !== note)
    MODERN_EL.lineOptionsNote.textContent = note;
}

// The page mirrors the session, not a second open flag. That is what makes the Classic Ref Nudge
// button in the bottom bar still the entry, and it means a Save/Undo/Exit in either place cannot
// leave the page showing a stale state.
function modernSyncLineAdjust() {
  if (!MODERN_EL.lineAdjust) return;
  if (!modernRailLive) {
    if (modernLineAdjustOpen()) modernHideLineAdjust(false);
    modernRestoreRefPanel();
    return;
  }
  modernHostRefPanel();
  modernBuildLineOptions();
  const want = modernRefSessionOpen();
  if (want && !modernLineAdjustOpen()) {
    modernOpenLineAdjust();
    return;
  }
  if (!want && modernLineAdjustOpen()) {
    modernHideLineAdjust(modernLineAdjustFocusBack);
    modernLineAdjustFocusBack = false;
    return;
  }
  modernRenderLineAdjust();
}

// Called from the one frame loop (js/frame.js). It early-outs in Classic and rebuilds only
// when host state changes, so there is no second renderer or network loop.
function renderModernUi() {
  if (!isModernUi() || !MODERN_EL.rail || !MODERN_EL.list) return;
  // Auto UI size re-measures the rail after this render has updated it (throttled; no-op
  // unless Auto is the chosen size).
  if (typeof refreshAutoUiScale === 'function') refreshAutoUiScale();
  modernSyncMenuState();
  if (MODERN_EL.xteValue) MODERN_EL.xteValue.textContent = modernXteReadout();

  // The card pane owns the right edge while it is split or full; step aside there.
  const suspended = modernCardPaneOpen();
  if (suspended !== modernRailSuspended) {
    modernRailSuspended = suspended;
    MODERN_EL.rail.classList.toggle('suspended', suspended);
    if (suspended) modernCloseAllLines(false);
    syncModernMapArea(); // restores the rail's inset when the pane closes; a no-op while open
  }
  // One visible cycle pair: the rail's while it is on screen, the Classic right-nav's otherwise.
  syncModernClassicCycleFallback();
  // The line adjustment page mirrors the Classic Ref Nudge session; it also restores the moved
  // panel when the rail is gone.
  modernSyncLineAdjust();
  // Guidance labels and the optional on-map cluster follow host state every frame (cheap DOM
  // writes only when a value differs).
  modernRenderGuidanceSettings();
  modernSyncMapControls();
  // The full All lines column updates while open; selecting a line does not close it.
  modernRenderAllLines();

  const hasField = !!(scene && scene.hasField);
  const fieldNameNow = hasField ? (scene.fieldName || '') : '';
  if (fieldNameNow !== modernLastFieldName) {
    modernLastFieldName = fieldNameNow;
    if (fieldNameNow) modernRememberField(fieldNameNow);
  }
  const pinnedFields = modernPinnedFields();
  const fieldPinned = !!fieldNameNow && pinnedFields.includes(fieldNameNow);
  const tracks = (scene && scene.trackList) || [];
  const guidance = tracks.filter(t => !MODERN_NON_GUIDANCE.has(t.type));
  const visible = guidance.filter(t => t.visible);
  const activeName = (tick && tick.activeTrackName) || '';
  const op = (tick && tick.op) || {};
  const steerEngaged = !!op.autoSteer;
  const contour = !!op.contour;
  const recording = modernRecordingState();
  const record = modernRecordState();
  const cycleAvailable = modernCycleAvailable(hasField, visible, contour);
  const cycleNote = modernCycleNote(hasField, visible, contour);
  const nudge = modernNudgeReadout();
  const nudgeAvailable = modernNudgeAvailable();
  const steerAvailable = modernSteerAvailable();
  const autoTrackOn = !!(tick && tick.tools && tick.tools.autoTrack) && hasField;
  const autoTrackAvailable = iHoldControl && hasField && !contour
    && (autoTrackOn || visible.length > 1);
  // tick.activeTrackName is the host's own readout; the list below marks t.active from the
  // scene. Show it in the header too, so the active choice is visible when the list is scrolled
  // or the line is not among the visible rows.
  const activeLineLabel = contour ? tr('Contour guidance') : (activeName || tr('No active line'));
  const activeTrack = guidance.find(t => t.name === activeName);
  const activeType = (!contour && activeTrack && activeTrack.type) ? tr(activeTrack.type) : '';
  const fieldBlocked = modernFieldEntryBlocked();
  const fieldReason = fieldBlocked ? modernFieldBlockedReason() : '';
  const fieldOpen = modernFieldPanelsOpen();
  // A definite observer may still see another browser's host recording/edit. It does not block the
  // view-only chooser, but the note must not imply this screen can finish that work.
  const observerHostBusy = modernIsObserverNow() && modernOperatorHostBusy();
  const nearby = modernNearbyFields(fieldNameNow);
  const nearbyKey = nearby.map(f => f.name + ':' + (f.hasDistance ? f.distanceKm.toFixed(2) : '-')).join('|');
  const activeJob = (statusBar && statusBar.jobName) || '';
  const activeJobEntry = activeJob ? modernJobEntry(fieldNameNow, activeJob) : null;
  const lastJob = !activeJob && hasField ? modernLastJob(fieldNameNow) : null;
  // The row shows what kind of work it is, not the task's date-style name.
  const shownJob = activeJob
    ? ((activeJobEntry && activeJobEntry.workType) || activeJob)
    : (lastJob ? (lastJob.workType || lastJob.taskName) : '');
  const shownLastTask = lastJob ? lastJob.taskName : '';
  const jobMode = activeJob ? 'active' : (lastJob ? 'last' : '');
  const key = [
    hasField, fieldNameNow, fieldPinned, pinnedFields.join('|'), activeJob, activeName,
    activeLineLabel, activeType,
    shownJob, shownLastTask, jobMode,
    iHoldControl, connState === 'connected', steerEngaged, contour, cycleAvailable, cycleNote,
    nudgeAvailable, nudge.text, steerAvailable, autoTrackOn, autoTrackAvailable,
    record.disabled, record.note, modernGpsMissing(),
    recording.active, recording.flow, recording.step, recording.points, recording.elapsedSec,
    recording.primary, recording.stepText,
    fieldBlocked, fieldReason, fieldOpen, observerHostBusy, nearbyKey, guidance.length,
    visible.map(t => t.index + ':' + (t.name || '') + ':' + (t.type || '') + ':' + (t.active ? '1' : '0')).join('|'),
  ].join('~');
  if (key === modernRailKey) return;
  modernRailKey = key;

  // The separate dock remains visible and must update even when the recording card takes over.
  if (MODERN_EL.steer) {
    const steerLabel = steerEngaged ? tr('On') : tr('Off');
    MODERN_EL.steer.disabled = !steerAvailable;
    MODERN_EL.steer.classList.toggle('on', steerEngaged);
    MODERN_EL.steer.setAttribute('aria-pressed', steerEngaged ? 'true' : 'false');
    if (MODERN_EL.steerState) MODERN_EL.steerState.textContent = steerLabel;
    const steerAria = tr('AutoSteer: {state}. Tap to change.', { state: steerLabel });
    MODERN_EL.steer.setAttribute('aria-label', steerAria);
    MODERN_EL.steer.title = steerAria;
  }
  modernRenderRecording(recording);
  if (recording.active) {
    // Announce the mode and step, not every sampled curve point; the card itself shows the
    // point count and updates without re-reading the whole rail.
    modernAnnounce(tr('Recording {mode} in {field}: {step}', {
      mode: recording.mode,
      field: (scene && scene.fieldName) || '—',
      step: recording.stepText,
    }));
    return;
  }

  MODERN_EL.fieldName.textContent = hasField ? (scene.fieldName || '—') : tr('No field');
  if (hasField) MODERN_EL.fieldName.setAttribute('translate', 'no');
  else MODERN_EL.fieldName.removeAttribute('translate');
  if (MODERN_EL.fieldPin) {
    const pinLabel = fieldPinned ? tr('Unpin field') : tr('Pin field');
    MODERN_EL.fieldPin.hidden = !hasField;
    MODERN_EL.fieldPin.textContent = fieldPinned ? '★' : '☆';
    MODERN_EL.fieldPin.setAttribute('aria-pressed', fieldPinned ? 'true' : 'false');
    MODERN_EL.fieldPin.setAttribute('aria-label', pinLabel);
    MODERN_EL.fieldPin.title = pinLabel;
  }
  if (MODERN_EL.fieldJob) {
    MODERN_EL.fieldJob.hidden = !(hasField && shownJob);
    if (MODERN_EL.fieldJobName) MODERN_EL.fieldJobName.textContent = shownJob;
    if (MODERN_EL.jobAction) {
      const jobActionBlocked = fieldBlocked || (!activeJob && !iHoldControl);
      MODERN_EL.jobAction.hidden = !(hasField && shownJob);
      MODERN_EL.jobAction.textContent = activeJob ? tr('Jobs…') : tr('Resume');
      MODERN_EL.jobAction.disabled = jobActionBlocked;
      if (jobActionBlocked) MODERN_EL.jobAction.setAttribute('aria-describedby', 'mod-field-note');
      else MODERN_EL.jobAction.removeAttribute('aria-describedby');
    }
  }
  if (MODERN_EL.activeType) {
    MODERN_EL.activeType.textContent = activeType;
    MODERN_EL.activeType.hidden = !activeType;
  }
  if (MODERN_EL.activeLine) {
    MODERN_EL.activeLine.textContent = hasField ? activeLineLabel : tr('No field');
    // A line name is user data, never a translation key.
    if (hasField && activeName && !contour) MODERN_EL.activeLine.setAttribute('translate', 'no');
    else MODERN_EL.activeLine.removeAttribute('translate');
  }
  if (MODERN_EL.autoTrack) {
    MODERN_EL.autoTrack.hidden = !hasField;
    MODERN_EL.autoTrack.disabled = !autoTrackAvailable;
    MODERN_EL.autoTrack.setAttribute('aria-pressed', autoTrackOn ? 'true' : 'false');
  }
  if (MODERN_EL.fieldSwitch) {
    MODERN_EL.fieldSwitch.disabled = fieldBlocked;
    MODERN_EL.fieldSwitch.classList.toggle('active', fieldOpen);
    MODERN_EL.fieldSwitch.setAttribute('aria-expanded', fieldOpen ? 'true' : 'false');
  }
  modernRenderFieldChips(hasField ? (scene.fieldName || '') : '', fieldBlocked);
  if (MODERN_EL.fieldNote) {
    MODERN_EL.fieldNote.textContent = fieldBlocked
      ? fieldReason
      : observerHostBusy
        ? tr('Observer: view only. Another screen may be recording or editing; the host rejects field actions.')
        : '';
  }
  modernObserver(connState === 'connected' && !iHoldControl);
  if (MODERN_EL.lockNote) {
    MODERN_EL.lockNote.hidden = !record.note;
    MODERN_EL.lockNote.textContent = record.note;
  }
  // The disabled reason replaces the generic help while the starts are unavailable; showing
  // both pushes the record controls off a short rail.
  if (MODERN_EL.recordHelp) MODERN_EL.recordHelp.hidden = !!record.note;
  if (MODERN_EL.recordLine) MODERN_EL.recordLine.disabled = record.disabled;
  if (MODERN_EL.recordAb) MODERN_EL.recordAb.disabled = record.disabled;
  if (MODERN_EL.recordCurve) MODERN_EL.recordCurve.disabled = record.disabled;
  MODERN_EL.prev.disabled = !cycleAvailable;
  MODERN_EL.next.disabled = !cycleAvailable;
  if (MODERN_EL.cycleNote) MODERN_EL.cycleNote.textContent = cycleNote;
  if (MODERN_EL.nudgeLeft) MODERN_EL.nudgeLeft.disabled = !nudgeAvailable;
  if (MODERN_EL.nudgeRight) MODERN_EL.nudgeRight.disabled = !nudgeAvailable;
  if (MODERN_EL.snapPivot) MODERN_EL.snapPivot.disabled = !nudgeAvailable;
  if (MODERN_EL.nudgeValue) {
    MODERN_EL.nudgeValue.textContent = nudge.text;
    const nudgeLabel = tr('Nudge offset: {value}', { value: nudge.full });
    MODERN_EL.nudgeValue.title = nudgeLabel;
    MODERN_EL.nudgeValue.setAttribute('aria-label', nudgeLabel);
  }
  // The count is the host's total guidance-line count (hidden rows included), not the visible
  // rows in this rail; the label says what the manager will show.
  MODERN_EL.allLines.textContent = guidance.length
    ? tr('All lines ({n})', { n: guidance.length })
    : tr('All lines');
  modernAnnounce(modernStatusSummary(hasField, hasField ? (scene.fieldName || '') : '',
    activeName, contour, guidance.length, record, cycleAvailable, cycleNote, fieldReason, autoTrackOn));

  const lineRowsBefore = modernCaptureLineRows();
  MODERN_EL.list.innerHTML = '';
  MODERN_EL.list.classList.toggle('mod-empty-list', !hasField || !visible.length);
  if (MODERN_EL.activeSlot) MODERN_EL.activeSlot.hidden = true;
  if (!hasField) {
    modernEmpty(tr('Open a field first'));
    return;
  }
  if (!visible.length) {
    modernEmpty(guidance.length ? tr('No visible AB lines') : tr('No tracks in this field'));
    return;
  }
  // Four-row window around the active line: previous, active, next, next-next. The order matches
  // what the host's Previous/Next cycle would reach, wrapping like it does. Fewer lines means a
  // shorter window; nothing scrolls.
  // The host's active name is authoritative; the scene's active flag can lag a frame behind a
  // cycle. Prefer the name so the window recenters immediately.
  let activeIdx = activeName ? visible.findIndex(t => t.name === activeName) : -1;
  if (activeIdx < 0) activeIdx = visible.findIndex(t => t.active);
  const windowRows = [];
  if (activeIdx >= 0) {
    const n = visible.length;
    const seen = new Set();
    for (const off of [-1, 0, 1, 2]) {
      const i = ((activeIdx + off) % n + n) % n;
      if (seen.has(i)) continue;
      seen.add(i);
      windowRows.push({ t: visible[i], active: i === activeIdx });
    }
  } else {
    for (const t of visible.slice(0, MODERN_MAX_LINES)) windowRows.push({ t, active: false });
  }
  for (const row of windowRows) {
    if (row.active && MODERN_EL.activeSlot) {
      const inner = MODERN_EL.activeSlot.children && MODERN_EL.activeSlot.children[0];
      if (inner) {
        inner.dataset.modLine = String(row.t.index);
        inner.setAttribute('aria-current', 'true');
      }
      MODERN_EL.activeSlot.hidden = false;
      MODERN_EL.list.appendChild(MODERN_EL.activeSlot);
    } else {
      // The scene's active flag can lag; only the slot is the active row.
      MODERN_EL.list.appendChild(modernLineRow(Object.assign({}, row.t, { active: false })));
    }
  }
  modernAnimateLineRows(lineRowsBefore);
}

// ---- The existing surfaces, reached from the Modern shell -------------------
// The Classic bottom-bar entries close the AB flyout first (js/tracks.js); the rail must do the
// same, or the flyout can stay open behind the Tracks Manager dialog or the Quick AB dialog.
function modernCloseAbFlyout() {
  if (typeof abFlyoutClose === 'function') abFlyoutClose();
}
let modernAllLinesKey = '';

function modernAllLinesShown() {
  return !!MODERN_EL.allLinesPanel && !MODERN_EL.allLinesPanel.hidden;
}

// The All lines column lists every guidance line, including hidden ones (marked Hidden). It is
// rebuilt only when the list or the active marker changes; selecting a row does not close it.
function modernRenderAllLines() {
  if (!modernAllLinesShown()) return;
  if (MODERN_EL.tracksManager) MODERN_EL.tracksManager.disabled = modernLocalFlowBusy();
  if (MODERN_EL.quickAb) MODERN_EL.quickAb.disabled = modernLocalFlowBusy()
    || connState !== 'connected' || !iHoldControl || !(scene && scene.hasField);
  const tracks = (scene && scene.trackList) || [];
  const guidance = tracks.filter(t => !MODERN_NON_GUIDANCE.has(t.type));
  const activeName = (tick && tick.activeTrackName) || '';
  const contour = !!(tick && tick.op && tick.op.contour);
  const isActive = t => (activeName ? t.name === activeName : !!t.active);
  const key = [
    guidance.length, activeName, contour, iHoldControl ? '1' : '0',
    guidance.map(t => [
      t.index, t.name || '', t.type || '', t.visible ? '1' : '0',
      isActive(t) ? '1' : '0',
    ].join(':')).join('|'),
  ].join('~');
  if (key === modernAllLinesKey) return;
  modernAllLinesKey = key;
  if (MODERN_EL.allLinesCount) {
    MODERN_EL.allLinesCount.textContent = tr('{n} lines', { n: guidance.length });
  }
  if (!MODERN_EL.allLinesList) return;
  MODERN_EL.allLinesList.innerHTML = '';
  if (!guidance.length) {
    modernEmptyInto(MODERN_EL.allLinesList,
      scene && scene.hasField ? tr('No tracks in this field') : tr('Open a field first'));
    return;
  }
  for (const t of guidance) {
    MODERN_EL.allLinesList.appendChild(
      modernLineRow(Object.assign({}, t, { active: isActive(t) }), true));
  }
}

function modernOpenAllLinesPanel() {
  if (!MODERN_EL.allLinesPanel) {
    if (typeof openTracksManager === 'function') openTracksManager();
    return;
  }
  MODERN_EL.allLinesPanel.hidden = false;
  if (MODERN_EL.allLines) {
    MODERN_EL.allLines.classList.add('active');
    MODERN_EL.allLines.setAttribute('aria-expanded', 'true');
  }
  modernAllLinesKey = '';
  modernRenderAllLines();
  syncModernMapArea();
  const first = MODERN_EL.allLinesList && MODERN_EL.allLinesList.children[0];
  const btn = first && first.children && first.children[0];
  if (btn && typeof btn.focus === 'function') btn.focus();
}

function modernCloseAllLines(focusBtn) {
  if (!MODERN_EL.allLinesPanel) return;
  MODERN_EL.allLinesPanel.hidden = true;
  if (MODERN_EL.allLines) {
    MODERN_EL.allLines.classList.remove('active');
    MODERN_EL.allLines.setAttribute('aria-expanded', 'false');
  }
  syncModernMapArea();
  if (focusBtn && MODERN_EL.allLines) MODERN_EL.allLines.focus();
}

function modernOpenAllLines() {
  modernCloseAbFlyout();
  if (modernAllLinesShown()) modernCloseAllLines(true);
  else modernOpenAllLinesPanel();
}
function modernStartRecord(mode) {
  // A+ and finishing a driven line make the new line active without disengaging AutoSteer.
  // The record shortcuts therefore reuse the same client snapshot pause as the rest of the
  // rail. A disabled button is only a visual gate, so recheck the same helper here.
  if (modernRecordState().disabled) return;
  modernCloseAbFlyout();
  if (typeof qabHeadingReset === 'function') qabHeadingReset();
  if (typeof qabSetSide === 'function') qabSetSide('right');
  // One dispatcher shared with the existing Quick AB dialog. A+ starts immediately from the
  // current heading; Drive A→B and Curve start their existing client-local steps.
  if (typeof qabStart === 'function') {
    qabStart(mode);
    return;
  }
  // Older client without the dispatcher: fall back to the existing creation hub.
  if (typeof openDialog === 'function') openDialog('dlg-quickab');
}

// ---- Switch and recovery ----------------------------------------------------
// A reload releases this screen's control; the host turns AutoSteer and the sections off as it
// does for any control end. We do not pre-engage or pre-disengage anything here.
function modernSwitchPresentation() {
  if (modernSwitchBlocked()) {
    showToast(tr('Finish the current recording or edit, or close the open confirmation, before switching interfaces'));
    return;
  }
  const toClassic = isModernUi();
  const message = toClassic
    ? tr('Switch to the Classic UI? The page reloads. If this screen has control, AutoSteer and the sections are turned off.')
    : tr('Switch to the Modern UI? The page reloads. If this screen has control, AutoSteer and the sections are turned off. Classic remains the default.');
  showConfirm(tr('Switch interface'), message, () => {
    // Recheck: a local edit/recording, wizard, prompt or other dialog may have appeared while the
    // confirmation was open. This is still a local page guard, not a host interlock. A host flow
    // owned by another browser no longer blocks a definite observer (see modernSwitchResetFlowBusy).
    if (modernSwitchBlocked(true)) {
      showToast(tr('Finish the current recording or edit, or close the open confirmation, before switching interfaces'));
      return;
    }
    window.AgOpenWebUiMode.set(toClassic ? 'classic' : 'modern');
  });
}
function modernResetPresentation() {
  // In Classic with no saved preference and no ui query there is nothing to reset. Do not
  // reload (which would needlessly release control); say so instead. If storage cannot be read
  // reliably, fall through to the normal warning/reload path.
  try {
    if (window.AgOpenWebUiMode && typeof window.AgOpenWebUiMode.isResetNoop === 'function'
        && window.AgOpenWebUiMode.isResetNoop()) {
      showToast(tr('Classic UI is already the default; there is no saved UI preference to reset'));
      return;
    }
  } catch (_) { /* fall through */ }
  // Reset reloads too, so it must use the same guard as a switch. Never discard an active
  // client-local edit/recording or replace an open confirmation; another screen's host flow does
  // not block a definite observer's recovery path.
  if (modernSwitchBlocked()) {
    showToast(tr('Finish the current recording or edit, or close the open confirmation, before switching interfaces'));
    return;
  }
  showConfirm(tr('Reset UI preferences'),
    tr('Reset the saved interface choice and return to Classic? This only resets the Modern UI preference. The page reloads; if this screen has control, AutoSteer and the sections are turned off.'),
    () => {
      if (modernSwitchBlocked(true)) {
        showToast(tr('Finish the current recording or edit, or close the open confirmation, before switching interfaces'));
        return;
      }
      window.AgOpenWebUiMode.reset();
    });
}
function modernSwitchLabels() {
  const switchLabel = isModernUi() ? tr('Classic UI') : tr('Modern UI');
  if (MODERN_EL.switchBtn) MODERN_EL.switchBtn.textContent = switchLabel;
  if (MODERN_EL.settingsSwitch) MODERN_EL.settingsSwitch.textContent = switchLabel;
  if (MODERN_EL.hint) {
    MODERN_EL.hint.textContent = isModernUi()
      ? tr('Modern UI is a preview. Classic is the default.')
      : tr('Classic is the default. Modern is a preview.');
  }
}

// ---- Wiring (once) ----------------------------------------------------------
if (MODERN_EL.menu) {
  modernActivate(MODERN_EL.menu, modernOpenMenu);
}
if (MODERN_EL.settingsClose) {
  modernActivate(MODERN_EL.settingsClose, () => modernCloseSettings(true));
}
if (MODERN_EL.settingsSwitch) {
  modernActivate(MODERN_EL.settingsSwitch, () => {
    modernCloseSettings(false);
    modernSwitchPresentation();
  });
}
if (MODERN_EL.settingsReset) {
  modernActivate(MODERN_EL.settingsReset, () => {
    modernCloseSettings(false);
    modernResetPresentation();
  });
}
const modernScrim = document.getElementById('ln-scrim');
if (modernScrim) modernScrim.addEventListener('pointerdown', () => modernCloseSettings(false));
if (MODERN_EL.prev) {
  modernActivate(MODERN_EL.prev, () => modernCycle(-1));
}
if (MODERN_EL.next) {
  modernActivate(MODERN_EL.next, () => modernCycle(1));
}
if (MODERN_EL.nudgeLeft) {
  modernActivate(MODERN_EL.nudgeLeft, () => modernNudge('track.nudgeLeft'));
}
if (MODERN_EL.nudgeRight) {
  modernActivate(MODERN_EL.nudgeRight, () => modernNudge('track.nudgeRight'));
}
if (MODERN_EL.snapPivot) {
  modernActivate(MODERN_EL.snapPivot, modernSnapPivot);
}
if (MODERN_EL.steer) {
  modernActivate(MODERN_EL.steer, modernToggleSteer);
}
if (MODERN_EL.autoTrack) {
  modernActivate(MODERN_EL.autoTrack, modernToggleAutoTrack);
}
if (MODERN_EL.allLines) {
  modernActivate(MODERN_EL.allLines, modernOpenAllLines);
}
if (MODERN_EL.allLinesClose) {
  modernActivate(MODERN_EL.allLinesClose, () => modernCloseAllLines(true));
}
if (MODERN_EL.tracksManager) {
  modernActivate(MODERN_EL.tracksManager, () => {
    if (modernLocalFlowBusy()) return;
    modernDispatchPointer(document.getElementById('bn-tracks'));
  });
}
if (MODERN_EL.quickAb) {
  modernActivate(MODERN_EL.quickAb, () => {
    if (modernLocalFlowBusy() || connState !== 'connected' || !iHoldControl || !(scene && scene.hasField)) return;
    modernDispatchPointer(document.getElementById('bn-quickab'));
  });
}
if (MODERN_EL.fieldSwitch) {
  modernActivate(MODERN_EL.fieldSwitch, modernOpenFields);
}
if (MODERN_EL.fieldPin) {
  modernActivate(MODERN_EL.fieldPin, modernTogglePin);
}
if (MODERN_EL.jobAction) {
  modernActivate(MODERN_EL.jobAction, modernJobAction);
}
if (MODERN_EL.recordLine) {
  modernActivate(MODERN_EL.recordLine, () => modernStartRecord('aPlus'));
}
if (MODERN_EL.recordAb) {
  modernActivate(MODERN_EL.recordAb, () => modernStartRecord('driveAB'));
}
if (MODERN_EL.recordCurve) {
  modernActivate(MODERN_EL.recordCurve, () => modernStartRecord('recordCurve'));
}
if (MODERN_EL.recPrimary) {
  modernActivate(MODERN_EL.recPrimary, modernRecordingSetPoint);
}
if (MODERN_EL.recCancel) {
  modernActivate(MODERN_EL.recCancel, modernCancelRecording);
}
if (MODERN_EL.lineAdjustBtn) {
  modernActivate(MODERN_EL.lineAdjustBtn, modernOpenLineAdjust);
}
if (MODERN_EL.lineAdjustClose) {
  modernActivate(MODERN_EL.lineAdjustClose, () => {
    modernLineAdjustFocusBack = true;
    modernRequestCloseLineAdjust();
    modernSyncLineAdjust();
  });
}
if (MODERN_EL.lineAdjustAllLines) {
  modernActivate(MODERN_EL.lineAdjustAllLines, () => {
    modernRequestCloseLineAdjust();       // nothing has moved from this state
    if (modernRefSessionOpen()) return;   // a pending move appeared: let the dialog own it
    modernHideLineAdjust(false);
    modernOpenAllLines();
  });
}
// Guidance settings: the cycle-only host commands keep their state label, so the button says what
// the next tap will do instead of pretending to be a direct selector.
if (MODERN_EL.setTram) {
  modernActivate(MODERN_EL.setTram, () => {
    if (iHoldControl) transport.send('tram.cycle');
  });
}
if (MODERN_EL.setSkipMode) {
  modernActivate(MODERN_EL.setSkipMode, () => {
    if (iHoldControl) transport.send('youturn.skipToggle');
  });
}
if (MODERN_EL.setSkipRows) {
  modernActivate(MODERN_EL.setSkipRows, () => {
    if (iHoldControl) transport.send('youturn.skipCycle');
  });
}
// On-map preferences are client-local; they only choose which existing control is on screen.
for (const [btn, key] of [
  [MODERN_EL.setMapFlags, 'flags'],
  [MODERN_EL.setMapHeadland, 'headland'],
  [MODERN_EL.setMapSections, 'sections'],
  [MODERN_EL.setMapContour, 'contour'],
  [MODERN_EL.setMapSectionsAuto, 'sectionsAuto'],
  [MODERN_EL.setMapSectionsManual, 'sectionsManual'],
  [MODERN_EL.setMapYouturn, 'youturn'],
  [MODERN_EL.setMapIsobus, 'isobus'],
  [MODERN_EL.setMapContourLock, 'contourLock'],
]) {
  if (btn) {
    modernActivate(btn, () => {
      const prefs = modernMapControlPrefs();
      modernSetMapControlPref(key, !prefs[key]);
    });
  }
}
for (const [mode, btn] of [
  ['trailing', MODERN_EL.setModeTrailing],
  ['always', MODERN_EL.setModeAlways],
  ['never', MODERN_EL.setModeNever],
]) {
  if (btn) modernActivate(btn, () => modernSetMapControlPref('toolHeading', mode));
}
// The on-map buttons dispatch the original bottom-bar button: one command owner, one gate.
if (MODERN_EL.mapFlags) {
  modernActivate(MODERN_EL.mapFlags, () => {
    if (iHoldControl && !MODERN_EL.mapFlags.disabled) modernDispatchPointer(document.getElementById('bn-flags'));
  });
}
if (MODERN_EL.mapHeadland) {
  modernActivate(MODERN_EL.mapHeadland, () => {
    if (iHoldControl && !MODERN_EL.mapHeadland.disabled) modernDispatchPointer(document.getElementById('bn-headland'));
  });
}
if (MODERN_EL.mapSections) {
  modernActivate(MODERN_EL.mapSections, () => {
    if (iHoldControl && !MODERN_EL.mapSections.disabled) modernDispatchPointer(document.getElementById('bn-secheadland'));
  });
}
if (MODERN_EL.mapToolHeading) {
  modernActivate(MODERN_EL.mapToolHeading, () => {
    if (iHoldControl && !MODERN_EL.mapToolHeading.disabled) modernDispatchPointer(document.getElementById('bn-reset-heading'));
  });
}
for (const [btn, srcId] of [
  [MODERN_EL.mapContour, 'rn-contour'],
  [MODERN_EL.mapSectionsAuto, 'rn-auto'],
  [MODERN_EL.mapSectionsManual, 'rn-manual'],
  [MODERN_EL.mapYouturn, 'rn-youturn'],
  [MODERN_EL.mapIsobus, 'rn-isobus'],
  [MODERN_EL.mapContourLock, 'rn-contourlock'],
]) {
  if (btn) {
    modernActivate(btn, () => {
      if (iHoldControl && !btn.disabled) modernDispatchPointer(document.getElementById(srcId));
    });
  }
}
if (MODERN_EL.mapControls) {
  // The flags flyout is moved into the cluster while the rail is live, so its data-cmd rows no
  // longer bubble through #bottomnav. Same contract as the bar delegate: Tier-2 needs control.
  MODERN_EL.mapControls.addEventListener('pointerdown', e => {
    e.stopPropagation();
    const btn = e.target && typeof e.target.closest === 'function'
      ? e.target.closest('button[data-cmd]') : null;
    if (!btn) return;
    if (btn.hasAttribute('data-t2') && !iHoldControl) return;
    transport.send(btn.dataset.cmd);
  });
}
if (MODERN_EL.switchBtn) {
  modernActivate(MODERN_EL.switchBtn, modernSwitchPresentation);
}
if (MODERN_EL.resetBtn) {
  modernActivate(MODERN_EL.resetBtn, modernResetPresentation);
}
if (MODERN_EL.rail) {
  // A press or wheel on the rail is not a map gesture: keep it from the window-level pan,
  // map-tap capture and wheel zoom. Do not preventDefault, so buttons, focus and scrolling
  // still work; a scrollable list still receives its wheel.
  MODERN_EL.rail.addEventListener('pointerdown', e => e.stopPropagation());
  MODERN_EL.rail.addEventListener('wheel', e => e.stopPropagation(), { passive: true });
}
if (MODERN_EL.allLinesPanel) {
  MODERN_EL.allLinesPanel.addEventListener('pointerdown', e => e.stopPropagation());
  MODERN_EL.allLinesPanel.addEventListener('wheel', e => e.stopPropagation(), { passive: true });
}
if (MODERN_EL.lineAdjust) {
  // Same contract for the full-map page: its presses are not map gestures. Individual controls
  // still get their own handlers, and the page scrolls with the wheel.
  MODERN_EL.lineAdjust.addEventListener('pointerdown', e => e.stopPropagation());
  MODERN_EL.lineAdjust.addEventListener('wheel', e => e.stopPropagation(), { passive: true });
}
for (const t of ['uizoom', 'resize']) addEventListener(t, syncModernMapArea);

// A dialog, confirmation, host prompt or wizard owns Escape while it is open; typing in a field
// owns it too. The existing map/drawing flows cancel themselves first (js/map-input.js), so this
// handler does not take their Escape.
function modernEscapeOwnedElsewhere() {
  if (typeof wizard !== 'undefined' && wizard && !wizard.closed) return true;
  if (typeof hostPrompt !== 'undefined' && hostPrompt && hostPrompt.kind) return true;
  if (typeof isTyping === 'function' && isTyping()) return true;
  for (const id of ['dlg-unsavedcov', 'hostprompt', 'dialoghost']) {
    const el = document.getElementById(id);
    if (el && el.classList.contains('open')) return true;
  }
  if (typeof abFlow !== 'undefined' && abFlow) return true;
  if (typeof hlFlow !== 'undefined' && hlFlow) return true;
  if (typeof editSession !== 'undefined' && editSession) return true;
  if (typeof satBnd !== 'undefined' && satBnd) return true;
  if (typeof mapTap !== 'undefined' && mapTap) return true;
  return false;
}

// The labeled Menu opens the Modern settings hub (and its items open the existing panels).
// Escape closes the hub or any open left-nav panel and returns focus to #mod-menu. It only acts
// while such a surface is open in Modern and no dialog/drawing flow owns the key, so the existing
// map/drawing Escape handling and the Classic page are unchanged. Focus is restored, not trapped.
addEventListener('keydown', e => {
  if (e.key !== 'Escape' || e.defaultPrevented || !isModernUi()) return;
  if (modernEscapeOwnedElsewhere()) return;
  // A full-list column closes on Escape and returns focus to its toggle.
  if (modernAllLinesShown()) {
    modernCloseAllLines(true);
    e.preventDefault();
    return;
  }
  // The line adjustment page is its own surface. Its close is guarded exactly like Exit, so
  // Escape cannot drop an unsaved move.
  if (modernLineAdjustOpen()) {
    modernLineAdjustFocusBack = true;
    modernRequestCloseLineAdjust();
    modernSyncLineAdjust();
    e.preventDefault();
    return;
  }
  if (modernSettingsOpen()) {
    modernCloseSettings(true);
    e.preventDefault();
    return;
  }
  const classicEntry = document.getElementById('ln-filemenu');
  const scrim = document.getElementById('ln-scrim');
  let panelOpen = false;
  try { panelOpen = !!document.querySelector('.ln-panel.open'); } catch (_) { /* stub DOM */ }
  if (!panelOpen) panelOpen = !!(classicEntry && classicEntry.classList.contains('active'))
    || !!(scrim && scrim.classList.contains('open'));
  if (!panelOpen) return;
  lnCloseAll();
  modernCloseSettings(false);
  modernSyncMenuState(true);
  if (MODERN_EL.menu) MODERN_EL.menu.focus();
  e.preventDefault();
});

// ---- Successful-init gate ---------------------------------------------------
// The baseline stylesheet hides the shell. Unhide it, show the Modern styles, verify the
// stylesheet is actually in effect and sync the map area; only then report ready. A failure
// restores the Classic shell instead of leaving unstyled or half-laid-out Modern elements.
function modernStart() {
  if (!isModernUi()) {
    if (window.AgOpenWebUiMode && typeof window.AgOpenWebUiMode.markReady === 'function')
      window.AgOpenWebUiMode.markReady();
    return;
  }
  try {
    // A card pane restored as open at load already owns the map area; the rail steps aside,
    // but the labeled Menu still proves the Modern stylesheet is in effect.
    if (modernCardPaneOpen()) {
      modernRailSuspended = true;
      if (MODERN_EL.rail) MODERN_EL.rail.classList.add('suspended');
    }
    if (MODERN_EL.rail) MODERN_EL.rail.hidden = false;
    if (MODERN_EL.menu) MODERN_EL.menu.hidden = false;
    document.documentElement.setAttribute('data-ui-init', 'modern');
    if (!modernMenuShown()) throw new Error('modern.css did not show the Modern shell');
    syncModernMapArea();
    syncModernClassicCycleFallback();
    if (window.AgOpenWebUiMode && typeof window.AgOpenWebUiMode.markReady === 'function')
      window.AgOpenWebUiMode.markReady();
  } catch (e) {
    document.documentElement.removeAttribute('data-ui-init');
    document.documentElement.setAttribute('data-ui', 'classic');
    if (MODERN_EL.rail) MODERN_EL.rail.hidden = true;
    if (MODERN_EL.menu) MODERN_EL.menu.hidden = true;
    if (!modernCardPaneOpen() && typeof setMapArea === 'function') setMapArea(0, 0);
    syncModernClassicCycleFallback(); // Classic keeps its right-nav cycle pair
    if (window.AgOpenWebUiMode && typeof window.AgOpenWebUiMode.markReady === 'function')
      window.AgOpenWebUiMode.markReady();
    console.warn('[modern-ui] initialization failed; keeping the Classic shell', e);
  }
}

modernStart();
modernSwitchLabels();
modernBuildColorSwatches();
