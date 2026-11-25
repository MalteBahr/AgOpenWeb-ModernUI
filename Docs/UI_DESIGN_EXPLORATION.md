# Modern UI design exploration: AB lines, recording and field switching

**Status: design exploration, with an opt-in preview built.** Classic remains the default UI. The
[README](../README.md) describes the implemented preview: a right rail with host-confirmed line
cards, one-tap `track.select` plus a client confirmation while AutoSteer is engaged, `A+ here` /
`Drive A→B` / `Curve` record shortcuts, a this-browser-only recording card with local elapsed time
and a post-point discard confirmation, field chips with fork-local pinned/recent order plus a
last-job Resume, an Auto Track toggle, 64 px −/+ lateral nudge controls, a rail AutoSteer
On/Off control, a top-bar XTE readout, and a large Settings overlay built from the existing
left-nav entries plus the File menu's settings, diagnostics and recovery entries. The line surface
is a constant four-row window (previous, active, next, next-next) that glides to its new rows; the
active row carries `Adjust line` and `Auto`. `All lines` opens a full-height scrollable column
between the map and the rail and grows the map inset while it is open. A labeled
`⚙ Adjust line` row opens the full-map **Line adjustment** page, which hosts the one Classic Ref
Nudge panel and reuses its session and pending-move confirmation; the page also carries the AB
flyout's line commands (Smooth, Delete contours, Extend/Shorten, half width, Pass) as labeled
buttons, and `Snap to pivot` sits in the rail. The hub's Guidance & display section carries tram
lines, mapping colour and U-Turn skip mode/rows with their host state in the label; an On-map
controls section chooses which of Flags, Headland, Sections in headland and Reset tool heading
appear in a labeled bottom-left cluster; a bottom-right cluster carries the Classic right nav's
guidance controls (Contour, section modes, auto U-turn, ISOBUS, contour lock), optionally. The roll
gauge and camera pad stay top-right; roll is a `ROLL` readout in the top bar and the gauge is
Classic-only. The camera pad keeps its compact cross with modern button surfaces and no labels. The
on-screen U-turn/Lateral rows and the auto U-turn panel share one top-left stack, in the same panel
+ title language; the clock is gone in Modern. The File menu
parity inventory is in [`Plans/MODERN_UI_FILE_MENU_PARITY.md`](../Plans/MODERN_UI_FILE_MENU_PARITY.md).
The wireframes
below remain low-fidelity design material, not screenshots; host changes still needed for the full
safe contract are collected in
[`Plans/MODERN_UI_HOST_CHANGES.md`](../Plans/MODERN_UI_HOST_CHANGES.md).

> **Revision note (23 Nov 2026, user feedback).** The preferred concept is now **Concept A with
> its persistent line rail on the right**, and the standalone mockup opens on it. The reason is
> right-handed reach: the tablet is mounted in the tractor, so the operator's right hand more
> easily reaches the right edge of the display than the far left. A single labeled
> `Settings`/`Menu` trigger is proposed at the far left for infrequent settings. This is design
> input, not an approved design or a measured reach study, and **Classic remains the
> application's default**; enabling the modern presentation stays a separate, tested opt-in per
> the README. Concept C's earlier recommendation is retained as an alternative (Section 9.2).

**Scope:** the three frequent in-cab tasks named in the design brief:

1. choosing an AB line (a track) to steer on,
2. recording a new AB line or curve,
3. switching fields.

The brief also asks for controls that explain themselves, with a target of **0 or 1 touch**. This
document separates what that can honestly mean, then compares four layouts against it.

**What this document is not:** a parity inventory, a backend proposal, a visual style guide, or a
commitment to add commands. Anything that needs host state or a new command is flagged as an open
decision. The rules in the README still apply: presentation work belongs in
`Shared/AgOpenWeb.RemoteServer/wwwroot/`; the original UI must stay usable; no fork-specific
backend change without the approval record in the README.

**Related material**

- [UI_DESIGN_MOCKUPS.html](UI_DESIGN_MOCKUPS.html) - standalone, interactive visual mockups of concepts A-D at the 1280x800 reference size, opening on Concept A with its rail on the right. Sample data only, no connection; controls animate the page only.
- [README](../README.md) - fork goals, reference screen, touch/contrast targets, roadmap gates.
- [Docs/INTERFACE_GUIDE.md](INTERFACE_GUIDE.md) - the documented Classic screen and controls.
- [Docs/WEB_CLIENT.md](WEB_CLIENT.md) - the web client, the 1280x800 landscape reference, and the
  rule that a touch UI puts words on the button, not only in a tooltip.
- [Plans/Ideas/GlyphWordButtons/PLAN.md](../Plans/Ideas/GlyphWordButtons/PLAN.md) - prior art for
  glyph-over-word buttons. It was written in the Avalonia era (`Strings.resx`, XAML panels) and
  would need re-basing on `wwwroot`; the principle (glyph above a short word, background carries
  state) still applies.

## What is new here (and therefore not evidence of parity)

The following are design proposals. None is claimed to exist today, and each needs validation
against the current host, the parity inventory and - for anything safety-related - maintainer
approval:

- **Right-hand rail and a left settings entry.** Concept A's rail is on the right as a user
  preference, and the mockup adds a single left `Settings` trigger. Neither exists today; the menu
  is a static placeholder and does not replace Classic's settings, diagnostics or recovery. Classic
  stays the application default.
- **Pinned line cards and recent-field tabs.** The layout assumes a small visible set of choices.
  Where that set comes from is an open decision (Section 11, item 4). The frames are not proof that
  such a list is available.
- **Detailed cards (`A>B 312 m`).** The `Scene` sends a track list with index, name, type, active
  and visible, and geometry for the **active** track only. It does not send heading or length, and
  it does not send the points of inactive tracks. The detailed values in the mockups are
  illustrative. Real values need a host contract change under the README exception process.
- **A+ from the current heading.** The host has `track.aPlus` with an optional heading; an empty
  argument uses the current heading. The one-touch `A+ here` button is a proposal for placement and
  needs a safety check, not a new command. See Section 11, item 1.
- **A discard confirmation once a recording has data.** This is a new interaction, not current
  behavior. It needs product and safety review.
- **Blocking field switch/close while recording.** This is a new guard proposal. Current field
  close cancels an AB/boundary recording unsaved; the existing unsaved-coverage guard does not
  cover that recording. Any block must extend, never bypass or weaken, the existing guards
  (Section 11, item 6).
- **A host-confirmed recording banner.** AB and curve creation are tracked in the web client and
  are not projected by the host. The host keeps its creation mode across a control loss, and a
  reload loses the client flow while the host may keep appending points. A reliable banner after
  reconnect therefore needs host-projected state and a backend exception in the README's approval
  register (Section 11, item 2).
- **Direct one-tap line cards under AutoSteer.** The current `track.select` changes the active
  track without disengaging AutoSteer, while `track.cycle` disengages it when the track changes.
  Which semantics a one-tap card uses is a safety decision (Section 11, item 13).
- **The touch targets in Section 3.3.** They are targets to validate, not measured results.

No automatic restore, undo, or automatic re-engagement is proposed here. If any of those is wanted,
it needs a separate decision and must not be inferred from this document.

---

## 1. The problem with the current, documented flow

The following counts come from the control structure described in
[Docs/INTERFACE_GUIDE.md](INTERFACE_GUIDE.md), not from a timed device test. They are indicative
and should be verified on the reference tablet before being used as a benchmark.

