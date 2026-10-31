# Welding projects (Metal mode)

## Intent

A second workshop next to the board furniture: beginner metal projects built from square structural tube (PTR), welded at home. Same promise as the wood side: pick a template, change sizes within safe limits, and get every output from one pure `generate()`. The outputs are a 3D model in the final color, a bar cut plan, interactive build steps with a tool demo, machine settings, a shopping list and suggestions.

## Decisions

- **One app, two modes.** A Madera | Metal switch in the sidebar. Both modes share the shell, `ParamForm`, `TemplatePicker`, `StepsPanel` (now generic over `Step`) and `Viewer3D` (now takes `{ placements, fittings? }`, an optional `finish` and scene `children`). Tabs in Metal mode: Diseño (3D + ajuste), Cortes (tramos), Pasos (demostración), Compras (lista).
- **Engine in `src/engine/welding/`**, pure TS like the rest, so the native app can adopt it unchanged. `WeldTemplate.generate(params) => WeldResult` (`ok`/`issues`, never throws for validation).
- **Square tube only.** A PTR member is an axis-aligned box, so `Placement` renders it exactly. Angle, flat bar and round tube come later as catalog entries plus a renderer for their shapes.
- **Templates:** Mesa de PTR, Banco alto and Estante industrial. All are four legs plus rectangular frames: either a frame on the legs (`cap`, with butt or 45° corners) or frames between them (`levels`).
- **Params:** dimensions, tube size, wall gauge (calibre), corner joint, lower frame or footrest, welding process (MIG sin gas, MIG con gas, Electrodo, TIG) and final color. Ids are stored in params, so never renumber them.
- **Validation:** a size/gauge combination that is not sold, and shelves closer than 200 mm apart.
- **Cut plan:** first-fit decreasing over 6.10 m bars. 10 mm squares each mill end, 3 mm kerf after every piece, and the leftover is reported. Each piece is measured from the fresh end.
- **Machine settings** (`weldSettings`):
  - MIG, flux and TIG: about 39 A per mm of wall (1 A per thousandth of an inch), with a ±10 % range.
  - Stick: an E6013 electrode chosen by wall, at 3/32" or 1/8".
  - Each process also gives its wire or electrode, polarity (flux runs electrode negative), gas and technique.
  - The UI says to test on a scrap of the same tube first. That test is the real calibration.
- **Suggestions** are condition-based, so the defaults raise no warnings. Each has a `fix` (several params at once) that the sidebar applies in one click. They cover:
  - thin wall with stick;
  - miters with stick;
  - TIG for a beginner;
  - more amps than a 127 V machine gives;
  - sag on long rails;
  - racking on tall legs without a lower frame;
  - a stool that can tip over;
  - anchoring tall shelving to the wall;
  - rust on bare steel;
  - weight.
- **Tool demo:** each `WeldStep` may carry a `ToolAction` (`kind`, `from`, `to`, `normal`). The web viewer draws a primitive grinder, torch, tape or spray gun moving along that path, with sparks and arc glow, and `FocusRig` flies the camera to it. Reduced motion freezes it mid-path.
- **Shopping list:**
  - bars and kg;
  - consumable quantity at 2× the bead deposit, to cover practice;
  - gas tank, tips and anti-spatter;
  - cut-off and flap discs;
  - primer and enamel (or clear coat) in liters and in spray cans;
  - thinner and a respirator.

  Tools and safety gear are listed separately, and the whole list shares as plain text. There are no prices: they come from the user, as on the wood side, and are left for later.
- **PDF:** `WeldPrintReport` prints the settings, cut plan, shopping list and steps.

## Shop-true 3D

The model must match what gets cut and welded, so nobody is surprised at the bench.

- **Tube:** hollow, with its real wall for the gauge and rounded corners (outer radius 2 × wall).
- **Lengths:** every piece is drawn exactly as long as its cut-list length.
- **Miters:** a mitered rail runs to its long points, and its ends lean back 45° from the outer face. Two rails meeting at a corner share one cut plane (`endPlane`).
- **Beads:** a fillet runs all round each welded tube end, where the joint is. Their count is the joint count, and their perimeters give the bead length; a 45° seam crosses two faces diagonally.
- **Plugs:** every open end gets a plastic plug. This covers the feet, the open ends of square-cut top rails and the open leg tops of a shelf. Plugs are bought in the shopping list and tapped in after painting.
- **Steps:**
  - beads appear from the welding step on, and the weld and grind steps light them;
  - plugs appear from the paint step;
  - the cut demo's disc stands on the real 45° plane.

## Not yet

- Native app screens for Metal mode (the engine is already shared).
- Prices and cost.
- Angle, flat bar and round profiles; gates, railings and brackets.
- Wood joinery in 3D (screws, hinge boring, slides at their real positions).
