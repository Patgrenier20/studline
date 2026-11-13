# Screen recording review

## Second recording — precision milestone v0.3

Reviewed October 22, 2026 **before geometry/UI changes**. Source: `20261022-1254-08.6190513.mp4`, 1600 × 852, 30 fps, duration **02:26.4**. This recording still shows **v0.1** (toolbar/version/welcome controls), not the subsequent v0.2 openings release.

Method: inspected the complete 00:00–02:26 timeline in sequential one-second frames/contact sheets, then full-resolution frames around the top-wall edit and recessed closure. This is a visual sampling review, not a claim to have captured every frame or keyboard/pointer event. The audio track is effectively silent (maximum −91 dB). Intent is inferred from visible interactions. No actual 3D view, save/reopen or numeric typing is demonstrated.

| ID / timestamp | Intended task | Observed behavior | Expected professional behavior | Classification / likely cause | Correction / priority / disposition |
| --- | --- | --- | --- | --- | --- |
| S1 · 00:00–00:39 | Inspect/navigate a 24 × 18 ft rectangle | 432 sq ft centerline area remains visible | State the measurement reference; offer interior usable area separately | **Working centerline calculation**, not an incorrect 432 value | Add labeled interior-face area; delivered v0.3. P1 enhancement |
| S2 · 00:40–00:45 | Select and reposition top wall | Both top endpoints translate sideways; adjacent walls skew; top remains 24 ft and parallelogram area remains 432 | A wall body move should normally follow its normal, with free translation available explicitly | **Confirmed unconstrained body behavior / UX limitation**. No evidence that an endpoint move was mistaken for a body move. Existing body command translates both nodes freely | Default parallel movement, separate handles, explicit Free translate and orthogonal corner propagation. Delivered v0.3. P1 |
| S3 · 00:43–00:52 | Adjust room depth | Area changes through 408 and 420 sq ft; eventual depth 17.5 ft | Recalculate polygon area from actual coordinates | **Working updates**, not proof of an area arithmetic bug | Retain polygon calculation; add exact anchor editing. Delivered/tests. P1 |
| S4 · 00:48–00:58 | Adjust grid/snap settings | Controls respond; no crash or lost plan visible | Clear independent navigation/drafting controls | **No confirmed defect**; physical wheel/trackpad feel cannot be inferred | Retain v0.2 bounded cursor-centered zoom and test acquisition across scales |
| S5 · 00:59–01:02 | Create a new project | New dialog opens and creates an empty Untitled project | Create reliably; expose defaults clearly | **Create works**. Static defaults in recorded v0.1 are a prior enhancement request | Editable defaults already delivered in v0.2; preserve saved-project list |
| S6 · 01:02–01:20 | Choose tools and navigate empty plan | Large welcome panel remains during early wall workflow | Active drafting should have an unobstructed canvas and compact live controls | **Previously confirmed v0.1 UI limitation** | v0.2 hides welcome while drawing; v0.3 adds contextual draft input. P1 |
| S7 · 01:21–01:24 | Build recessed outline | Six connected segments appear: 29.5 right, 15 down, 9.5 left, 7.5 up, 7.5 left, 7.5 down (feet) | Continuous chaining with immediate exact length/angle entry | **Drawing works; precision enhancement requested**. No typed input failure is observed | Click-drag + first-digit input, Tab angle, Enter, Esc. Delivered v0.3. P1 |
| S8 · 01:28–01:51 | Aim the next segment | Cursor oscillation changes horizontal/vertical previews; committed count stays six | Stable preview and explicit direction/length locks | **Expected dominant-axis preview switching**; no accidental committed wall is proven | Typed angle locks direction; clear reference/preview length. Delivered. P2 |
| S9 · 01:52–01:58 | Aim toward an existing corner with Ortho on | Brief diagonal preview near a candidate endpoint | Ortho must not silently yield to off-axis proximity | **Confirmed v0.1 snap precedence defect**. The diagonal is a preview, not a proven committed diagonal wall | v0.2 ortho-first resolution retained; regression coverage preserved. P1 |
| S10 · 02:00–02:08 | Close the recessed perimeter | Bottom-left 12.5-ft run and final 15-ft left wall complete eight-wall perimeter; no area appears | Recognize valid concave enclosure and calculate polygon area | **Confirmed area bug, reproduced in code**. `segmentsIntersect` treated disjoint collinear bottom runs as intersecting because it omitted bounding-box separation | AABB rejection before orientation tests; exact recorded outline fixture. Fixed v0.3. P0 |
| S11 · 02:08–02:26 | Inspect closed layout | Eight walls / 104 total ft persist without area; brief preview around 02:13 does not add a ninth wall | Accurate enclosure feedback and no hidden pending changes | **Same confirmed area defect**, no evidence of an extra committed wall or data loss | Recorded geometry now yields **386.25 sq ft centerline / 360.5 sq ft interior** at 6-in thickness. P0 fixed |