| Task | Documented path today | Taps before the task starts |
|---|---|---|
| Pick a specific saved line | Bottom bar -> AB line menu -> Tracks Manager -> activate a row | 3+ (panel depth depends on the row) |
| Step to the next/previous line | Right nav "Next track" / "Previous track", shown with two or more visible tracks | 1 |
| Start a line from the current heading (A+) | AB line menu -> Quick AB Creator -> A+ from current heading | 3+ |
| Drive A to B | AB line menu -> Quick AB Creator -> Drive A-to-B -> Set Point A -> drive -> Set Point B | 4+ |
| Record a curve by driving | AB line menu -> Quick AB Creator -> record curve -> Set Point A -> drive -> Finish | 4+ |
| Switch field | File menu -> Field Operations -> Fields and Jobs -> select field -> open | 4+ |
| Know the active line / field / recording state | Status line, field data card, draw toolbar; spread across the screen | 0, but not in one place |

Two observations matter for the design:

- The current client already has a genuinely one-touch line change: the next/previous track
  buttons, which disengage AutoSteer when the track changes. It does not offer one-touch *choosing*
  among named lines from the driving screen, and it does not keep the active line's identity and
  direction next to those buttons.
- Recording exists as a top-center draw toolbar (`Set Point`, `Undo`, `Finish`, `Cancel`) with a
  map hint. It is visible while it runs, but it is far from the bottom thumb zone and it is not
  the same surface as line selection.

The examples below are not a claim that these commands are stable public interfaces. They are the
command names observed in the current client and would be the reuse candidates:
`track.driveAB`, `track.setABGps`, `track.recordCurve`, `track.recordPivot`,
`track.drawStraight`, `track.drawCurve`, `track.drawPoint`. Each would need verification, and
any new state would need a proper contract change under the README rules.

---

## 2. Design goals

| ID | Goal | Consequence for the layout |
|---|---|---|
| G1 | **Recognition beats recall.** A control says what it does in words. | Word labels are permanent; icons are supporting, never the only cue. |
| G2 | **State is visible without touching.** | Active line, its direction and length, the field, and recording state are always on screen. |
| G3 | **The common action is one touch.** | Frequent choices are rendered as visible labeled options, not behind a menu. |
| G4 | **Thumbs first.** | Line choice and recording live within the dominant hand's reach: the right-edge rail in A, the bottom third in B/C/D. Infrequent setup can sit at the top or the far side; a left-handed mirror is an open decision. |
| G5 | **Recording is a state, not a toast.** | A recording banner replaces the normal line bar and names the step, the exit actions and the consequence. |
| G6 | **Safety language is unambiguous.** | A recording stop is never a bare `STOP`; it cannot be confused with stopping the vehicle or disengaging AutoSteer. |
| G7 | **Honest availability.** | Observer, no-field, no-GPS, control-lost and blocked states keep their label and state the reason. |
| G8 | **Survives the cab.** | 1280x800 landscape, glare, gloves, vibration, long translations, color-vision differences. |

---

## 3. What "0 or 1 touch" means here

A touch is one complete press-and-release, including the tap that opens a picker. The definition
only has teeth if it is applied to the *whole task*, not just the last tap.

### 3.1 The three depths

| Depth | Meaning | Examples |
|---|---|---|
| **0 touches** | The operator needs no touch to *know* something or to *already have* a usable state. | Active line name and direction; recording state and step; field name; operator/observer role; guidance already selected by Auto Track Select, when the operator has that documented option on. |
| **1 touch** | One tap on a visible, labeled target changes the state or starts the task. The next action is driving, not navigating UI. | Tap a visible line card; tap a recent field tab; tap `A+ here`; tap `Set B`; tap `Cancel recording`. |
| **2+ touches** | A declared exception, not a silent violation. | Defining A and B (two separate points); confirming a destructive discard; opening an overflow list of all lines or fields; switching fields while a job guard asks a question. |

### 3.2 The selector rule

Choosing among options only costs one touch when **the options themselves are on the driving
screen**. A selector that must first be opened costs one touch to open plus one to choose, so it is
a two-touch path. Both are legitimate, but they must be labeled differently:

- `[ All lines (7) ]` tells the operator that a longer list opens. That is the two-touch overflow
  path.
- A row of line cards is the one-touch path. The current line is marked, and every other visible
  card is a direct target.

This is why the concepts keep a small set of **pinned/recent choices visible** rather than putting
every track behind one "Tracks" button. Pinning is a proposal; where the list comes from and how
it is ordered is an open decision (Section 11).

Selection is also **host-confirmed**. Tapping a card sends the existing command; the active marker
must follow the host's state, not the tap. A locally highlighted card that the host did not accept
would be a displayed/actual mismatch, which the README forbids. If the command is rejected or the
link drops, the marker returns to the confirmed line and the surface says why.

That still leaves the steering question open: `track.select` changes the active track while
AutoSteer stays engaged, whereas `track.cycle` disengages AutoSteer when the track changes. A
one-tap card surface must not silently pick the riskier behavior. Section 5.4 records the current
behavior; Section 11, item 13 is the decision.

### 3.3 Touch budget per task

| Task | Target | Honest note |
|---|---|---|
| See active line, field and recording state | 0 | Persistent labels; no hover or tap required. Direction and length need host data (Section 5.4). |
| Get guidance with Auto Track Select on | 0 | Automatic choice must show *what* it chose and offer a 1-touch override. |
| Pick a visible/pinned line | 1 | Direct tap on a labeled card. |
| Change line while AutoSteer is engaged | 1 with cycle-style disengage, or 2 with a confirm | The current commands differ; this is a safety decision (Section 11, item 13). A silent switch with steering still engaged is not acceptable. |
| Pick any other saved line | 2 | `All lines` opens the list; choosing is host-confirmed and applies under normal operation. |
| Start an A+ line at the current heading | 1 | Existing `track.aPlus` with an empty heading uses the current heading; the one-touch button is a placement/safety proposal. |
| Record A to B | 3 | `Drive A>B` -> `Set A` -> `Set B`. The two points are inherent; do not pretend otherwise. |
| Record a curve by driving | 2+ | `Record curve` -> `Set A/Start` -> drive -> `Finish curve`. AB/curve state is client-local today (Section 5.4). |
| Switch to a recent/pinned field | 1 | Only when no guard applies. Current close/open cancels an AB/boundary recording unsaved, so this target is unsafe during recording until a new guard is approved. |
| Switch to any other field | 2 | `All fields` list. |
| Cancel or discard a recording | 1, or 2 with confirm | 1 before any data exists; confirm when discarding captured points/distance. |
| Read why a control is disabled | 0 | Inline reason next to the control, not a tooltip. |

### 3.4 Rules that keep the promise

1. No gesture-only path (long-press, swipe, drag) for a frequent task. Gestures may exist as
   accelerators, never as the only door.
2. No nested flyout for a frequent choice. One level of overflow is the maximum.
3. Picking a line or field is not destructive and normally applies immediately, with the previous
   choice still one tap away. A steering-safety confirm while AutoSteer is engaged, or a recording
   guard, is an allowed exception (Section 11, items 6 and 13).
4. Confirmations are allowed and do not count as a broken 1-touch rule. They protect data or
   machine state.
5. Do not count the touch that dismisses an accidental overlay. Avoid overlays on the driving
   screen.

---

