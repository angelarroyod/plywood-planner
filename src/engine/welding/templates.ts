import type { ParamSpec, Placement, TemplateParams, ValidationIssue, Vec3 } from '../types.ts';
import { paramIssues, resolveParams } from '../validation.ts';
import {
  FINISH_OPTIONS,
  GAUGE_OPTIONS,
  PROCESS_OPTIONS,
  SIZE_OPTIONS,
  TUBE_SIZES,
  paintFinish,
  tube,
  tubeSize,
  weldProcess,
  weldSettings,
  type ToolId,
  type Tube,
} from './catalog.ts';
import type { Member, Suggestion, WeldDesign, WeldResult, WeldStep, WeldTemplate } from './types.ts';

const LOW_RAIL_HEIGHT = 150; // mm, bottom of a table's lower frame
const SHELF_CLEARANCE = 100; // mm, bottom of a shelving unit's first frame
const MIN_SHELF_GAP = 200; // mm clear between shelf frames
const MAX_SPAN_RATIO = 40; // unsupported rail length per mm of tube side before it sags
const MAX_LEG_RATIO = 25; // leg length per mm of tube side before an unbraced frame racks
const HEAVY_KG = 25;

const common = {
  size: (def: number): ParamSpec => ({ kind: 'select', key: 'size', label: 'Perfil', unit: '', options: SIZE_OPTIONS, default: def }),
  gauge: (def: number): ParamSpec => ({ kind: 'select', key: 'gauge', label: 'Calibre (pared)', unit: '', options: GAUGE_OPTIONS, default: def }),
  joint: { kind: 'select', key: 'joint', label: 'Uniones del marco', unit: '', default: 1, options: [{ value: 1, label: 'Rectas (más fácil)' }, { value: 2, label: 'A 45° (más limpio)' }] } satisfies ParamSpec,
  process: { kind: 'select', key: 'process', label: 'Proceso de soldadura', unit: '', options: PROCESS_OPTIONS, default: 1 } satisfies ParamSpec,
  finish: { kind: 'select', key: 'finish', label: 'Color final', unit: '', options: FINISH_OPTIONS, default: 1 } satisfies ParamSpec,
  lower: (label: string): ParamSpec => ({ kind: 'select', key: 'lower', label, unit: '', default: 1, options: [{ value: 1, label: 'Sí' }, { value: 0, label: 'No' }] }),
};

/** Shape of a four-legged frame: either a frame sitting on the legs (table, stool) or frames between them (shelving). */
interface FrameSpec {
  templateId: string;
  p: TemplateParams; // resolved
  W: number;
  D: number;
  H: number;
  cap: 'square' | 'miter' | null; // frame on top of the legs, and how its corners join
  levels: { id: string; name: string; long: string; short: string; bottoms: number[] }; // frames between the legs
  board: { what: string; count: number; length: number; width: number }; // the wood the frame carries
}

