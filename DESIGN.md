---
name: Planificador
description: A maker's grid notebook for planning plywood furniture and welded tube projects, from sizes to the yard order.
colors:
  paper: "#f4f7fb"
  paper-night: "#0c1226"
  panel: "#ffffff"
  panel-night: "#121a33"
  raised: "#eef2f8"
  raised-night: "#1b2546"
  ink: "#141a2b"
  ink-night: "#eef2ff"
  ink-soft: "#4a5263"
  ink-soft-night: "#b3bdd6"
  ink-faint: "#5d6576"
  ink-faint-night: "#97a2bf"
  rule: "#dfe5ee"
  rule-night: "#26315a"
  rule-strong: "#b7c2d3"
  rule-strong-night: "#34427a"
  accent: "#2340c8"
  accent-night: "#3d5be8"
  accent-ink: "#2340c8"
  accent-ink-night: "#9fb0ff"
  accent-tint: "#e9edff"
  accent-tint-night: "#1d2a5c"
  hi: "#ffe14d"
  hi-night: "#ffe14d"
  cut: "#d93a2f"
  cut-night: "#ff6b5e"
  cut-ink: "#b8281e"
  cut-ink-night: "#ff8a7f"
  cut-tint: "#fdecea"
  cut-tint-night: "#3a1620"
  ply: "#b5763a"
  ply-night: "#d9a066"
  ply-tint: "#f6e6d2"
  ply-tint-night: "#2a2418"
  ply-deep: "#8a5a25"
  ply-deep-night: "#d9a066"
  grid: "#dcecf7"
  grid-night: "#172245"
  grid-major: "#b3d6ee"
  grid-major-night: "#24356a"
  sheet: "#ffffff"
  sheet-night: "#121a33"
  sheet-edge: "#b7c2d3"
  sheet-edge-night: "#34427a"
  piece: "#f1d4ae"
  piece-night: "#d9a066"
  piece-edge: "#9b6430"
  piece-edge-night: "#9b6430"
  piece-label: "#3a2410"
  piece-label-night: "#1a1206"
  piece-dims: "#6b4b22"
  piece-dims-night: "#eef2ff"
  grain: "#9b6430"
  grain-night: "#6b4b22"
  mark: "#d93a2f"
  mark-night: "#ff6b5e"
  stage-near: "#fbfdff"
  stage-near-night: "#142047"
  stage-far: "#eaf1f8"
  stage-far-night: "#0c1226"
typography:
  display:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.333
    letterSpacing: "-0.01em"
  display-sm:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 800
    lineHeight: 1.556
    letterSpacing: "-0.01em"
  readout:
    fontFamily: "Atkinson Hyperlegible Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "44px"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "tnum"
  title:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.375
  body:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.4
  caption:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.333
  number:
    fontFamily: "Atkinson Hyperlegible Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.5
    fontFeature: "tnum"
  number-sm:
    fontFamily: "Atkinson Hyperlegible Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.333
    fontFeature: "tnum"
rounded:
  md: "6px"
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "20px"
  xl: "28px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.panel}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "40px"
  button-quiet:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink-soft}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "40px"
  chip:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink-soft}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "36px"
  chip-selected:
    backgroundColor: "{colors.accent-tint}"
    textColor: "{colors.accent-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "36px"
  input-number:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.accent-ink}"
    typography: "{typography.number}"
    rounded: "{rounded.lg}"
    padding: "0 8px"
    height: "36px"
  input-number-invalid:
    backgroundColor: "{colors.cut-tint}"
    textColor: "{colors.cut-ink}"
    typography: "{typography.number}"
    rounded: "{rounded.lg}"
  segmented-active:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "36px"
  card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
  step-marker-active:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.panel}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    size: "30px"
  error-pill:
    backgroundColor: "{colors.cut-tint}"
    textColor: "{colors.cut-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "6px 14px"
---

# Design System: Planificador

## Overview

**Creative North Star: "Cuaderno de cuadro"**

The planner is a maker's grid notebook. Every measurement sits on one true-scale cuadrícula, and whatever the maker is working on right now (the active step, the hovered piece, the size being dragged) is swept with a yellow highlighter. The page is notebook-white paper in daylight and ink-blue paper at night. Both themes are first-class. The paper palette is the base and the one print inherits; the night notebook overrides it on screen only.

The density is that of a well-kept notebook page. A 340 px rail of grouped controls sits beside a large stage, cut and order tables run edge to edge in ruled modules, and hairlines (1 px) do the structuring. Ink colours carry meaning and nothing is decorative: ballpoint blue is what you chose or can press, margin red is where you cut or what is wrong, the highlighter is where you are. Numbers are the product, so every measurement is set in a tabular monospace and is the most legible thing on the screen.