## 4. Shared frame and assumptions

All concepts use the same landscape frame so they can be compared directly.

```
Reference: 10" tablet, landscape, 1280 x 800 CSS px, UI scale as Classic
+--------------------------------------------------------------------------------+
| status: operator | GPS fix | speed | active line | field | time                |
+--------------------------------------------------------------------------------+
|                                                                                |
|                                    MAP                                         |
|                     vehicle, active line, coverage, guidance                   |
|                                                                                |
+--------------------------------------------------------------------------------+
| primary working surface: line choice / recording state / field switching       |
+--------------------------------------------------------------------------------+
| existing action bar: AutoSteer, sections, U-turn, camera, menu                 |
+--------------------------------------------------------------------------------+
```

Approximate heights: status 48 px, working surface 96-140 px, action bar 64-72 px.

This frame is the comparison baseline and fits B, C and D. **Concept A replaces the bottom
working surface with a persistent side rail**, now proposed on the right (Section 6.1); its map
keeps full height but loses width. The user preference for the right rail is recorded in the
revision note and Section 9.1; it is not a measured result.

Assumptions (to confirm, not facts):

- **A1.** The `Scene` carries a track list (`index`, `name`, `type`, `active`, `visible`) and the
  geometry of the **active** track only. It does not carry heading or length for any track, and it
  does not carry the points of inactive tracks. Cards can therefore show names and active/visible
  state today. Direction and length are mock data until a contract change supplies them.
- **A2.** Recent/pinned lines and fields can be derived from existing lists or stored as
  fork-namespaced presentation preferences. This must respect the README rule against saving
  machine state or overwriting upstream keys.
- **A3.** Existing commands can be reused for A+, drive A-B, curve recording and field open/close.
  No command is assumed to exist merely because a button is drawn here.
- **A4.** The map stays the largest element. The concepts spend map space only for frequent
  controls, and never cover safety indicators.
- **A5.** Landscape is the supported target; portrait and phones remain out of scope as the README
  states.
- **A6.** Safety-critical indicators, the operator/observer role and warnings stay visible and are
  not folded into the line or field surface. The layout may not hide, obscure or reword them.

**Touch and text targets (proposal, aligned with the README):**

- Primary targets at least 56 CSS px; secondary at least 48; never below 40. Gaps at least 8 px.
- Primary labels 16-18 px, secondary 13-15 px; no label below 12 px at the reference scale.
- Normal text contrast at least 4.5:1; large text and meaningful controls at least 3:1.
- Do not encode recording, active line or warning state by color alone: use word + shape + color.
- Plan for German and a long-label language from the first mockup; one-line labels may truncate
  only if the full text remains available in the same context (not a hover-only tooltip).

---

## 5. Recording state and safe stop (proposed shared contract)

Every concept is evaluated against this proposed contract. It is **not current behavior**. AB and
curve creation are tracked in the web client and are not projected by the host, so this contract
needs validation against that reality, the existing guards and the control authority rules before
implementation; items 4-5 in particular are new interactions, not parity.

### 5.1 What the operator should see while recording (proposal)

Scope: this section covers **AB line and curve creation at the vehicle** (A+, Drive A-to-B, record
curve). Drawing a line on the map and boundary-edge creation are different gestures and are out of
scope for this pass; they would need their own map-tap design. The boundary recorder and the recorded
path are separate host-projected flows with their own Record/Pause/Save semantics (Section 5.4).
They keep their own panels and wording; do not fold them into this banner.

- The word **RECORDING** (translated), not only a red dot.
- What is being recorded: `Drive A to B` or `Curve`, and the field name.
- The current step: `Set A`, `Drive to B`, `Set B`, `Finish`.
- Progress: elapsed time and captured distance or point count.
- The exits, with consequences:
  - curve: `Finish curve` (saves the curve and makes it the active line),
  - A-to-B: `Set B` (completes and makes the line active),
  - either: `Cancel recording (nothing is saved)`.

### 5.2 Safe stop rules (proposed)

1. **Never label the button `STOP` alone.** In a guidance app that word belongs to vehicle or
   machine control. Use `Cancel recording` / `Finish curve`, and say what happens to the data and
   to the active line.
2. **Do not put recording exits in the same control group as AutoSteer or section controls.**
   Separate them with a clear gap and surface boundary, so a miss cannot change machine state.
3. **Keep the exit in the same place for the whole recording.** The banner replaces the line bar;
   the exit does not move between steps.
4. **Proposal: block field switching and field closing while recording.** Keep the control visible,
   disable it, and state why: `Finish or cancel the recording before switching fields.` This must
   extend the existing unsaved-coverage and active-job guards, which keep their current behavior;
   if a guard already asks, reuse that question rather than adding a second one. Needs validation
   and approval.
5. **Proposal: confirm a discard once data exists.** Before the first point, cancel is immediate;
   after points or distance are captured, `Discard this recording?` with `Keep recording` as the
   safe default. This confirmation does not exist today and needs product/safety review.
6. **Do not auto-save a partial line.** A curve is saved and made active by `Finish curve`, and is
   discarded by `Cancel`; an A-to-B line is created by `Set B`, not by a generic Save. A+ is
   immediate and has no recording banner. `Finish curve` is only enabled when the flow can save
   (the host requires enough points for a curve); otherwise the label says why. Do not apply this
   wording to the boundary recorder or the recorded path (Section 5.4).
7. **Control loss does not stop AB/curve creation on the host today.** The note here has to be
   precise: the host keeps its creation mode, while the client-side flow lives in the page. The
   host therefore may keep collecting points after control is lost or the page reloads, with no
   host-confirmed state to show it. The banner must not claim a confirmed state it does not have. Reliable
   post-reconnect recording state requires host projection and a backend exception (Section 11,
   item 2).
8. **Reload/reconnect must not fabricate state.** A reload loses the client flow (`abFlow`,
   `driveStep`), but the host may still be in its creation mode. Until host-projected state exists,
   the modern UI must not say the recording survived, and must offer a clear way back to a known
   state after reconnect. This is a safety gap, not a visual detail.
9. **Finish is a line change, not a neutral save.** `Set B` for Drive-AB, `Finish curve` and
   `A+` all add the new line and make it active; the code does not disengage AutoSteer in that
   step. The prototype must treat completion like a card tap for steering safety (Section 11,
   items 13 and 14). Do not present it as a harmless "save" while the machine is engaged.

Cancel is a recording-data action, not a vehicle command. It must never be wired to a steering,
section or machine-control action, and its label must say what data is lost.

### 5.3 Recording banner shape

```
+--------------------------------------------------------------------------------+
| RECORDING  Curve  "Headland 2"  | step 2 of 3: drive the curve  | 01:24  186 m |
| [ FINISH CURVE ]   [ CANCEL RECORDING ]                                        |
| Saves and activates the curve. Cancel discards it.                             |
+--------------------------------------------------------------------------------+
```

The shape follows the surface: a horizontal banner in B and C, a vertical panel in A's rail, but
the order stays the same (state, step, progress, exits, consequence). The banner is always in the
same surface that normally holds the line choices: the right rail in
Concept A, the card strip in Concept C. That is deliberate: the operator's hand is already there,
and the change from "choose a line" to "recording" is unmistakable. In A the exits sit at the
bottom of the right rail, below the recording details and above the machine action bar, with the
rail's surface boundary and the helper text keeping them distinct from machine control. This is a
proposal: today the AB/curve recorder is a client-local flow, not a projected host state.