### Requested capabilities not directly demonstrated in the recording

First-digit numeric capture, face-based targeting/dimensions/thickness anchors, floating editing controls, constrained length editing, save-error protection and 3D synchronization were verified independently through source/tests/browser work. They are enhancements or independently tested behavior, not fabricated timestamped bugs. Permanent dimensions, wall construction layers, T/X joins and multiple adjoining rooms remain missing.

### Fresh validation

`tests/precision.test.ts` includes the exact eight-wall recorded coordinates: (0,0), (29.5,0), (29.5,15), (20,15), (20,7.5), (12.5,7.5), (12.5,15), (0,15), in feet. It preserves crossing/overlap rejection while accepting separated collinear runs. Browser acceptance used a different, deliberately smaller eight-wall recess (133.75 centerline / 119 interior before edits), then changed its top exterior dimension/thickness. That browser model is not misrepresented as the recording's exact coordinates. See `docs/VERIFICATION.md`.

The first recording's near-miss closure below was a different issue. Its eventual endpoint weld made an area appear. The second recording's disjoint-collinear failure is independently reproduced and fixed; the earlier finding has not been retroactively relabeled.

---

# Earlier recording — v0.2 review

Reviewed October 22, 2026. Source: `20261022-1216-02.1220448.mp4`, duration **02:20.93**, 1920×1032, 30 fps. The recording shows the deployed v0.1 application, before this session's door/window work.

Review method: inspected the visual timeline from 00:00 through 02:20 using sequential one-second frames and full-resolution frames around the measurement, drawing, corner closure and editing interactions. Timestamps below are approximate to a second; this is not an input-event trace. The audio track contains silence (maximum measured level −91 dB), so intent is inferred from visible actions, not spoken instructions. No 3D view is actually displayed in this recording. Browser chrome and unrelated tabs are excluded from the findings.

## Findings

