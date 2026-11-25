# Modern UI host-change backlog

**Status: proposed only. No host, wire or persistence change in this list is approved or
implemented.** These are the changes the finished Modern UI will need from the host once the
presentation work is done. They are collected here so they can be implemented in one reviewable
pass later, instead of being scattered through UI commits.

Rules for this backlog:

- The Modern UI must keep working with today's host. A missing item here is a known limitation,
  not a reason to fake state or add a second command path.
- Do not implement an item by changing `Shared/AgOpenWeb.Models`, `Shared/AgOpenWeb.ViewModels`,
  `Shared/AgOpenWeb.RemoteServer`, the wire contracts or persistence without recording an approved
  exception in `README.md` first.
- Each item names the exact current signal, the missing signal or semantic, and the tests that must
  exist before the host change is accepted.
- Items are ordered by what the finished UI needs first, not by implementation size.

## H1 - Atomic named-line selection

**Priority: high - blocks one-tap named-line cards that stay safe while AutoSteer is engaged.**

**UI need.** The rail shows the host's named guidance lines. A card should select a specific line in
one touch. Today the rail either delegates to the Classic Tracks Manager or uses
`track.cycle`/`cycleBack`, which disengage AutoSteer and the U-turn when the track changes.

**Current behavior.** `track.select|index` makes that track active and does **not** disengage
AutoSteer. The Classic Tracks Manager and Field Builder still use it. `track.cycle` and
`track.cycleBack` do disengage when the track changes and report
`Guidance stopped: track changed`.

**Missing host semantic.** One atomic operation that either:

1. disengages AutoSteer and the U-turn, selects the requested track, and reports the resulting
   state; or
2. refuses while AutoSteer is engaged and returns a reason the client can show.

The operation must be authoritative on the host; a client-side check of `tick.op.autoSteer` is a
snapshot and can race with the host's steering state.

**Proposed contract (for review, not applied).** A new command such as
`track.selectSafely|<index>` with a result frame carrying accepted/refused, the reason, the active
track and whether guidance stopped. Do not silently change the existing `track.select` semantics
for Classic without a separate decision.

**Acceptance tests.** Engaged steering plus a selection request ends with AutoSteer disengaged or
the selection refused; a rejected request leaves the old line active; two clients cannot make the
host select two lines from stale client state; Classic Tracks Manager behavior is either unchanged
or deliberately migrated with its own approval record.

**Owner decision needed.** Per the current maintainer choice, Tracks Manager is left unchanged for
now. The Modern rail may use a client-side confirmation as a temporary UI mitigation, but that is
not a substitute for H1.

## H2 - Field close/open recording guard

**Priority: high - blocks one-tap field switching during an unsaved AB/boundary recording.**

**UI need.** A field chip or one-tap field switch must never silently discard an AB or boundary
recording.

**Current behavior.** Closing a field disengages AutoSteer, switches sections off and cancels a
boundary recording and an AB creation unsaved. The unsaved-coverage guard does not cover an AB or
boundary recording. Opening another field closes the current one first.

**Current UI.** The rail shows up to three fields: a fork-local recent order validated against
FieldOps first, then the host distance. A chip opens one through the existing `field.openOnly`
command and warns with Stay/Switch field when AutoSteer or a live section would stop. It disables
the chips for an observer and for this browser's local/host guard, so a local recording cannot be
discarded from the rail. That guard cannot see a host-only recording after a reload or another
client; H2 is still required.

**Missing host semantic.** A field-switch request must be refused while the host holds unsaved
recording data, with a reason the client can show. The host must also project whether the current
field can be closed/changed by this screen, including work owned by another client.

**Proposed contract (for review, not applied).** Either a guarded `field.openOnly` result or a
`field.canSwitch` state in the scene/status frame. The guard must extend, never bypass, the existing
unsaved-coverage and active-job guards. A discard confirmation, if wanted, belongs to H4.

**Acceptance tests.** A boundary recording in progress refuses a field switch; an AB creation in
progress refuses it; after Finish/Cancel the switch succeeds; another client's recording blocks an
operator/unknown seat but not a definite observer's view-only chooser; no path silently drops points.

## H3 - Host-projected AB/curve recording state

**Priority: high - blocks a banner that is still truthful after reload, control loss or reconnect.**

**UI need.** The rail should take over the line list while a new AB line or curve is being recorded,
showing the mode, step, field, elapsed time and captured distance/point count, with the correct exits.

**Current behavior.** The web client owns `abFlow`, `driveStep`, `curveMarks` and the Drive-AB/curve
flow. The host keeps its `CurrentABCreationMode` and recorded points but does not project them.
Control loss does not cancel the host mode; a reload loses the client flow while the host may keep
collecting points. Boundary recording and recorded path are projected separately and keep their own
semantics.

**Missing host state.** A frame with at least: recording active, kind (A+/Drive AB/Curve/Pivot),
field, step, point count or distance, start time, whether points have been captured, and the
finish/cancel availability. It must be authoritative after reconnect and for other clients.

