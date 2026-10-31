---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: ["src/index.css","src/components"]
---

# Planner app shell (web)

Scope: the whole web app shell and its four views in both modes (Madera, Metal): Diseño, Cortes, Pasos, Pedido/Compras, plus the PDF print report. Visitor mode: Operate.

Audience and task: a first-time maker plans a piece on a laptop, then follows cuts, steps and the store list on a phone at the bench or store counter. Success: sizes set with confidence, an order the yard can cut as written, steps followed without guessing.

Constraints: light and dark themes with a toggle; Spanish (es-MX) copy; web only this pass (iOS later); approved dependencies only; WCAG AA in both themes; no screen text under 11 px.

Memorable moment: dragging a size makes its number ride over the stage at display size while the model moves on the true-scale grid; the active step or piece is swept with a highlighter.

Raises kept from declined challengers:
- Dense web: order and cut tables run edge to edge in ruled modules, dense but legible.
- Labanotation: every piece row carries a true-scale length bar.
- Centre rail: one-device-pixel rules; states drawn as marks (filled, outlined, struck), never glows.
- Doujin catalog: list and map are one space; hovering a numbered piece lights it on the sheet or bar.
- Variable-font specimen: one enormous live number while dragging.

## Direction contract

THESIS: The planner is a maker's grid notebook. Every measurement sits on one true-scale cuadrícula, and the active piece or step is swept with a highlighter. It refuses the category default (a dark CAD stage beside a neutral settings panel) and the previous dark-shop costume.

OWN-WORLD:
- Notebook-white paper, with a cyan 100 mm cuadrícula on the work stages only.
- Ballpoint blue for selection, primary actions and dimensions; highlighter yellow for the active piece or step; margin red only for cuts and errors; pencil graphite for secondary text.
- The night theme is ink-blue paper with a faint grid.
- Atkinson Hyperlegible Next for the UI and Atkinson Hyperlegible Mono for every number.
- One-pixel hairlines, 8–14 px radii, soft offset shadows only.

STORY: A beginner sees the piece standing on a measurable page and drags a size; the number and the model change together. They follow cuts, steps and the store list without leaving the notebook, and take the order to the counter.

FIRST VIEWPORT:
- Desktop: a 64 px top bar with the mark and Planificador, the Madera|Metal segmented control, the four view tabs, the theme toggle, and Exportar PDF as the primary action.
- The 340 px rail holds the template list with line-drawn thumbnails, then grouped params with chips and editable values. A 1 px red margin rule separates rail from stage.
- The stage fills the rest on the cuadrícula: the model in the centre, a scale bar top right, the live readout top left while dragging, and a summary strip at the bottom.
- Phone: top bar, then the stage at 55vh, params below, and the tabs as a bottom bar.

FORM: Cuaderno de cuadro, position 4 on my ordered list; seed:c7366e989d7bbbd5

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
