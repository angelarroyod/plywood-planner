repo: angelarroyod/plywood-planner
branch: main

## Last sync
date: 2026-09-04T00:00:00Z

### Updated in this project
- Ported `src/engine/*` (templates, nesting, validation) to browser JS as `engine.js` — same span limits, FFDH nesting and Spanish validation copy.
- Recreated the desktop planner UI as `Planificador Escritorio.dc.html` (sidebar params, 3D view, cut plan, assembly steps).
- Designed the iOS app `Planificador Móvil.dc.html` on top of the same engine: onboarding, projects, template picker, measurements, camera measure, 3D, cut checklist, assembly steps, share sheet.
- Two navigation models (bottom tabs / wizard) and two 3D presentations (immersive / card) switchable in the design.

## Screen map
| Screen | Built from |
| --- | --- |
| Desktop recreation — sidebar (plantilla + medidas) | src/components/TemplatePicker.tsx, src/components/ParamForm.tsx, src/engine/validation.ts |
| Desktop recreation — 3D view | src/components/Viewer3D.tsx, src/engine/templates/*.ts |
| Desktop recreation — cut plan | src/components/CutDiagram.tsx, src/components/SheetSvg.tsx, src/engine/nesting.ts |
| Desktop recreation — steps | src/components/StepsPanel.tsx, src/engine/templates/*.ts (steps) |
| Mobile — plantillas | src/engine/templates/bookshelf.ts, src/engine/templates/side-table.ts |
| Mobile — medidas + validación | src/engine/validation.ts, src/engine/types.ts (ParamSpec) |
| Mobile — cortes + checklist | src/engine/nesting.ts, src/components/SheetSvg.tsx |
| Mobile — pasos de armado | src/engine/templates/*.ts (steps, explodeOffsets) |
| Mobile — lista de compras | src/components/labels.ts (HARDWARE_LABELS), src/engine/types.ts (Hardware) |