| ID / timestamp | Attempt and actual behavior | Expected CAD behavior | Classification / likely cause | Correction / priority |
| --- | --- | --- | --- | --- |
| R1 · 00:00–00:08, 00:25–00:28 | Navigate the example room. Zoom changes rapidly between a partial wall and the complete room. | Predictable cursor-centered zoom, recoverable fit, clear pan behavior. | **Suspected usability defect**, not proof of unsolicited camera movement. Wheel input is not recorded. Source applies unbounded exponential scaling to each wheel delta and ignores deltaMode. | Normalize wheel units, bound per-event zoom, retain the cursor anchor, prevent browser scrolling inside canvas. P1. |
| R2 · 00:12–00:25 | Measure across the existing room. A temporary horizontal measurement appears; user adjusts and zooms to reach the other wall. | Clear target/snap feedback and explicit distinction between centerlines and finished faces. | **Confirmed capability limit.** Only endpoints/grid are snap targets; wall faces/segments are not. No evidence that the displayed numerical value is wrong. | Add visible snap labels now; face/segment measurement and persistent dimension objects remain future work. P1/P2. |
| R3 · 00:29–00:37 | Open the guide and switch from Measure to Select. The temporary dimension disappears. | Tool state should be clear; persistent dimensions need a separate command. | **Expected current behavior**, not data loss. The measure state resets on tool change. | Keep temporary measurement clearly described; add persistent dimensions later. P2. |
| R4 · 00:38–00:40 | Select the example's top wall; handles/properties appear. | Click selects, intentional drag moves; exact properties reflect committed geometry. | **Working selection**, with no proven edit failure. The status says Move wall, but there is insufficient event evidence to call it an accidental movement. | Preserve selection; do not invent a selection regression. |
| R5 · 00:48–00:58 | Create a new project; repeatedly target the residential/floor/dimension summary. Text is selected; no settings open. Create succeeds at about 00:58. | Starting wall height/thickness should be editable or unmistakably read-only. | **Requested UX enhancement**, not a failed Create action. The summary is static and hardcodes 9 ft / 6 in even if session defaults differ. | Replace the dimension summary with validated new-wall default fields. P2. |
| R6 · 00:59–01:21 | Start drawing. After the first click, a rubber-band wall is visible while the large “A new space starts here” card remains. Wall count stays zero until placement is committed. | A draft is clearly distinguished from committed geometry; onboarding stops obscuring active drafting. | **Confirmed UI defect:** empty-state display tests committed wall count only. Zero committed walls during the preview is correct. | Hide the welcome card while drafting; provide a compact live length/heading input. P1. |
| R7 · 01:18–01:37 | Draw a stepped/L-shaped chain. Length follows mouse/grid positions; the properties panel describes the last committed wall, while the active segment has a different preview length. | Enter exact length before placement and clearly distinguish active draft from selected geometry. | **Confirmed missing precision workflow**, not proof that numeric property entry failed. No property value is visibly entered in the recording. | Add typed draft length and direction, preserve click chaining and undo. P1. |
| R8 · 01:30–01:39 | Move toward the initial endpoint to close the outline. The preview can become diagonal near that endpoint even though ortho is enabled; moving slightly away returns to an axis-aligned preview. | Ortho should remain orthogonal, with alignment guides helping the earlier horizontal run land on the correct X coordinate. | **Confirmed source-level interaction defect.** Existing snap code lets endpoint proximity bypass ortho, and has no projected alignment inference. Full-resolution 01:39 shows a slightly angled preview with a fractional length. | Axis-respecting endpoint snapping, projected X/Y alignment, explicit endpoint feedback and an exposed ortho control. P1. |
| R9 · 01:40–01:49 | Finish the six-wall outline. It looks closed, but there is no area label. Full-resolution geometry shows a small separation at the upper-left corner. | Clearly show an unconnected endpoint/gap, and help snap to a real shared junction. Never label a visually approximate closure as watertight. | **Confirmed connectivity near-miss**, not an area-calculation bug. The subsequent weld produces an area. Fixed 12-pixel endpoint acquisition and no open-end diagnostics allow a visually subtle gap. | Alignment-assisted drafting, larger consistent screen-space endpoint tolerance, open-end markers and explicit open-outline notice. P1. |
| R10 · 01:47–01:51 | Select the top wall, then move its A endpoint to the left wall. Area appears as 459.5 sq ft. | Weld the junction deterministically, update all views and clearly show the dimension change. | **Welding works.** The top span changes from 30 ft to 30 ft 6 in: closure changes geometry, not just appearance. During the drag preview the property field still shows the old committed 30 ft value. | Preserve welding; expose draft/preview state. Rectangle/orthogonal editing constraints remain future work. P1/P2. |
| R11 · 01:52–02:20 | Inspect the finished L shape and move around the workspace. The six walls and 459.5 sq ft persist visibly. | Maintain geometry while navigating, avoid losing context. | **No confirmed model corruption or crash.** No save/reload, explicit numeric edit, or 3D render is demonstrated here. | Independently verify those workflows in tests and browser; do not claim the recording proves them. |

## Priority decision

Keep the hosted opening increment already built under the preceding assignment. The next bounded improvement is **precision wall drafting and reliable orthogonal closure**, because the recording directly shows a six-inch near-miss and a subsequent geometry-changing repair. This does not justify replacing the application or introducing a new rendering framework.