### 5.4 Current behavior this design must respect (verified by code inspection)

These points were checked in the current code, not measured on a device. They constrain the
mockups and are not proposals.

| Area | Current behavior | Consequence for this design |
|---|---|---|
| Changing a line | `track.select` (a Tracks Manager / Field Builder row) makes that track active and **does not disengage AutoSteer**. `track.cycle` / `cycleBack` disengages AutoSteer and U-turn when the track changes and reports "Guidance stopped: track changed". `track.activate` on the active track clears it, which deactivates guidance; that method does not include the cycle disengage. | A one-tap card must not silently choose the riskier `track.select` semantics while AutoSteer is engaged. This is a safety decision (Section 11, item 13). |
| Track data in the scene | The scene sends the active track's geometry (`TrackDto`: id, name, type, points) and a track list (`TrackInfoDto`: index, name, type, active, visible). It sends no heading and no length, and no points for inactive tracks. | Cards can show names and active/visible state. `A>B` and `312 m` are mock data; real values need a host contract change (Section 11, item 5). |
| AB / curve recording | The client owns the flow (`abFlow`, `driveStep`, curve marks). The host has `CurrentABCreationMode` and the recorded points, but does not project them. Control loss does not cancel the mode; a reload loses the client flow while the host may keep collecting. | A banner is local while the page lives. It cannot be host-confirmed after a reconnect, and a reload can leave the host recording with no UI. Host projection is a backend exception for the README's approval register (Section 11, item 2). |
| Field close / switch | Closing a field disengages AutoSteer, switches sections off, and cancels a boundary recording and an AB creation **unsaved**. Opening another field closes the current one first. The unsaved-coverage guard does not cover an AB or boundary recording. | A one-tap field switch can discard a recording today. Blocking or confirming it is a new guard, not existing behavior, and needs approval (Section 11, item 6). |
| Completing a recording | `Set B` for Drive-AB and `Finish` for a curve add the line and set it active; `A+` does the same immediately. The code does not disengage AutoSteer in those steps. | Finishing is a line change, not a neutral save. It needs the same steering-safety treatment as a card tap (Section 11, items 13 and 14). |
| Boundary and recorded path | Both have host-projected state and their own semantics: the boundary recorder has Record/Pause and its own frame; the recorded path has `RecordedPathDto` with record/info/name. | Do not reuse the AB banner's "Finish curve / Cancel" wording for them. Their panels and flows stay separate. |

This table is the reason the mockups' detailed cards are labeled mock data and the recording banner
is described as local. It is also why the recommendation refuses to present the banner as a
confirmed machine state.

---

## 6. Four layout concepts

Each wireframe is deliberately low-fidelity. `[*]` marks the active line or field, `[ ]` an
inactive choice, and `A>B` the guidance direction. All are 1280x800 landscape.

Concept A is the user-preferred variant and is shown first in the mockup; its rail is on the right.
The other three remain unchanged alternatives. All four frames assume the recent/pinned list in A2
and the existing commands in A3. The field tabs and line cards are proposals, not screenshots of
available data. In particular, `A>B 312 m` on the cards is **mock data**: the scene sends no
direction or length at all, only the active track's points (A1 and Section 5.4). Recording banners
show the proposed local state contract in Section 5, not a host-projected state. The touch paths
below assume AutoSteer is not engaged; when it is, a line change has a pending safety decision
(Section 11, items 13 and 14) and may add a confirm.

### 6.1 Concept A - Persistent line rail, on the right (preferred)

**Idea:** a permanent **right** rail holds the recent lines and the record actions. A single
labeled `Settings` trigger sits at the far left for infrequent settings; the existing Classic
Menu is moved there rather than duplicated. Field tabs stay in the top bar. The map keeps the
center and its full height.

Why the right: in a tractor-mounted landscape tablet, a right-handed operator reaches the right
edge of the display without crossing the screen or the steering wheel. The frequent line and
recording controls therefore belong on that edge. Settings are infrequent and can sit at the
longer left reach. The rail still costs map width; that trade-off is accepted for this preference,
not hidden. A mirrored left rail for left-handed operators is an open accommodation (Section 11,
item 15), not a second default.

```
+--------------------------------------------------------------------------------+
| [Settings] OPERATOR RTK FIX 4.2 km/h  Field: [HOME*] [North 40] [All]   09:41   |
+-------------------------------------------------------+------------------------+
|                                                       | AB LINES  tap one      |
|                                                       |                        |
|                                                       | [*] North 0            |
|                                                       |     A>B  312 m         |
|                                                       | [ ] South 0            |
|                          MAP                          |     A>B  298 m         |
|                                                       | [ ] Pivot curve        |
|                 vehicle + active line                 |     128 pts            |
|                                                       |                        |
|                                                       | [ All lines (7) ]      |
|                                                       |                        |
|                                                       |------------------------|
|                                                       | RECORD NEW             |
|                                                       | [ A+ here ]            |
|                                                       | [ Drive A to B ]       |
|                                                       | [ Record curve ]       |
+-------------------------------------------------------+------------------------+
| [AutoSteer] [Sections] [U-Turn] [Camera]                                       |
+--------------------------------------------------------------------------------+
```

`[Settings]` is the single menu trigger; the Classic Menu leaves the action bar in this concept.
Recording takes over the same right rail:

```
+-------------------------------------------------------+------------------------+
|                                                       | RECORDING  (red)       |
|                                                       | Drive A to B           |
|                                                       | Step 2 of 2: set B     |
|                          MAP                          | 00:18      112 m       |
|                 vehicle + active line                 |                        |
|                                                       | [    SET B     ]       |
|                                                       | [ CANCEL RECORDING ]   |
|                                                       |  nothing is saved      |
+-------------------------------------------------------+------------------------+
| [AutoSteer] [Sections] [U-Turn] [Camera]                                       |
+--------------------------------------------------------------------------------+
```

The recording exits stay in the rail's own surface; the machine action bar is a separate row.
The mockup also keeps a visible gap and helper text between the exits and that bar so a miss
cannot easily reach AutoSteer or sections.

| Task | Touch path |
|---|---|
| Pick a visible line | 1 - tap its row |
| Pick another line | 2 - `All lines (7)` -> row |
| Field switch | 1 - tap a field tab; 2 - `All` |
| Start A+ | 1 - `A+ here` |
| Record A>B | 3 - `Drive A to B` -> `Set A` -> `Set B` |
| Cancel recording | 1 before data, 2 with confirm after data |
| Open menu/settings | 1 - the single `Settings` trigger at the far left |

**Strengths:** the frequent line and recording controls are at the right edge, in the right-handed
operator's reach; labels are always visible; the line list scales vertically and has room for long
names and A>B/length; recording state is unmistakable and its exits stay put; the map keeps its
full height; settings is out of the way on the left.

**Risks:** the rail permanently takes about 306 px of width from the map; long translated names
force wrapping and push the record actions down; the recording exits sit near the bottom-right
machine bar and must keep the proposed surface boundary and gap; a left-handed operator or a
left-mounted tablet may prefer a mirrored rail (open decision); a wider rail covers more map edge
detail.

### 6.2 Concept B - Command deck

**Idea:** the map stays full width. Two compact decks at the bottom show one line and one field at
a time, with previous/next arrows for one-touch stepping and an explicit picker for the rest.