The world rejects the category default (a dark CAD stage beside a neutral settings panel) and the "taller nocturno" dark-shop costume it replaced: no amber-on-graphite, no condensed uppercase display, no hard red offset shadows.

**Key Characteristics:**
- Two paper palettes (day and night) on one set of tokens. Components read tokens and never branch on theme.
- The true-scale cuadrícula (20 px cells, a stronger line every 100 px) on work stages only.
- Three inks with fixed jobs: ballpoint (accent), margin red (cut), highlighter (hi).
- Atkinson Hyperlegible Next for words and Atkinson Hyperlegible Mono for numbers.
- Hairline rules, 6–16 px radii, and low, soft shadows only on things that float.

## Colors

A cool notebook palette: blue-white paper, graphite-blue ink, and three pen colours that each do one job. Every token has a day value and a night value (`-night` in the frontmatter). Text pairs measure at least 5.0:1 in both themes.

### Primary
- **Ballpoint Blue** (`accent` / `accent-night`): fills and borders for selection and primary actions, including the Exportar PDF button, the selected chip and template, the active step marker, the slider's filled track and thumb ring, the focus outline, and the true-scale length bars in piece tables. White text sits on its fill.
- **Ballpoint Ink** (`accent-ink` / `accent-ink-night`): the same blue used as text, for editable values, dimension numbers, the live readout, links and selected labels. At night it lifts to a pale periwinkle so it stays legible on ink-blue paper.
- **Ballpoint Wash** (`accent-tint` / `accent-tint-night`): the ground behind a selected chip, template row or active step card.

### Secondary
- **Highlighter Yellow** (`hi`, the same in both themes): the active step's title, the dimension being dragged (its line in 3D and its number), and the piece row lit by hovering. It always sits under the dark ink (#141a2b), never under light text. By day it is a marker stroke across the lower half of the line. At night it becomes a solid 3 px-radius swatch, because a half-height stroke disappears on dark paper.

### Tertiary
- **Margin Red** (`cut` / `cut-night`): saw cuts and cut marks on the sheet diagrams, the invalid slider thumb and field border, and the single 1 px margin rule between rail and stage on desktop, which is the red margin line of a notebook page.
- **Margin Red Ink** (`cut-ink` / `cut-ink-night`): error text, invalid values, the stale-model pill and cut numbers in the saw lists.
- **Margin Red Wash** (`cut-tint` / `cut-tint-night`): grounds for error blocks, invalid fields and the stale-model pill.

### Neutral
- **Notebook Paper** (`paper` / `paper-night`): the page itself. Print rebinds it to true white.
- **Sheet White** (`panel` / `panel-night`): the top bar, rail, summary strip, cards and floating overlays.
- **Raised Paper** (`raised` / `raised-night`): number-field wells, the segmented control's track, and hover grounds.
- **Graphite Ink** (`ink` / `ink-night`): body text and numbers.
- **Pencil** (`ink-soft` / `ink-soft-night`): secondary text, inactive tabs and descriptions.
- **Faint Pencil** (`ink-faint` / `ink-faint-night`): units, slider min and max, and summary labels. It is still at least 5:1 on every surface.
- **Hairline** (`rule` / `rule-night`) and **Ruled Line** (`rule-strong` / `rule-strong-night`): dividers, card borders and inactive chip borders, with the stronger line for table heads, hover borders and the inactive step marker.
- **Cuadrícula** (`grid`, `grid-major`, with night values): the minor and major grid lines on work stages. The 3D floor grid mirrors them in Viewer3D's PALETTE.
- **Stage Light** (`stage-near`, `stage-far`): the ground of work stages and the 3D backdrop gradient.

### Wood and diagram tokens
- **Plywood** (`ply`, `ply-tint`, `ply-deep`): wood in legends and swatches.
- **Diagram set** (`sheet`, `sheet-edge`, `piece`, `piece-edge`, `piece-label`, `piece-dims`, `grain`, `mark`): the cut-diagram SVG is filled only through these, so one markup re-skins per theme and per medium.

### Named Rules
**The Three Inks Rule.** Ballpoint is for what you chose or can press. Margin red is for cuts, errors and invalid states, plus the notebook's one margin rule. The highlighter is for where you are right now: the active step or piece and the dimension being dragged. No ink is ever used for decoration.

**The Ink-Token Rule.** Coloured text always uses the `-ink` token (`accent-ink`, `cut-ink`), never the fill token, because only the ink values hold 5:1 in both themes.

**The Two-Palette Rule.** A new colour token goes into both the `@theme` block and the screen-only night override, never into print. WebGL cannot read CSS variables, so Viewer3D's PALETTE mirrors the palette per theme and is the only place a component knows the theme.

