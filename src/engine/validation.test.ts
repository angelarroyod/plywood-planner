import { describe, expect, it } from 'vitest';
import { paramIssues, resolveParams, spanIssue } from './validation.ts';
import { getStock } from './stock.ts';
import { bookshelf } from './templates/bookshelf.ts';

const specs = bookshelf.params;

describe('resolveParams', () => {
  it('fills missing params with defaults', () => {
    const p = resolveParams(specs, { width: 600 });
    expect(p['width']).toBe(600);
    expect(p['height']).toBe(1200);
    expect(p['material']).toBe(3);
  });

  it('drops unknown keys', () => {
    const p = resolveParams(specs, { bogus: 1, thickness: 18 });
    expect(p['bogus']).toBeUndefined();
    expect(p['thickness']).toBeUndefined();
  });
});

describe('paramIssues', () => {
  it('accepts defaults', () => {
    expect(paramIssues(specs, resolveParams(specs, {}))).toEqual([]);
  });

  it('rejects out-of-range number with Spanish message', () => {
    const issues = paramIssues(specs, resolveParams(specs, { width: 5000 }));
    expect(issues).toHaveLength(1);
    expect(issues[0]!.paramKey).toBe('width');
    expect(issues[0]!.message).toContain('Ancho');
    expect(issues[0]!.message).toContain('entre 300 y 1200 mm');
  });

  it('rejects a material outside the options, listing their labels', () => {
    const issues = paramIssues(specs, resolveParams(specs, { material: 99 }));
    expect(issues).toHaveLength(1);
    expect(issues[0]!.paramKey).toBe('material');
    expect(issues[0]!.message).toBe(
      '«Material» debe ser uno de: Triplay de pino 12 mm, Triplay de pino 15 mm, ' +
        'Triplay de pino 18 mm, Melamina blanca 16 mm.',
    );
  });

  it('rejects the back-only Fibracel as a material', () => {
    expect(paramIssues(specs, resolveParams(specs, { material: 5 }))).toHaveLength(1);
  });

  it('rejects non-finite values', () => {
    expect(paramIssues(specs, resolveParams(specs, { width: NaN }))).toHaveLength(1);
  });
});

describe('spanIssue', () => {
  it('allows spans at or under the stock limit', () => {
    expect(spanIssue(800, getStock(3))).toBeNull();
    expect(spanIssue(500, getStock(1))).toBeNull();
    expect(spanIssue(550, getStock(4))).toBeNull();
  });

  it('blocks spans over the limit, naming the material', () => {
    const issue = spanIssue(600, getStock(1));
    expect(issue).not.toBeNull();
    expect(issue!.message).toBe(
      'El claro de 600 mm supera el máximo seguro de 500 mm para triplay de pino 12 mm. ' +
        'Reduce el ancho o elige un material más grueso.',
    );
    expect(spanIssue(768, getStock(4))!.message).toContain('melamina blanca 16 mm');
  });

  it('throws for a stock that can never be a shelf', () => {
    expect(() => spanIssue(100, getStock(5))).toThrow(/Fibracel/);
  });
});
