# Studline architecture — v0.3

Studline is an original residential CAD application. The current implementation is a browser-local, single-story wall and hosted-opening editor. It continues the original application and requires no backend or AI credentials.

## Stack decisions

- React 19 + strict TypeScript + Vite 7: static app, fast feedback, no server dependency.
- SVG for initial 2D drafting: precise world coordinates, hit testing, crisp vector dimensions, accessible DOM. Swap renderer behind the model boundary if scale warrants Canvas/WebGL.
- Three.js / React Three Fiber 9: extrude the same wall footprint polygons used by the 2D renderer; OrbitControls from Three.js. A Three.js SVGRenderer fallback uses the same triangle meshes when WebGL 2 is unavailable. React 19/Fiber 9 compatibility is documented at https://r3f.docs.pmnd.rs/getting-started/installation.
- Zustand: editor state and reversible commands. Plain CSS design tokens avoid a utility framework dependency at this scale.
- Vitest: geometry, imperial units, model validation, command history, persistence round trips. ESLint and TypeScript provide static checks.

## Model and geometry

Schema v2 stores immutable projects with stable UUIDs, one floor (elevation), shared junction nodes, wall objects referencing two node IDs, and hosted openings. Coordinates, heights, thicknesses, opening offsets and dimensions are integer ticks; 64 ticks = one inch. Plan X goes right and Y goes down; 3D maps plan X/Y to horizontal X/Z and model elevation to vertical Y. Render conversion is in feet. A typed diagonal rounds each endpoint axis once to the nearest tick; its resulting Euclidean length can differ slightly from the requested length.

Model operations are pure and validated before commit. Wall editing is centralized in `wallEditing.ts`. Body moves project the requested delta onto the wall normal by default; Free translate is explicit. Length edits resolve a selected face/centerline segment with A fixed, B fixed or symmetric motion. Existing horizontal/vertical node equalities propagate through connected walls; edits conflicting with locked walls are rejected. This is not a general nonlinear constraint solver. Quantization bounds error to 1/64 inch per axis. Two-wall junctions receive bounded miter joins. Multi-way intersections and wall layer resolution are Phase 2 work. No destructive Boolean operations are stored in source data.

### Hosted apertures

`floor.openings` stores `{ id, wallId, kind, offset, width, height, sill, hinge, swing }`. Offset is the distance along host centerline from A to the near jamb. `kind` is door/window; hinge is start/end and swing is ±1. Door sill is zero. Host motion/rotation carries the opening without rewriting its local parameters. Host deletion cascades, and command undo restores all objects.

`validateProject` also validates openings. Jambs must lie beyond the miter tips, with one inch of end/pier/header material. Openings on a host cannot overlap along its length, even if their heights differ. Invalid host edits and opening mutations are rejected atomically, not silently clamped. These are geometric rules, not construction sizing.

Plan polygons are clipped at opening stations, then symbols are rendered. `wallSolids` derives full-height wall pieces, sills and overhead portions; `createWallGeometry` extrudes and merges those pieces for both 3D renderers. This removes actual aperture volume. The merge currently retains internal touching faces: it is not a unioned manifold boundary representation. Manufacturing assemblies and door leaves are not modeled.

### Drafting and interaction

`draftPoint` resolves ortho first, then exact-axis endpoints, projected alignment and grid snapping. The UI supplies an 18-pixel acquisition tolerance converted to model units. Without ortho, normal endpoint/grid snapping applies. Typed heading explicitly overrides ortho. First numeric key after a start focuses length; Tab moves to angle and Enter places one segment. Click-drag commits on release; click-click chains remain available. Both typed and clicked placement use `addReferencedWall`, which delegates centerline placement to the existing `addWall` command. Reference-based placement remains tested in the core, but v0.4 uses centerline drawing and whole-wall selection by user request. Degree-one junction markers expose open ends; they are not a general topology validator.

Draft/drag previews stay outside the saved model until committed. Camera zoom preserves the world point under the cursor; wheel deltas are normalized and bounded. Wall properties describe committed geometry during drag previews. Workspace preferences, defaults, camera and command history remain session-local.

## Modules

- `src/core/units.ts`: architectural and decimal metric input, imperial formatting and tick conversions.
- `src/core/wallEditing.ts`: exact wall references, exterior orientation, zoom-aware acquisition, anchored resizing, axis constraint propagation and reference-based wall creation.
- `src/core/model.ts`: schema, validation, pure edits.
- `src/core/geometry.ts`: snapping, footprints, extents, dimension calculations, simple closed-loop area.
- `src/core/drafting.ts`: ortho-safe endpoint/alignment snaps, typed heading, open-end diagnostics and camera helpers.
- `src/core/openings.ts`: hosted mutations/validation, wall stations, clipped plan polygons and derived solids.
- `src/core/mesh.ts`: shared triangle extrusion for GPU and software 3D.
- `src/core/history.ts`: reversible before/after commands (100 entries).
- `src/state/store.ts`: UI state, command dispatch, autosave hooks.
- `src/storage/projects.ts`: versioned JSON, local projects and recovery snapshot.
- `src/ui/PlanCanvas.tsx`: pointer interaction and drafting.
- `src/ui/ModelView.tsx`: extruded footprints, camera and selection.
- `src/ui/SoftwareModel.tsx`: SVG fallback with shared wall meshes; painter ordering and camera reset on model edits remain limitations.
- `src/ui/OpeningSymbol.tsx`: host-relative door/window plan graphics and hit targets.
- `src/ui/Properties.tsx`: explicit, validated numeric edits.
- `src/core/rooms.ts`: independent simple enclosure discovery, polygon hit testing, stable boundary signatures, interior label points and metadata updates.
- `src/core/materials.ts`: finish types, palette and validation.
- `src/core/specifications.ts`: atomic wall specification transaction.
- `src/ui/SpecificationDialogs.tsx`: wall and room drafts with Apply/OK/Cancel; no mutation on blur/cancel.
- `src/ui/Modal.tsx`: focus management, Escape and tab containment.
- `src/ui/CadMenus.tsx`: desktop application menus wired to existing actions.