Implement R1, R5–R9 with pure geometry/camera helpers, real controls and regression tests. Retain explicit limitations for face dimensions, persistent dimensions, orthogonal edit constraints, wall intersections and general room detection. The recording does not justify blaming autosave or the 3D renderer; test those separately.

## Verification and disposition

| Finding | Disposition in v0.2 | Verification |
| --- | --- | --- |
| R1 | Implemented normalized, bounded wheel zoom and native scroll prevention | Unit tests cover pixel/line/page deltas and cursor-anchor invariance; hardware trackpad feel remains unverified |
| R2–R3 | Snap feedback added; temporary measurement retained | Face/segment references and persistent dimensions remain incomplete |
| R4 | Existing selection retained | Browser selection and editing acceptance passed |
| R5 | New-project height/thickness fields implemented | Browser rejected zero height; accepted 10 ft / 6.5 in and created walls with those values |
| R6–R7 | Active drawing clears welcome card; exact length/heading input added with L shortcut | Browser created a six-wall L outline using 30, 18, 17, 6, 13, 12 ft at 0°, 90°, 180°, 270°, 180°, 270°; closed area 462 sq ft |
| R8–R9 | Ortho-safe snaps, projected alignment, endpoint feedback and open-end markers implemented | Dedicated 6-inch near-miss regression test; browser undid two L-shape segments and redrew them using assisted snapping, restoring exactly 462 sq ft |
| R10 | Existing welding preserved; constraint-preserving edits remain incomplete | Original welding tests retained; no claim that a length edit preserves a rectangular room |
| R11 | Persistence and 3D tested independently | Save/reload retained the L outline; door/window export/import/reload retained fractional dimensions; software 3D showed actual apertures |

All 72 automated tests, lint, strict type checks and production build pass. Further evidence and remaining rendering limits are in `docs/VERIFICATION.md` and `DEVELOPMENT_STATUS.md`. The recording review covers the complete supplied duration, but does not assert that every frame or underlying pointer/keyboard event was captured in this sampling method. The later 462 sq ft test is an intentionally exact reproduction of the intended outline, not a claim that the recorded 459.5 sq ft geometry had the same coordinates.

## v0.4 follow-up — latest interface feedback

No new recording timestamps are invented for this follow-up. The user reports invisible grid, faint text/white background, unwanted exterior/center/interior wall targeting, and requests familiar wall/room specification dialogs. These are the current user instructions, superseding earlier face-selection requests.

| Evidence | Attempt / observed issue | Expected behavior | Cause / classification | Correction / priority | Verification |
| --- | --- | --- | --- | --- | --- |
| User report and supplied still; timestamp N/A | Grid toggle appears ineffective; grid difficult to see | Clearly visible toggleable grid | Confirmed low-contrast faint dots in existing source; no confirmed hidden/offscreen canvas defect | P1: visible line grid, darker canvas, explicit pressed state | Actual SVG grid disappears/reappears; screenshot records lines |
| User report; timestamp N/A | Text requires squinting | Legible drafting labels/controls | Confirmed many 8–11px muted labels and pale backgrounds | P1: darker system-font labels and gray desktop panels/canvas | Browser visual inspection at recorded viewport |
| Latest requested workflow; timestamp N/A | Face targeting adds unwanted choices | Click wall as one object and edit specification | Requested interaction change, not an engine defect | P1: remove three-reference UI/F shortcut/hover labels; modal General/Materials | Whole-wall click in 2D/3D and editable dimension both open dialog |
| Latest requested workflow; timestamp N/A | Cannot name/settings-edit an enclosed room | Double-click actual enclosure and edit saved room settings | Confirmed missing semantic room metadata and dialog | P1: stable boundary-keyed records, polygon hit test, name/type/notes/label settings | Named L room survives resize/save/reopen; outside recess is not selected |

The former extents-midpoint room label was also replaced with a tested polygon-interior point. Existing video findings remain historical evidence; current status and remaining limits are in DEVELOPMENT_STATUS.md.