## Typography

**Display Font:** Atkinson Hyperlegible Next (with ui-sans-serif, system-ui)
**Body Font:** Atkinson Hyperlegible Next (with ui-sans-serif, system-ui)
**Label/Mono Font:** Atkinson Hyperlegible Mono (with ui-monospace, SFMono-Regular)

**Character:** One family built for legibility in poor conditions, set heavy for headings and plain for reading. Its mono twin carries every number with tabular figures so measurement columns line up. The voice is a clear hand in a notebook, never a drafting stencil.

### Hierarchy
- **Display** (800, 24px, 1.33, -0.01em, sentence case): view headings such as Plan de corte and Pedido para maderería. At 18px it sets the wordmark. Print headings run 30px.
- **Readout** (Mono 700, 44px, 1): the live number that rides over the stage while a size is dragged, in ballpoint ink with its unit in pencil at 18px.
- **Title** (700, 16px, 1.375): step titles and template names (15px in the rail).
- **Body** (400, 15px, 1.5): the base size. Descriptions use 14px at a relaxed 1.625.
- **Label** (600–700, 13px): field labels, `.rule-label` section heads (bold, pencil, followed by a hairline to the edge) and chip text.
- **Caption** (600, 12px): summary labels, phone tab labels and units.
- **Numbers** (Mono, 12–20px, tabular): table measurements at 12px, editable values at 15px bold, summary figures at 18–20px bold.

### Named Rules
**The Mono-Means-Measurement Rule.** The mono face is only for numbers, measurements and piece codes (L1, A2). Words, sentences and labels are set in the sans, even when they sit in a numeric table.

**The Sentence-Case Rule.** No uppercase tracked labels anywhere. Hierarchy comes from weight and size, and section heads are bold sentence case followed by a hairline.

**The 11 px Floor.** No screen text is under 11px. The 11px size is reserved for slider bounds and fine print. Only the print report goes smaller (10px table heads).

## Layout

- **Desktop (lg, 1024px and up):** a 64px sticky top bar holds the mark, the Madera|Metal segmented control, the four view tabs, the theme toggle and Exportar PDF. Below it, a 340px rail with 20px padding scrolls independently beside a stage that fills the rest of the viewport (`h-dvh`). The rail is separated from the stage by the 1 px margin-red rule.
- **Phone:** the top bar stays. The Diseño stage takes 58dvh with the rail's controls below it. The view tabs move to a 64px bottom bar with 20px line icons above their labels, padded for the safe area. Templates become a horizontally scrolling chip row.
- **Rhythm:** a 4px base. Control gaps run 6–8px, field stacks 20px, and section breaks 28px. A summary strip of four ruled cells closes the design stage.
- **The cuadrícula:** 20px minor cells with a major line every 100px, on work stages only (cut sheets and bar plans). In 3D the floor grid is a true 100 mm square, labelled by a scale bar ("Cuadro de 100 mm").
- **Tables:** order and cut tables run edge to edge in ruled rows (1px `rule`, a `rule-strong` head line) with right-aligned numeric columns. Each piece row carries a 4px true-scale length bar.

## Elevation & Depth

The system is flat, layered by tone: paper, then sheet white, then raised paper, divided by hairlines. Shadows are low, soft and short, used only on things that float over a stage or sit on top of a control: the readout, the stale pill, dimension labels, cut sheets on the grid, the segmented control's active segment, and the primary button. All are graphite-tinted (rgb 20 26 43) with 1–2px offsets.

### Shadow Vocabulary
- **Contact** (`box-shadow: 0 1px 2px rgb(20 26 43 / 0.2)`): the primary button and toggle knob.
- **Lift** (`box-shadow: 0 1px 3px rgb(20 26 43 / 0.16)`): the active segment and dimension labels.
- **Float** (`box-shadow: 0 2px 8px rgb(20 26 43 / 0.12)`): overlays on the stage, such as the readout and demo captions.
- **Sheet** (`box-shadow: 0 2px 10px rgb(20 26 43 / 0.12)`): a cut sheet lying on the cuadrícula.

### Named Rules
**The Soft-Only Rule.** Shadows have a zero x-offset, at most a 2px y-offset and a blur at least as large as that offset. No hard offset shadows and no glows. Selection is drawn with ink (border, wash, fill), never with a shadow.

## Shapes

Gently rounded and consistent. Badges and the cut-sheet SVG use 6px. Buttons, chips, fields and thumbnails use 8px. Cards, step rows and floating panels use 12px. The cut-plan stage uses 16px. Pills, step markers, swatches, toggles and the slider thumb are fully round. Borders are always 1px hairlines. The only 2px lines are the desktop active-tab underline, the slider thumb ring and the focus outline. Icons are hand-drawn line SVGs with round caps and joins at 1.4–1.6 stroke. Template thumbnails are line drawings in the same weight.

