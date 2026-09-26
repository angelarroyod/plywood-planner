# Phase 5.2 Drawers + TV Stand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable drawer building block (telescopic slides, a screwed box and a separate front) and use it for a "Cajones" option on the closet and in a new "Mueble para TV" template with two bays.

**Architecture:**
- **Engine additions:**
  - `src/engine/parts/drawer.ts` returns the same fragment shape as the door block, now named `PartSet`.
  - `mergeHardware` collapses equal hardware lines when a template combines fragments.
  - `spanishList` moves to the engine's shared copy helpers.
- **Templates:**
  - The closet gains a drawer zone under a fixed shelf, with the doors above it.
  - The TV stand is a new template: two bays split by a divider.
- **Clients:** they need no component changes, because drawers are ordinary panels, placements, fittings, hardware and steps.

**Tech Stack:**
- TypeScript (strict) and Vitest.
- Web: React 18, Vite, Tailwind v4 and @react-three/fiber, with pnpm at the repo root.
- iOS: Expo SDK 57, with npm in `mobile/`.

**Spec:** `docs/superpowers/specs/2026-09-25-drawers-tv-stand-design.md`

## Global Constraints

- `src/engine/` is pure TypeScript: ZERO imports from React, DOM APIs or three.js. The iOS app imports it unchanged through `mobile/src/lib/engine.ts`.
- UI copy is Spanish (es-MX). Code, comments and commit messages are English. Use Conventional Commits.
- No new dependencies. All internal units are millimetres.
- `generate()` returns a `GenerateResult` envelope and never throws for validation. Issue messages are Spanish, human-readable, and carry `paramKey` when tied to one input.
- A panel's `length` is its grain direction ("largo" at the lumber yard).
- Every template must produce panels that fit a 1220 × 2440 sheet within its param limits.
- Never renumber stock ids.
- Front gaps:
  - fronts inside a block are 3 mm apart;
  - every front keeps 2 mm to the edge of the area it covers, so neighbouring blocks sit 4 mm apart.
- Work on the local branch `feat/drawers`. Never push or contact a remote.
- End every commit message with a `Co-Authored-By:` trailer naming the model that wrote it, e.g. `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Verification:
  - At the repo root: `pnpm test`, `pnpm typecheck`, `pnpm demo`.
  - In `mobile/`: `npx tsc --noEmit`, and `npx expo export --platform ios --output-dir <a temp dir>`.
- On Windows the Bash tool is Git Bash. `cd` to `C:\Users\angel\Claude\Projects\plywood-planner` or use absolute paths.

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `src/engine/types.ts` | modify | `Hardware.type` gains `'slide'` |
| `src/engine/labels.ts` | modify | `HARDWARE_LABELS.slide`, `spanishList` (moved from the closet) |
| `src/engine/labels.test.ts` | create | `spanishList` test |
| `src/engine/parts/merge.ts` | create | `PartSet`, `mergeHardware` |
| `src/engine/parts/merge.test.ts` | create | `mergeHardware` tests |
| `src/engine/parts/door.ts` | modify | returns `PartSet` (`DoorSet` removed) |
| `src/engine/parts/drawer.ts` | create | `SLIDES`, `MIN_DRAWER_FRONT`, `slideFor`, `drawerFrontHeight`, `DrawerStack`, `DrawerSetOptions`, `drawerSet` |
| `src/engine/parts/drawer.test.ts` | create | drawer block tests |
| `src/engine/templates/closet.ts` | modify | `drawers` param, drawer zone, merged hardware |
| `src/engine/templates/closet.test.ts` | modify | drawer tests, sweep with drawers |
| `src/engine/templates/testing.ts` | create | `overlappingBoxes` test helper (pure; not exported from the engine index) |
| `src/engine/templates/tv-stand.ts` | create | "Mueble para TV" template |
| `src/engine/templates/tv-stand.test.ts` | create | TV stand tests |
| `src/engine/templates/templates.test.ts` | modify | shared invariants include the TV stand |
| `src/engine/order.test.ts` | modify | TV stand order line |
| `src/engine/index.ts` | modify | exports and template registry |
| `mobile/src/app/templates.tsx` | modify | `KIND['tv-stand']` |
| `CLAUDE.md`, the 5.2 spec | modify | conventions, status, spec refinements |

---

### Task 1: Drawer building block

**Files:**
- Modify: `src/engine/types.ts`, `src/engine/labels.ts`, `src/engine/parts/door.ts`, `src/engine/index.ts`
- Create: `src/engine/parts/merge.ts`, `src/engine/parts/merge.test.ts`, `src/engine/parts/drawer.ts`, `src/engine/parts/drawer.test.ts`

**Interfaces:**
- Consumes (existing): `bandEdges`, `NO_EDGES` (`../edge-banding.ts`); `FIBRACEL_3` (`../stock.ts`); the types `EdgeBandingMode`, `Fitting`, `Hardware`, `Panel`, `Placement`, `Step`, `Stock`, `Vec3`, `Boring` (`../types.ts`).
- Produces (Tasks 2–3 rely on these):
  - `interface PartSet { panels: Panel[]; placements: Placement[]; hardware: Hardware[]; fittings: Fitting[]; boring: Boring[]; steps: Omit<Step, 'order'>[] }` in `src/engine/parts/merge.ts`.
  - `mergeHardware(items: Hardware[]): Hardware[]` in `src/engine/parts/merge.ts`.
  - `doorSet(o: DoorSetOptions): PartSet`.
  - In `src/engine/parts/drawer.ts`:
    - `SLIDES: { inches: number; mm: number }[]`
    - `MIN_DRAWER_FRONT = 120`
    - `slideFor(depth: number): { inches: number; mm: number } | null`
    - `drawerFrontHeight(count: number, bottom: number, top: number): number`
    - `interface DrawerStack { frontLeft; frontRight; openingLeft; openingRight }`
    - `interface DrawerSetOptions { count: number; stacks: DrawerStack[]; bottom: number; top: number; frontZ: number; depth: number; stock: Stock; mode: EdgeBandingMode }`
    - `drawerSet(o: DrawerSetOptions): PartSet`
  - Panel ids `'drawer-front' | 'drawer-side' | 'drawer-end' | 'drawer-bottom'`, and fitting id `'drawer-handle'`.
  - Hardware: type `'slide'`, labelled `'Corredera telescópica (par)'`.

- [ ] **Step 1: Write the failing tests**

Create `src/engine/parts/merge.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mergeHardware } from './merge.ts';
import type { Hardware } from '../types.ts';

describe('mergeHardware', () => {
  it('sums equal items and keeps first-seen order', () => {
    expect(
      mergeHardware([
        { type: 'confirmat', size: '5x50', qty: 18 },
        { type: 'screw', size: '3.5x16', qty: 24 },
        { type: 'confirmat', size: '5x50', qty: 16 },
        { type: 'screw', size: '3.5x25', qty: 8 },
        { type: 'screw', size: '3.5x16', qty: 28 },
      ]),
    ).toEqual([
      { type: 'confirmat', size: '5x50', qty: 34 },
      { type: 'screw', size: '3.5x16', qty: 52 },
      { type: 'screw', size: '3.5x25', qty: 8 },
    ]);
  });

  it('keeps items cut to different lengths apart', () => {
    expect(
      mergeHardware([
        { type: 'rod', size: '15×30 mm', qty: 1, cutTo: 762 },
        { type: 'rod', size: '15×30 mm', qty: 1, cutTo: 562 },
        { type: 'rod', size: '15×30 mm', qty: 1, cutTo: 762 },
      ]),
    ).toEqual([
      { type: 'rod', size: '15×30 mm', qty: 2, cutTo: 762 },
      { type: 'rod', size: '15×30 mm', qty: 1, cutTo: 562 },
    ]);
  });

  it('leaves the items it was given untouched', () => {
    const items: Hardware[] = [
      { type: 'screw', size: '3.5x16', qty: 1 },
      { type: 'screw', size: '3.5x16', qty: 2 },
    ];
    mergeHardware(items);
    expect(items[0]!.qty).toBe(1);
  });
});
```

Create `src/engine/parts/drawer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MIN_DRAWER_FRONT, drawerFrontHeight, drawerSet, slideFor, type DrawerSetOptions } from './drawer.ts';
import { FIBRACEL_3, getStock } from '../stock.ts';
import { NO_EDGES } from '../edge-banding.ts';