```
+--------------------------------------------------------------------------------+
| OPERATOR  RTK FIX  4.2 km/h  |  [HOME*] [North 40] [All]  |  Line NORTH 0      |
+--------------------------------------------------------------------------------+
|                                                                                |
|                                                                                |
|                                    MAP                                         |
|                      vehicle + active line + coverage                          |
|                                                                                |
|                                                                                |
+--------------------------------------------------------------------------------+
| LINE   [<]  NORTH 0   A>B 312 m  [>]      [Pick line (7)]   [A+ here]          |
+--------------------------------------------------------------------------------+
| FIELD  [<]  HOME  [>]                  [Pick field (4)]   [Close field]        |
+--------------------------------------------------------------------------------+
| [AutoSteer] [Sections] [U-Turn] [Camera] [Menu]                                |
+--------------------------------------------------------------------------------+
```

Recording replaces the line deck:

```
+--------------------------------------------------------------------------------+
| RECORDING  Drive A to B  | step 2 of 2: drive to B, then Set B   | 00:18 112 m |
| [ SET B ]   [ CANCEL RECORDING ]   Cancel saves nothing.                       |
+--------------------------------------------------------------------------------+
```

| Task | Touch path |
|---|---|
| Pick adjacent line | 1 - `<` or `>` |
| Pick a named line | 2 - `Pick line (7)` -> row |
| Field switch | 1 - top field tab or `<`/`>`; 2 - `Pick field` |
| Start A+ | 1 - `A+ here` |
| Record A>B | 3 if the mode is directly visible; 4 if it is behind a chooser |
| Cancel recording | 1 before data, 2 with confirm after data |

**Strengths:** largest map; lowest visual clutter; the bottom deck is in the thumb zone; the
previous/next pattern already exists in Classic. **Risks:** only one line is visible at a time, so
recognition depends on the label being excellent; picking a specific line is a two-touch overflow;
the field row duplicates the top field tabs if both are kept.

### 6.3 Concept C - Field tabs plus line cards (retained alternative)

**Status:** this was the earlier recommendation before the user feedback recorded in Section 9.1.
It is kept as an alternative because it protects map width; it is no longer the default proposal.

**Idea:** recent fields are large tabs across the top. AB lines are a horizontal strip of labeled
cards above the bottom action bar; tapping a card selects it. During recording, the card strip is
replaced by the recording banner.

```
+--------------------------------------------------------------------------------+
| OPERATOR | RTK FIX | 4.2 km/h | 09:41 | [HOME*] [NORTH 40] [All fields]        |
+--------------------------------------------------------------------------------+
|                                                                                |
|                                                                                |
|                                    MAP                                         |
|                      vehicle + active line + coverage                          |
|                                                                                |
|                                                                                |
+--------------------------------------------------------------------------------+
| AB LINES   tap a card to steer                                                 |
| +-------------+ +-------------+ +-------------+ +-------------+ +-----------+  |
| |[*] NORTH 0  | |[ ] SOUTH 0  | |[ ] PIVOT    | |[ ] EDGE 12  | | ALL (7)   |  |
| | A>B  312 m  | | A>B  298 m  | | 128 pts     | | A>B  410 m  | | more...   |  |
| +-------------+ +-------------+ +-------------+ +-------------+ +-----------+  |
+--------------------------------------------------------------------------------+
| [ A+ here ] [ Drive A>B ] [ Record curve ]    [AutoSteer] [Sections] [Menu]    |
+--------------------------------------------------------------------------------+
```

Recording replaces the cards:

```
+--------------------------------------------------------------------------------+
| RECORDING  Drive A to B  | step 2 of 2: drive to B, then Set B  | 00:18  112 m |
| [ SET B ]   [ CANCEL RECORDING ]   Cancel discards this recording.             |
| +-------------+ +-------------+ +-------------+                                |
| | A  set      | | B  waiting  | | 112 m so far|                                |
| +-------------+ +-------------+ +-------------+                                |
+--------------------------------------------------------------------------------+
```

| Task | Touch path |
|---|---|
| Pick a visible line | 1 - tap its card |
| Pick another line | 2 - `All lines (7)` -> row |
| Field switch | 1 - top tab; 2 - `All fields` |
| Start A+ | 1 - `A+ here` |
| Record A>B | 3 - `Drive A>B` -> `Set A` -> `Set B` |
| Record curve | 2+ - `Record curve` -> `Set A/Start` -> drive -> `Finish` |
| Cancel recording | 1 before data, 2 with confirm after data |

**Strengths:** the three frequent actions are in the thumb zone; cards are recognizable by name,
direction and length at a glance; the map keeps full width and most of its height; the recording
banner reuses the exact strip the hand already knows. **Risks:** four cards plus `All` consume the
width at 1280; translated names must truncate gracefully; the field tabs at the top are a longer
reach than the bottom strip, though they still keep a recent field to one touch; five cards is the
working limit before overflow.

### 6.4 Concept D - Split deck

**Idea:** the lower part of the screen is permanently split into a LINE panel and a FIELD panel,
each with always-visible labeled rows. Nothing about line or field is hidden.

```
+--------------------------------------------------------------------------------+
| OPERATOR | RTK FIX | 4.2 km/h | Line: NORTH 0 | Field: HOME* | 09:41           |
+--------------------------------------------------------------------------------+
|                                                                                |
|                                    MAP                                         |
|                      vehicle + active line + coverage                          |
|                                                                                |
+------------------------------------+-------------------------------------------+
| LINE                               | FIELD                                     |
| [*] North 0        A>B 312 m       | [*] Home          job: Spray 3            |
| [ ] South 0        A>B 298 m       | [ ] North 40                              |
| [ ] Pivot curve    128 pts         | [ ] River 12                              |
| [ All lines (7) ]                  | [ All fields (4) ]                        |
| [ A+ here ] [ A>B ] [ Curve ]      | [ Close field ]                           |
+------------------------------------+-------------------------------------------+
| [AutoSteer] [Sections] [U-Turn] [Camera] [Menu]                                |
+--------------------------------------------------------------------------------+
```

Recording takes over the LINE panel; the FIELD panel stays visible but guarded:

```
+------------------------------------+-------------------------------------------+
| RECORDING  Drive A to B            | FIELD  HOME*  job: Spray 3                |
| Step 2 of 2: drive to B, then Set B| [ ] North 40                              |
| 00:18   112 m                      | [ ] River 12                              |
| [    SET B     ]                   | [ All fields (4) ]                        |
| [ CANCEL RECORDING ]               | [ Close field ]  blocked while recording  |
+------------------------------------+-------------------------------------------+
```

The blocked field control is the proposed guard from Section 5.2, not current behavior. The real
guard wording and lifecycle must come from the existing implementation and its approval.

| Task | Touch path |
|---|---|
| Pick a visible line | 1 - tap its row |
| Pick another line | 2 - `All lines (7)` -> row |
| Field switch | 1 - tap a field row; 2 - `All fields` |
| Start A+ | 1 - `A+ here` |
| Record A>B | 3 - `A>B` -> `Set A` -> `Set B` |
| Cancel recording | 1 before data, 2 with confirm after data |

**Strengths:** the most literal 0/1-touch layout; line and field choices are always visible with
room for labels and secondary detail; the guarded field panel demonstrates the field-switch rule
without hiding it. **Risks:** the deck takes about a quarter of the screen height, leaving a
shallower map; two lists compete for attention; at 1280x800 the rows may need to shrink below the
comfortable target; it feels more like a control console than a guidance view.

