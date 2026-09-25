import { bandEdges } from '../edge-banding.ts';
import type {
  Boring,
  EdgeBandingMode,
  Fitting,
  Hardware,
  Panel,
  Placement,
  Step,
  Stock,
  Vec3,
} from '../types.ts';

const GAP = 2; // mm around a door's outer edges
const PAIR_GAP = 3; // mm between the two doors of a pair
const HINGE_END = 100; // mm from each door end to its outer hinge cups
const CUP = { diameter: 35, depth: 12, fromEdge: 22 }; // mm, the standard 35 mm cup-hinge boring
const PLATE_SETBACK = 37; // mm from a side's front edge to the hinge plate
const HANDLE_SPACING = 128; // mm between a bar handle's screws
const HANDLE_HEIGHT = 1050; // mm from the floor to a handle's center
const HANDLE_FROM_EDGE = 40; // mm from the door's closing edge
const HANDLE_BOX: Vec3 = [30, 160, 12]; // mm; sticks 30 mm out of the open door's outer face
const PLATE_HALF = 25; // mm; a hinge plate and its arm take about 50 mm of the side's height

export const MIN_DOOR_THICKNESS = 15; // mm; the 12 mm cup needs 3 mm of board behind it

export interface DoorSetOptions {
  count: 0 | 1 | 2;
  width: number; // outer width of the case front the doors cover
  bottom: number; // y where the covered front starts
  top: number; // y where it ends
  frontZ: number; // z of the case front
  stock: Stock;
  mode: EdgeBandingMode;
  avoid?: { bottom: number; top: number }[]; // floor-y ranges of the case's fixed horizontal panels the hinge plates must clear
}

/** A design fragment a template merges with its own parts. */
export interface DoorSet {
  panels: Panel[];
  placements: Placement[];
  hardware: Hardware[];
  fittings: Fitting[];
  boring: Boring[];
  steps: Omit<Step, 'order'>[];
}

/** Cup hinges per door by its height, the usual rule for 35 mm hinges. */
export function hingeCount(doorHeight: number): number {
  if (doorHeight <= 900) return 2;
  if (doorHeight <= 1600) return 3;
  if (doorHeight <= 2000) return 4;
  return 5;
}

/** Width of each full-overlay door when `count` doors cover a case front `width` wide. */
export function doorWidth(count: 1 | 2, width: number): number {
  return count === 1 ? width - 2 * GAP : Math.floor((width - 2 * GAP - PAIR_GAP) / 2);
}

/** The height nearest `y` where a hinge plate clears every fixed panel; a tie goes toward the door's middle. */
function clearHeight(y: number, avoid: { bottom: number; top: number }[], middle: number): number {
  const clash = (v: number) => avoid.find((r) => v + PLATE_HALF > r.bottom && v - PLATE_HALF < r.top);
  const hit = clash(y);
  if (!hit) return y;
  const options = [Math.floor(hit.bottom - PLATE_HALF), Math.ceil(hit.top + PLATE_HALF)].filter((v) => !clash(v));
  options.sort((a, b) => Math.abs(a - y) - Math.abs(b - y) || Math.abs(a - middle) - Math.abs(b - middle));
  return options[0] ?? y; // ponytail: shelves stand ≥ 100 mm apart, so one side always clears
}

/**
 * Full-overlay doors on 35 mm cup hinges, drilled by the lumber yard. Doors are drawn swung
 * open 90° so the interior stays visible: each stands in front of its side, sticking out
 * forward. A single door hinges on the left. The block does not validate — templates do.
 */
export function doorSet(o: DoorSetOptions): DoorSet {
  if (o.count === 0) return { panels: [], placements: [], hardware: [], fittings: [], boring: [], steps: [] };

  const t = o.stock.thickness;
  const h = o.top - o.bottom - 2 * GAP;
  const w = doorWidth(o.count, o.width);
  const k = hingeCount(h);
  const doorBottom = o.bottom + GAP;
  const doorTop = doorBottom + h;
  const even = Array.from({ length: k }, (_, i) => Math.round(HINGE_END + (i * (h - 2 * HINGE_END)) / (k - 1)));
  const plates = even.map((a) => clearHeight(doorTop - a, o.avoid ?? [], doorBottom + h / 2)).sort((a, b) => a - b);
  const along = plates.map((y) => doorTop - y).sort((a, b) => a - b);
  const handleY = Math.min(Math.max(HANDLE_HEIGHT, doorBottom + 100), doorTop - 100);
  const pair = o.count === 2;
  const sides = pair ? [-1, 1] : [-1]; // −1 = hinged on the left

  const placements: Placement[] = sides.map((s, i): Placement => ({
    panelId: 'door',
    instance: i,
    position: [s * (o.width / 2 - t / 2), doorBottom + h / 2, o.frontZ + w / 2],
    size: [t, h, w],
  }));
  const fittings: Fitting[] = sides.map((s, i): Fitting => ({
    id: 'handle',
    instance: i,
    label: 'Jaladera',
    position: [s * (o.width / 2 + HANDLE_BOX[0] / 2), handleY, o.frontZ + w - HANDLE_FROM_EDGE],
    size: [...HANDLE_BOX],
  }));

  const steps: Omit<Step, 'order'>[] = [
    {
      title: 'Monta las placas',
      description:
        `Atornilla las placas de las bisagras en la cara interior ${pair ? 'de cada lateral' : 'del lateral izquierdo'}, ` +
        `a ${PLATE_SETBACK} mm del frente, a ${plates.join(' · ')} mm del piso. ` +
        `Las puertas vienen barrenadas de la maderería; si las barrenas tú: broca Forstner de ${CUP.diameter} mm, ` +
        `${CUP.depth} mm de profundidad, centro a ${CUP.fromEdge} mm del canto.`,
      panelRefs: ['door'],
    },
    {
      title: pair ? 'Cuelga las puertas' : 'Cuelga la puerta',
      description:
        'Engancha cada bisagra en su placa y ajústala con sus tornillos (lado, fondo y altura) hasta dejar ' +
        `${GAP} mm de luz alrededor${pair ? ` y ${PAIR_GAP} mm entre las puertas` : ''}.`,
      panelRefs: ['door'],
      explodeOffsets: { door: [0, 0, 150] },
    },
    {
      title: pair ? 'Pon las jaladeras' : 'Pon la jaladera',
      description:
        `Barrena 2 agujeros de 5 mm separados ${HANDLE_SPACING} mm, a ${HANDLE_FROM_EDGE} mm del canto que cierra ` +
        `y centrados a ${Math.round(handleY)} mm del piso, y atornilla ${pair ? 'cada jaladera' : 'la jaladera'}.`,
      panelRefs: ['door', 'handle'],
    },
  ];

  return {
    panels: [
      {
        id: 'door',
        label: 'Puerta',
        length: h,
        width: w,
        stock: o.stock,
        grain: 'length',
        edges: bandEdges(o.mode, 'L1', 'L2', 'A1', 'A2'),
        qty: o.count,
      },
    ],
    placements,
    hardware: [
      { type: 'hinge', size: '35 mm recta', qty: o.count * k },
      { type: 'handle', size: `${HANDLE_SPACING} mm`, qty: o.count },
    ],
    fittings,
    boring: [{ panelId: 'door', kind: 'hinge-cup', ...CUP, along }],
    steps,
  };
}
