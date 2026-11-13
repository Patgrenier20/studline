# Studline development roadmap

Updated October 26, 2026. Continue the existing canonical model and shared 2D/3D geometry. Chapter references are to the supplied X18 manual; they organize user-facing capabilities, not implementation copying.

## Delivered foundation

- v0.1: integer units, shared wall junctions, SVG plan, GPU/software 3D, history and local projects.
- v0.2: hosted door/window apertures, migration, typed length/heading, ortho-safe closure and open-end feedback.
- v0.3: click-drag, immediate numeric entry, three wall references, contextual dimension editing, anchored thickness/length, orthogonal connected edits, fixed-wall checks, recorded recessed-room area correction and interior-face areas. 109 tests pass; see DEVELOPMENT_STATUS.md for boundaries.

- v0.4: desktop CAD menus/contrast/visible grid, whole-wall specification, persisted surface finishes, room double-click/name/type/notes and concave interior labels. 131 tests; independent simple enclosures only. Three face-targeting controls removed by user direction.

## Next milestone — reliable partitions and multiple rooms

This is the highest-priority remaining foundation. Existing single-cycle detection is insufficient for a residential plan.

1. Add deterministic wall intersection/split transactions. Keep existing node/wall identities where possible, create explicit replacement mappings and retain host-opening world positions. Reject a split through an aperture until a supported remapping rule exists.
2. Normalize collinear overlap and T/X joins with unequal thicknesses. Rebuild common 2D/3D boundary geometry atomically. Do not store a second independent mesh model.
3. Extract bounded faces from the planar graph. Derive centerline and interior boundaries for adjoining rooms. Extend the current wall-set-keyed names/types and interior labels with deterministic split/merge identity/default inheritance.
4. Apply current edits through topology normalization, with fixed-object constraints and reversible history.

Acceptance: L-shaped exterior plus two partitions yields the correct adjoining rooms and polygonal interior areas. Move a partition and retain openings, joins and room metadata. Export/import and undo preserve all object relationships. Include angled, near-coincident, acute, mixed-thickness, overlap and invalid-opening fixtures. Reject unsupported geometry explicitly rather than silently dropping room area.

## Dimension and assembly milestone

Persistent dimensions (manual 476–520) and wall layers (414–422) need a shared reference contract. Introduce descriptors for centerline, exterior/interior and stable layer faces, then project-owned dimension entities/styles. Provide between-wall clear dimensions with an explicit moving side. Introduce wall assemblies with ordered construction/finish layers, main structural layer and dimension layer; maintain overall thickness as derived data.

Acceptance: change drywall thickness while holding the structural face fixed; a stored room-clear dimension remains associated; changing its value moves the selected wall and connected geometry without moving fixed walls. Old schema-1/2 projects migrate to one-body assemblies without loss. New assembly/reference data must have an explicit schema migration.

## Chapter-based residential systems

| Priority / system | Manual organization | Dependencies and implementation direction | Acceptance gate |
| --- | --- | --- | --- |
| 1. Doors/windows | Doors 571–602; Windows 603–642 | Existing apertures → semantic types, frame/glazing/leaf/casing geometry, handing and schedules; depend on assembly/opening references | Resize host and opening; maintain clear opening, trim placement and scheduled identity |
| 1. Floors/ceilings/levels | Rooms 443–475; Multiple Floor Levels 762–773 | Valid room faces, level datums, platform assemblies, stair/shaft voids, inherited heights | Concave floor excludes recess; adjacent room heights and multi-story walls regenerate consistently |
| 1. Orthographic/elevations/sections | 3D Views 1146–1200 | Camera projection/state, clipping and section contours; persistent annotations for documentation | Four scaled elevations agree with plan; section shows correct cuts/openings and remains associative |
| 2. Foundations | 737–761 | Levels, structural wall layers, platform loading references; footing/slab/stem-wall geometry | Foundation aligns to chosen structural face and updates after supported wall edits |
| 2. Stairs/ramps/landings | 774–821 | Level heights, floor openings, parametric runs/risers/landings; validation separate from code compliance | Rise/run totals meet target level exactly; opening and 2D/3D remain coordinated |
| 2. Roofs | 822–879 | Exterior/room topology, wall-layer baselines, level datums; planes/ridges/valleys before automatic roof inference | Gable/hip test plans join without cracks; pitch/eave changes preserve expected plane intersections |
| 3. Framing/trusses | 880–963 | Structural layers, floors, roofs and openings; member roles, rules and identifiers | Opening changes update member geometry and quantities without duplicate members |
| 3. Cabinets | 643–690 | Hosted/placed parametric objects, wall/room constraints, material surfaces | Width/run edits preserve cabinet adjacency, clearances and schedule entries |
| 3. Materials | 1099–1145 | Semantic material library, units, layers and per-face assignments | Material/finish edits persist and drive identical model appearance and quantities |
| 3. Lighting | Electrical 691–707; Rendering 1205–1223 | Typed fixtures/lights, circuit metadata later, camera-independent light records | Place fixture, edit photometric parameters and reopen reproducible view |
| 4. 3D rendering | 1201–1244 | Correct watertight geometry, materials, cameras and lights first; fix fallback artifacts before premium effects | No visible aperture seams in tested views; saved lighting/projection reproduce; GPU device test recorded |
| 4. Construction documents | CAD 319–369; Text 521–570; Layout 1393–1423; Printing 1424–1445 | Views, scales, sheets, annotations, revision metadata and line-weight system | Export a measured test sheet at stated scale; all plan/elevation labels resolve to model references |
| 4. Schedules | 708–736 | Stable typed object properties, identifiers and document tables | Door/window change updates the correct schedule row and count |
| 4. Material takeoffs | Materials Lists 1368–1392 | Assemblies, framing/member roles, openings, quantity units and waste rules | Analytical fixtures match net lengths/areas/volumes and exclude modeled voids |
| 4. CAD/PDF exports | Import/Export 1285–1306; Printing 1424–1445 | Scale/unit contracts, drawing primitives and sheet model; DXF and PDF independently validated | Reimport CAD with correct units; PDF printed test length matches specified scale |

## Reliability work alongside each milestone

Preserve project data with migrations and backups; keep commands atomic and previews separate. Add a checked-in browser regression suite for the precision acceptance workflow. Persist project defaults and saved camera state. Add revision-aware remote persistence/cross-tab conflicts after the model schema stabilizes. Verify physical input hardware and large-model performance before declaring them supported. AI proposals, if later added, must execute validated previewable commands; no AI service or credential is part of this release.
