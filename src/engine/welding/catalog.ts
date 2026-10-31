// Metal catalog: tube sizes, wall gauges, welding processes, paint finishes and tools.
// Pure data + small lookups — same rules as the rest of src/engine/ (no React/DOM/three).
// Ids are stored in numeric template params, so never renumber them — append new ones.

/** Square structural tube (PTR in Mexico), sold in 6.10 m bars. */
export interface TubeSize {
  id: number;
  label: string; // '1"'
  side: number; // mm, outer
  gauges: number[]; // calibres sold in this size
}

export const BAR_LENGTH = 6100; // mm, one "tramo" of PTR
export const CUT_KERF = 3; // mm, abrasive cut-off disc
export const END_TRIM = 10; // mm squared off the mill end of every bar

export const TUBE_SIZES: TubeSize[] = [
  { id: 1, label: '3/4"', side: 19.05, gauges: [18, 16, 14] },
  { id: 2, label: '1"', side: 25.4, gauges: [18, 16, 14, 12] },
  { id: 3, label: '1 1/4"', side: 31.75, gauges: [16, 14, 12, 11] },
  { id: 4, label: '1 1/2"', side: 38.1, gauges: [16, 14, 12, 11] },
  { id: 5, label: '2"', side: 50.8, gauges: [16, 14, 12, 11] },
];

/** Calibre → wall thickness, mm (sheet-gauge steel, as Mexican yards quote PTR). */
export const GAUGE_WALL: Record<number, number> = { 18: 1.2, 16: 1.5, 14: 1.9, 12: 2.7, 11: 3.0 };

export const SIZE_OPTIONS = TUBE_SIZES.map((s) => ({ value: s.id, label: `PTR ${s.label}` }));
export const GAUGE_OPTIONS = Object.entries(GAUGE_WALL)
  .map(([g, wall]) => ({ value: Number(g), label: `Cal. ${g} (${wall} mm)` }))
  .sort((a, b) => b.value - a.value);

export function tubeSize(id: number): TubeSize {
  const size = TUBE_SIZES.find((s) => s.id === id);
  if (!size) throw new Error(`Unknown tube size ${id}`);
  return size;
}

/** The one tube a frame is built from. */
export interface Tube {
  label: string; // 'PTR 1" cal. 16'
  side: number; // mm
  wall: number; // mm — drives amperage
  radius: number; // mm, outer corner: cold-formed tube is bent round about 2 × wall
  gauge: number;
  kgPerM: number;
}

const STEEL_DENSITY = 7.85e-3; // kg per mm² of section per meter

export function tube(sizeId: number, gauge: number): Tube {
  const size = tubeSize(sizeId);
  const wall = GAUGE_WALL[gauge];
  if (wall === undefined) throw new Error(`Unknown gauge ${gauge}`);
  const section = 4 * size.side * wall - 4 * wall * wall; // mm², square hollow section
  return {
    label: `PTR ${size.label} cal. ${gauge}`,
    side: size.side,
    wall,
    radius: 2 * wall,
    gauge,
    kgPerM: Math.round(section * STEEL_DENSITY * 100) / 100,
  };
}

// ---- Welding processes ----

export type ProcessKey = 'flux' | 'mig' | 'stick' | 'tig';

export interface WeldProcess {
  id: number;
  key: ProcessKey;
  label: string; // select label
  machine: string; // the welder the user needs
  slag: boolean; // leaves slag to chip off
}

export const PROCESSES: WeldProcess[] = [
  { id: 1, key: 'flux', label: 'MIG sin gas (alambre tubular)', machine: 'Soldadora MIG/flux (micro alambre)', slag: true },
  { id: 2, key: 'mig', label: 'MIG con gas', machine: 'Soldadora MIG con regulador de gas', slag: false },
  { id: 3, key: 'stick', label: 'Electrodo (arco eléctrico)', machine: 'Soldadora de electrodo (arco)', slag: true },
  { id: 4, key: 'tig', label: 'TIG', machine: 'Soldadora TIG con pedal o perilla', slag: false },
];

export const PROCESS_OPTIONS = PROCESSES.map((p) => ({ value: p.id, label: p.label }));