## Components

### Buttons
- **Shape:** gently rounded (8px), 40px tall.
- **Primary:** a ballpoint fill with white bold 14px text and a line icon, padded 0 16px, with the Contact shadow. Hover brightens the fill (`brightness(1.1)`). There is one primary action per bar (Exportar PDF).
- **Quiet:** a hairline border with pencil text that darkens to graphite on hover (border to `rule-strong`). Used for the theme toggle and Vista general.
- **Focus:** a 2px ballpoint outline at a 2px offset, everywhere.

### Chips
- **Style:** 36px (40px on phones), 8px radius, 13px semibold text, a hairline border and pencil text. An optional round swatch at 14px with a faint ink ring.
- **State:** selected chips take a ballpoint border, ballpoint wash and ballpoint ink (`aria-pressed`). Step part tags are 6px-radius 12px labels on raised paper.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** sheet white on paper.
- **Shadow Strategy:** none at rest (see Elevation & Depth).
- **Border:** a 1px hairline.
- **Internal Padding:** 12–20px.

### Inputs / Fields
- **Number field:** a raised-paper well with an 8px radius and hairline border, holding a right-aligned 15px bold mono value in ballpoint ink and its unit in faint pencil. No spinner chrome. Focus turns the border ballpoint.
- **Slider:** a 4px hairline track filled in ballpoint up to the thumb (`--fill`), with a 20px round thumb ringed 2px in ballpoint that scales to 1.15 while dragged. Its min and max sit below in 11px mono.
- **Error:** the field turns to the red wash with red ink, the thumb ring turns red, and the message appears under the field as 13px red-ink text with a line warning icon. Cross-field issues collect in a 12px-radius red-wash block.
- **Toggle:** a 40 × 24 round track (`rule-strong`, ballpoint when on) with a sheet-white knob.

### Navigation
- **Segmented control (Madera|Metal):** a raised-paper track with a 12px radius. The active segment is sheet white with graphite text, the Lift shadow and its icon in ballpoint ink.
- **View tabs:** on desktop, 15px bold pencil labels; the active tab turns graphite with a 2px ballpoint underline. On phones, a bottom bar of icon over 12px label; the active tab turns ballpoint ink. Arrow keys, Home and End move between tabs.

### Live Readout (signature)
While a size is dragged, a sheet-white panel (12px radius, Float shadow) appears top-left of the stage. It shows the field label at 13px and the value in the 44px Readout style, and lingers 700ms after the last change. At the same moment the matching dimension line on the model turns highlighter and thickens from 1.5 to 3.

### Step List (signature)
Numbered 30px round markers hang on a 1px vertical rule. The active step's marker fills ballpoint with white mono numerals, its card takes the ballpoint wash and its title is swept with the highlighter. In 3D, the step's parts turn highlighter and everything else turns a pencil ghost.

### Cut Sheets (signature)
Sheets lie on the cuadrícula with the Sheet shadow. Pieces are drawn in the wood diagram tokens with grain lines and numbered red cut badges. Hovering a piece row lights the piece on the sheet with the highlighter, and lights the row too. The row must keep the 5:1 text floor in both themes, so it cannot be a translucent wash at night.

## Do's and Don'ts

### Do:
- **Do** use ballpoint (`accent`) for selection and primary actions, and `accent-ink` whenever that blue is text.
- **Do** use the highlighter (`hi`) only for the active step or piece and the dimension being dragged, always under #141a2b text.
- **Do** keep margin red (`cut`) for cuts, errors and invalid states. The 1 px rail margin rule is the one structural use.
- **Do** set every number and measurement in Atkinson Hyperlegible Mono with tabular figures.
- **Do** put the cuadrícula (`.stage-grid`) on work stages only: cut sheets, bar plans and the 3D floor.
- **Do** add every new colour token to both the paper `@theme` block and the night override, and mirror it in Viewer3D's PALETTE if WebGL needs it.
- **Do** keep screen text at 11px or larger and every text pair at 5:1 or better in both themes.

### Don't:
- **Don't** use hard offset shadows; shadows stay soft, short and graphite-tinted.
- **Don't** put coloured side stripes on callouts; errors use a full red wash with a line icon.
- **Don't** use uppercase tracked labels or eyebrow kickers; section heads are bold sentence case with a hairline.
- **Don't** set words or sentences in the mono face.
- **Don't** use red for focus, selection or emphasis.
- **Don't** colour text with a fill token (`accent`, `cut`); use the `-ink` token.
- **Don't** lay the cuadrícula behind forms, lists or chrome.
- **Don't** read the theme in a component; read tokens.
