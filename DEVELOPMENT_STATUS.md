# Studline development status

## 0.5.0 · Architectural workspace

The workspace upgrade is implemented on the existing single-floor model. See [workspace audit and verification](docs/WORKSPACE_AUDIT.md) for the browser checks, reference comparison, and remaining model limits.

Verified October 26, 2026. Current increment: **v0.4.0 — desktop CAD workspace, wall specifications and room settings**. Continued the existing React/Zustand/SVG/Three application without rebuilding it. Baseline `6a7ec1f932c630038cc05f6bb26712f6006979f2` (v0.3) was clean; **109 tests, lint, strict TypeScript and production build passed before edits**.

The current user directive replaces three-face targeting with whole-wall selection. The core reference mathematics remain tested, but exterior/center/interior targeting controls, hover labels and the F shortcut have been removed from the product workflow. The new original interface uses desktop CAD menus, panels and specification dialogs; no Chief Architect code or interface artwork was copied.

## Verified inventory

| System | Current working behavior | Evidence and limits |
| --- | --- | --- |
| Canonical geometry | Stable wall/junction IDs, shared endpoints, orientation, integer 1/64-in ticks, height/thickness, two-wall corner joins, fixed-wall constraints | Existing model/geometry/precision tests retained. Straight, single-floor walls; no general T/X normalization |
| Precision drawing | Click-drag and continuous click/typed chains; immediate numeric entry, fractions/metric input, heading, endpoint/grid/orthogonal alignment | Browser drew a 20-ft wall by dragging, then a 12-ft-6-in wall by immediate input and four further segments to close an L room |
| Desktop workspace | Functional File/Edit/Build/Tools/3D/View/Help menus, compact toolbars, tools/model panels, system fonts, darker text and gray canvas | Browser visual inspection; existing branding and editor architecture retained |
| Grid and navigation | Clearly visible line grid, actual on/off state, screen-adaptive spacing, configurable snap grid, wheel zoom/pan/fit | Browser toggled rendered grid count 1 → 0 → 1. Display grid may use multiples of the snap increment at distant zoom |
| Wall selection/specification | Click whole wall in plan or 3D; click its dimension; General/Materials sections; Apply/OK/Cancel | Browser verified selection, invalid-input rejection, cancellation and 3D picking. Wall length inputs use centerline; thickness stays centered |
| Wall edits | Exact length/height/thickness, start/end/midpoint resize anchors, wall type, fixed geometry, connected-square-corner option, parallel/free body movement, endpoint/length/rotation handles | Atomic pure `applyWallSpecification`; neighbor locks/opening validation remain enforced. Rotation handle is about A |
| Surface materials | Independent interior/exterior paint/siding/brick/stone/wood/plaster kinds and colors, stored in project; GPU/software meshes receive appropriate per-surface colors | Mesh-normal/color tests, reversal regression and visible blue exterior in software 3D. Kinds/color only: no texture maps, siding profiles or layer assemblies |
| Room identity/settings | Double-click actual interior polygon; name, type, label visibility and notes; readonly interior area/perimeter/wall count | `rooms.ts`, dialog and 22 new tests. Stable wall-set key retains metadata through resizing. Broken boundaries keep dormant settings; metadata never substitutes for geometry |
| Room geometry | Independent simple rectangular/L/recessed/angled enclosures; actual interior polygon area; separate centerline overview area; concave labels stay inside | Browser named L room retained name through 22→24-ft edit, area 208.21→232.04 sq ft. Unit test excludes bounding-box recess. No adjoining-room/partition extraction |
| Openings | Wall-hosted doors/windows, placement preview, exact properties, door swing/hinge, plan breaks, actual mesh apertures | Original 27 opening tests plus browser placed door after material/room edits; 3D aperture verified |
| Shared 3D | Canonical footprints/solids drive both renderers; geometry and surface-color changes regenerate | Actual mesh bounds/colors checked. Browser software orbit/material/selection verified; GPU raster output not available in this environment |
| Commands/persistence | Atomic commands, undo/redo, autosave, browser project list, save recovery, JSON import/export, schema-1 migration and additive schema-2 compatibility | Store tests plus actual browser export/reopen. Opened a different empty project, then reopened saved L room with dimensions, door, materials, name/type/notes intact |

## Known defects and incomplete features

| Priority | Finding | Required next work |
| --- | --- | --- |
| P1 | Room polygons support a single boundary | Model holes and nested enclosures before generating room surfaces for those layouts |
| P1 | No associative permanent dimensions or room clear-width editing | Persist dimension entities and stable references; solve dimension-driven moves with explicit anchors |
| P1 | No wall construction layers or structural/main layer | Layer assemblies, actual materials/textures and dimension reference rules; current finish selection does not imply construction data |
| P1 | No floors/ceilings generated by semantic rooms | Polygon surfaces, assemblies, heights/elevations and shared level datums; the 3D ground plane is only a viewer aid |
| P1/P2 | Existing software shading/occlusion seams and internal mesh faces | Unioned boundary meshes and fallback ordering; artifact seams remain around apertures |
| P2 | Software camera resets when the project changes | Keep camera lifecycle separate from scene regeneration |
| P2 | Constraints are orthogonal equality propagation only | General parallel/perpendicular/fixed-angle solver; current shared connections persist but arbitrary-angle room dimensions lack a general solver |
| P2 | Acute/unresolved interior offsets return no room | Robust polygon offsets/joins; continue rejecting invalid geometry rather than inventing area |
| P2 | Defaults, tools, grid/anchor preferences and undo history are session-local | Persist workspace preferences separately from building geometry |
| P2 | Browser-local storage has no cloud sync or concurrent-tab conflict handling | Project revisions, remote repository/backups and conflict resolution; JSON export remains portable |
| Later | Missing levels, foundations, stairs, roofs, framing, cabinets, lights, elevations/sections, sheets, schedules, takeoffs and scaled CAD/PDF export | Follow dependency roadmap in `ROADMAP.md` |

Studline remains an early residential CAD foundation, not a complete professional BIM or construction-document product. No structural or building-code verification is implemented. Physical pen/touch/trackpad, large-project performance and GPU visual output remain unverified.

## Verification

Final release gate: `npm run check` — **131 tests**, ESLint, strict TypeScript and Vite production build. Test breakdown: core 30, openings 27, drafting 12, precision 35, store 5, specifications 22. All 109 baseline cases retained. New cases cover room hit testing/concave label placement, separate enclosures, persistent room identity, malformed metadata, legacy files, atomic multi-field failures, three resize anchors, fixed neighbors, physical surface colors, direction reversal, autosave/undo/reopen and the actual browser-exported fixture.

Manual browser evidence is separate from automated tests. Screenshots and exact observations: `docs/VERIFICATION.md`. No checked-in automated browser suite is claimed.

## Next priorities

1. **Topology and adjoining rooms** remain the most important missing foundation for professional residential layouts.
2. Associative dimensions, explicit room clear-width editing and wall construction layers.
3. Room floors/ceilings and multi-level datums, then door/window assemblies and roofs.
4. Orthographic elevations/sections and documentation/export systems.
