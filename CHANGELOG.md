# Changelog

## 0.5.0 · Architectural workspace

Added grouped toolbars, contextual wall and opening editing, a searchable Project Browser, layer controls, view tabs and split views, and persistent dock settings. Improved floating length and heading entry while preserving the existing project file format.

## 0.4.0 — 2026-10-26

- Reworked the existing workspace into a compact desktop CAD layout with functional application menus, darker system-font text, a gray drawing background and an explicit visible line-grid toggle.
- Replaced three-face targeting, hover labels and floating wall controls with whole-wall selection and a modal Wall Specification. Removed the F reference shortcut by user request; retained tested core reference geometry.
- Added atomic Apply/OK/Cancel editing for length, height, thickness, wall classification, resize anchor, corner constraints, movement mode and fixed geometry.
- Added independent interior/exterior finish kinds and colors. Both renderers use per-surface mesh colors; material assignment pins physical exterior orientation. Surface textures and layered assemblies remain future work.
- Added room double-click selection, persistent names/types/notes/label visibility, actual polygon area/perimeter and label points inside concave rooms. Independent simple enclosures are supported; partitioned room graphs remain unsupported.
- Preserved schema 2 through optional validated wall finishes and room metadata. Names survive resizing; broken-room settings remain dormant for restoration.
- Retained all 109 previous tests and added 22 regression cases (131 total). Browser checks cover grid toggles, L-room drafting, exact edits, materials, room dialogs, cancel, doors, software 3D, export and project reopening.

## 0.3.0 — 2026-10-22

- Fixed the recorded recessed-room area failure caused by treating disjoint collinear segments as intersecting. Added real interior-face polygon area alongside centerline area.
- Added click-drag drawing, immediate numerical input, fractional/metric parsing, Tab angle entry and continuous typed wall chains.
- Added exterior/center/interior targeting, face-based creation/measurement, floating controls, editable wall labels and reference-anchored thickness/length changes.
- Added default parallel body moves, explicit free moves, orthogonal connected-node propagation, A/B/both resize anchors, endpoint/length/rotation handles, geometry locks and orientation reversal with preserved openings.
- Added failed-save project-switch protection, 37 regression cases (109 total), X18 feature matrix and second recording review.
- Preserved schema 2 with optional validated wall metadata and existing schema-1 migration. No construction-layer model or persistent dimension entities are claimed.
- Retained known multi-room/topology, software-rendering and GPU verification limitations; see DEVELOPMENT_STATUS.md.

## 0.2.0 — 2026-10-22

Incremental update to the existing Studline application and private Site.

### Added

- Host-relative door/window aperture objects, exact properties, placement previews, plan symbols, drag placement, hinge/swing controls and deletion.
- Shared 2D wall breaks and actual 3D aperture geometry; host fit/overlap/header validation, cascading deletion and command history integration.
- Schema 2 and in-memory schema-1 migration, retaining existing wall geometry and IDs.
- Typed draft length/heading with L shortcut; projected alignment guides, open endpoint markers and closure feedback.
- Editable starting wall height/thickness in New project.
- 42 regression tests, bringing the suite from 30 to 72; verified inventory, roadmap and timestamped recording review.

### Fixed

- Endpoint proximity no longer silently defeats orthogonal drafting.
- Active wall drawing no longer retains the obstructing empty-canvas card.
- Wheel zoom normalizes delta modes, caps per-event changes and preserves its cursor anchor.
- Renderer dependencies are prebundled to avoid the observed development-only reload on first 3D use.

### Compatibility and limits

Old schema-1 projects remain readable. New saves/exports use schema 2 and cannot be opened by the old v0.1 editor. Existing browser project keys are retained; import creates a separate project ID.

Openings are wall apertures, not complete door/window construction assemblies. Multi-way topology, general room detection and constraint-preserving dimension edits remain incomplete. Software 3D can show shading seams; GPU visual testing was unavailable. See DEVELOPMENT_STATUS.md and docs/VERIFICATION.md.

## 0.1.0 — existing baseline

Single-floor shared-wall model, precise imperial units, SVG plan editor, GPU/software 3D, local persistence, undo/redo and 30 core tests. Baseline source: `ed6d5743959ca77c28cb8502c40156f8254f4c65`.
