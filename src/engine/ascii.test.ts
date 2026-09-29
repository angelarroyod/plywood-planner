import { describe, expect, it } from 'vitest';
import { renderAscii } from './ascii.ts';
import { nest } from './nesting.ts';
import { bookshelf } from './templates/bookshelf.ts';

describe('renderAscii', () => {
  it('renders the default bookshelf layout', () => {
    const result = bookshelf.generate({});
    if (!result.ok) throw new Error('default bookshelf must validate');
    const output = renderAscii(nest(result.design.panels));

    console.log(output); // visual check in test output

    expect(output).toContain('Sheet 1 — Triplay de pino 18 mm (1220x2440mm');
    expect(output).toContain('A = side#0');
    expect(output).toMatch(/Triplay de pino 18 mm: \d+ sheet\(s\), waste \d+\.\d%/);
  });

  it('renders an empty result', () => {
    expect(renderAscii(nest([]))).toBe('Total sheets: 0');
  });
});