/** Every number the steps and suggestions need, worked out once. */
function frameDesign(spec: FrameSpec, t: Tube, extra: Suggestion[]): WeldDesign {
  const { W, D, H, cap, levels, p } = spec;
  const s = t.side;
  const process = weldProcess(p['process']!);
  const finish = paintFinish(p['finish']!);
  const settings = weldSettings(process, t.wall);
  const between = (n: number) => Math.floor(n - 2 * s); // rail that fits between two legs
  const legLength = Math.floor(cap ? H - s : H);

  const members: Member[] = [{ id: 'leg', label: 'Pata', length: legLength, ends: 'square', qty: 4 }];
  if (cap) {
    members.push(
      { id: 'top-long', label: 'Larguero superior', length: W, ends: cap, qty: 2 },
      { id: 'top-short', label: 'Travesaño superior', length: cap === 'miter' ? D : between(D), ends: cap, qty: 2 },
    );
  }
  const nLevels = levels.bottoms.length;
  if (nLevels > 0) {
    members.push(
      { id: `${levels.id}-long`, label: levels.long, length: between(W), ends: 'square', qty: 2 * nLevels },
      { id: `${levels.id}-short`, label: levels.short, length: between(D), ends: 'square', qty: 2 * nLevels },
    );
  }

  // Assembly space: x = width, y = up, z = depth with +z the front; floor at y = 0.
  const xL = W / 2 - s / 2;
  const zL = D / 2 - s / 2;
  const placements: Placement[] = [];
  const corners: [number, number][] = [[-xL, -zL], [xL, -zL], [-xL, zL], [xL, zL]];
  corners.forEach(([x, z], i) => placements.push({ panelId: 'leg', instance: i, position: [x, legLength / 2, z], size: [s, legLength, s] }));
  const ring = (id: string, y: number, first: number, longLen: number) => {
    [-zL, zL].forEach((z, i) => placements.push({ panelId: `${id}-long`, instance: first + i, position: [0, y, z], size: [longLen, s, s] }));
    // ponytail: a mitered short rail is drawn at its between-the-long-rails length; boxes can't show a 45° end
    [-xL, xL].forEach((x, i) => placements.push({ panelId: `${id}-short`, instance: first + i, position: [x, y, 0], size: [s, s, between(D)] }));
  };
  if (cap) ring('top', H - s / 2, 0, W);
  levels.bottoms.forEach((b, i) => ring(levels.id, b + s / 2, 2 * i, between(W)));

  // Every joint is welded all round the tube; a 45° seam runs √2 longer on each face.
  const capJoints = cap ? 8 : 0;
  const joints = capJoints + 8 * nLevels;
  const weldLength = Math.round(4 * s * (joints + (cap === 'miter' ? 4 * (Math.SQRT2 - 1) : 0)));

  const kg = members.reduce((sum, m) => sum + (m.length * m.qty * t.kgPerM) / 1000, 0);
  const steps = frameSteps(settings.start);
  const tools = [...new Set(steps.flatMap((st) => st.tools))];

  return {
    templateId: spec.templateId,
    params: p,
    tube: t,
    process,
    finish,
    settings,
    members,
    placements,
    joints,
    weldLength,
    weight: Math.round(kg * 10) / 10,
    steps,
    tools,
    suggestions: [...extra, ...commonSuggestions(spec, t, settings.start, kg)],
  };

  function frameSteps(amps: number): WeldStep[] {
    const topY = H - s / 2; // center of the highest rails
    const heroId = cap ? 'top-long' : `${levels.id}-long`;
    const heroEnd = cap ? W / 2 : W / 2 - s;
    const slag = process.slag ? ' Quita la escoria con la piqueta antes de seguir.' : '';
    const miterNote =
      cap === 'miter'
        ? ' Los 4 del marco superior van a 45° en ambas puntas, medidos de punta larga a punta larga.'
        : '';
    const cutCount = members.reduce((n, m) => n + m.qty, 0);

    const list: Omit<WeldStep, 'order'>[] = [
      {
        title: 'Mide, marca y corta',
        description:
          `Corta las ${cutCount} piezas de la pestaña Cortes. Marca con escuadra todo alrededor del tubo y corta ` +
          `del lado del desperdicio; sujeta el tubo con prensa, nunca con la mano.${miterNote}`,
        panelRefs: members.map((m) => m.id),
        tools: ['tape', 'square', 'marker', 'clamp', 'saw'],
        action: { kind: 'cut', from: [heroEnd - 60, H + 70, zL], to: [heroEnd - 60, H - s - 5, zL], normal: [1, 0, 0] },
      },
      {
        title: 'Limpia las puntas',
        description:
          'Quita la rebaba de cada corte con el disco de láminas y deja el metal brillante 2 cm alrededor de cada unión; ' +
          'la grasa y la cascarilla hacen poros en la soldadura.',
        panelRefs: [heroId],
        tools: ['grinder'],
        action: { kind: 'grind', from: [heroEnd - 140, H, zL], to: [heroEnd - 30, H, zL], normal: [0, 1, 0] },
      },
    ];

    if (cap) {
      const tackAt: Vec3 = cap === 'miter' ? [W / 2 - s / 2, H, D / 2 - s / 2] : [xL, H, D / 2 - s];
      list.push(
        {
          title: 'Puntea el marco superior',
          description:
            `Arma el marco boca abajo sobre una superficie plana con las escuadras magnéticas. Da un punto de 1 segundo a ${amps} A ` +
            'en cada esquina y mide las dos diagonales: deben ser iguales antes de seguir.',
          panelRefs: ['top-long', 'top-short'],
          tools: ['welder', 'magnet', 'clamp', 'square'],
          action: { kind: 'tack', from: tackAt, to: tackAt, normal: [0, 1, 0] },
        },
        {
          title: 'Puntea las patas',
          description:
            'Con el marco boca abajo, para cada pata en una esquina por dentro del marco, revísala a escuadra en dos caras ' +
            'y puntéala por dos lados.',
          panelRefs: ['leg'],
          tools: ['welder', 'magnet', 'square'],
          action: { kind: 'tack', from: [xL, H - s, D / 2], to: [xL, H - s, D / 2], normal: [0, 0, 1] },
        },
      );
      if (nLevels > 0) {
        const b = levels.bottoms[0]!;
        list.push({
          title: `Puntea el ${levels.name}`,
          description:
            `Marca las 4 patas a ${b} mm del piso y puntea los travesaños entre ellas, con la marca en su cara de abajo.`,
          panelRefs: [`${levels.id}-long`, `${levels.id}-short`],
          tools: ['welder', 'tape', 'magnet'],
          action: { kind: 'tack', from: [W / 2 - s, b + s / 2, D / 2], to: [W / 2 - s, b + s / 2, D / 2], normal: [0, 0, 1] },
        });
      }
    } else {
      list.push(
        {
          title: 'Arma las dos escaleras laterales',
          description:
            `Acuesta dos patas en el piso, marca las alturas ${levels.bottoms.join(', ')} mm y puntea los travesaños cortos ` +
            `entre ellas a ${amps} A. Repite con las otras dos patas.`,
          panelRefs: ['leg', `${levels.id}-short`],
          tools: ['welder', 'tape', 'magnet', 'square'],
          action: { kind: 'tack', from: [W / 2, topY, D / 2 - s], to: [W / 2, topY, D / 2 - s], normal: [1, 0, 0] },
        },
        {
          title: 'Une las escaleras con los largueros',
          description: 'Para las dos escaleras y puntea los largueros de frente y de atrás en cada nivel, revisando escuadra.',
          panelRefs: [`${levels.id}-long`],
          tools: ['welder', 'magnet', 'clamp'],
          action: { kind: 'tack', from: [W / 2 - s, topY, D / 2], to: [W / 2 - s, topY, D / 2], normal: [0, 0, 1] },
        },
      );
    }

    list.push(
      {
        title: 'Revisa escuadra y nivel',
        description:
          'Mide las diagonales de arriba (deben variar menos de 2 mm) y apoya la pieza en el piso: no debe cojear. ' +
          'Corrige con golpes de mazo ahora; después de soldar ya no se puede.',
        panelRefs: [],
        tools: ['tape', 'level'],
        action: { kind: 'measure', from: [-W / 2, H + 2, -D / 2], to: [W / 2, H + 2, D / 2], normal: [0, 1, 0] },
      },
      {
        title: 'Suelda los cordones',
        description:
          `${settings.technique} Empieza en ${amps} A y ajusta entre ${settings.amps[0]} y ${settings.amps[1]} A ` +
          `según se vea el charco. Suelda tramos de 2–3 cm alternando esquinas opuestas para que no se tuerza.${slag}`,
        panelRefs: [],
        tools: ['welder', ...(process.slag ? (['chipper'] as ToolId[]) : [])],
        action: cap
          ? { kind: 'weld', from: [W / 2 - s, H - s, D / 2], to: [W / 2, H - s, D / 2], normal: [0, 0, 1] }
          : { kind: 'weld', from: [W / 2 - s, H - s, D / 2], to: [W / 2 - s, H, D / 2], normal: [0, 0, 1] },
      },
      {
        title: 'Esmerila las uniones',
        description: 'Empareja los cordones con el disco de láminas sin adelgazar el tubo, y sopla o limpia el polvo.',
        panelRefs: [],
        tools: ['grinder'],
        action: { kind: 'grind', from: [W / 2 - s - 10, H - s, D / 2], to: [W / 2 + 10, H - s, D / 2], normal: [0, 0, 1] },
      },
      {
        title: finish.painted ? `Pinta de ${finish.label.toLowerCase()}` : 'Protege el acero',
        description: finish.painted
          ? `Desengrasa con thinner, da una mano de primario anticorrosivo y, ya seco, dos manos delgadas de esmalte ${finish.label.toLowerCase()}. ` +
            'Pinta en un lugar ventilado y con mascarilla.'
          : 'Pule con fibra hasta dejar el acero parejo, desengrasa y aplica dos manos de barniz transparente para metal: sin protección se oxida en días.',
        panelRefs: members.map((m) => m.id),
        tools: ['brush'],
        action: { kind: 'paint', from: [-W / 2 + 40, topY, D / 2 + 260], to: [W / 2 - 40, topY, D / 2 + 260], normal: [0, 0, 1] },
      },
      {
        title: `Coloca ${spec.board.what}`,
        description:
          `Corta ${spec.board.count === 1 ? 'una tabla' : `${spec.board.count} tablas`} de ${spec.board.length} × ${spec.board.width} mm ` +
          '(puedes planearla en el modo Madera). Barrena los tubos de abajo hacia arriba cada 30 cm y fíjala con pijas de 8 × 3/4".',
        panelRefs: [heroId],
        tools: ['drill'],
      },
    );
    return list.map((st, i) => ({ ...st, order: i + 1 }));
  }
}

