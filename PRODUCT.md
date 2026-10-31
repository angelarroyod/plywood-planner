# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

First-time makers in Mexico furnishing small homes. Most own no table saw; some own a small welder. They plan on a laptop at home, then follow cuts and build steps on a phone: at the maderería or hardware store counter, and propped on a sawhorse in a garage, patio or rooftop, often in bright daylight or dust.

## Product Purpose

Turn a furniture or metal project into everything needed to build it. The user picks a template and sets safe sizes. They get a 3D model, an optimized cut plan (sheets for wood, 6.10 m bars for tube), an order or shopping list for the store, and numbered build steps with the tools each one needs. Metal projects also get welding machine settings. Everything exports to PDF. Success: a beginner walks into a maderería with an order the counter can cut and band as written, and finishes the piece without guessing.

## Positioning

Cut optimizers (CutList Optimizer, Opticorte, Arauco TABLERED) stop at pieces; pro suites (Corte Cloud, MuebleMIO, Polyboard) assume a carpenter. This product alone goes furniture → pieces → yard order → build steps for a beginner, in Mexican materials, sheet sizes and trade vocabulary.

## Operating Context

- Lumber yards (madererías) cut and edge-band to order (~$3.9 MXN/m cut, $8–25 MXN/m band). The order text is shown or shared at the counter.
- Hardware and steel stores sell PTR tube in 6.10 m bars and welding consumables.
- Materials: pine plywood 12/15/18 mm, white melamine 16 mm and Fibracel 3 mm, all in 1220 × 2440 sheets.
- Prices are typed in by the user; the app never invents them.
- All measurements are millimetres.
- Two modes: Madera (board furniture) and Metal (welded square tube).
- Main views: 3D design, cuts, build steps, and order or shopping list.

## Capabilities and Constraints

- Every template is a pure function `(params) => Design`; all views derive from it. The engine is shared unchanged with the Expo iOS app.
- UI copy is Spanish (es-MX).
- Web stack: Vite, React 18, TypeScript, Tailwind v4, react-three-fiber/drei, Zustand. New dependencies need the owner's approval.
- This redesign pass covers the web app only. The iOS app follows later from the documented system.
- No backend until Phase 6.

## Brand Commitments

- Both a light and a dark theme, with a toggle (confirmed by the owner).
- Quality bar, in the owner's words: it must never look like "a cheap vibe code app with 0 sense of design and aesthetics".
- The product name "Planificador" and the current mark exist but are not pinned.

## Evidence on Hand

- Real templates and engine output: bookshelf, side table, modular closet, TV stand, PTR table, stool, shelving unit.
- Market research notes live in CLAUDE.md.
- There are no testimonials, customers, partners or usage numbers. Never fabricate them.

## Product Principles

1. **Beginner first.** Every screen should feel doable to someone who has never built furniture, never like CAD.
2. **The measurement is the product.** Numbers, cut lists and settings must be the most legible thing on the screen, in any light.
3. **One source of truth.** 3D, cuts, steps and orders always agree, because they come from one design.
4. **Honest.** No invented prices, claims or capabilities; estimates are labelled as estimates.
5. **Works where the work happens.** Plan at the desk and follow at the bench, so the phone layout is first-class.

## Accessibility & Inclusion

- WCAG AA contrast in both themes, and readable in bright outdoor light.
- Screen text is never below 11 px.
- Full keyboard use with a skip link; reduced motion respected.
