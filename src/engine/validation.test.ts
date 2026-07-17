import { describe, expect, it } from 'vitest';
import { paramIssues, resolveParams, spanIssue } from './validation.ts';
import { DEFAULT_CONFIG } from './types.ts';
import { bookshelf } from './templates/bookshelf.ts';

const specs = bookshelf.params;

describe('resolveParams', () => {
  it('fills missing params with defaults', () => {
    const p = resolveParams(specs, { width: 600 });
    expect(p['width']).toBe(600);
    expect(p['height']).toBe(1200);
    expect(p['thickness']).toBe(18);
  });

  it('drops unknown keys', () => {
    const p = resolveParams(specs, { bogus: 1 });
    expect(p['bogus']).toBeUndefined();
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

  it('rejects unsupported thickness', () => {
    const issues = paramIssues(specs, resolveParams(specs, { thickness: 14 }));
    expect(issues).toHaveLength(1);
    expect(issues[0]!.paramKey).toBe('thickness');
    expect(issues[0]!.message).toContain('12, 15, 18');
  });

  it('rejects non-finite values', () => {
    expect(paramIssues(specs, resolveParams(specs, { width: NaN }))).toHaveLength(1);
  });
});

describe('spanIssue', () => {
  it('allows spans at or under the limit', () => {
    expect(spanIssue(800, 18, DEFAULT_CONFIG)).toBeNull();
    expect(spanIssue(500, 12, DEFAULT_CONFIG)).toBeNull();
  });

  it('blocks spans over the limit with a Spanish message', () => {
    const issue = spanIssue(600, 12, DEFAULT_CONFIG);
    expect(issue).not.toBeNull();
    expect(issue!.message).toContain('600 mm');
    expect(issue!.message).toContain('500 mm');
    expect(issue!.message).toContain('triplay de 12 mm');
  });
});
