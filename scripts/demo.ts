// Dev-only script: prints the default bookshelf cut layout. Run: pnpm demo
// Lives outside src/engine/ so the engine stays free of Node-specific entry points.
import { nest } from '../src/engine/nesting.ts';
import { renderAscii } from '../src/engine/ascii.ts';
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
      panels: result.design.panels.map((p) => `${p.id} ${p.length}x${p.width}x${p.thickness} x${p.qty}`),
      sheets: layout.sheets.length,
      wastePercent: Number(layout.wastePercent.toFixed(1)),
    },
    null,
    2,
  ),
);