---

## 7. Side-by-side comparison

| Criterion | A - Line rail | B - Command deck | C - Tabs + cards | D - Split deck |
|---|---|---|---|---|
| Map width | reduced | full | full | full |
| Map height | full | nearly full | nearly full | reduced |
| Visible line choices | 3-4 + All | 1 + picker | 4 + All | 3-4 + All |
| Visible field choices | 2-3 tabs | 2-3 tabs | 2-3 tabs | 3-4 rows |
| Pick visible line | 1 | 1 (next/prev) | 1 | 1 |
| Pick any line | 2 | 2 | 2 | 2 |
| Switch recent field | 1 | 1 | 1 | 1 |
| Start A+ | 1 | 1 | 1 | 1 |
| Start A>B | 1 then 2 points | 1 then 2 points | 1 then 2 points | 1 then 2 points |
| Recording state visibility | rail swap, high | deck swap, high | strip swap, high | panel swap, high |
| Reach in landscape | right edge (preferred) | bottom | bottom + top | bottom |
| Infrequent settings entry | single `Settings` far left (proposal) | Classic Menu in action bar | Classic Menu in action bar | Classic Menu in action bar |
| Label room | high | medium | medium | high |
| Long-translation risk | medium | low | medium-high | medium-high |
| Glare / at-a-glance | high | medium | high | high |
| Main risk | map width (accepted for reach) | one line at a time | width pressure on cards | map height, density |

**User preference (23 Nov 2026):** Concept A with the rail on the right is the preferred starting
point because of right-handed reach in a tractor-mounted tablet. It is a design preference only;
Section 9.1 records the conditions, and Section 9.2 keeps C, B and D as alternatives. No row above
is a measured result.

**Touch-count summary (common tasks):** all four achieve 1 touch for a visible line, a recent field,
and starting an A+ line with the existing `track.aPlus`. Those counts have conditions: the line
change must use a steering-safe command (Section 11, item 13), and a field switch during recording
is unsafe until the new guard is approved (item 6). All four require 2 for overflow lists and at
least 3 for a driven A-to-B line. The differences are in how much the operator must *read* and
*reach*, not in the raw counts.

---

## 8. Contextual labels

The brief's rule is stronger than "use icons with tooltips": if there is doubt about what a button
does, the explanation goes **next to the button or on it**. A `title` tooltip is not available on a
tablet, so it cannot be the explanation.

### 8.1 Label contract

| Element | Rule | Example |
|---|---|---|
| Primary action | Verb + object, on the button | `Drive A>B`, `Set B`, `Cancel recording` |
| Consequence | Same surface as the action, directly beside or below it | `Cancel discards this recording.` |
| State | A word, not only a color or icon | `ACTIVE`, `RECORDING`, `Observer: view only` |
| Active choice | A symbol mark plus the full name in the same label; never color alone | `[*] NORTH 0`, `HOME*` (the active name is always visible) |
| Disabled reason | Inline where the control lives | `Finish or cancel the recording first.` |
| Ambiguous control | A short helper line in the same group | `A+ here creates a line along the current heading.` |
| Overflow | Say what opens and how many | `All lines (7)`, `All fields (4)` |
| Infrequent settings entry | Hamburger plus a permanent word; one trigger, never icon-only | `[☰ Settings]` at the far left; it stands in for the single Classic Menu entry |

Rules:

1. **Words are permanent.** A button may have a glyph, but the word is always visible at the
   reference scale. Icon-only is not acceptable for line, recording or field actions.
2. **The label says the result, not the mechanism.** `Switch to Home field` beats `Field select`.
   `Finish curve` beats `OK`.
3. **The explanation lives in the same surface.** A helper line under the primary action is
   acceptable; a modal or a separate help panel is not.
4. **Disabled controls keep their label and gain a reason.** Do not grey out a wordless icon and
   leave the operator guessing.
5. **Safety words are unique.** `Cancel recording` never means stop the vehicle. If the label could
   be misread in a moving machine, change the words, not just the color.
6. **No label depends on hover, long-press or a gesture.** All of those may add detail, never supply
   the primary meaning.

### 8.2 Label anatomy

```
+--------------------------------------+
|  [ SET B ]                           |
|  Saves the end point of this line.   |
+--------------------------------------+
```

The button carries the action; the line below says what happens next. In the driving layout the
helper line must not push the primary action out of the thumb zone or cover the map.

### 8.3 Phrases to use consistently

| Instead of | Use | Why |
|---|---|---|
| `Set Point` | `Set A` / `Set B` | Says which end of the line is being defined. |
| `Cancel` | `Cancel recording (nothing saved)` | Says what is lost. |
| `Finish` | `Finish curve` | Says it saves the curve and makes it the active line. |
| `Track` (alone) | `AB line` or the line's name | The model calls it a track; the operator calls it a line. Pick one UI word and keep it. |
| `All` | `All lines (7)` / `All fields (4)` | Says what opens. |
| A greyed-out button | `Observer: view only` / `No GPS: unavailable` | Gives the reason, not just the state. |
| A bare red dot | `RECORDING` + red accent | Color is not the only carrier. |

The final English wording must be translated through the existing `tr()` path and checked in
German and a long-label language. If a label does not fit, shorten the words in English first; do
not shrink below the readable size or hide the meaning in a tooltip.

---

## 9. Recommendation

### 9.1 Preferred direction after user feedback: Concept A, rail on the right

**This supersedes the earlier Concept C-first recommendation as a design preference (23 Nov 2026),
not as an approved design or a measured result.** Prototype **Concept A (persistent line rail)**
with the rail on the **right** and a single labeled menu/settings trigger at the far left. The
standalone mockup opens on this layout. "Shown first" here means the mockup's initial view only:
**Classic remains the application's default**, and enabling the modern presentation stays a
separate, tested opt-in under the README's gates (including the recovery URL and the rule that a
Modern default requires separate maintainer agreement).

Why A:

1. **Reach.** In a tractor-mounted landscape tablet, a right-handed operator reaches the right edge
   of the display without crossing the screen. The two most frequent actions - choosing the line
   and recording - sit there, under the hand that is already working. The earlier draft put them
   on the left; moving them to the right is the correction this preference records.
2. **Recognition with the same surface.** Rows carry the name and active state, and would carry
   direction (`A>B`) and length once the host supplies them (mock data today, Section 5.4). The
   rail has vertical room for long translated names.
3. **Recording takes over the same right rail.** The operator does not have to find a new toolbar
   while driving; the surface changes state, and the exits stay in the same place. The rail's
   bottom must keep a visible gap, helper text and surface boundary from the machine action bar so
   a miss cannot reach AutoSteer or section controls.
4. **Field switching** is less frequent than line switching, so recent fields in the top bar remain
   an acceptable reach. The field name is visible at all times (0-touch state). Recent fields are an
   assumption, not existing data.
5. **Settings can sit on the left.** The proposed `[☰ Settings]` trigger is a single, permanent,
   word-labeled control at the far left; the existing Classic Menu entry moves there rather than a
   second menu being added. Its exact contents stay open (Section 11, item 16). It is infrequent, so
   the longer reach is acceptable, and the label keeps it discoverable.
6. **The map-width cost is real.** The rail takes about 306 px of width at 1280, and this document
   does not pretend otherwise. It is accepted because reach and always-visible line state were the
   user's priority; C remains the alternative if field testing shows map width matters more.

