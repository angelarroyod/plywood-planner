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
