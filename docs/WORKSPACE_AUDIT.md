# Studline workspace audit

The baseline was the running v0.4 application at source revision 0e61d82. The functional reference was the official [Chief Architect Premier X18 Reference Manual](https://cloud.chiefarchitect.com/1/pdf/documentation/chief-architect-x18-reference-manual.pdf), particularly menus and side windows (17–19), grouped toolbars and selection editing (158–159), view management (175–187), and layer locking (208). Existing wall and dimension workflows are covered in the Chief Architect feature matrix.

| Area | v0.4 baseline | v0.5 workspace |
| --- | --- | --- |
| Menus and tools | Basic menus and a flat side list | CAD and Window menus, shortcut hints, expandable architectural groups |
| Object editing | Canvas handles, properties and specification dialogs | Selection toolbar with move, length, angle, reversal, reference and specifications. Opening controls change with the selection. |
| Draft feedback | Exact length and heading form near the start point | Compact input near the active wall with typed preview, existing snap guides and endpoint feedback |
| Navigation | Object counts and room links | Searchable wall and opening rows, room specifications, saved plan presets and camera links |
| Layers | Grid and dimension toggles | Category visibility and model edit locks |
| Views and layout | Plan/model toggle and fixed docks | Tabs, plan and 3D split views, orthographic projection and persistent dock sizes |

[Before workspace](studline-v04-workspace.jpg) · [After workspace](studline-v05-workspace.jpg) · [Floating measurement entry](studline-v05-wall-entry.jpg)

In Chromium at 1363 × 936, verified the Walls group, browser selection, a 24′ to 26′ wall resize, wall reversal and specifications, an 8′ wall at 90°, layer visibility in the plan and 3D, a blocked locked-wall edit, split views, orthographic rendering, and project save/reload and reopen. The compatibility renderer was active in this browser.

Studline supports one floor per project. Plan presets store layer settings in the browser. Doors and windows can be hidden as plan symbols while their physical apertures remain in 3D. Stairs, foundations, roofs, cabinets, general CAD primitives, elevations and sections are marked as planned.