**Left-handed accommodation is an open decision, not built here.** A mirrored left rail (and
possibly the Settings trigger on the right) could serve left-handed operators or a left-mounted
tablet. If pursued, it must be a validated, fork-namespaced presentation preference or a deliberate
manual choice - not a second layout, not a hidden gesture, and not a change to machine state. It
must not duplicate controls or weaken the safety rules. Section 11, item 15.

**Rules this recommendation does not relax:**

- **Line change has to be steering-safe.** A tap sends an existing command; the active row or card
  changes only when the host confirms it. But `track.select` leaves AutoSteer engaged while
  `track.cycle` disengages it. The prototype must not wire line choices to `track.select` under an
  engaged AutoSteer without an explicit safety decision (Section 11, item 13). The same applies to
  `Set B`, `Finish curve` and `A+`, which make the new line active (item 14). A confirm or a
  cycle-style disengage costs a touch and is acceptable; a silent swing onto another line is not.
- **Field choices reuse the existing field open/close path.** Unsaved-coverage and active-job guards
  keep their current behavior. Note that the current close cancels an AB or boundary recording
  unsaved and the coverage guard does not cover it. A one-tap field switch during recording is
  therefore unsafe until the new guard in Section 5.2 is approved; it is not parity.
- **Every action remains operator-only.** Observers see the same labels, disabled, with
  `Observer: view only` in context.
- **The recording banner is local, not host-confirmed, for AB/curve creation.** It may show the
  in-page flow, but it must not claim the recording survived a reload or control loss. Reliable
  state needs the host projection described in Section 5.4 (backend exception in the approval
  register, item 2).
- **A+ is one touch via the existing `track.aPlus`.** The button placement still needs a safety
  check (item 1); there is no new command in this proposal.
- **The settings menu is a placeholder in the mockup, not a live settings surface.** In a real
  implementation it must open the existing, approved menu/settings path, keep its guards and
  recovery routes, and never imply a setting was saved when it was not.

### 9.2 Alternatives retained

- **Concept C (field tabs + line cards)** was the previous recommendation. It keeps the full map
  width and puts line choice and recording in the bottom thumb zone. Keep it as the fallback if
  right-edge reach does not justify the lost map width, or if the right rail proves to crowd map
  detail at the reference size. Its earlier rationale still holds within that trade-off; only its
  "recommended" status is superseded.
- **Concept B (command deck)** keeps the largest continuous map and reuses Classic's previous/next
  pattern, at the cost of showing one line at a time and a two-touch picker for a named line.
- **Concept D (split deck)** is the most literal visible-choice console, at the cost of about a
  quarter of the map height and greater density.
- **No alternative is promoted by this preference.** The four remain comparison options; only the
  order and the recommendation changed.

### 9.3 Proposed layout budget (1280x800)

**Concept A (preferred), starting budget:**

| Region | Size | Notes |
|---|---|---|
| Left settings trigger | 48 px high, in the top bar | Single `[☰ Settings]`/menu entry; not icon-only; out of the right-thumb zone |
| Top status + field tabs | 52-60 px | 0-touch field/role/fix state; field tabs are 48 px tall |
| Right line rail | 306 px wide (296-320 proposed) | Full height between the top bar and action bar; 3 rows + `All` + record starts |
| Map | remaining width (about 950 px) x 520-560 px | Full height, narrower; existing map overlays keep their reserved areas and stay clear of the rail |
| Existing action bar | 64-72 px | AutoSteer, sections, U-turn, camera unchanged in function; Menu moves to the left trigger |
| Recording | inside the right rail | Exits at the bottom of the rail, with helper text and a surface boundary between them and the machine bar |
| Safe areas | reserved | Keep the README's safe-area handling; do not place exits under a bezel |

**Concept C (retained alternative):** the earlier budget, unchanged:

| Region | Height | Notes |
|---|---|---|
| Top status + field tabs | 52-60 px | 0-touch field/role/fix state; field tabs are 48 px tall |
| Map | 520-560 px | Never covered by the line strip; existing map overlays keep their reserved areas |
| Line card strip / recording banner | 96-116 px | 48 px cards + label row; banner has two 56 px actions |
| Existing action bar | 64-72 px | AutoSteer, sections, U-turn, camera, menu unchanged in function |
| Safe areas | reserved | Keep the README's safe-area handling; do not place exits under a bezel |

Numbers are a starting budget for a paper prototype, not a measured layout.

---

## 10. Interaction plan

### Phase 1 - Paper and clickable prototype (no code)

- Print the four frames at 1280x800-equivalent size, or build a static HTML mock outside the
  shipped client.
- Test with at least three operators on the reference tablet in the cab or under comparable glare.
- Script the tasks: pick a named line; pick the next line; start A+; record A>B; cancel mid-line;
  switch field; switch field while recording; open the menu/settings entry; observe while another
  device holds control.
- Run a reach check with right-handed and left-handed testers: A's right rail against a mirrored
  left rail, and the bottom-strip alternatives. Record reach time, wrong taps, and whether the
  operator has to cross the screen. A's right rail is a user preference, not yet a measured win.
- Check the single labeled menu/settings trigger for discoverability: can the operator find it
  without being told, and does anyone mistake it for a machine control?
- Record taps, wrong taps, time to first correct action, and whether the operator can say what is
  recording without touching the screen.
- Reject any concept that needs an explanation longer than the label itself.

### Phase 2 - Presentation-only prototype

- Only after the README's architecture proof of concept (gate 1) and design foundation (gate 2).
- Add the layout as a modern presentation; reuse existing commands and state. Classic stays
  untouched and remains the default. "Shown first in the mockup" does not promote Modern to the
  application default; that needs the README gates and a separate maintainer agreement.
- Do not add backend commands or wire fields in this phase. If a label needs data that the current
  frames do not carry, mark the card/row as name-only and open a separate, approved contract change.
- Keep one transport, one renderer and one set of element IDs, as the README requires.

### Phase 3 - Harness and device checks

Extend the existing web-client scenario harness rather than inventing a parallel test:

- reference tablet layout at 1280x800, with UI scaling and long German labels;
- Concept A right rail: verify the map overlays, including map zoom/reset buttons, stay clear of
  the rail, and that the recording exits keep their surface boundary and gap from machine controls;
- optional left-handed mirror, if approved: prove it is a presentation preference only, does not
  duplicate controls, and still exposes the same mandatory state;
- single left `Settings`/menu trigger: keyboard focus, visible focus ring, 48 px target, dialog
  focus trap and Escape, and no duplicate menu control in Concept A;
- operator and observer: every action control disabled with a visible reason for the observer;
- line change with AutoSteer engaged: prove which command semantics the card/row uses and that the
  machine response is the approved one (Section 11, item 13);
- recording state visible at each step; cancel before and after data; guard on field switch;
- control loss, link drop and reload during AB/curve recording, including the case where the host
  keeps collecting with no projecting UI (Section 5.4); expected behavior pending item 2;
- field switch during recording: prove the current unsaved cancel, then the approved guard if any;
- night/day and high-contrast themes; color-vision check;
- touch counts measured from the harness or by screen recording, not estimated;
- simulator only, never live equipment.

### Phase 4 - Review and iterate

- Compare measured taps and errors against the table in Section 3.3.
- Keep a concept only if it meets the common-case targets and its two-touch exceptions are
  explicitly accepted.