/** Advice any frame can earn from the user's choices. */
function commonSuggestions(spec: FrameSpec, t: Tube, amps: number, kg: number): Suggestion[] {
  const { p, W, H, cap } = spec;
  const out: Suggestion[] = [];
  const process = weldProcess(p['process']!);
  const size = tubeSize(p['size']!);

  if (process.key === 'stick' && t.wall < 1.5) {
    out.push({
      level: 'warn',
      message: `Con electrodo, una pared de ${t.wall} mm se perfora fácil. Usa calibre 16 o más grueso, o MIG sin gas.`,
      fix: { label: 'Usar calibre 16', params: { gauge: 16 } },
    });
  }
  if (process.key === 'stick' && cap === 'miter') {
    out.push({
      level: 'tip',
      message: 'Las esquinas a 45° dejan orillas delgadas que el electrodo quema; para empezar, las uniones rectas perdonan más.',
      fix: { label: 'Uniones rectas', params: { joint: 1 } },
    });
  }
  if (process.key === 'tig') {
    out.push({
      level: 'tip',
      message: 'TIG deja los cordones más limpios, pero es el proceso más difícil de aprender. MIG sin gas es el más fácil para empezar.',
      fix: { label: 'Cambiar a MIG sin gas', params: { process: 1 } },
    });
  }
  if (amps > 110) {
    out.push({
      level: 'tip',
      message: `Esta pared pide unos ${amps} A. Muchas soldadoras de 127 V llegan a 120–140 A con poco ciclo de trabajo: revisa la placa de la tuya.`,
    });
  }

  const span = cap ? W : W - 2 * t.side;
  if (span / t.side > MAX_SPAN_RATIO) {
    const bigger = TUBE_SIZES.find((x) => span / x.side <= MAX_SPAN_RATIO && x.gauges.includes(t.gauge));
    out.push({
      level: 'warn',
      message: `Un larguero de ${Math.round(span)} mm en PTR ${size.label} se pandea con peso encima. Usa un perfil más grande o reduce el ancho.`,
      ...(bigger ? { fix: { label: `Usar PTR ${bigger.label}`, params: { size: bigger.id } } } : {}),
    });
  }
  if (cap && p['lower'] === 0 && H / t.side > MAX_LEG_RATIO) {
    out.push({
      level: 'warn',
      message: `Patas de ${Math.round(H)} mm sin travesaño abajo se mecen. Agrega un ${spec.levels.name}.`,
      fix: { label: 'Agregar', params: { lower: 1 } },
    });
  }
  if (!paintFinish(p['finish']!).painted) {
    out.push({ level: 'tip', message: 'El acero natural con barniz es para interior; afuera píntalo o se oxidará.' });
  }
  if (kg > HEAVY_KG) {
    out.push({ level: 'tip', message: `Pesa unos ${Math.round(kg)} kg: ármalo cerca de donde va a quedar o pide ayuda para moverlo.` });
  }
  return out;
}

