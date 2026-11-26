// AgOpenWeb
// Copyright (C) 2024-2026 AgOpenWeb Contributors
// SPDX-License-Identifier: Apache-2.0
//
// CanvasKit start, map theme, UI scale and the placement of the corner pad, panels and HUD, Skia paints.

// ---- CanvasKit (Skia) renderer: colours, paints, UI scale and placement. Its state is
//      declared in js/core.js, beside resize(), which calls recreateSkSurface. ----
// Hex (#rrggbb) or rgb(a)(...) → CanvasKit color (CK.Color: r,g,b 0-255, a 0-1).
function ckColor(s) {
  if (s[0] === '#') return CK.Color(parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16), 1);
  const m = s.match(/\(([^)]+)\)/)[1].split(',').map(Number);
  return CK.Color(m[0], m[1], m[2], m.length > 3 ? m[3] : 1);
}
// Day/Night theme. CSS chrome flips via [data-theme]; the Skia map (clear + grid) is
// recoloured here. Grid greys read on dark; dark-blue greys read on the light day field. One grid
// colour: every line looks the same, as in AgOpenGPS (#496).
const MAP_CLEAR = { night: '#0f1115', day: '#d7dee7' };
const GRID_MINOR = { night: 'rgba(180,180,180,0.314)', day: 'rgba(80,92,110,0.33)' };
function applyMapTheme() {
  if (!CK || !SKP) return; // paints not built yet — buildSkPaints() re-applies on init
  const k = mapIsDay ? 'day' : 'night';
  SKP.gridMinor.setColor(ckColor(GRID_MINOR[k]));
}
// UI size (Screen & Alerts): the controls are zoomed by CSS (--ui-zoom), the map is not.
// Anything that turns screen pixels into a zoomed element's left/top divides by uiZoom.
// Engines differ: current Chromium and WebKit give a zoomed element's rects in screen
// pixels and grow vw/vh with the zoom; older WebKit (iPadOS 17) gives the rects in the
// element's own pixels. calibrateZoom measures which, so rects are always screen pixels
// (zoomRect) and --vw/--vh always come out at one viewport percent.
let uiZoom = 1;
let rectScale = 1;
// Auto size is per browser, not a host setting: what fits depends on the display in front of
// the operator. It measures the live Modern rail and picks the largest existing preset whose
// scaled height still fits the window, so changing the rail (a new row, a taller record card,
// a longer field name) updates the choice instead of relying on a fixed resolution table. The
// line window is measured at its four-row design height so a short field does not inflate the
// scale. Classic, or a Modern page whose rail has not rendered yet, falls back to the
// 1280x720 design box. The 100 % floor keeps the touch targets from shrinking.
const UI_SCALE_PRESETS = [100, 115, 130, 150];
const UI_SCALE_AUTO_KEY = 'agopenweb.uiScaleAuto';
const UI_SCALE_RAIL_MAX_W = 40; // keep at least 60 % of the window for the map
let hostUiScale = 100;
let uiScaleAuto = false;
let autoRailNatural = 0;
let autoRailWidth = 0;
let autoScaleTimer = 0;
let autoScalePending = false;
try { uiScaleAuto = localStorage.getItem(UI_SCALE_AUTO_KEY) === '1'; } catch (_) { /* local only */ }

function pxNum(v) { return parseFloat(v) || 0; }
function uiShown(el) { return !!el && !el.hidden && getComputedStyle(el).display !== 'none'; }
function uiLocalRect(el) {
  const r = typeof zoomRect === 'function' ? zoomRect(el) : el.getBoundingClientRect();
  const z = uiZoom || 1;
  return { top: r.top / z, bottom: r.bottom / z, width: r.width / z, height: r.height / z };
}