const PLY18 = getStock(3);
// The spec's closet example: 800 wide, 2 drawers from the zoclo (70) to the drawer shelf's centre (477), front at z = 275.
const CLOSET: DrawerSetOptions = {
  count: 2,
  stacks: [{ frontLeft: -398, frontRight: 398, openingLeft: -382, openingRight: 382 }],
  bottom: 70,
  top: 477,
  frontZ: 275,
  depth: 547,
  stock: PLY18,
  mode: 'yard',
};
// The TV stand default (1400 × 500 × 400) with drawers in both bays.
const TV_BOTH: DrawerSetOptions = {
  count: 2,
  stacks: [
    { frontLeft: -698, frontRight: -2, openingLeft: -682, openingRight: -9 },
    { frontLeft: 2, frontRight: 698, openingLeft: 9, openingRight: 682 },
  ],
  bottom: 70,
  top: 500,
  frontZ: 200,
  depth: 397,
  stock: PLY18,
  mode: 'yard',
};

describe('slideFor', () => {
  it('picks the longest telescopic slide that leaves 10 mm behind it', () => {
    expect(slideFor(264)).toEqual({ inches: 10, mm: 254 });
    expect(slideFor(263)).toBeNull();
    expect(slideFor(567)).toEqual({ inches: 20, mm: 508 });
    expect(slideFor(569)).toEqual({ inches: 22, mm: 559 });
  });
});

describe('drawerFrontHeight', () => {
  it('leaves 2 mm at the ends and 3 mm between fronts, rounding down', () => {
    expect(drawerFrontHeight(1, 70, 477)).toBe(403);
    expect(drawerFrontHeight(2, 70, 477)).toBe(200);
    expect(drawerFrontHeight(3, 70, 400)).toBe(106);
    expect(MIN_DRAWER_FRONT).toBe(120);
  });
});