function sizeIssue(p: TemplateParams): ValidationIssue | null {
  const size = tubeSize(p['size']!);
  if (size.gauges.includes(p['gauge']!)) return null;
  return {
    paramKey: 'gauge',
    message: `El PTR ${size.label} no se vende en calibre ${p['gauge']}. Elige calibre ${size.gauges.join(', ')}.`,
  };
}

function check(params: ParamSpec[], raw: TemplateParams): { p: TemplateParams; issues: ValidationIssue[] } {
  const p = resolveParams(params, raw);
  const issues = paramIssues(params, p);
  if (issues.length === 0) {
    const bad = sizeIssue(p);
    if (bad) issues.push(bad);
  }
  return { p, issues };
}

// ---- Templates ----

const tableParams: ParamSpec[] = [
  { kind: 'number', key: 'width', label: 'Largo', unit: 'mm', min: 600, max: 2000, step: 10, default: 1200 },
  { kind: 'number', key: 'depth', label: 'Fondo', unit: 'mm', min: 400, max: 900, step: 10, default: 600 },
  { kind: 'number', key: 'height', label: 'Alto', unit: 'mm', min: 450, max: 1000, step: 10, default: 750 },
  common.size(4),
  common.gauge(14),
  common.joint,
  common.lower('Travesaño inferior'),
  common.process,
  common.finish,
];