// The rail shows fewer rows for a short field. Auto must not grow just because today's field
// has one line, so the window is counted at its four-row design height instead of its current
// visible height. Each existing row is measured independently, including wrapped names; missing
// rows use the normal row's CSS minimum, so a restyle changes the result.
function fullLineWindowHeight(list) {
  const cs = getComputedStyle(list);
  const gap = pxNum(cs.rowGap) || pxNum(cs.gap);
  const rows = 4;
  const items = [...list.children];
  const visible = items.filter(el => uiShown(el) && el.querySelector('.mod-line'));
  const sample = visible.find(el => !el.querySelector('.mod-line-active')) || visible[0];
  const line = sample && sample.querySelector('.mod-line');
  const normalMin = line ? (pxNum(getComputedStyle(line).minHeight) || 56) : 56;
  // Measure each real row separately: any of them may have a long wrapped name. Missing rows
  // are reserved at the CSS minimum so a short field cannot inflate the selected scale.
  const realHeight = visible.reduce((sum, el) => sum + uiLocalRect(el).height, 0);
  const reservedHeight = Math.max(0, rows - visible.length) * normalMin;
  return pxNum(cs.paddingTop) + pxNum(cs.paddingBottom)
    + realHeight + reservedHeight + gap * (Math.max(rows, visible.length) - 1);
}

// Natural height of the rail's visible surface in 100 % px. The dock is sticky, so its own
// rect can be pinned before its flow position; add its measured height to the last normal
// child instead of using the dock's current bottom.
function railNaturalHeight(rail, surface) {
  const cs = getComputedStyle(surface);
  const rs = getComputedStyle(rail);
  const gap = pxNum(rs.rowGap) || pxNum(rs.gap);
  const dock = rail.querySelector('.mod-steer-dock');
  const kids = [...surface.children].filter(el => uiShown(el) && el !== dock);
  const last = kids[kids.length - 1];
  if (!last) return 0;
  let h = uiLocalRect(last).bottom - uiLocalRect(surface).top;
  if (dock && uiShown(dock)) h += gap + pxNum(getComputedStyle(dock).marginTop) + uiLocalRect(dock).height;
  const list = document.getElementById('mod-rail-list');
  if (list && uiShown(list)) h += fullLineWindowHeight(list) - uiLocalRect(list).height;
  h += pxNum(cs.paddingBottom);
  return h + pxNum(rs.paddingTop) + pxNum(rs.paddingBottom);
}

function designBoxUiScale() {
  return Math.min(innerHeight / 720, innerWidth / 1280) * 100;
}

// Fit percentage from the live rail. Runs only in Modern; a hidden/suspended rail keeps its
// last measurement so opening a card pane does not rescale the app.
function railFitPct() {
  if (document.documentElement.getAttribute('data-ui') !== 'modern') return 0;
  const rail = document.getElementById('modern-rail');
  if (rail && uiShown(rail)) {
    const w = uiLocalRect(rail).width;
    if (w > 0) autoRailWidth = w;
    const normal = document.getElementById('mod-normal-surface');
    if (normal && uiShown(normal)) {
      const h = railNaturalHeight(rail, normal);
      if (h > 0) autoRailNatural = h;
    }
  }
  if (!autoRailNatural) return 0;
  const hFit = 100 * innerHeight / autoRailNatural;
  const wFit = autoRailWidth > 0 ? UI_SCALE_RAIL_MAX_W * innerWidth / autoRailWidth : Infinity;
  return Math.min(hFit, wFit);
}

function autoUiScale() {
  const fit = railFitPct();
  const want = fit || designBoxUiScale();
  let pct = 100;
  for (const s of UI_SCALE_PRESETS) if (s <= want + 0.01) pct = s;
  return pct;
}

