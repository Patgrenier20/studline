# Studline verification

## v0.4 — final checks October 26, 2026; browser workflow October 22, 2026

Baseline source `6a7ec1f932c630038cc05f6bb26712f6006979f2` was clean. Before edits: **109 tests, lint, TypeScript and production build passed**. Final release gate: **131 tests**, ESLint, strict TypeScript and Vite build. The original 109 cases remain; `tests/specifications.test.ts` adds 22 cases, including the browser-exported fixture.

### Automated regression scope

- Actual polygon hit testing excludes wall thickness and concave recesses; scanline labels are inside the room.
- Separate simple enclosures retain distinct metadata despite unrelated open walls; unsupported partition/self-crossing graphs do not invent room records.
- Names/type/notes and stable identity survive connected resizing; broken-boundary metadata stays dormant; invalid names/duplicate metadata/invalid finishes reject.
- Schema-2 legacy files and optional metadata round trip; one immutable wall transaction handles multiple fields, three anchors, host opening constraints and fixed neighboring walls.
- Mesh-normal/color assertions distinguish interior/exterior surfaces before and after direction reversal. Pinning the exterior sign prevents finish swapping when the enclosure is opened. Final review also verified side inference for independent enclosures with opposite winding and an unrelated open wall.
- Store actions autosave, undo, redo, switch and reopen complete wall/room settings.
- The actual `examples/wall-room-specifications.studline.json` browser export loads as 6 walls, 1 door, 24-ft × 8-in edited wall, paint/siding and the named L room at 232.0416667 sq ft.

### Manual browser acceptance

These are observed browser checks, not an automated browser test suite. Internal development preview, 1363 × 936 viewport, software 3D fallback:

1. Existing v0.3 project restored with its 8-wall recess and area. New desktop menu/toolbar/panels, line grid, gray canvas and darker text were visually inspected.
2. Created `Wall and room specifications QA`. Drew a 20-ft wall by click-drag. Pressed `1` immediately after the next start; draft input focused with `1`. Entered `12' 6"` / 90°, then four exact segments to close an L room.
3. Grid toggled actual SVG grid count 1→0→1 with visible on/off indication; geometry remained unchanged.
4. Single-clicked the wall body: Wall Specification opened, no three-way face targeting. Invalid length displayed an error without changing the plan. Applied 22-ft length, 8-in thickness, Exterior wall, interior Paint `#e8e1d3`, exterior Siding `#668394`.
5. Double-clicked inside enclosure: Room Specification opened. Saved `Living / dining`, type `Living room`, notes `L-shaped family space.`. Dimensions showed 208.21 sq ft, 66 ft 10 in interior perimeter and 6 walls. Edited the name again, then Cancel; saved name remained unchanged.
6. Changed the wall dimension to 24 ft. Connected L geometry and room name survived; actual interior area became 232.04 sq ft, centerline area 252 sq ft. Double-click in the bounding-box recess produced no room dialog.
7. Placed a 3-ft door after the edits. Software 3D showed its real aperture. Orbit exposed the distinct blue exterior surface; inside retained its separate finish. Clicking the 3D wall opened the same Wall Specification.
8. Saved, opened a different empty project, and reopened the named QA plan through Open. Verified 6 walls, 1 door, exact 24-ft/8-in dimensions, room name/type/notes and both finishes. Exported the actual project as the checked-in fixture. Hot reload also restored the same saved project.
9. Opened File menu and inspected its New/Open/Save/Export commands. Wall dialog focuses length; room dialog focuses name. Cancel discards draft fields; Apply keeps the dialog open.

Screenshots: [workspace](studline-v04-workspace.jpg), [wall materials](studline-v04-wall-dialog.jpg), [room settings](studline-v04-room-dialog.jpg), [exterior finish and aperture](studline-v04-exterior.jpg).

### Verification boundaries

GPU rasterization, physical touch/pen and phone-sized dialog layout were not browser-tested. Software rendering retains pre-existing shading/occlusion seams. Surface types/colors are real persisted settings; siding profiles, material textures and layered construction are not implemented. Room detection is limited to independent simple, nonoverlapping enclosures; adjoining partitioned rooms await topology work. No cloud project synchronization is claimed. Production publication is verified by the native deployment result; the private production URL is not browser-QA accessible in this environment.

## v0.3 — October 22, 2026

Baseline v0.2 source `6cd8186ff83c37480beb527c198e386deba3dc89` was clean; existing **72 tests, lint, strict TypeScript and build passed before edits**. The second recording was reviewed before implementing fixes. Final `npm run check` passes **109 tests**, lint, strict TypeScript and Vite build.