export function generateWeldTable(raw: TemplateParams): WeldResult {
  const { p, issues } = check(tableParams, raw);
  if (issues.length > 0) return { ok: false, issues };
  const W = p['width']!;
  const D = p['depth']!;
  const t = tube(p['size']!, p['gauge']!);
  const design = frameDesign(
    {
      templateId: 'weld-table',
      p,
      W,
      D,
      H: p['height']!,
      cap: p['joint'] === 2 ? 'miter' : 'square',
      levels: { id: 'low', name: 'marco inferior', long: 'Larguero inferior', short: 'Travesaño inferior', bottoms: p['lower'] ? [LOW_RAIL_HEIGHT] : [] },
      board: { what: 'la cubierta', count: 1, length: W, width: D },
    },
    t,
    [],
  );
  return { ok: true, design };
}

const stoolParams: ParamSpec[] = [
  { kind: 'number', key: 'width', label: 'Ancho del asiento', unit: 'mm', min: 300, max: 500, step: 10, default: 380 },
  { kind: 'number', key: 'depth', label: 'Fondo del asiento', unit: 'mm', min: 300, max: 500, step: 10, default: 380 },
  { kind: 'number', key: 'height', label: 'Alto', unit: 'mm', min: 450, max: 800, step: 10, default: 650 },
  common.size(2),
  common.gauge(16),
  common.joint,
  common.lower('Reposapiés'),
  common.process,
  common.finish,
];

const STOOL_BASE_RATIO = 0.5; // narrowest side of the base per mm of height before it tips

