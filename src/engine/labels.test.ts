import { describe, expect, it } from 'vitest';
import { spanishList } from './labels.ts';

describe('spanishList', () => {
  it('joins with commas and a final "y"', () => {
    expect(spanishList(['a'])).toBe('a');
    expect(spanishList(['a', 'b'])).toBe('a y b');
    expect(spanishList(['a', 'b', 'c'])).toBe('a, b y c');
  });
});