export function weldProcess(id: number): WeldProcess {
  const p = PROCESSES.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown process ${id}`);
  return p;
}

/** Starting machine settings for one process on one wall thickness. */
export interface WeldSettings {
  amps: [number, number]; // range to tune within
  start: number; // where to set the dial first
  consumable: string; // wire, electrode or filler rod
  wire?: string; // MIG/flux wire diameter, for contact tips
  tungsten?: string; // TIG electrode
  gas: string | null;
  polarity: string;
  technique: string; // torch angle and travel, one sentence
}

const round5 = (n: number) => Math.round(n / 5) * 5;

/**
 * Rule-of-thumb settings. MIG, flux and TIG follow "1 A per thousandth of an inch"
 * (≈ 39 A per mm of wall); stick picks a 6013 electrode by thickness and scales
 * within its range. Every machine reads differently — the UI tells the user to
 * test on a scrap first, which is the real calibration.
 */
export function weldSettings(process: WeldProcess, wall: number): WeldSettings {
  if (process.key === 'stick') {
    const thin = wall < 2.5;
    const amps: [number, number] = thin ? [50, 80] : [80, 120];
    return {
      amps,
      start: Math.min(amps[1], Math.max(amps[0], round5(25 + 25 * wall))),
      consumable: thin ? 'Electrodo E6013 de 3/32" (2.4 mm)' : 'Electrodo E6013 de 1/8" (3.2 mm)',
      gas: null,
      polarity: 'CA o CD con el electrodo en positivo (+)',
      technique: 'Arrastra el electrodo inclinado 10–20° y mantén el arco tan corto como el grosor del electrodo.',
    };
  }
  const start = round5(39.4 * wall);
  const amps: [number, number] = [round5(start * 0.9), round5(start * 1.1)];
  if (process.key === 'tig') {
    return {
      amps,
      start,
      consumable: wall <= 2 ? 'Varilla ER70S-6 de 1.6 mm' : 'Varilla ER70S-6 de 2.4 mm',
      tungsten: `Tungsteno lantanado 2 % de ${wall <= 2.5 ? '1.6' : '2.4'} mm`,
      gas: 'Argón 100 % a 7–9 L/min',
      polarity: 'CD electrodo negativo (−)',
      technique: 'Empuja el charco con la antorcha a 15° y mete la varilla por delante, en toques cortos.',
    };
  }
  const wire = wall <= 2 ? '0.8 mm (0.030")' : '0.9 mm (0.035")';
  return process.key === 'mig'
    ? {
        amps,
        start,
        consumable: `Alambre sólido ER70S-6 de ${wire}`,
        wire,
        gas: 'Argón/CO₂ 75/25 a 8–12 L/min',
        polarity: 'CD antorcha en positivo (+)',
        technique: 'Empuja la antorcha inclinada 10–15° con 10 mm de alambre libre.',
      }
    : {
        amps,
        start,
        consumable: `Alambre tubular E71T-11 de ${wire}`,
        wire,
        gas: null,
        polarity: 'CD antorcha en negativo (−) — revisa el puente de polaridad',
        technique: 'Jala (arrastra) la antorcha inclinada 10–15° con 15 mm de alambre libre.',
      };
}

// ---- Finishes ----

export interface PaintFinish {
  id: number;
  label: string;
  hex: string; // 3D tint
  painted: boolean; // false → bare steel, protected with clear coat
  gloss: boolean;
}

export const FINISHES: PaintFinish[] = [
  { id: 1, label: 'Negro mate', hex: '#2a2b2e', painted: true, gloss: false },
  { id: 2, label: 'Negro brillante', hex: '#1c1d20', painted: true, gloss: true },
  { id: 3, label: 'Gris grafito', hex: '#575c63', painted: true, gloss: false },
  { id: 4, label: 'Blanco', hex: '#e8e6e1', painted: true, gloss: true },
  { id: 5, label: 'Rojo óxido', hex: '#8e2a1d', painted: true, gloss: false },
  { id: 6, label: 'Verde bosque', hex: '#2f4a35', painted: true, gloss: true },
  { id: 7, label: 'Azul marino', hex: '#1f3354', painted: true, gloss: true },
  { id: 8, label: 'Acero natural (barniz)', hex: '#8f969e', painted: false, gloss: false },
];

export const FINISH_OPTIONS = FINISHES.map((f) => ({ value: f.id, label: f.label, swatch: f.hex }));

export function paintFinish(id: number): PaintFinish {
  const f = FINISHES.find((x) => x.id === id);
  if (!f) throw new Error(`Unknown finish ${id}`);
  return f;
}

// ---- Tools ----

export type ToolId =
  | 'welder'
  | 'saw'
  | 'grinder'
  | 'tape'
  | 'square'
  | 'marker'
  | 'magnet'
  | 'clamp'
  | 'level'
  | 'chipper'
  | 'drill'
  | 'brush'
  | 'mallet';

/** Spanish names; 'welder' is replaced by the chosen process's machine. */
export const TOOL_LABELS: Record<ToolId, string> = {
  welder: 'Soldadora',
  saw: 'Cortadora de disco 14" o esmeriladora 4½" con disco de corte',
  grinder: 'Esmeriladora angular 4½" con disco de láminas (flap) grano 60',
  tape: 'Flexómetro',
  square: 'Escuadra de herrero',
  marker: 'Rayador o gis de herrero',
  magnet: 'Escuadras magnéticas (2 a 4)',
  clamp: 'Prensas de presión tipo C (2)',
  level: 'Nivel de burbuja',
  chipper: 'Piqueta y cepillo de alambre',
  drill: 'Taladro con broca para metal de 5/32"',
  brush: 'Brocha o pistola para pintar',
  mallet: 'Mazo de goma',
};

/** Always required, whatever the project. */
export const SAFETY_GEAR = [
  'Careta fotosensible (sombra 10 a 13)',
  'Guantes de carnaza para soldar',
  'Mangas o chamarra de carnaza, o ropa 100 % algodón (nada sintético)',
  'Lentes de seguridad para cortar y esmerilar',
  'Tapones auditivos',
  'Extintor PQS a la mano y área sin cartón, aserrín ni solventes',
];
