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