- Feed the result into the parity inventory; this document is not a substitute for it.

---

## 11. Open decisions

Each item needs an answer before implementation. "Owner" is a suggestion, not an assignment.

| # | Decision | Why it matters | Suggested owner |
|---|---|---|---|
| 1 | Confirm that `track.aPlus` with an empty heading (current heading) is the intended one-touch A+ action, and where the button may appear (field open, GPS fix, steering engaged, close to a boundary). | The command exists; the placement and safety of a one-tap line creation do not follow from that. | UI + safety review |
| 2 | AB/curve creation is client-local and the host keeps its mode across control loss, but neither is projected. Should the host project recording state, and what should happen on control loss/reload? | A reliable banner after reconnect needs host state and a backend exception in the README's approval register. Without it, the UI must not claim the recording survived. | Backend/VM maintainer + safety review |
| 3 | For AB/curve creation, is there a real Pause, or only `Set B`/`Finish curve` and `Cancel`? | Adding a UI-only Pause would be a fake state. | Backend/VM maintainer |
| 4 | Where do pinned/recent lines and fields come from: the current scene/field data, client-local presentation storage, or a host list? | The 1-touch visible-choice model depends on having the data without a backend change. | Architecture + UI |
| 5 | The scene sends names, type, active and visible for the track list, but no heading/length and no inactive geometry. Do cards stay name-only, or is a contract change approved for direction and length? | Cards showing `A>B 312 m` are mock data today; showing them for real needs a host change. | Scene/contract owner |
| 6 | Current field close cancels an AB/boundary recording unsaved, and the unsaved-coverage guard does not cover it. Is the proposed block/confirm approved, and exactly when does it apply? | A one-tap field switch during recording would silently discard work today. A new guard is a behavior change, not parity. | Backend/VM maintainer + safety review |
| 7 | Does the new working surface (right rail in A, bottom strip in C) replace the existing bottom navigation, or sit above it? | Both would consume too much space at 1280x800 and duplicate controls. | UI + parity review |
| 8 | How many line rows/cards and field tabs are pinned, and what is the overflow order? | Determines whether the common case is really 1 touch. | UI |
| 9 | How does Auto Track Select interact with manual choice? | 0-touch automatic guidance is desirable, but it must show what it chose and not override a deliberate pick. | Guidance/VM |
| 10 | Is the user-facing word "AB line", "track" or "guidance line"? | Mixed vocabulary undermines recognition and translation. | UI + translations |
| 11 | Do we show a recording banner in high contrast with a non-red cue? | Color alone is not sufficient; recording is safety-relevant data state. | UI/accessibility |
| 12 | Which two-touch exceptions are approved as permanent? | The brief says 0 or 1; the honest design has exceptions. Sign them off explicitly. | Maintainer/product |
| 13 | Which command semantics does a one-tap line card/row use while AutoSteer is engaged: `track.select` (steering stays engaged), `track.cycle` (disengages and reports), a confirmation, or a new approved command? | The current commands behave differently, and a silent swing onto another line is a safety hazard. This decides whether the 1-touch card claim is acceptable. | Backend/VM maintainer + safety review |
| 14 | Finishing a recording (`Set B`, `Finish curve`, `A+`) makes the new line active without an AutoSteer disengage in that step. Should the modern flow disengage, warn, or require AutoSteer off before completing while engaged? | A prominent one-tap finish could otherwise change guidance on an engaged machine. It is the same hazard as item 13 at a different moment. | Backend/VM maintainer + safety review |
| 15 | Is the right rail the default proposed Modern layout, and is a local left-handed mirror worth building? If so, does it mirror the rail only, or the rail and the settings trigger, and how is the preference presented, validated and reset? | User feedback favors the right rail for right-handed reach in a tractor-mounted tablet. Left-handed operators and left-mounted tablets may prefer the mirror, but a second layout adds test surface and must not duplicate controls or hide mandatory state. It must remain a presentation preference, never machine state. | UI + accessibility + maintainer |
| 16 | What is the single left-side menu/settings entry: label `Settings` or `Menu`, hamburger plus a permanent word, and does it open the existing Classic Menu (including diagnostics, recovery and about) or a subset? Must it stay visible while driving, and what happens during recording? | The user prefers settings on the left and the frequent guidance controls on the right. One trigger avoids duplicate menus, but "Settings" and "Menu" are not the same promise, and recovery/diagnostics must remain reachable. The mockup's menu is a labeled placeholder, not live settings. | UI + parity + safety review |

---

## 12. Assumptions and limitations

- This is a design exploration, not evidence. No layout has been built, measured or tested on a
  device, and no simulator run was made for this document.
- Touch counts in Section 1 are inferred from the documented panel structure. The current UI may
  have shortcuts, and panel depth may differ in practice.
- Section 5.4 and the line-change observations were verified by code inspection of the current
  tree (`SceneProjector`, `Contracts`, `RemoteServerWiring`, `MainViewModel.*.Track`/`TrackManagement`,
  `tracks.js`), not by exercising the app. Runtime behavior can differ from the code paths read;
  confirm on the simulator before relying on any count or transition.
- "Recent fields" and "pinned lines" are proposals. The repository does not currently promise
  those lists, and storing them may touch the README's rules on local preferences.
- The commands named in Section 1 are observed in the current client and routing, not verified as
  stable or sufficient for this design.
- Direction and length on inactive line cards/rows are mock data. The scene does not send them.
- The right-rail preference is user feedback about right-handed reach in a tractor-mounted tablet,
  not a measured ergonomics study. The mockup opens on Concept A, but **Classic remains the
  application default**; no application code was changed for this exploration. A left-handed mirror
  is an open question and has not been tested.
- The left-side `Settings` menu in the mockup is a static placeholder. It does not load, change or
  save a setting, and it does not represent the existing Classic Menu's settings, diagnostics,
  recovery, about or bug-report paths.
- The document identifies where a backend contract change or exception would be needed (projected
  AB/curve recording state, detailed track metadata, line-change semantics) but does not propose
  an implementation. Those items are in Section 11.
- Portrait, phones and smaller screens are out of scope, consistent with the README and
  [Docs/WEB_CLIENT.md](WEB_CLIENT.md).
- The ASCII frames are comparison tools. They are not pixel specifications and do not define the
  final theme, icon set or typography.

## 13. Glossary

| Term | Meaning in this document |
|---|---|
| AB line | A guidance track; in the model it is a track with two points. The UI may also call it a line or track. |
| A+ | A line created from the vehicle's current position and heading, without driving to B. |
| Active line | The track guidance is currently following. |
| Pinned/recent | A small, visible set of choices kept on the driving screen for one-touch selection. |
| Overflow list | The full list behind `All lines` / `All fields`; opening it costs one touch, choosing another. |
| Observer | A connected device without control; it sees state but cannot command the machine. |
| Guard | An existing confirmation or block that protects unsaved coverage, an active job, or machine state. |
| Right rail | Concept A's persistent right-hand surface for line choice and recording, with one left-side settings trigger. The default proposed Modern layout in the current mockup, not the application default. |
| Mockup default | The concept shown first in the standalone HTML mockup. It does not change the application's Classic default or approve a Modern default. |
| Host-projected / host-confirmed | State the host sends in a frame; the client may present it as actual rather than guessed. |
| Client-local | State or flow that lives in the page (AB/curve creation today) and is not projected by the host. It does not survive a reload. |