// Throttled re-pick for renders and resizes: content can change at 10 Hz, but a scale change
// settles once per burst instead of thrashing the layout.
function refreshAutoUiScale() {
  if (!uiScaleAuto || autoScalePending) return;
  autoScalePending = true;
  clearTimeout(autoScaleTimer);
  autoScaleTimer = setTimeout(() => {
    autoScalePending = false;
    if (!uiScaleAuto) return;
    applyUiScale(autoUiScale());
    if (typeof syncModernMapArea === 'function') syncModernMapArea();
  }, 150);
}
function isUiScaleAuto() { return uiScaleAuto; }
function currentUiScale() { return hostUiScale; }
function setUiScaleAuto(on) {
  uiScaleAuto = !!on;
  if (!uiScaleAuto) { clearTimeout(autoScaleTimer); autoScalePending = false; }
  try { localStorage.setItem(UI_SCALE_AUTO_KEY, uiScaleAuto ? '1' : '0'); } catch (_) { /* local only */ }
  applyUiScale(uiScaleAuto ? autoUiScale() : hostUiScale);
}
function setUiScaleManual(pct) {
  uiScaleAuto = false;
  clearTimeout(autoScaleTimer);
  autoScalePending = false;
  try { localStorage.setItem(UI_SCALE_AUTO_KEY, '0'); } catch (_) { /* local only */ }
  hostUiScale = pct >= 100 && pct <= 200 ? pct : 100;
  applyUiScale(hostUiScale);
}
// Every config frame carries the host's manual size. Auto must not be overwritten by the
// persisted value, so display.uiScale arrives here; the manual buttons apply their own click.
function applyConfiguredUiScale(pct) {
  hostUiScale = pct >= 100 && pct <= 200 ? pct : 100;
  if (!uiScaleAuto) applyUiScale(hostUiScale);
}
function applyUiScale(pct) {
  const z = pct >= 100 && pct <= 200 ? pct / 100 : 1;
  if (z === uiZoom) return;
  uiZoom = z;
  document.documentElement.style.setProperty('--ui-zoom', String(z));
  document.documentElement.style.setProperty('--map-l', (mapL / z) + 'px');
  document.documentElement.style.setProperty('--map-r', (mapR / z) + 'px');
  calibrateZoom();
  placeCorner();
  placeHud();
  dispatchEvent(new Event('uizoom'));
}
function calibrateZoom() {
  const root = document.documentElement.style;
  root.removeProperty('--vw'); root.removeProperty('--vh');
  rectScale = 1;
  if (uiZoom === 1) return;
  const p = document.createElement('div');
  p.style.cssText = 'position:fixed;left:0;top:0;width:calc(100 * var(--vw));height:1px;visibility:hidden;pointer-events:none';
  document.body.appendChild(p);
  const w = p.getBoundingClientRect().width, own = p.offsetWidth;
  if (w > 0 && own > 0) {
    // 1 when rects are already screen pixels, else uiZoom (offsetWidth is rounded)
    rectScale = Math.abs(w / own - uiZoom) < Math.abs(w / own - 1) ? 1 : uiZoom;
    // vw/vh not grown by the zoom here: one viewport percent is plain vw.
    if (Math.abs(w * rectScale - innerWidth) > 4) { root.setProperty('--vw', '1vw'); root.setProperty('--vh', '1vh'); }
  }
  p.remove();
}
// An element's rect in screen pixels, whichever way the engine reports zoomed rects.
function zoomRect(el) {
  const r = el.getBoundingClientRect(), k = rectScale;
  if (k === 1) return r;
  return { left: r.left * k, right: r.right * k, top: r.top * k, bottom: r.bottom * k, width: r.width * k, height: r.height * k };
}
// The right nav grows down from the top, the bottom bar up from the bottom, and the gauge
// + camera pad and the clock sit in the bottom-right corner between them. When they meet
// (a big UI size, a short screen, many buttons) the corner moves rather than being
// covered: the gauge + pad beside the nav, and the clock and gauge + pad above the bar.
function placeCorner() {
  const rn = document.getElementById('rightnav'), lr = document.getElementById('lowerright');
  const clock = document.getElementById('clock'), bar = document.getElementById('bottomstack');
  if (!rn || !lr || !clock || !bar) return;
  lr.style.right = ''; lr.style.bottom = ''; clock.style.bottom = '';
  const b = zoomRect(bar);
  // Screen pixels from the bottom edge to y, in the zoomed pixels bottom is set in.
  const above = (y, gap) => `${(innerHeight - y) / uiZoom + gap}px`;
  const meets = q => b.height > 0 && q.left < b.right && q.right > b.left && q.bottom > b.top;
  if (meets(zoomRect(clock))) clock.style.bottom = above(b.top, 8);
  // Lift the gauge + pad clear of the bar and the clock; lifting can carry it into the
  // nav, and moving it beside the nav can bring it over the bar, so lift again after.
  const lift = () => {
    lr.style.bottom = '';
    const r = zoomRect(lr), c = zoomRect(clock);
    let top = Infinity;
    if (meets(r)) top = b.top;
    if (r.left < c.right && r.right > c.left && r.bottom > c.top) top = Math.min(top, c.top);
    if (top < Infinity) lr.style.bottom = above(top, 10);
  };
  lift();
  const nav = zoomRect(rn), r = zoomRect(lr);
  if (nav.height > 0 && nav.bottom > r.top && nav.left < r.right) {
    lr.style.right = `calc(14px + var(--sar) + ${nav.width / uiZoom}px)`;
    lift();
  }
}
if (window.ResizeObserver) {
  const ro = new ResizeObserver(placeCorner);
  ro.observe(document.getElementById('rightnav'));
  ro.observe(document.getElementById('bottomstack'));
}
addEventListener('resize', placeCorner);
addEventListener('maparea', placeCorner);
// Menu panels open beside the left nav and may cover the card pane (Plans/ADD_ON_CARDS_PLAN.md
// §1.8). With the pane on the left the nav sits far to the right, so a panel too wide for the
// rest of the window is moved left until it fits; a panel opening grows from 0, which the
// observer sees.
function placePanel(p) {
  p.style.left = ''; p.classList.remove('ln-moved');
  if (!mapL || !p.classList.contains('open')) return;
  const r = zoomRect(p), over = r.right - (innerWidth - 16);
  if (over > 0) { p.style.left = Math.max(16, r.left - over) / uiZoom + 'px'; p.classList.add('ln-moved'); }
}
if (window.ResizeObserver) {
  const ro = new ResizeObserver(es => { for (const e of es) placePanel(e.target); });
  for (const p of document.querySelectorAll('.ln-panel')) ro.observe(p);
  addEventListener('maparea', () => { for (const p of document.querySelectorAll('.ln-panel.open')) placePanel(p); });
}
// Top-centre HUD (#hud-top) and everything docked under the status bar hang from the bar's
// measured bottom (--bar-bottom): the dev diagnostics row adds 26 px, the UI size zooms the
// bar, iOS adds the safe area. The HUD scales with the screen height, roughly as AgOpenGPS
// sizes its light-bar and track text: ×1 up to 540 px, ×1.33 on a 720p screen, at most ×2.
// The map canvas isn't zoomed, so the light bar's cells (drawn on it) take hudK, the HUD
// scale times the UI zoom, to match the readout beside them.
let hudScale = 0, hudBarBottom = -1, hudK = 1;
function placeHud() {
  const root = document.documentElement.style;
  const s = Math.min(2, Math.max(1, innerHeight / 540));
  if (s !== hudScale) { hudScale = s; root.setProperty('--hud-s', s.toFixed(3)); }
  hudK = hudScale * uiZoom;
  let bottom = 0;
  for (const id of ['statusbar', 'sb-diag']) {
    const el = document.getElementById(id);
    if (el) bottom = Math.max(bottom, zoomRect(el).bottom);
  }
  if (bottom !== hudBarBottom) {
    hudBarBottom = bottom;
    // No bar on screen (not connected yet): keep the CSS default, the bar's usual place.
    if (bottom > 0) root.setProperty('--bar-bottom', (bottom / uiZoom).toFixed(2) + 'px');
    else root.removeProperty('--bar-bottom');
  }
}
if (window.ResizeObserver) {
  const ro = new ResizeObserver(placeHud);
  ro.observe(document.getElementById('statusbar'));
  ro.observe(document.getElementById('sb-diag'));
}
addEventListener('resize', placeHud);
addEventListener('maparea', placeHud);
placeHud();
// Re-pick the preset after a reflow (rotation, window resize, OS scale change).
addEventListener('resize', refreshAutoUiScale);
// Apply a saved Auto choice before the first config frame so the layout does not start at
// 100 % and jump once the connection is up.
if (uiScaleAuto) applyUiScale(autoUiScale());
function applyTheme(isDay) {
  mapIsDay = !!isDay;
  document.documentElement.setAttribute('data-theme', mapIsDay ? 'day' : 'night');
  applyMapTheme();
}
function buildSkPaints() {
  const mk = (color, w, dash) => {
    const p = new CK.Paint();
    p.setStyle(CK.PaintStyle.Stroke);
    p.setColor(ckColor(color));
    p.setStrokeWidth(w);
    p.setAntiAlias(true);
    p.setStrokeJoin(CK.StrokeJoin.Round);
    p.setStrokeCap(CK.StrokeCap.Round);
    if (dash) p.setPathEffect(CK.PathEffect.MakeDash(dash, 0));
    return p;
  };
  const fill = (color) => { const p = new CK.Paint(); p.setStyle(CK.PaintStyle.Fill); p.setColor(ckColor(color)); p.setAntiAlias(true); return p; };
  SKP = {
    // Widths are set per frame in updateLineWidths() (world metres × pxPerM).
    boundary: mk('rgba(242,112,89,0.8)', 5), boundaryInner: mk('rgb(245,245,77)', 5), headland: mk('rgb(251,235,107)', 4),
    // Out of bounds (#494, AgOpenGPS CFence / OpenGL.Designer): every boundary thick and red,
    // and an orange frame round the map.
    boundaryOut: mk('rgb(242,64,64)', 6), outFrame: mk('rgb(255,168,84)', 8),
    track: mk('#ffd24a', 4), reference: mk('rgb(180,100,255)', 5, [9, 7]),
    guidance: mk('rgb(252,86,186)', 5), guidanceOutline: mk('rgb(0,0,0)', 15), uturn: mk('rgb(77,242,77)', 5), next: mk('rgb(0,200,200)', 4),
    // Extra guidelines (adjacent passes) — green(51,153,50,153)
    // over a black shadow, both 0.3 m. Widths set per frame in updateLineWidths.
    extraGuide: mk('rgba(51,153,50,0.6)', 1), extraGuideShadow: mk('rgba(0,0,0,0.5)', 1),
    // Grid: grey, ~0.31 alpha, one line style (#496); its width is set per frame in drawGridSk.
    gridMinor: mk('rgba(180,180,180,0.314)', 1),
    vehicle: fill('#39FF6A'),
    flagFill: fill('#FF0000'), flagOutline: mk('#101010', 1.5), // colour set per flag
    // Field Builder headland-editor offset lines: yellow = contributes to the closed
    // headland loop, red = doesn't (yet). Width set per frame in drawHeadlandSegEditLinesSk.
    hlEdit: mk('rgba(245,235,90,0.95)', 3), hlEditOff: mk('rgba(232,86,74,0.95)', 3),
    // Tram lines (wheel tracks) — orange, set per frame in drawTramLinesSk.
    tram: mk('rgba(255,140,60,0.9)', 2),
    // AgOpenGPS's shadow on the current line: where the tool will land. Lighter than its 20 %
    // grey (shadowAreaGray), with clear edges, so it reads over the aerial image.
    toolBand: fill('rgba(220,220,220,0.3)'), toolBandEdge: mk('rgba(240,240,240,0.75)', 1.5),
    // Saved recorded paths / contour strips — AgOpenGPS's pale-yellow lines (#110).
    recPath: mk('rgb(250,235,117)', 2), contourStrip: mk('rgb(250,235,107)', 2),
  };
  // Section footprint bars: one stroke paint per ColorCode (butt cap so adjacent
  // sections abut without rounded overhang), matching the 2D SECTION_COLORS.
  SKP.section = SECTION_COLORS.map((c) => {
    const p = new CK.Paint();
    p.setStyle(CK.PaintStyle.Stroke);
    p.setColor(ckColor(c));
    p.setStrokeWidth(7);
    p.setStrokeCap(CK.StrokeCap.Butt);
    p.setAntiAlias(true);
    return p;
  });
  // Section footprint: filled 2 m-deep rects per ColorCode + a thin black outline.
  SKP.sectionFill = SECTION_COLORS.map((c) => fill(c));
  SKP.sectionOutline = mk('#000000', 1.2);
  SKP.sectionOutline.setStrokeCap(CK.StrokeCap.Butt);
  SKP.sectionOutline.setStrokeJoin(CK.StrokeJoin.Miter);
  // Lightbar arrow fill — one reusable paint, recoloured per facet.
  SKP.lbFill = new CK.Paint();
  SKP.lbFill.setStyle(CK.PaintStyle.Fill);
  SKP.lbFill.setAntiAlias(true);
  // Steer bar (steerBarSk): its bar and arrows, outlined in black.
  SKP.sbFill = new CK.Paint();
  SKP.sbFill.setStyle(CK.PaintStyle.Fill);
  SKP.sbFill.setAntiAlias(true);
  SKP.sbLine = new CK.Paint();
  SKP.sbLine.setStyle(CK.PaintStyle.Stroke);
  SKP.sbLine.setAntiAlias(true);
  SKP.sbLine.setStrokeJoin(CK.StrokeJoin.Miter);
  // Vehicle triangle in marker-local px (drawn under canvas translate+rotate).
  skTri = CK.Path.MakeFromSVGString('M 0 -14 L 9 11 L -9 11 Z');
  applyMapTheme(); // sync grid colours if the theme arrived before paints were built
}