describe('drawerSet', () => {
  it('cuts a banded front, two sides, two ends and a Fibracel bottom per drawer', () => {
    const { panels } = drawerSet(CLOSET);
    expect(panels.map((p) => [p.id, p.label, p.length, p.width, p.qty, p.stock.id, p.grain])).toEqual([
      ['drawer-front', 'Frente de cajón', 796, 200, 2, 3, 'length'],
      ['drawer-side', 'Costado de cajón', 508, 160, 4, 3, 'length'],
      ['drawer-end', 'Frente y trasera de cajón', 702, 160, 4, 3, 'length'],
      ['drawer-bottom', 'Fondo de cajón', 508, 738, 2, FIBRACEL_3.id, 'any'],
    ]);
    expect(panels[0]!.edges).toEqual({ L1: true, L2: true, A1: true, A2: true });
    for (const p of panels.slice(1)) expect(p.edges).toEqual(NO_EDGES);
  });

  it('draws each drawer pulled out a third of its slide, with the box centred on its front', () => {
    const { placements } = drawerSet(CLOSET);
    expect(placements.slice(0, 6)).toEqual([
      { panelId: 'drawer-front', instance: 0, position: [0, 172, 453], size: [796, 200, 18] },
      { panelId: 'drawer-side', instance: 0, position: [-360, 172, 190], size: [18, 160, 508] },
      { panelId: 'drawer-side', instance: 1, position: [360, 172, 190], size: [18, 160, 508] },
      { panelId: 'drawer-end', instance: 0, position: [0, 172, 435], size: [702, 160, 18] },
      { panelId: 'drawer-end', instance: 1, position: [0, 172, -55], size: [702, 160, 18] },
      { panelId: 'drawer-bottom', instance: 0, position: [0, 90.5, 190], size: [738, 3, 508] },
    ]);
    expect(placements.filter((p) => p.panelId === 'drawer-front').map((p) => p.position[1])).toEqual([172, 375]);
  });

  it('builds two stacks side by side from one set of panels', () => {
    const d = drawerSet(TV_BOTH);
    expect(d.panels.map((p) => [p.id, p.length, p.width, p.qty])).toEqual([
      ['drawer-front', 696, 211, 4],
      ['drawer-side', 356, 171, 8],
      ['drawer-end', 611, 171, 8],
      ['drawer-bottom', 356, 647, 4],
    ]);
    expect(
      d.placements.filter((p) => p.panelId === 'drawer-front').map((p) => [p.instance, p.position[0], p.position[1]]),
    ).toEqual([
      [0, -350, 177.5],
      [1, -350, 391.5],
      [2, 350, 177.5],
      [3, 350, 391.5],
    ]);
    // 13 mm of slide room on both sides of every box
    expect(d.placements.filter((p) => p.panelId === 'drawer-side').map((p) => p.position[0])).toEqual([
      -660, -31, -660, -31, 31, 660, 31, 660,
    ]);
  });

  it('puts a handle on each front and buys hardware per drawer', () => {
    const d = drawerSet(CLOSET);
    expect(d.fittings).toEqual([
      { id: 'drawer-handle', instance: 0, label: 'Jaladera', position: [0, 172, 477], size: [160, 12, 30] },
      { id: 'drawer-handle', instance: 1, label: 'Jaladera', position: [0, 375, 477], size: [160, 12, 30] },
    ]);
    expect(d.hardware).toEqual([
      { type: 'confirmat', size: '5x50', qty: 16 },
      { type: 'screw', size: '3.5x16', qty: 34 }, // ⌈2·(738 + 508)/150⌉ = 17 per bottom
      { type: 'screw', size: '3.5x25', qty: 8 },
      { type: 'slide', size: '20" (508 mm)', qty: 2 },
      { type: 'handle', size: '128 mm', qty: 2 },
    ]);
    expect(d.boring).toEqual([]);
  });

  it('gives the slide heights from the floor and ends with the handles', () => {
    const steps = drawerSet(CLOSET).steps;
    expect(steps.map((s) => s.title)).toEqual([
      'Arma las cajas',
      'Monta las correderas',
      'Mete los cajones',
      'Pon los frentes',
      'Pon las jaladeras de los cajones',
    ]);
    expect(steps[1]!.description).toContain('al ras del frente, centrada a 172 · 375 mm del piso');
    expect(steps[3]).toMatchObject({ panelRefs: ['drawer-front'], explodeOffsets: { 'drawer-front': [0, 0, 150] } });
    expect(steps[4]!.panelRefs).toEqual(['drawer-front', 'drawer-handle']);
    expect(drawerSet(TV_BOTH).steps[1]!.description).toContain('centrada a 178 · 392 mm del piso');
  });

  it('returns nothing without drawers or stacks', () => {
    const empty = { panels: [], placements: [], hardware: [], fittings: [], boring: [], steps: [] };
    expect(drawerSet({ ...CLOSET, count: 0 })).toEqual(empty);
    expect(drawerSet({ ...CLOSET, stacks: [] })).toEqual(empty);
  });

  it('refuses a depth no slide fits', () => {
    expect(() => drawerSet({ ...CLOSET, depth: 263 })).toThrow('No drawer slide fits 263 mm of depth');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/engine/parts/merge.test.ts src/engine/parts/drawer.test.ts`

Expected: FAIL. Vitest cannot resolve `./merge.ts` or `./drawer.ts`.

- [ ] **Step 3: Add the slide hardware type and label**

In `src/engine/types.ts`, change the `Hardware` interface's `type` line to:

```ts
  type: 'screw' | 'dowel' | 'confirmat' | 'hinge' | 'handle' | 'rod' | 'rod-support' | 'slide';
```

In `src/engine/labels.ts`, add this as the last entry of `HARDWARE_LABELS`:

```ts
  slide: 'Corredera telescópica (par)',
```

- [ ] **Step 4: Create `src/engine/parts/merge.ts`**

```ts
import type { Boring, Fitting, Hardware, Panel, Placement, Step } from '../types.ts';

/** What every building block returns: a design fragment a template merges with its own parts. */
export interface PartSet {
  panels: Panel[];
  placements: Placement[];
  hardware: Hardware[];
  fittings: Fitting[];
  boring: Boring[];
  steps: Omit<Step, 'order'>[];
}

/** One line per distinct item (type, size, cut length) with quantities summed, in first-seen order. */
export function mergeHardware(items: Hardware[]): Hardware[] {
  const byKey = new Map<string, Hardware>();
  for (const h of items) {
    const key = `${h.type} ${h.size} ${h.cutTo ?? ''}`;
    const seen = byKey.get(key);
    byKey.set(key, seen ? { ...seen, qty: seen.qty + h.qty } : { ...h });
  }
  return [...byKey.values()];
}
```

- [ ] **Step 5: Make the door block return `PartSet`**

In `src/engine/parts/door.ts`:
- Replace the type import block with:

  ```ts
  import type { EdgeBandingMode, Fitting, Placement, Step, Stock, Vec3 } from '../types.ts';
  import type { PartSet } from './merge.ts';
  ```

- Delete the whole `/** A design fragment a template merges with its own parts. */ export interface DoorSet { … }` block.
- Change the signature to:

  ```ts
  export function doorSet(o: DoorSetOptions): PartSet {
  ```

- [ ] **Step 6: Create `src/engine/parts/drawer.ts`**

```ts
import { NO_EDGES, bandEdges } from '../edge-banding.ts';
import { FIBRACEL_3 } from '../stock.ts';
import type { EdgeBandingMode, Fitting, Hardware, Panel, Placement, Step, Stock, Vec3 } from '../types.ts';
import type { PartSet } from './merge.ts';

const GAP = 2; // mm at the top and bottom of a stack's fronts
const FRONT_GAP = 3; // mm between stacked fronts
const SLIDE_CLEARANCE = 26; // mm the box is narrower than its opening: 12.7 mm per telescopic slide, rounded
const BOX_SHORTER = 40; // mm the box is lower than its front: 20 mm above and 20 mm below
const SLIDE_BACK_CLEARANCE = 10; // mm left behind the slide
const BOTTOM_SCREW_SPACING = 150; // mm between the bottom's screws
const HANDLE_SPACING = 128; // mm between a bar handle's screws
const HANDLE_BOX: Vec3 = [160, 12, 30]; // mm; a horizontal bar standing 30 mm off the front

/** Telescopic ball-bearing slides as sold in Mexico: pairs, 10" to 22". */
export const SLIDES = [
  { inches: 10, mm: 254 },
  { inches: 12, mm: 305 },
  { inches: 14, mm: 356 },
  { inches: 16, mm: 406 },
  { inches: 18, mm: 457 },
  { inches: 20, mm: 508 },
  { inches: 22, mm: 559 },
];

export const MIN_DRAWER_FRONT = 120; // mm; leaves an 80 mm box

/** The longest slide that fits `depth` of inside depth with 10 mm to spare, or null when none does. */
export function slideFor(depth: number): { inches: number; mm: number } | null {
  return [...SLIDES].reverse().find((s) => s.mm <= depth - SLIDE_BACK_CLEARANCE) ?? null;
}

/** Height of each of `count` fronts stacked between `bottom` and `top`: 2 mm at the ends, 3 mm between. */
export function drawerFrontHeight(count: number, bottom: number, top: number): number {
  return Math.floor((top - bottom - 2 * GAP - FRONT_GAP * (count - 1)) / count);
}

/** One column of drawers: the x span its fronts cover and the x span between the walls its boxes run in. */
export interface DrawerStack {
  frontLeft: number;
  frontRight: number;
  openingLeft: number;
  openingRight: number;
}

export interface DrawerSetOptions {
  count: number; // drawers per stack, stacked bottom to top
  stacks: DrawerStack[]; // 1 or 2 columns side by side, all the same size
  bottom: number; // y where the fronts start
  top: number; // y where they end
  frontZ: number; // z of the case front
  depth: number; // inside depth available for the slides
  stock: Stock;
  mode: EdgeBandingMode;
}

/**
 * Drawers on telescopic slides: a screwed box (2 sides, 2 ends, a Fibracel bottom screwed underneath)
 * and a separate front banded all round, fixed last so it can be lined up after the box runs.
 * Drawn pulled out a third of their slide. The block does not validate — templates do.
 */
export function drawerSet(o: DrawerSetOptions): PartSet {
  const n = o.count * o.stacks.length;
  if (n === 0) return { panels: [], placements: [], hardware: [], fittings: [], boring: [], steps: [] };
  const slide = slideFor(o.depth);
  if (!slide) throw new Error(`No drawer slide fits ${o.depth} mm of depth`);

  const t = o.stock.thickness;
  const tb = FIBRACEL_3.thickness;
  const L = slide.mm;
  const hf = drawerFrontHeight(o.count, o.bottom, o.top);
  const hb = hf - BOX_SHORTER;
  const first = o.stacks[0]!; // ponytail: every stack is the same size
  const wf = first.frontRight - first.frontLeft;
  const wb = Math.floor(first.openingRight - first.openingLeft - SLIDE_CLEARANCE);
  const pull = Math.round(L / 3);
  const frontBottoms = Array.from({ length: o.count }, (_, i) => o.bottom + GAP + i * (hf + FRONT_GAP));
  const centers = frontBottoms.map((y) => Math.round(y + hf / 2));
  const zBox = o.frontZ - L / 2 + pull;

  const placements: Placement[] = [];
  const fittings: Fitting[] = [];
  let k = 0; // drawer number across all stacks
  for (const s of o.stacks) {
    const fx = (s.frontLeft + s.frontRight) / 2;
    const bx = (s.openingLeft + s.openingRight) / 2;
    for (const fy of frontBottoms) {
      const by = fy + BOX_SHORTER / 2; // the box walls' underside
      const cy = by + hb / 2;
      placements.push(
        { panelId: 'drawer-front', instance: k, position: [fx, fy + hf / 2, o.frontZ + t / 2 + pull], size: [wf, hf, t] },
        { panelId: 'drawer-side', instance: 2 * k, position: [bx - wb / 2 + t / 2, cy, zBox], size: [t, hb, L] },
        { panelId: 'drawer-side', instance: 2 * k + 1, position: [bx + wb / 2 - t / 2, cy, zBox], size: [t, hb, L] },
        { panelId: 'drawer-end', instance: 2 * k, position: [bx, cy, o.frontZ - t / 2 + pull], size: [wb - 2 * t, hb, t] },
        { panelId: 'drawer-end', instance: 2 * k + 1, position: [bx, cy, o.frontZ - L + t / 2 + pull], size: [wb - 2 * t, hb, t] },
        { panelId: 'drawer-bottom', instance: k, position: [bx, by - tb / 2, zBox], size: [wb, tb, L] },
      );
      fittings.push({
        id: 'drawer-handle',
        instance: k,
        label: 'Jaladera',
        position: [fx, fy + hf / 2, o.frontZ + t + pull + HANDLE_BOX[2] / 2],
        size: [...HANDLE_BOX],
      });
      k++;
    }
  }

  const panels: Panel[] = [
    {
      id: 'drawer-front',
      label: 'Frente de cajón',
      length: wf,
      width: hf,
      stock: o.stock,
      grain: 'length',
      edges: bandEdges(o.mode, 'L1', 'L2', 'A1', 'A2'),
      qty: n,
    },
    { id: 'drawer-side', label: 'Costado de cajón', length: L, width: hb, stock: o.stock, grain: 'length', edges: NO_EDGES, qty: 2 * n },
    {
      id: 'drawer-end',
      label: 'Frente y trasera de cajón',
      length: wb - 2 * t,
      width: hb,
      stock: o.stock,
      grain: 'length',
      edges: NO_EDGES,
      qty: 2 * n,
    },
    { id: 'drawer-bottom', label: 'Fondo de cajón', length: L, width: wb, stock: FIBRACEL_3, grain: 'any', edges: NO_EDGES, qty: n },
  ];

  const hardware: Hardware[] = [
    { type: 'confirmat', size: '5x50', qty: 8 * n },
    { type: 'screw', size: '3.5x16', qty: Math.ceil((2 * (wb + L)) / BOTTOM_SCREW_SPACING) * n },
    { type: 'screw', size: '3.5x25', qty: 4 * n },
    { type: 'slide', size: `${slide.inches}" (${slide.mm} mm)`, qty: n },
    { type: 'handle', size: `${HANDLE_SPACING} mm`, qty: n },
  ];

  const steps: Omit<Step, 'order'>[] = [
    {
      title: 'Arma las cajas',
      description:
        'Arma cada caja con tornillos confirmat, 2 por esquina, con los costados por fuera del frente y la trasera. ' +
        'Mide sus diagonales para dejarla a escuadra y atornilla el fondo de fibracel por debajo cada ' +
        `${BOTTOM_SCREW_SPACING / 10} cm.`,
      panelRefs: ['drawer-side', 'drawer-end', 'drawer-bottom'],
    },
    {
      title: 'Monta las correderas',
      description:
        'Separa cada corredera en sus dos partes. Atornilla la parte fija en las paredes del hueco, al ras del frente, ' +
        `centrada a ${centers.join(' · ')} mm del piso, y la parte móvil en los costados de cada caja, centrada en su alto.`,
      panelRefs: ['drawer-side'],
    },
    {
      title: 'Mete los cajones',
      description: 'Engancha cada caja en sus correderas y revisa que corra suave y cierre al ras del frente.',
      panelRefs: ['drawer-side'],
    },
    {
      title: 'Pon los frentes',
      description:
        `Deja ${FRONT_GAP} mm entre frentes y ${GAP} mm alrededor, con cartón o monedas de separadores. Pega cada ` +
        'frente con cinta doble cara, abre el cajón y atorníllalo desde dentro con 4 tornillos de 3.5×25.',
      panelRefs: ['drawer-front'],
      explodeOffsets: { 'drawer-front': [0, 0, 150] },
    },
    {
      title: 'Pon las jaladeras de los cajones',
      description: `Barrena 2 agujeros de 5 mm separados ${HANDLE_SPACING} mm, centrados en cada frente, y atornilla la jaladera.`,
      panelRefs: ['drawer-front', 'drawer-handle'],
    },
  ];

  return { panels, placements, hardware, fittings, boring: [], steps };
}
```

- [ ] **Step 7: Export the new modules**

In `src/engine/index.ts`, after `export * from './parts/door.ts';`, add:

```ts
export * from './parts/merge.ts';
export * from './parts/drawer.ts';
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `pnpm vitest run src/engine/parts`. Expected: PASS.

Then run `pnpm test`, `pnpm typecheck`, and `npx tsc --noEmit` in `mobile/`. Expected: all green.

- [ ] **Step 9: Commit**

```bash
git add src/engine/types.ts src/engine/labels.ts src/engine/index.ts src/engine/parts/merge.ts src/engine/parts/merge.test.ts src/engine/parts/drawer.ts src/engine/parts/drawer.test.ts src/engine/parts/door.ts
git commit -m "feat(engine): add a drawer block on telescopic slides"
```

(Add the `Co-Authored-By:` trailer.)

---

### Task 2: Closet drawers

**Files:**
- Modify: `src/engine/templates/closet.ts`, `src/engine/templates/closet.test.ts`, `src/engine/labels.ts`
- Create: `src/engine/labels.test.ts`, `src/engine/templates/testing.ts`

**Interfaces:**
- Consumes, from Task 1: `drawerSet`, `DrawerStack`, `mergeHardware`, and the drawer panel and fitting ids.
- Produces, used by Task 3:
  - `spanishList(items: string[]): string` in `src/engine/labels.ts`: `'a'`, `'a y b'`, `'a, b y c'`.
  - `overlappingBoxes(d: Design): string[]` in `src/engine/templates/testing.ts`.
  - Closet param `drawers` ("Cajones", 0–3, default 0) and panel id `'drawer-shelf'` ("Techo de cajones").

- [ ] **Step 1: Write the failing tests**

Create `src/engine/labels.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { spanishList } from './labels.ts';

describe('spanishList', () => {
  it('joins with commas and a final "y"', () => {
    expect(spanishList(['a'])).toBe('a');
    expect(spanishList(['a', 'b'])).toBe('a y b');
    expect(spanishList(['a', 'b', 'c'])).toBe('a, b y c');
  });
});
```

Create `src/engine/templates/testing.ts`. This is a pure test helper; it is not exported from `src/engine/index.ts`.

```ts
import type { Design } from '../types.ts';

/** Pairs of 3D boxes (placements and fittings) whose volumes overlap; touching faces don't count. */
export function overlappingBoxes(d: Design): string[] {
  const boxes = [
    ...d.placements.map((p) => ({ name: `${p.panelId}#${p.instance}`, position: p.position, size: p.size })),
    ...d.fittings.map((f) => ({ name: `${f.id}#${f.instance}`, position: f.position, size: f.size })),
  ];
  const out: string[] = [];
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      if ([0, 1, 2].every((k) => Math.abs(a.position[k]! - b.position[k]!) < (a.size[k]! + b.size[k]!) / 2 - 0.001)) {
        out.push(`${a.name} × ${b.name}`);
      }
    }
  return out;
}
```

In `src/engine/templates/closet.test.ts`:

- Add `import { overlappingBoxes } from './testing.ts';` after the `refLabels` import.
- In `expectBuildable`, change the `flats` filter list to `['top', 'bottom', 'drawer-shelf', 'hat-shelf', 'shelf']`. Replace the whole `const boxes = … for … for … { … }` block at the end of the function with:

  ```ts
    expect(overlappingBoxes(d)).toEqual([]);
  ```

- In the `'closet sheet fit'` sweep, wrap the innermost loop body in one more loop, `for (const drawers of [0, 3])`, and pass `drawers` to `closet.generate({ material, width, height, depth, interior, shelfCount, doors, drawers })`.
- Append:

```ts
describe('closet drawers', () => {
  const colgar = { interior: 1, drawers: 2 }; // Colgar, 2 drawers, 2 doors

  it('stacks 200 mm fronts under a drawer shelf and starts the doors above it', () => {
    const d = designOf(colgar);
    expect(d.panels.find((p) => p.id === 'drawer-shelf')).toMatchObject({
      label: 'Techo de cajones',
      length: 764,
      width: 547,
      qty: 1,
    });
    expect(d.placements.find((p) => p.panelId === 'drawer-shelf')!.position[1]).toBe(477);
    expect(d.panels.find((p) => p.id === 'drawer-front')).toMatchObject({ length: 796, width: 200, qty: 2 });
    expect(d.placements.filter((p) => p.panelId === 'drawer-front').map((p) => p.position[1])).toEqual([172, 375]);
    expect(d.panels.find((p) => p.id === 'door')).toMatchObject({ length: 1519, width: 396, qty: 2 });
    expect(d.boring[0]!.along).toEqual([100, 760, 1419]);
  });

  it('measures the space above from the drawer shelf', () => {
    // Colgar: the rod stays at 1564, 1078 mm above the drawer shelf's top face (486)
    expect(designOf(colgar).fittings.find((f) => f.id === 'rod')!.position[1]).toBe(1564);
    // Entrepaños: 4 gaps of 360.5 above 486
    expect(shelfYs(designOf({ interior: 2, drawers: 2 }))).toEqual([855.5, 1234, 1612.5]);
    // Mixto: only 60 mm would be left between the drawer shelf and the hanging zone
    expect(issuesOf({ drawers: 2 })).toEqual([
      {
        paramKey: 'height',
        message: 'No caben la zona de colgar de 1000 mm y un espacio útil debajo. Aumenta el alto o elige Colgar.',
      },
    ]);
  });

  it('adds the drawer shelf and drawer hardware, merged with the case and the doors', () => {
    expect(designOf(colgar).hardware).toEqual([
      { type: 'confirmat', size: '5x50', qty: 34 }, // (Tapa, Base, Maletero, techo de cajones)·4 + zoclo 2 + 2 boxes·8
      { type: 'screw', size: '3.5x16', qty: 70 }, // back 28 + 2 runs·4, and 2 drawer bottoms·17
      { type: 'rod', size: '15×30 mm', qty: 1, cutTo: 762 },
      { type: 'rod-support', size: '15×30 mm', qty: 2 },
      { type: 'screw', size: '3.5x25', qty: 8 },
      { type: 'slide', size: '20" (508 mm)', qty: 2 },
      { type: 'handle', size: '128 mm', qty: 4 },
      { type: 'hinge', size: '35 mm recta', qty: 6 },
    ]);
  });

  it('installs the drawer shelf with the interior and adds the drawer steps before the doors', () => {
    const steps = designOf(colgar).steps;
    expect(steps.map((s) => s.title)).toEqual([
      'Prepara y marca',
      'Arma la caja acostada',
      'Instala el techo de los cajones y el maletero',
      'Verifica la escuadra y coloca el fondo',
      'Pon el tubo',
      'Arma las cajas',
      'Monta las correderas',
      'Mete los cajones',
      'Pon los frentes',
      'Pon las jaladeras de los cajones',
      'Monta las placas',
      'Cuelga las puertas',
      'Pon las jaladeras',
    ]);
    expect(steps[0]!.description).toContain('base a 70 mm, techo de cajones a 468 mm, maletero a 1614 mm.');
    expect(steps[2]!.panelRefs).toEqual(['drawer-shelf', 'hat-shelf']);
    expect(steps[3]!.description).toContain(
      'a la base (a 79 mm del borde de abajo), al techo de los cajones y al maletero.',
    );
    expect(steps[6]!.description).toContain('centrada a 172 · 375 mm del piso');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/engine/labels.test.ts src/engine/templates/closet.test.ts`

Expected: FAIL. `spanishList` is not exported from `labels.ts`, and the closet has no `drawers` param, so `paramIssues` rejects the unknown input silently and the new drawer expectations fail.

- [ ] **Step 3: Move `spanishList` into the engine's copy helpers**

In `src/engine/labels.ts`, append:

```ts
/** A Spanish list: 'a', 'a y b', 'a, b y c'. */
export function spanishList(items: string[]): string {
  return items.length === 1 ? items[0]! : `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`;
}
```

In `src/engine/templates/closet.ts`, delete the local `/** 'a, b y c' */ function spanishList(…) { … }`, and add these imports next to the existing `doorSet` import:

```ts
import { drawerSet } from '../parts/drawer.ts';
import { mergeHardware } from '../parts/merge.ts';
import { spanishList } from '../labels.ts';
```

- [ ] **Step 4: Add the drawers param and the drawer zone to the closet**

In `src/engine/templates/closet.ts`:

1. After `const MIN_DOOR = 200; …`, add:

   ```ts
   const DRAWER_PITCH = 203; // mm per drawer: a 200 mm front plus the 3 mm gap to the next one
   ```

2. In `params`, right after the `shelfCount` entry, add:

   ```ts
     { kind: 'number', key: 'drawers', label: 'Cajones', unit: '', min: 0, max: 3, step: 1, default: 0 },
   ```

3. In the doc comment above `generateCloset`, add a sentence before "A wall is several modules side by side.": `Optional drawers stack on the zoclo under a fixed shelf, and the doors start above it.`

4. After `const N = p['shelfCount']!;`, add `const drawers = p['drawers']!;`.

5. Replace `const floor = PLINTH + t; // the Base's top face` with:

   ```ts
     const Z = PLINTH + DRAWER_PITCH * drawers + 1; // top of the drawer zone: every front comes out 200 mm
     const floor = drawers > 0 ? Z + t / 2 : PLINTH + t; // lowest free surface: the drawer shelf's or the Base's top face
   ```

6. In the `gap` expression, replace `(H - PLINTH - 2 * t - N * t) / (N + 1)` with `(H - t - floor - N * t) / (N + 1)`. It is identical without drawers.

7. Replace the `flatRanges` array with:

   ```ts
     const flatRanges = [
       { bottom: PLINTH, top: PLINTH + t }, // Base
       ...(drawers > 0 ? [{ bottom: Z - t / 2, top: Z + t / 2 }] : []), // drawer shelf
       { bottom: H - t, top: H }, // Tapa
       ...(hasRod ? [{ bottom: hatBottom, top: hatBottom + t }] : []),
       ...shelfBottoms.map((y) => ({ bottom: y, top: y + t })),
     ];
   ```

8. In the `doorSet({ … })` call, change `bottom: PLINTH` to `bottom: drawers > 0 ? Z : PLINTH`. Right after that call, add:

   ```ts
     // Fronts keep 2 mm to the case's outer edges; the boxes run between the sides.
     const drawer = drawerSet({
       count: drawers,
       stacks: [{ frontLeft: -W / 2 + 2, frontRight: W / 2 - 2, openingLeft: -W / 2 + t, openingRight: W / 2 - t }],
       bottom: PLINTH,
       top: Z,
       frontZ: D / 2,
       depth: Dc,
       stock,
       mode,
     });
   ```

9. In `panels`:
   - after the `plinth` entry, insert `...(drawers > 0 ? [shelfPanel('drawer-shelf', 'Techo de cajones', 1)] : []),`;
   - directly before `...door.panels,`, insert `...drawer.panels,`.

10. In `placements`:
    - after the `plinth` entry, insert `...(drawers > 0 ? [flat('drawer-shelf', 0, Z - t / 2)] : []),`;
    - directly before `...door.placements,`, insert `...drawer.placements,`.

11. Replace `const shelfLike = (hasRod ? 1 : 0) + shelves; // Maletero + Entrepaños` with:

    ```ts
      const shelfLike = (hasRod ? 1 : 0) + shelves + (drawers > 0 ? 1 : 0); // Maletero + Entrepaños + drawer shelf
    ```

12. Replace the `const hardware: Hardware[] = [ … ];` array with:

    ```ts
      const hardware = mergeHardware([
        { type: 'confirmat', size: '5x50', qty: (2 + shelfLike) * 4 + 2 },
        { type: 'screw', size: '3.5x16', qty: backScrews },
        ...rodHardware,
        ...drawer.hardware,
        ...door.hardware,
      ]);
    ```

13. In `marks`, after `` `base a ${PLINTH} mm`, ``, insert:

    ```ts
        ...(drawers > 0 ? [`techo de cajones a ${Math.round(Z - t / 2)} mm`] : []),
    ```

14. Replace the `interiorIds` and `interiorTitle` constants with:

    ```ts
      const interiorIds = [
        ...(drawers > 0 ? ['drawer-shelf'] : []),
        ...(hasRod ? ['hat-shelf'] : []),
        ...(shelves > 0 ? ['shelf'] : []),
      ];
      const interiorTitle = `Instala ${spanishList([
        ...(drawers > 0 ? ['el techo de los cajones'] : []),
        ...(hasRod ? ['el maletero'] : []),
        ...(shelves > 0 ? ['los entrepaños'] : []),
      ])}`;
    ```

15. In `backTo`, right after the `a la base (…)` entry, insert `...(drawers > 0 ? ['al techo de los cajones'] : []),`.

16. In the iron step, change `panels.filter((pn) => pn.id !== 'back')` to `panels.filter((pn) => pn.stock.id !== FIBRACEL_3.id)`. Fibracel pieces are never banded.

17. In `steps`, change `...rodSteps,` + `...door.steps,` to `...rodSteps,` + `...drawer.steps,` + `...door.steps,`.

18. In the `design` literal, change `fittings: [...rod, ...door.fittings],` to `fittings: [...rod, ...drawer.fittings, ...door.fittings],`.

`Hardware` stays imported; `rodHardware` still uses it.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run src/engine/labels.test.ts src/engine/templates src/engine/order.test.ts`

Expected: PASS. Every pre-existing closet, template and order test is unchanged and still green, since `drawers` defaults to 0.

Then run `pnpm test`, `pnpm typecheck`, and `npx tsc --noEmit` in `mobile/`. Expected: all green.

If a value disagrees with a test, re-derive it from the spec's formulas before changing either side. The numbers above come from the spec's worked example.

- [ ] **Step 6: Commit**

```bash
git add src/engine/labels.ts src/engine/labels.test.ts src/engine/templates/closet.ts src/engine/templates/closet.test.ts src/engine/templates/testing.ts
git commit -m "feat(engine): let the closet hold up to three drawers under its doors"
```

(Add the `Co-Authored-By:` trailer.)

---

### Task 3: TV stand template

**Files:**
- Create: `src/engine/templates/tv-stand.ts`, `src/engine/templates/tv-stand.test.ts`
- Modify: `src/engine/index.ts`, `src/engine/templates/templates.test.ts`, `src/engine/order.test.ts`, `mobile/src/app/templates.tsx`

**Interfaces:**
- Consumes:
  - from Task 1: `drawerSet`, `drawerFrontHeight`, `MIN_DRAWER_FRONT`, `DrawerStack`, `mergeHardware`;
  - from Task 2: `spanishList`, `overlappingBoxes`.
- Produces: `tvStand: Template` (id `'tv-stand'`, name `'Mueble para TV'`) and `generateTvStand(raw)`, registered in `templates` as `[bookshelf, sideTable, closet, tvStand]`.

- [ ] **Step 1: Write the failing tests**

Create `src/engine/templates/tv-stand.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { tvStand } from './tv-stand.ts';
import { overlappingBoxes } from './testing.ts';
import { nest } from '../nesting.ts';
import { FIBRACEL_3, MATERIAL_OPTIONS } from '../stock.ts';
import type { Design, TemplateParams, ValidationIssue } from '../types.ts';

function designOf(params: TemplateParams = {}): Design {
  const result = tvStand.generate(params);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.design;
}

function issuesOf(params: TemplateParams): ValidationIssue[] {
  const result = tvStand.generate(params);
  if (result.ok) throw new Error('expected validation issues');
  return result.issues;
}

const ids = (d: Design) => d.panels.map((p) => p.id);

describe('tv stand', () => {
  it('builds the default: drawers left, an open shelf right, the back short of the top', () => {
    const d = designOf();
    expect(d.panels.map((p) => [p.id, p.label, p.length, p.width, p.qty])).toEqual([
      ['side', 'Lateral', 500, 397, 2],
      ['top', 'Tapa', 1364, 397, 1],
      ['bottom', 'Base', 1364, 397, 1],
      ['plinth', 'Zoclo', 1364, 70, 1],
      ['divider', 'Divisor', 394, 397, 1],
      ['shelf', 'Entrepaño', 673, 397, 1],
      ['drawer-front', 'Frente de cajón', 696, 211, 2],
      ['drawer-side', 'Costado de cajón', 356, 171, 4],
      ['drawer-end', 'Frente y trasera de cajón', 611, 171, 4],
      ['drawer-bottom', 'Fondo de cajón', 356, 647, 2],
      ['back', 'Fondo', 1400, 400, 1],
    ]);
    expect(d.panels.find((p) => p.id === 'back')!.stock).toBe(FIBRACEL_3);
  });

  it('stands the divider between the Base and the Tapa and the shelf halfway up its bay', () => {
    const d = designOf();
    const at = (id: string) => d.placements.find((p) => p.panelId === id);
    expect(at('divider')).toEqual({ panelId: 'divider', instance: 0, position: [0, 285, 1.5], size: [18, 394, 397] });
    expect(at('shelf')).toEqual({ panelId: 'shelf', instance: 0, position: [345.5, 285, 1.5], size: [673, 18, 397] });
    expect(at('back')).toEqual({ panelId: 'back', instance: 0, position: [0, 200, -198.5], size: [1400, 400, 3] });
  });

  it('fills the drawer bay with two 211 mm fronts on 14" slides', () => {
    const d = designOf();
    expect(d.placements.filter((p) => p.panelId === 'drawer-front').map((p) => p.position)).toEqual([
      [-350, 177.5, 328],
      [-350, 391.5, 328],
    ]);
    expect(d.hardware).toEqual([
      { type: 'confirmat', size: '5x50', qty: 34 }, // Tapa, Base, divider, shelf ·4 + zoclo 2 + 2 boxes·8
      { type: 'screw', size: '3.5x16', qty: 52 }, // back 18 + divider 2 + shelf 4, and 2 drawer bottoms·14
      { type: 'screw', size: '3.5x25', qty: 8 },
      { type: 'slide', size: '14" (356 mm)', qty: 2 },
      { type: 'handle', size: '128 mm', qty: 2 },
    ]);
  });

  it('can hold drawers in both bays, or shelves in both', () => {
    const drawers = designOf({ rightBay: 1 });
    expect(ids(drawers)).not.toContain('shelf');
    expect(drawers.panels.find((p) => p.id === 'drawer-front')!.qty).toBe(4);
    expect(drawers.placements.filter((p) => p.panelId === 'drawer-front').map((p) => p.position[0])).toEqual([
      -350, -350, 350, 350,
    ]);

    const shelves = designOf({ leftBay: 2 });
    expect(ids(shelves).filter((id) => id.startsWith('drawer'))).toEqual([]);
    expect(shelves.panels.find((p) => p.id === 'shelf')!.qty).toBe(2);
    expect(shelves.fittings).toEqual([]);
    expect(shelves.steps.map((s) => s.title)).toEqual([
      'Prepara y marca',
      'Arma la caja',
      'Instala los entrepaños',
      'Verifica la escuadra y coloca el fondo',
    ]);
  });

  it('marks, assembles and backs the stand, leaving a cable slot', () => {
    const steps = designOf().steps;
    expect(steps.map((s) => s.title)).toEqual([
      'Prepara y marca',
      'Arma la caja',
      'Instala el entrepaño',
      'Verifica la escuadra y coloca el fondo',
      'Arma las cajas',
      'Monta las correderas',
      'Mete los cajones',
      'Pon los frentes',
      'Pon las jaladeras de los cajones',
    ]);
    expect(steps[0]!.description).toContain('la cara de abajo de cada pieza: base a 70 mm, entrepaño a 276 mm.');
    expect(steps[1]!.description).toContain('Antes de poner el zoclo, fija el divisor');
    expect(steps[3]!.description).toContain(
      'desde el borde de abajo: a los laterales, a la base (a 79 mm del borde de abajo), al divisor y al entrepaño. ' +
        'Deja libres los 10 cm de arriba para pasar los cables.',
    );
    expect(steps[5]!.description).toContain('centrada a 178 · 392 mm del piso');
  });
});

describe('tv stand validation', () => {
  it('rejects a bay wider than the material spans', () => {
    expect(issuesOf({ width: 1700 })).toEqual([
      {
        paramKey: 'width',
        message:
          'El claro de 823 mm supera el máximo seguro de 800 mm para triplay de pino 18 mm. ' +
          'Reduce el ancho o elige un material más grueso.',
      },
    ]);
  });

  it('needs drawer fronts of at least 120 mm', () => {
    expect(issuesOf({ height: 400, drawersPerBay: 3 })).toEqual([
      {
        paramKey: 'drawersPerBay',
        message: 'Con 3 cajones por bahía cada frente quedaría de 106 mm y el mínimo es 120 mm. Usa menos cajones o aumenta el alto.',
      },
    ]);
    expect(tvStand.generate({ height: 400, drawersPerBay: 3, leftBay: 2 }).ok).toBe(true);
  });
});

describe('tv stand sheet fit', () => {
  it('nests every valid stand, with no overlapping boxes', () => {
    let valid = 0;
    for (const material of MATERIAL_OPTIONS.map((o) => o.value))
      for (const width of [1000, 1140, 1400, 1650, 1800])
        for (const height of [400, 500, 650])
          for (const depth of [350, 500])
            for (const leftBay of [1, 2])
              for (const rightBay of [1, 2])
                for (const drawersPerBay of [1, 3]) {
                  const result = tvStand.generate({ material, width, height, depth, leftBay, rightBay, drawersPerBay });
                  if (!result.ok) continue;
                  valid++;
                  expect(() => nest(result.design.panels)).not.toThrow();
                  expect(overlappingBoxes(result.design)).toEqual([]);
                }
    expect(valid).toBeGreaterThan(100);
  });
});
```

In `src/engine/templates/templates.test.ts`:

- Add `import { tvStand } from './tv-stand.ts';` after the `closet` import. Change `import type { Design, Template } from '../types.ts';` to `import type { Design, Template, TemplateParams } from '../types.ts';`.
- Change the shared-invariants loop header `for (const template of [bookshelf, sideTable, closet]) {` to `for (const template of [bookshelf, sideTable, closet, tvStand]) {`.
- Replace the test `'uses the chosen material for its panels'` with:

  ```ts
      it('uses the chosen material for its panels', () => {
        // melamine spans 550 mm: the TV stand's bays are half its width, the others span their whole width
        const params: TemplateParams = template.id === 'tv-stand' ? { width: 1000, material: 4 } : { width: 500, material: 4 };
        const melamine = designOrThrow(template, params);
        expect(melamine.panels.filter((p) => p.stock.id !== FIBRACEL_3.id).every((p) => p.stock.id === 4)).toBe(true);
      });
  ```

In `src/engine/order.test.ts`, add `import { tvStand } from './templates/tv-stand.ts';` after the `closet` import, and append:

```ts
describe('tv stand order', () => {
  it('lists the slides as pairs with their length', () => {
    expect(orderText(orderFor(tvStand, {}, 'Mueble para TV'))).toContain('Corredera telescópica (par) 14" (356 mm) × 2');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/engine/templates src/engine/order.test.ts`

Expected: FAIL. Vitest cannot resolve `./tv-stand.ts`.

- [ ] **Step 3: Implement `src/engine/templates/tv-stand.ts`**

```ts
import type {
  Design,
  GenerateResult,
  Panel,
  ParamSpec,
  Placement,
  Step,
  Template,
  TemplateParams,
  ValidationIssue,
} from '../types.ts';
import { DEFAULT_MATERIAL, FIBRACEL_3, MATERIAL_OPTIONS, getStock } from '../stock.ts';
import {
  DEFAULT_EDGE_BANDING,
  EDGE_BANDING_OPTIONS,
  NO_EDGES,
  bandEdges,
  edgeBandingMode,
  ironStep,
  prepSentence,
} from '../edge-banding.ts';
import { paramIssues, resolveParams, spanIssue } from '../validation.ts';
import { spanishList } from '../labels.ts';
import { MIN_DRAWER_FRONT, drawerFrontHeight, drawerSet, type DrawerStack } from '../parts/drawer.ts';
import { mergeHardware } from '../parts/merge.ts';

const PLINTH = 70; // mm, zoclo height
const CABLE_SLOT = 100; // mm the back stops short of the top, so cables pass without a hole saw
const BACK_SCREW_SPACING = 200; // mm between back screws

const BAY_OPTIONS = [
  { value: 1, label: 'Cajones' },
  { value: 2, label: 'Entrepaño' },
];

const params: ParamSpec[] = [
  { kind: 'number', key: 'width', label: 'Ancho', unit: 'mm', min: 1000, max: 1800, step: 10, default: 1400 },
  { kind: 'number', key: 'height', label: 'Alto', unit: 'mm', min: 400, max: 650, step: 10, default: 500 },
  { kind: 'number', key: 'depth', label: 'Profundidad', unit: 'mm', min: 350, max: 500, step: 10, default: 400 },
  { kind: 'select', key: 'leftBay', label: 'Bahía izquierda', unit: '', options: BAY_OPTIONS, default: 1 },
  { kind: 'select', key: 'rightBay', label: 'Bahía derecha', unit: '', options: BAY_OPTIONS, default: 2 },
  { kind: 'number', key: 'drawersPerBay', label: 'Cajones por bahía', unit: '', min: 1, max: 3, step: 1, default: 2 },
  { kind: 'select', key: 'material', label: 'Material', unit: '', options: MATERIAL_OPTIONS, default: DEFAULT_MATERIAL },
  {
    kind: 'select',
    key: 'edgeBanding',
    label: 'Cubrecanto',
    unit: '',
    options: EDGE_BANDING_OPTIONS,
    default: DEFAULT_EDGE_BANDING,
  },
];

/**
 * A low TV stand on a zoclo: two bays split by a centre divider, each holding a stack of drawers or
 * an open shelf (open fronts suit electronics: the remote's infrared and ventilation). The Fibracel
 * back stops 100 mm short of the top as a cable slot. `depth` is the overall depth, back included.
 */
export function generateTvStand(raw: TemplateParams): GenerateResult {
  const p = resolveParams(params, raw);
  const rangeIssues = paramIssues(params, p);
  if (rangeIssues.length > 0) return { ok: false, issues: rangeIssues };

  // resolveParams guarantees every spec key exists; paramIssues vetted the select values
  const W = p['width']!;
  const H = p['height']!;
  const D = p['depth']!;
  const bays = [p['leftBay']!, p['rightBay']!]; // 1 Cajones, 2 Entrepaño; left first
  const n = p['drawersPerBay']!;
  const stock = getStock(p['material']!);
  const mode = edgeBandingMode(p['edgeBanding']!);
  const t = stock.thickness;
  const tb = FIBRACEL_3.thickness;
  const Dc = D - tb; // case depth; the back makes up the rest
  const zc = tb / 2; // case center, shifted forward (+z) so the back sits behind it
  const span = W - 2 * t; // Tapa, Base and zoclo run between the sides
  const bay = Math.floor((W - 3 * t) / 2); // each bay's inside width, rounded down to whole mm
  const hd = H - PLINTH - 2 * t; // between the Base and the Tapa
  const hasDrawers = bays.includes(1);
  const shelfBays = [0, 1].filter((i) => bays[i] === 2);
  const shelfBottom = PLINTH + t + (hd - t) / 2; // halfway up the bay
  const hf = drawerFrontHeight(n, PLINTH, H);

  const issues: ValidationIssue[] = [];
  const spanProblem = spanIssue(bay, stock);
  if (spanProblem) issues.push({ paramKey: 'width', message: spanProblem.message });
  if (hasDrawers && hf < MIN_DRAWER_FRONT) {
    issues.push({
      paramKey: 'drawersPerBay',
      message:
        `Con ${n} cajones por bahía cada frente quedaría de ${hf} mm y el mínimo es ${MIN_DRAWER_FRONT} mm. ` +
        'Usa menos cajones o aumenta el alto.',
    });
  }
  if (issues.length > 0) return { ok: false, issues };

  // Each bay's fronts keep 2 mm to its outer edge and to the centre line; boxes run between a side and the divider.
  const stacks: DrawerStack[] = [];
  if (bays[0] === 1) stacks.push({ frontLeft: -W / 2 + 2, frontRight: -2, openingLeft: -W / 2 + t, openingRight: -t / 2 });
  if (bays[1] === 1) stacks.push({ frontLeft: 2, frontRight: W / 2 - 2, openingLeft: t / 2, openingRight: W / 2 - t });
  const drawer = drawerSet({ count: n, stacks, bottom: PLINTH, top: H, frontZ: D / 2, depth: Dc, stock, mode });

  const flatPanel = (id: string, label: string, length: number, qty: number): Panel => ({
    id,
    label,
    length,
    width: Dc,
    stock,
    grain: 'length',
    edges: bandEdges(mode, 'L1'),
    qty,
  });
  // Every panel fits a 1220 × 2440 sheet: W ≤ 1800, H ≤ 650, Dc ≤ 497.
  const panels: Panel[] = [
    { id: 'side', label: 'Lateral', length: H, width: Dc, stock, grain: 'length', edges: bandEdges(mode, 'L1', 'A1'), qty: 2 },
    flatPanel('top', 'Tapa', span, 1),
    flatPanel('bottom', 'Base', span, 1),
    { id: 'plinth', label: 'Zoclo', length: span, width: PLINTH, stock, grain: 'length', edges: bandEdges(mode, 'L1'), qty: 1 },
    flatPanel('divider', 'Divisor', hd, 1),
    ...(shelfBays.length > 0 ? [flatPanel('shelf', 'Entrepaño', bay, shelfBays.length)] : []),
    ...drawer.panels,
    { id: 'back', label: 'Fondo', length: W, width: H - CABLE_SLOT, stock: FIBRACEL_3, grain: 'any', edges: NO_EDGES, qty: 1 },
  ];

  const bayCenter = [-(W - t) / 4, (W - t) / 4];
  const flat = (panelId: string, instance: number, x: number, length: number, bottomY: number): Placement => ({
    panelId,
    instance,
    position: [x, bottomY + t / 2, zc],
    size: [length, t, Dc],
  });
  const placements: Placement[] = [
    { panelId: 'side', instance: 0, position: [-(W - t) / 2, H / 2, zc], size: [t, H, Dc] },
    { panelId: 'side', instance: 1, position: [(W - t) / 2, H / 2, zc], size: [t, H, Dc] },
    flat('top', 0, 0, span, H - t),
    flat('bottom', 0, 0, span, PLINTH),
    { panelId: 'plinth', instance: 0, position: [0, PLINTH / 2, D / 2 - t / 2], size: [span, PLINTH, t] },
    { panelId: 'divider', instance: 0, position: [0, PLINTH + t + hd / 2, zc], size: [t, hd, Dc] },
    ...shelfBays.map((i, k) => flat('shelf', k, bayCenter[i]!, bay, shelfBottom)),
    ...drawer.placements,
    {
      panelId: 'back',
      instance: 0,
      position: [0, (H - CABLE_SLOT) / 2, -D / 2 + tb / 2],
      size: [W, H - CABLE_SLOT, tb],
    },
  ];

  const shelves = shelfBays.length;
  const backScrews =
    Math.ceil((2 * (W + H - CABLE_SLOT)) / BACK_SCREW_SPACING) +
    Math.ceil((H - CABLE_SLOT) / BACK_SCREW_SPACING) + // up the divider
    shelves * Math.ceil(bay / BACK_SCREW_SPACING);
  const hardware = mergeHardware([
    { type: 'confirmat', size: '5x50', qty: 4 * 3 + 2 + 4 * shelves }, // Tapa, Base, divider; zoclo; shelves
    { type: 'screw', size: '3.5x16', qty: backScrews },
    ...drawer.hardware,
  ]);

  const marks = [`base a ${PLINTH} mm`, ...(shelves > 0 ? [`entrepaño a ${Math.round(shelfBottom)} mm`] : [])];
  const backTo = [
    'a los laterales',
    `a la base (a ${Math.round(PLINTH + t / 2)} mm del borde de abajo)`,
    'al divisor',
    ...(shelves === 2 ? ['a cada entrepaño'] : shelves === 1 ? ['al entrepaño'] : []),
  ];
  const shelfSteps: Omit<Step, 'order'>[] =
    shelves > 0
      ? [
          {
            title: shelves === 2 ? 'Instala los entrepaños' : 'Instala el entrepaño',
            description: 'Coloca cada entrepaño en su marca y fíjalo con 2 confirmat por lado.',
            panelRefs: ['shelf'],
            explodeOffsets: { shelf: [0, 0, 200] },
          },
        ]
      : [];

  const steps: Omit<Step, 'order'>[] = [
    {
      title: 'Prepara y marca',
      description:
        `${prepSentence(stock, mode)} Marca en los laterales y en el divisor la cara de abajo de cada pieza: ` +
        `${marks.join(', ')}. Marca también el centro de la tapa y de la base para el divisor.`,
      panelRefs: ['side', 'divider'],
    },
    ...(mode === 'diy' ? [ironStep(panels.filter((pn) => pn.stock.id !== FIBRACEL_3.id).map((pn) => pn.id))] : []),
    {
      title: 'Arma la caja',
      description:
        'Fija la base y la tapa entre los laterales con tornillos confirmat, 2 por lado. Antes de poner el zoclo, ' +
        'fija el divisor en las marcas del centro con 2 confirmat a través de la base y 2 a través de la tapa. ' +
        'Luego fija el zoclo bajo la base, al frente, con 1 por lado.',
      panelRefs: ['side', 'top', 'bottom', 'divider', 'plinth'],
      explodeOffsets: { top: [0, 150, 0], bottom: [0, -150, 0], divider: [0, 0, 150], plinth: [0, 0, 150] },
    },
    ...shelfSteps,
    {
      title: 'Verifica la escuadra y coloca el fondo',
      description:
        'Con el mueble boca abajo, mide las dos diagonales: deben ser iguales. Atornilla el fondo de fibracel con la ' +
        `cara lisa hacia el frente, cada 20 cm, desde el borde de abajo: ${spanishList(backTo)}. ` +
        `Deja libres los ${CABLE_SLOT / 10} cm de arriba para pasar los cables.`,
      panelRefs: ['back'],
      explodeOffsets: { back: [0, 0, -200] },
    },
    ...drawer.steps,
  ];

  const design: Design = {
    templateId: 'tv-stand',
    params: p,
    panels,
    placements,
    hardware,
    fittings: drawer.fittings,
    boring: [],
    steps: steps.map((s, i) => ({ ...s, order: i + 1 })),
    edgeBanding: mode,
  };
  return { ok: true, design };
}

export const tvStand: Template = {
  id: 'tv-stand',
  name: 'Mueble para TV',
  description: 'Mueble bajo para TV con dos bahías de cajones o entrepaño y paso de cables atrás.',
  params,
  generate: (raw) => generateTvStand(raw),
};
```

- [ ] **Step 4: Register the TV stand**

In `src/engine/index.ts`:
- After `export { closet, generateCloset } from './templates/closet.ts';`, add `export { tvStand, generateTvStand } from './templates/tv-stand.ts';`.
- After `import { closet } from './templates/closet.ts';`, add `import { tvStand } from './templates/tv-stand.ts';`.
- Change the registry to `export const templates: Template[] = [bookshelf, sideTable, closet, tvStand];`.

In `mobile/src/app/templates.tsx`, change the `KIND` line to:

```ts
const KIND: Record<string, string> = { bookshelf: 'estantería', 'side-table': 'mesa', closet: 'clóset', 'tv-stand': 'mueble' };
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run src/engine/templates src/engine/order.test.ts`. Expected: PASS.

Then run `pnpm test`, `pnpm typecheck` and `pnpm demo` (the bookshelf output must be unchanged), and `npx tsc --noEmit` in `mobile/`. Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/engine/templates/tv-stand.ts src/engine/templates/tv-stand.test.ts src/engine/templates/templates.test.ts src/engine/order.test.ts src/engine/index.ts mobile/src/app/templates.tsx
git commit -m "feat(engine): add the two-bay TV stand template"
```

(Add the `Co-Authored-By:` trailer.)

---

### Task 4: Docs, browser check and final verification

**Files:**
- Modify: `CLAUDE.md`, `docs/superpowers/specs/2026-09-25-drawers-tv-stand-design.md`

**Interfaces:**
- Consumes: everything above; this task documents the code as built and verifies it in both clients.
- Produces: nothing.

- [ ] **Step 1: CLAUDE.md conventions**

In `CLAUDE.md`, replace this exact text:

`- Building blocks live in \`src/engine/parts/\`. A block such as \`doorSet\` returns a fragment \`{ panels, placements, hardware, fittings, boring, steps }\` that a template merges with its own parts. Blocks never validate; templates do, using the block's helpers (e.g. \`doorWidth\`). Doors are full overlay:`

with:

`- Building blocks live in \`src/engine/parts/\`. A block (\`doorSet\`, \`drawerSet\`) returns a \`PartSet\` — \`{ panels, placements, hardware, fittings, boring, steps }\` — that a template merges with its own parts, passing all hardware through \`mergeHardware\` so equal items become one line. Blocks never validate; templates do, using the block's helpers (e.g. \`doorWidth\`, \`drawerFrontHeight\`, \`MIN_DRAWER_FRONT\`). Doors are full overlay:`

Directly after the line `  - doors need a board of at least \`MIN_DOOR_THICKNESS\` (15 mm) behind the 12 mm cup; templates validate it.`, insert:

```markdown
- Drawers (`drawerSet`) stack in 1–2 side-by-side columns (`stacks`), with 3 mm between fronts and 2 mm at the ends. Each drawer is:
  - a screwed box: 2 sides, 2 ends, and a Fibracel bottom screwed underneath;
  - running on telescopic slides: `slideFor` picks the longest 10"–22" pair that leaves 10 mm behind it;
  - sized from the slide: the box is the slide's length, 26 mm narrower than its opening and 40 mm lower than its front;
  - finished with a separate front banded all round, fixed last so the fronts line up after the boxes run.

  Drawers are drawn pulled out a third of their slide. Every front keeps 2 mm to the edge of the area it covers, so neighbouring blocks (closet drawers and doors, TV stand bays) sit 4 mm apart. `spanishList` in `labels.ts` builds every "a, b y c" in step copy.
```

- [ ] **Step 2: Phase 5 status**

Replace the line `  - **5.2 Drawers**: a drawer-box block and slides (new \`Hardware\` type), a drawer option on the closet, and a TV stand.` with:

```markdown
  - **5.2 Drawers + TV stand** — spec: `docs/superpowers/specs/2026-09-25-drawers-tv-stand-design.md`.
    - `drawerSet` building block: telescopic slides, a screwed box plus a separate front, drawn pulled out. `mergeHardware` keeps one line per hardware item.
    - Closet "Cajones" 0–3 under a drawer shelf, with the doors above it.
    - "Mueble para TV": two bays split by a divider, each Cajones or Entrepaño; the back stops 100 mm short of the top as a cable slot.
    - *Implemented; awaiting user approval.*
```

- [ ] **Step 3: Record the plan's refinements in the spec**

In `docs/superpowers/specs/2026-09-25-drawers-tv-stand-design.md`:
- Replace `5. **Pon las jaladeras.** Drill 2 holes` with `5. **Pon las jaladeras de los cajones.** (Named apart from the doors' step, since both can appear in one closet.) Drill 2 holes`.
- Replace `  - Box outside width \`wb = (openingRight − openingLeft) − 26\` (12.7 mm slide clearance each side).` with `  - Box outside width \`wb = ⌊(openingRight − openingLeft) − 26⌋\` (12.7 mm slide clearance each side, rounded down to whole mm).`
- Replace `\`bay = (W − 3t) / 2\` is each bay's inside width` with `\`bay = ⌊(W − 3t) / 2⌋\` is each bay's inside width (rounded down to whole mm)`.
- Replace `4. **Instala el entrepaño**, only when a bay is Entrepaño, with 2 confirmat per end.` with `4. **Instala el entrepaño** (**Instala los entrepaños** when both bays are Entrepaño), only when a bay is Entrepaño, with 2 confirmat per end.`

- [ ] **Step 4: Browser check (web)**

Start the dev server with the preview tool (`preview_start` with name `dev`, port 5173; never start it via Bash). Walk through each item below and record PASS or FAIL with evidence (values seen, screenshots):

1. **Closet, Colgar, Cajones 2, Puertas Dos.**
   - 3D: two drawers pulled out under the open doors, with steel handles.
   - Pasos: 13 steps. "Monta las correderas" reads `172 · 375 mm del piso`, and selecting "Pon los frentes" highlights the fronts.
   - Pedido: pieces include Techo de cajones, Frente de cajón, Costado de cajón, Frente y trasera de cajón and Fondo de cajón (in the Fibracel group); Herrajes lists each item once, including `Corredera telescópica (par) 20" (508 mm) × 2` and `Jaladera 128 mm × 4`.
2. **Closet, Mixto, Cajones 2.** The message "No caben la zona de colgar…" shows under Alto.
3. **"Mueble para TV" default.**
   - 3D: two drawers on the left, a shelf on the right, and the back ending below the top.
   - The Cortes tab lists the sheets without errors.
4. **TV stand, Bahía derecha = Cajones.** Four drawers, with no overlapping geometry visible.
5. **TV stand, Ancho 1700.** The span message shows under Ancho.
6. **PDF.** The hidden print DOM contains "Mueble para TV" and "Corredera telescópica" (check with `javascript_tool`).
7. **Console.** No console errors.

- [ ] **Step 5: Final verification**

- At the root: `pnpm test`, `pnpm typecheck`, `pnpm demo`.
- In `mobile/`: `npx tsc --noEmit`, and `npx expo export --platform ios --output-dir "$TMP/expo-drawers"`.

Paste the tails of the output into the report.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-09-25-drawers-tv-stand-design.md
git commit -m "docs: record drawer and TV stand conventions for Phase 5.2"
```

(Add the `Co-Authored-By:` trailer.)