## Persistence and recovery

Every committed model change synchronously writes a versioned JSON project into browser storage. A separate last-known-good snapshot is written before an existing save is replaced. The active project ID persists for reload. Failures are surfaced; successful in-memory edits are still exportable. Manual JSON export/import allows transfer and durable user backups. Loading an imported file creates a new project identity, preserving existing saves. New projects retain all previously saved projects. If an in-memory project has a save error and retry still fails, switching projects is blocked; beforeunload warns and JSON export remains available. Browser storage is per origin/device and is not cloud synchronization.

`deserialize` migrates schema 1 to 2 in memory by adding an empty openings array, retaining IDs, timestamps and geometry. Schema-1 input containing an openings field is rejected as inconsistent; unsupported future versions and malformed opening references are rejected. Subsequent saves/exports use schema 2; the earlier v0.1 editor cannot read that newer schema. Recovery can load a valid legacy snapshot. Import assigns a new project ID while retaining floor/node/wall/opening IDs within that independent project.

### Additive wall metadata and areas

Schema 2 accepts optional `exteriorSide: 1 | -1`, `wallType: generic | exterior | interior` and `locked: boolean`. Missing fields retain legacy behavior; schema-1/2 files remain readable without altering IDs. The older v0.2 editor does not enforce these new semantics, so it should not be used for locked/reference-aware editing. No wall assembly is implied by classification.

Closed-loop inference determines exterior orientation only when no explicit side is stored. Reverse A/B preserves physical face orientation and remaps hosted aperture stations, hinge and swing. Thickness changes offset the canonical centerline so the chosen supporting reference plane stays fixed; half-tick/angled results quantize to integer coordinate ticks. Face length iteration accepts at most one tick residual or rejects the entire edit.

`closedLoop` orders a single degree-two cycle and rejects crossings. Segment intersection first rejects separated bounding boxes, fixing the recorded false positive for disjoint collinear runs. Centerline area uses the shoelace polygon formula. Interior boundaries choose the corresponding mitered interior footprint edges, require corner agreement, and reject invalid offsets before calculating polygon area. This is deliberately not a bounding-box approximation or a general room-face extractor.

## Expansion boundaries

The next topology layer must split walls transactionally and remap hosted openings without changing their world placement; an opening spanning a split needs an explicit reject/remap rule. Room boundaries should derive from the resulting planar graph, not become a second independent wall model. Future assemblies can reference material definitions and floors can gain per-floor objects. Add explicit schema migrations before accepting new versions. A remote repository needs revisions and conflict handling. AI belongs behind a server secret boundary, generating typed command proposals validated by this core and previewed before application.

## Limits

Single floor; derived centerline wall dimension labels; two-wall miter joins only. Permanent associative dimension entities and layered assemblies are absent. Wall crossings are visually overlapped, not automatically split. No general geometric constraint solver, general room extraction, construction assemblies, roofs, BIM export, structural or code checks. The 3D ground plane is a viewing aid, not a floor assembly. See `../DEVELOPMENT_STATUS.md` for the verified inventory and unresolved defects.

## v0.4 room and material records

`Wall.finishes?` contains `{interior, exterior}`, each `{kind, color}`. Kinds are paint/siding/brick/stone/wood/plaster; colors are validated hex RGB. Missing fields fall back to the legacy wall color. The specification transaction pins the physical exterior sign before an enclosure can change. Mesh normals choose linear RGB vertex colors for the two long surfaces; ends/caps use the legacy edge color. Both Three renderers consume the same colors. No texture or assembly geometry is implied.

`Floor.rooms?` stores `{id, boundaryWallIds, name, roomType, showLabel, notes}`. Geometry is never duplicated in metadata. Detection partitions the existing graph into connected components and accepts only the existing validated simple-cycle interior polygons. A sorted wall-ID signature matches metadata across resize/move operations. Broken/deleted boundaries leave dormant metadata; it cannot be edited as a live room or attached to a different wall set. Undo can restore it. The future topology milestone must explicitly handle split/merge identity; this component approach is not half-edge room extraction.

Room hit testing uses the actual interior polygon. A scanline interior point replaces the old extents midpoint for labels, preventing labels in concave recesses. Label visibility changes no geometry. Room type and notes are metadata only. Independent nonoverlapping enclosures work; connected partitions, nested/overlapping room hierarchies and multi-way joins remain unsupported.

`applyWallSpecification` clones the model, applies valid dimensional changes with existing constraints, then writes classification/finishes/lock and validates the whole result. The UI submits one command only after success. Existing wall and room drafts are local component state; Cancel never submits them. The editor's `specification` discriminator controls the modal and prevents drawing shortcuts from executing behind it.