export function generateWeldStool(raw: TemplateParams): WeldResult {
  const { p, issues } = check(stoolParams, raw);
  if (issues.length > 0) return { ok: false, issues };
  const W = p['width']!;
  const D = p['depth']!;
  const H = p['height']!;
  const t = tube(p['size']!, p['gauge']!);

  const extra: Suggestion[] = [];
  if (Math.min(W, D) / H < STOOL_BASE_RATIO) {
    const base = Math.min(500, Math.ceil((H * STOOL_BASE_RATIO) / 10) * 10);
    extra.push({
      level: 'warn',
      message: `Un banco de ${H} mm de alto con base de ${Math.min(W, D)} mm se vuelca fácil. Ensancha la base a ${base} mm.`,
      fix: { label: `Base de ${base} mm`, params: { width: Math.max(W, base), depth: Math.max(D, base) } },
    });
  }
  if (H >= 600 && p['lower'] === 0) {
    extra.push({
      level: 'tip',
      message: 'A esta altura los pies quedan colgando; un reposapiés también amarra las patas.',
      fix: { label: 'Agregar reposapiés', params: { lower: 1 } },
    });
  }

  const design = frameDesign(
    {
      templateId: 'weld-stool',
      p,
      W,
      D,
      H,
      cap: p['joint'] === 2 ? 'miter' : 'square',
      levels: { id: 'low', name: 'reposapiés', long: 'Reposapiés largo', short: 'Reposapiés corto', bottoms: p['lower'] ? [Math.round(H * 0.4)] : [] },
      board: { what: 'el asiento', count: 1, length: W, width: D },
    },
    t,
    extra,
  );
  return { ok: true, design };
}

const shelfParams: ParamSpec[] = [
  { kind: 'number', key: 'width', label: 'Ancho', unit: 'mm', min: 600, max: 1500, step: 10, default: 900 },
  { kind: 'number', key: 'depth', label: 'Fondo', unit: 'mm', min: 250, max: 500, step: 10, default: 400 },
  { kind: 'number', key: 'height', label: 'Alto', unit: 'mm', min: 900, max: 2000, step: 10, default: 1800 },
  { kind: 'number', key: 'shelves', label: 'Entrepaños', unit: '', min: 2, max: 6, step: 1, default: 4 },
  common.size(2),
  common.gauge(16),
  common.process,
  common.finish,
];

export function generateWeldShelf(raw: TemplateParams): WeldResult {
  const { p, issues } = check(shelfParams, raw);
  if (issues.length > 0) return { ok: false, issues };
  const W = p['width']!;
  const D = p['depth']!;
  const H = p['height']!;
  const n = p['shelves']!;
  const t = tube(p['size']!, p['gauge']!);
  const s = t.side;

  // Frames evenly spaced from SHELF_CLEARANCE off the floor to flush with the top.
  const pitch = (H - s - SHELF_CLEARANCE) / (n - 1);
  if (pitch - s < MIN_SHELF_GAP) {
    return {
      ok: false,
      issues: [
        {
          paramKey: 'shelves',
          message: `Con ${n} entrepaños quedan ${Math.floor(pitch - s)} mm entre ellos; el mínimo es ${MIN_SHELF_GAP} mm. Quita entrepaños o sube el alto.`,
        },
      ],
    };
  }
  const bottoms = Array.from({ length: n }, (_, i) => Math.round(SHELF_CLEARANCE + i * pitch));

  const extra: Suggestion[] =
    H > 1200 ? [{ level: 'tip', message: 'Un estante alto se puede volcar: fíjalo al muro con dos escuadras y taquetes.' }] : [];

  const design = frameDesign(
    {
      templateId: 'weld-shelf',
      p,
      W,
      D,
      H,
      cap: null,
      levels: { id: 'shelf', name: 'marco de entrepaño', long: 'Larguero de entrepaño', short: 'Travesaño de entrepaño', bottoms },
      board: { what: 'los entrepaños', count: n, length: Math.floor(W - 2 * s), width: D },
    },
    t,
    extra,
  );
  return { ok: true, design };
}

export const weldTable: WeldTemplate = {
  id: 'weld-table',
  name: 'Mesa de PTR',
  description: 'Base de mesa o banco de trabajo con cubierta de madera.',
  params: tableParams,
  generate: generateWeldTable,
};

export const weldStool: WeldTemplate = {
  id: 'weld-stool',
  name: 'Banco alto',
  description: 'Banco o taburete con reposapiés y asiento de madera.',
  params: stoolParams,
  generate: generateWeldStool,
};

export const weldShelf: WeldTemplate = {
  id: 'weld-shelf',
  name: 'Estante industrial',
  description: 'Anaquel de tubo con entrepaños de madera.',
  params: shelfParams,
  generate: generateWeldShelf,
};

export const weldTemplates: WeldTemplate[] = [weldTable, weldStool, weldShelf];