| Automated evidence | Result |
| --- | --- |
| Original core / openings / drafting | 30 + 27 + 12 tests retained and passing |
| `tests/precision.test.ts` | 35 passing: exact recorded recess; crossing/overlap rejection; interior/exterior reference lengths; three zoom scales; thickness anchors; reversal preserving aperture/door orientation; face-drawn connected rectangles; parallel/free/endpoint edits; three resize anchors; rotation/history; fixed neighbor rejection; imperial/metric validation; edited 3D mesh bounds; old schema-2 compatibility; angled polygon area |
| `tests/store.test.ts` | Original 3 plus 2 new failed-save switch/recovery cases, all passing |
| Static/build | ESLint, strict TS and production build pass; no dependency changes |

### Fresh browser acceptance

Performed through the real UI in the managed preview. These are manual browser observations, not an automated E2E suite.

| Workflow | Observed result |
| --- | --- |
| New and click-drag | Created “Precision milestone acceptance”; drag release created one 12 ft 6 in wall |
| Immediate numeric input | Without clicking a field, pressed 1 then typed `2' 6"`; Tab to 90°; Enter created connected second wall of 12 ft 6 in |
| Continuous numeric chain | Added 4 ft @180°, 5 @270°, 4.5 @180°, 5 @90°, 4 @180°, 12.5 @270°; eight-wall recess closed, no open-end markers, 133.75 centerline / 119 interior sq ft |
| Reference editing | Selected exterior reference, changed top wall 6 → 10 in while preserving its exterior plane; entered exterior length 14 ft 6 in, keeping A fixed; enclosure retained and interior area became 132.5 sq ft |
| All reference choices | Exterior 14 ft 6 in, centerline 14 ft, interior 13 ft 6 in after edits; properties and canvas labels agree |
| Contextual focus | Browser exposed dimension click losing focus; added pointer-default prevention, then DOM focus check confirmed `Quick wall length` receives focus |
| 3D synchronization | Software renderer displayed eight walls and the same recessed outline; 10-in top thickness retained; independent mesh-bounds test verifies actual edited coordinates |
| Persistence | Saved/exported, fully reloaded, then closed the tab and reopened the app. Eight walls, 132.5 interior area, 14 ft 6 in exterior length and 10-in thickness retained |
| UI error check | No application errors in inspected error logs; only browser-extension metadata errors appeared |

Actual browser JSON: `../examples/precision-recess.studline.json`. Screenshots: `studline-v03-plan.jpg` (area/outline), `studline-v03-controls.jpg` (reference/anchor controls), `studline-v03-model.jpg` (shared 3D recess). The previous v0.2 opening export and visual evidence remain below; those old browser checks are not misrepresented as repeated v0.3 observations.

### Limits and remaining gates

- WebGL unavailable in this test browser: software output visually verified, GPU rasterization/shadows unverified. Physical touch/pen/trackpad feel and large-project performance also unverified.
- Stored geometry is origin-local. Tool/reference/anchor/default/camera state and undo history are session-local.
- New wall metadata is additive within schema 2; legacy files remain valid. The old editor will not enforce new lock/reference semantics. Layered wall assemblies need a future explicit migration.
- Existing software occlusion/aperture seams, camera reset on model edits, T/X intersection topology, multi-room extraction, persistent dimension objects and orthographic elevations remain open.
- Model regression tests cover locks/anchor variants/opening reversal; the browser smoke test is not exhaustive input-mode coverage.

---


## v0.2 — October 22, 2026 (UTC)

Baseline source `ed6d5743959ca77c28cb8502c40156f8254f4c65` was clean before work. Existing tests were rerun before changes. Final checks use the existing `npm run check` script: ESLint, Vitest, strict TypeScript and production Vite build.

| Automated evidence | Result |
| --- | --- |
| Original `tests/core.test.ts` | 30/30 pass; retained without edits |
| `tests/openings.test.ts` | 27/27 pass: dimensions, host transforms, bounds/overlap, invalid edits, deletion/undo, actual mesh volume and ray apertures, miter preservation, migration/recovery |
| `tests/drafting.test.ts` | 12/12 pass: recording's 6-inch near-miss, ortho/endpoint priority, alignment, snap-off, open ends, exact cardinal/fractional drafting, diagonal quantization, wheel modes/cursor anchoring |
| `tests/store.test.ts` | 3/3 pass: real Zustand commit/autosave/history, rejected edits remain atomic, cascading deletion/restore |
| Static/release checks | ESLint, strict TypeScript and Vite production build pass |

### Fresh browser acceptance

Manually exercised the existing app through the managed preview in a real cloud browser. These are observations, not a checked-in automated browser suite.

