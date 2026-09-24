import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EDGE_BANDING,
  EDGE_BANDING_NOTE,
  EDGE_BANDING_OPTIONS,
  EDGE_TRIM,
  NO_EDGES,
  bandEdges,
  bandSegments,
  edgeBandTotals,
  edgeBandingMode,
  edgeCodes,
  ironStep,
  prepSentence,
} from './edge-banding.ts';
import { getStock } from './stock.ts';
import type { Panel, PlacedPiece } from './types.ts';

const PLY18 = getStock(3);
const MELAMINA = getStock(4);
const FIBRACEL = getStock(5);

function panel(over: Partial<Panel> = {}): Panel {
  return {
    id: 'p',
    label: 'P',
    length: 1000,
    width: 300,
    stock: PLY18,
    grain: 'length',
    edges: NO_EDGES,
    qty: 1,
    ...over,
  };
}

describe('edgeBandingMode', () => {
  it('decodes the Cubrecanto select', () => {
    expect(EDGE_BANDING_OPTIONS).toEqual([
      { value: 0, label: 'Sin cubrecanto' },
      { value: 1, label: 'Lo aplica la maderería' },
      { value: 2, label: 'Lo aplico yo (plancha)' },
    ]);
    expect(DEFAULT_EDGE_BANDING).toBe(1);
    expect([0, 1, 2].map((v) => edgeBandingMode(v))).toEqual(['none', 'yard', 'diy']);
  });

  it('throws on any other value', () => {
    expect(() => edgeBandingMode(3)).toThrow(/3/);
  });
});

describe('bandEdges / edgeCodes', () => {
  it('bands the named edges', () => {
    expect(bandEdges('yard', 'L1', 'A1')).toEqual({ L1: true, L2: false, A1: true, A2: false });
    expect(bandEdges('diy', 'L1', 'L2', 'A1', 'A2')).toEqual({ L1: true, L2: true, A1: true, A2: true });
  });

  it('bands nothing when banding is off', () => {
    expect(bandEdges('none', 'L1', 'A1')).toEqual(NO_EDGES);
  });

  it('lists codes in parts-list order', () => {
    expect(edgeCodes({ L1: false, L2: true, A1: true, A2: false })).toBe('L2 A1');
    expect(edgeCodes(bandEdges('yard', 'A2', 'L1'))).toBe('L1 A2');
    expect(edgeCodes(NO_EDGES)).toBe('—');
  });
});

describe('edgeBandTotals', () => {
  it('adds edge lengths plus trim per edge, times quantity, rounded up to 0.1 m', () => {
    // (1000 + 30) + (300 + 30) = 1360 mm per piece × 2 = 2720 mm → 2.8 m
    expect(EDGE_TRIM).toBe(30);
    expect(edgeBandTotals([panel({ edges: bandEdges('yard', 'L1', 'A1'), qty: 2 })])).toEqual([
      { label: 'Cubrecanto de chapa de pino 22 mm', meters: 2.8, edges: 4 },
    ]);
  });

  it('groups by band label in first-seen order', () => {
    const totals = edgeBandTotals([
      panel({ id: 'mel', stock: MELAMINA, edges: bandEdges('yard', 'L1') }), // 1030
      panel({ id: 'ply', edges: bandEdges('yard', 'L1') }), // 1030
      panel({ id: 'mel2', stock: MELAMINA, edges: bandEdges('yard', 'L1', 'L2') }), // 2060
    ]);
    expect(totals).toEqual([
      { label: 'Cubrecanto PVC blanco 19 × 0.45 mm', meters: 3.1, edges: 3 }, // 3090 mm
      { label: 'Cubrecanto de chapa de pino 22 mm', meters: 1.1, edges: 1 }, // 1030 mm
    ]);
  });

  it('skips unbandable stock and panels with no banded edge', () => {
    expect(
      edgeBandTotals([panel({ stock: FIBRACEL, edges: bandEdges('yard', 'L1') }), panel({ edges: NO_EDGES })]),
    ).toEqual([]);
    expect(edgeBandTotals([])).toEqual([]);
  });
});

describe('prepSentence', () => {
  it('sands plywood and reminds that the yard applied the band', () => {
    expect(prepSentence(PLY18, 'yard')).toBe(
      'Lija todas las piezas con grano 180. ' +
        'Revisa que la maderería haya enchapado los cantos marcados en la lista de cortes.',
    );
  });

  it('never sands melamine', () => {
    expect(prepSentence(MELAMINA, 'diy')).toBe('Limpia las piezas con un trapo húmedo; la melamina no se lija.');
  });

  it('warns when melamine edges stay raw', () => {
    expect(prepSentence(MELAMINA, 'none')).toBe(
      'Limpia las piezas con un trapo húmedo; la melamina no se lija. ' +
        'Sin cubrecanto, los cantos de melamina absorben humedad y se despostillan: séllalos con pintura o barniz.',
    );
  });

  it('does not warn about raw plywood edges', () => {
    expect(prepSentence(PLY18, 'none')).toBe('Lija todas las piezas con grano 180.');
  });
});

describe('ironStep / EDGE_BANDING_NOTE', () => {
  it('describes applying pre-glued band with an iron', () => {
    expect(ironStep(['top'])).toEqual({
      title: 'Aplica el cubrecanto',
      description:
        'Con la plancha a temperatura media y sin vapor, pasa despacio sobre el cubrecanto pre-engomado ' +
        'en cada canto marcado en la lista de cortes. Deja enfriar y recorta el sobrante con un cúter.',
      panelRefs: ['top'],
    });
  });

  it('says who applies the band', () => {
    expect(EDGE_BANDING_NOTE).toEqual({
      yard: 'Lo aplica la maderería en los cantos marcados.',
      diy: 'Lo aplicas tú con plancha (cubrecanto pre-engomado).',
    });
  });
});

describe('bandSegments', () => {
  const piece: PlacedPiece = { panelId: 'p', instance: 0, x: 100, y: 200, length: 1000, width: 300, rotated: false };

  it('maps unrotated edges: L down the sides, A across the ends', () => {
    expect(bandSegments(piece, bandEdges('yard', 'L1', 'A2'), 7)).toEqual([
      { x1: 107, y1: 200, x2: 107, y2: 1200 }, // L1 = left
      { x1: 100, y1: 1193, x2: 400, y2: 1193 }, // A2 = bottom
    ]);
  });

  it('turns the mapping a quarter for rotated pieces', () => {
    const rotated: PlacedPiece = { ...piece, length: 300, width: 1000, rotated: true };
    expect(bandSegments(rotated, bandEdges('yard', 'L1', 'A1'), 7)).toEqual([
      { x1: 100, y1: 207, x2: 1100, y2: 207 }, // L1 = top
      { x1: 107, y1: 200, x2: 107, y2: 500 }, // A1 = left
    ]);
  });

  it('returns nothing for an unbanded piece', () => {
    expect(bandSegments(piece, NO_EDGES, 7)).toEqual([]);
  });
});
