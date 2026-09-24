// Dev-only script: prints the default bookshelf cut layout. Run: pnpm demo
// Lives outside src/engine/ so the engine stays free of Node-specific entry points.
import { nest } from '../src/engine/nesting.ts';
import { renderAscii } from '../src/engine/ascii.ts';
import { edgeBandTotals } from '../src/engine/edge-banding.ts';
import { cutTotals } from '../src/engine/cuts.ts';
import { bookshelf } from '../src/engine/templates/bookshelf.ts';

const result = bookshelf.generate({});
if (!result.ok) {
  console.error('Validation failed:', JSON.stringify(result.issues, null, 2));
  throw new Error('default params should always validate');
}

const layout = nest(result.design.panels);
console.log(renderAscii(layout));
console.log(
  JSON.stringify(
    {
      panels: result.design.panels.map(
        (p) => `${p.id} ${p.length}x${p.width}x${p.stock.thickness} ${p.stock.label} x${p.qty}`,
      ),
      byStock: layout.byStock.map((g) => ({
        stock: g.stock.label,
        sheets: g.sheets,
        wastePercent: Number(g.wastePercent.toFixed(1)),
      })),
      edgeBanding: edgeBandTotals(result.design.panels),
      cuts: cutTotals(layout),
    },
    null,
    2,
  ),
);