| Workflow | Observed result |
| --- | --- |
| Rectangular room | Five wall clicks created four connected 20 × 16 ft walls; 320 sq ft centerline area |
| Door | Placed on wall, edited width to 3 ft 2 1/16 in and offset to 2 ft; changed hinge to far jamb and flipped swing |
| Window | Placed on same host, edited sill to 2 ft 6 in, retained 3 × 4 ft aperture, dragged offset from 10 to 12 ft |
| Invalid overlap | Attempted window offset 3 ft; validation displayed an error and retained the previous valid position |
| Delete/history | Deleted window, undid, redid, undid; returned to two openings |
| 3D | Software fallback showed real door/window voids; switching back retained the plan; shading slivers around openings remain visible |
| File persistence | Exported actual JSON through download; imported it through the picker; fully reloaded; reselected door/window and confirmed fractional width, sill and offset |
| Existing saves | Open list retained the original courtyard, openings acceptance and precision L-shape projects |
| New project validation | Zero height blocked Create; valid 10 ft height and 6.5 in thickness were applied to new walls |
| Exact L-shaped drafting | Typed 30, 18, 17, 6, 13, 12 ft with headings 0°, 90°, 180°, 270°, 180°, 270°; six walls closed at shared junctions, area exactly 462 sq ft |
| Assisted closure | Undid final two L-shape walls; aimed return leg 6 in off alignment; guide snapped to original X; final orthogonal segment closed at original junction, preserving 462 sq ft |
| Open diagnostics | Amber endpoints and open-outline notice visible before closure; closed notice/area after closure |
| L-shape persistence | Save and full reload retained six walls and 462 sq ft; new-wall defaults reset to session defaults, an explicitly documented limitation |

`examples/20x16-openings.studline.json` is the actual exported schema-2 file. `studline-v02-plan.jpg` and `studline-v02-model.jpg` capture the reloaded imported model. Recording analysis is in `../SCREEN_RECORDING_REVIEW.md`; it was completed before the precision changes.

### Remaining verification limits

- Browser acceptance used the software renderer because WebGL was unavailable. GPU code compiles and consumes the same tested geometry; its rasterization/shadows remain unverified.
- SVG painter ordering and retained internal faces can create visible aperture seams. The mesh tests establish aperture volume/ray behavior, not a manifold Boolean boundary or artifact-free rendering.
- Physical touch devices, hardware trackpads, large models and concurrent tabs were not verified. The model's object-count guard is not a performance guarantee.
- Host translation/rotation, schema-1 migration, invalid host edits and corrupt-save recovery are covered by automated tests, not newly repeated manual browser workflows.
- There is no automated browser regression suite yet. These checks do not establish general room detection, overlap-safe topology, structural design or construction-document readiness.

## Historical v0.1 acceptance record

Date: October 21, 2026 (America/New_York).

### Automated checks

- Dependency installation completed with lockfile.
- ESLint passed.
- TypeScript strict compilation and Vite production build passed.
- 30 Vitest tests passed: imperial input/round trips, invalid input, real mesh triangles and bounds, connected rectangles, miter edges, dependent mesh updates, wall moves, snapping, invalid geometry, deletion, acute-corner bounds, junction welding, reversible history, JSON identity preservation, browser repository and recovery, storage failures.

### Browser acceptance observations

| Workflow               | Observed result                                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| Launch and new project | Application rendered; new blank project created while example remained saved.                                  |
| Draw four walls        | Five canvas clicks formed a 20 × 16 foot rectangle: four shared nodes, four walls, 320 sq ft to centerlines.   |
| Exact imperial editing | First wall changed to 21' 3 1/2"; its shared endpoint and neighboring wall updated; height changed to 10 feet. |
| 3D visualization       | Same four-wall model rendered as extruded solids using automatic software fallback; changed height visible.    |
| 3D navigation          | Orbit drag accepted; return to plan retained dimensions.                                                       |
| Wall movement          | A one-foot wall drag moved both ends and shortened both adjacent walls from 16 feet to 15 feet.                |
| Undo/redo              | Wall move reversed, redone and reversed again.                                                                 |
| Deletion               | Selected wall removed, count changed to three, enclosed area disappeared. Undo restored the room.              |
| Save/reload            | Full browser reload restored four walls, 20 × 16 foot dimensions and 320 sq ft.                                |
| Export                 | Browser downloaded actual JSON with wall and junction data.                                                    |
| Import                 | Exported JSON imported through the file picker; four walls and dimensions remained. Existing saves retained.   |

### Verification limits

The cloud browser disables WebGL. The R3F renderer compiled, and its shared mesh-generation path passed tests, but GPU rasterization and shadows have not been visually tested. The software renderer was tested visually. Mobile layout is responsive in code but has not been exercised on physical touch devices. Performance at 2,000 walls, arbitrary multi-way intersections, simultaneous tabs and cross-device synchronization are not established by these checks.

The first browser test exposed unavailable `crypto.randomUUID` on an HTTP preview. A cryptographically random UUID fallback using `crypto.getRandomValues` fixed it. First-use Vite dependency optimization caused a development-only reload; key renderer dependencies are now prebundled. Production code loads a built renderer chunk.