**Proposed contract (for review, not applied).** A `RecordingStateDto` in the seed and broadcast,
plus explicit finish/cancel commands whose results are reported. Until then, any Modern recording
card must be labelled as this-browser-only and must not claim host confirmation.

**Acceptance tests.** Reload while the host is recording shows a truthful banner; control loss and
reconnect re-seed it; another browser sees the recording; only one client can finish or cancel;
A+ has no lingering recording state; boundary/recorded path are not mixed into the AB banner.

## H4 - Discard confirmation and save/discard semantics

**Priority: medium - needed before the recording banner can offer a safe Cancel after points exist.**

**UI need.** Cancel before the first point can be immediate. Once points or distance exist, the UI
needs `Discard this recording?` with `Keep recording` as the safe default.

**Current behavior.** Cancel discards the local flow; there is no host-side discard confirmation.
Finish for Drive-AB is `Set B`; a curve is saved by its finish step; A+ is immediate.

**Current UI.** The rail's local recording card asks `Discard this recording?` after the first
point and keeps recording as the safe default; before the first point Cancel is immediate. The
confirmation is client-local and cannot become consistent with a host-only recording after a
reload or another client, so H4's host semantics are still required.

**Missing product/host semantics.** A host-supported discard confirmation, or an approved client
confirmation whose result can be made consistent with the host's recording state.

**Acceptance tests.** Cancel before any point is immediate; Cancel after points asks and Keep keeps
the recording; Discard clears local and host state; no partial line is auto-saved.

## H5 - Per-track metadata for richer line cards

**Priority: medium - presentation only, no safety dependency.**

**UI need.** The Concept A cards show direction and length. The current rail deliberately shows only
the name, type and active marker because those are the only host-confirmed values.

**Current behavior.** `scene.trackList` sends index, name, type, active and visible. `TrackDto` sends
geometry for the active track only. Inactive tracks have no heading, length or points on the wire.

**Missing host data.** Per-track heading/direction, length, and optionally inactive geometry for a
map preview. Any derived value must come from the host, not be guessed from the active line.

**Acceptance tests.** Inactive cards show only host-provided values; missing values show an em dash,
not a fake number; the active card and list stay consistent after a line change and reconnect.

## H6 - Shared guidance-line predicate/count

**Priority: low - the client already mirrors the host predicate.**

**UI need.** `All lines (n)` and the rail list count should always agree with the host's own guidance
track filter.

**Current behavior.** The client filters out `Path` and `Contour` with a local set; the host has
`Track.IsGuidanceTrack`. The two currently agree, but there is no shared contract or count.

**Missing host data (optional).** A projected guidance count, or a per-track `isGuidance` flag, so
the client does not have to mirror a host predicate.

**Acceptance tests.** A new non-guidance track type does not silently enter the rail count; Path and
Contour stay excluded.

## H7 - Recent/pinned fields for one-tap field tabs

**Priority: low - can be implemented with existing `FieldOpsDto` and local preferences first.**

**UI need.** The status bar or rail could show a few recent/pinned fields for one-tap switching.

**Current behavior.** `FieldOpsDto` lists every field with name, distance and area, but not a recent
order or a pinned flag. The rail keeps fork-local pinned and recent lists under
`agopenweb.modernui.pinnedFields` and `.recentFields`, validates both against FieldOps, and fills
remaining slots by host distance. Cross-device recency and a host-owned pin remain absent.

**Missing host data (optional).** A recent/pinned order, or a decision to keep this as a
browser-local preference under the existing fork namespace.

**Acceptance tests.** A missing recent list falls back to the chooser; a pinned field that no longer
exists is skipped; field switching still obeys H2.

## H8 - Recording/control state events for the rail

**Priority: low - current frames are sufficient for the implemented slice.**

**UI need.** The rail rebuilds from `scene`, `tick`, `statusBar`, `fieldOps`, `boundary`, `recPath`
and the control frame. A dedicated event for recording/control transitions would reduce polling and
make the banner update immediately.

**Current behavior.** The client renders once per frame and compares a rebuild key; state changes
arrive in the existing frames. No host change is required for correctness today.

**Acceptance tests.** No duplicate render loop; a state change still appears on the next frame even
if an event is missed.

## Cross-cutting review questions

These questions must be answered in the later host-change pass, not now:

1. Does the host change belong to the shared backend (Classic and Modern) or to a Modern-only
   projection? Prefer shared semantics with no second command path.
2. Which changes alter Classic behavior, and which are additive? H1 in particular must not silently
   change the Classic Tracks Manager without its own approval.
3. What is the rollback path if the host and client versions differ during an update?
4. Which acceptance tests can run in the simulator, and which need the reference tablet/WebView?
5. Which strings and labels are new, so they can be added to `en.json` and reached through Weblate
   with the normal label-length workflow?

## Not in this backlog

- A second field, track or recording command path in the client.
- Client-invented headings, lengths, recording steps or host confirmation.
- Automatic re-engagement of AutoSteer or sections.
- Changes to observer, deadman, authority or section rules.
- Hand-editing non-English translation files.
