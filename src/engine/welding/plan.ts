import { BAR_LENGTH, CUT_KERF, END_TRIM, SAFETY_GEAR, TOOL_LABELS, type ToolId } from './catalog.ts';
import type { Member, WeldDesign } from './types.ts';

// ---- Bar cut plan ----

export interface BarPiece {
  memberId: string;
  label: string;
  length: number;
  ends: Member['ends'];
  offset: number; // mm from the bar's mill end to where the piece starts
}

export interface BarLayout {
  pieces: BarPiece[];
  cuts: number; // squaring cut + one per piece that doesn't end at the bar's far end
  remnant: number; // mm of usable tube left over
}

/**
 * First-fit decreasing over 6.10 m bars. Each bar loses END_TRIM to square its
 * mill end, then every piece is followed by one disc kerf.
 */
export function planBars(members: Member[]): BarLayout[] {
  const pieces = members
    .flatMap((m) => Array.from({ length: m.qty }, () => m))
    .sort((a, b) => b.length - a.length);
  const bars: { pieces: BarPiece[]; next: number }[] = [];
  for (const m of pieces) {
    if (m.length > BAR_LENGTH - END_TRIM - CUT_KERF) throw new Error(`${m.id} (${m.length} mm) is longer than a bar`);
    let bar = bars.find((b) => b.next + m.length <= BAR_LENGTH);
    if (!bar) bars.push((bar = { pieces: [], next: END_TRIM + CUT_KERF }));
    bar.pieces.push({ memberId: m.id, label: m.label, length: m.length, ends: m.ends, offset: bar.next });
    bar.next += m.length + CUT_KERF;
  }
  return bars.map((b) => {
    const end = b.next - CUT_KERF; // far end of the last piece
    const flush = end === BAR_LENGTH;
    return { pieces: b.pieces, cuts: 1 + b.pieces.length - (flush ? 1 : 0), remnant: flush ? 0 : BAR_LENGTH - end - CUT_KERF };
  });
}

// ---- Shopping list ----

export interface ShoppingLine {
  label: string;
  qty: string;
  note?: string;
}

export interface ShoppingGroup {
  title: string;
  lines: ShoppingLine[];
}

const DEPOSIT_G_PER_M = 30; // small fillet bead on thin-wall tube
const PRACTICE = 2; // beginners burn as much on scrap practice and tacks as on the piece
const EFFICIENCY = { stick: 0.6, flux: 0.8, mig: 0.95, tig: 0.98 } as const; // deposit per gram bought
const COVERAGE_M2_PER_L = 8; // enamel/primer per coat, brushed or gun-sprayed
const SPRAY_CAN_M2 = 1.6; // one 400 ml can, one coat
const CUTS_PER_DISC = 15; // 1 mm cut-off disc in thin-wall tube
const ELECTRODE_G = { thin: 15, thick: 27 }; // one 350 mm E6013, 3/32" and 1/8"

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Painted outside surface of every member, m². */
export function paintArea(d: WeldDesign): number {
  return d.members.reduce((a, m) => a + 4 * d.tube.side * m.length * m.qty, 0) / 1e6;
}

/** Everything to buy for one design, grouped as a hardware store shelves it. */
export function shoppingList(d: WeldDesign, bars: BarLayout[]): ShoppingGroup[] {
  const { process, settings, tube } = d;
  const kg = (bars.length * BAR_LENGTH * tube.kgPerM) / 1000;
  const grams = ((d.weldLength / 1000) * DEPOSIT_G_PER_M * PRACTICE) / EFFICIENCY[process.key];
  const cuts = bars.reduce((n, b) => n + b.cuts, 0);

  const welding: ShoppingLine[] = [];
  if (process.key === 'stick') {
    const each = settings.consumable.includes('3/32') ? ELECTRODE_G.thin : ELECTRODE_G.thick;
    welding.push({
      label: settings.consumable,
      qty: `≈ ${Math.ceil(grams / each)} pzas`,
      note: `Se venden por kilo; ${grams <= 500 ? '½ kg alcanza' : `compra ${Math.ceil(grams / 500) / 2} kg`} con práctica incluida.`,
    });
  } else if (process.key === 'tig') {
    welding.push(
      { label: settings.consumable, qty: '1 tubo de 0.45 kg' },
      { label: settings.tungsten!, qty: '2 pzas', note: 'Afílalo en punta, a lo largo.' },
    );
  } else {
    welding.push(
      {
        label: settings.consumable,
        qty: grams <= 450 ? '1 carrete de 0.45 kg (1 lb)' : plural(Math.ceil(grams / 1000), 'carrete de 1 kg', 'carretes de 1 kg'),
      },
      { label: `Puntas de contacto de ${settings.wire}`, qty: '3 pzas' },
      { label: 'Antisalpicaduras en aerosol', qty: '1 pza' },
    );
  }
  if (settings.gas) welding.push({ label: `Gas: ${settings.gas.split(' a ')[0]}`, qty: '1 tanque', note: 'Se renta o se recarga en la gasera industrial.' });

  const area = paintArea(d);
  const coat = (coats: number) => Math.max(0.1, Math.ceil((area * coats * 10) / COVERAGE_M2_PER_L) / 10).toFixed(1);
  const cans = (coats: number) => Math.ceil((area * coats) / SPRAY_CAN_M2);
  const finish: ShoppingLine[] = d.finish.painted
    ? [
        { label: 'Primario anticorrosivo', qty: `${coat(1)} L`, note: `o ${plural(cans(1), 'aerosol', 'aerosoles')}` },
        { label: `Esmalte ${d.finish.label.toLowerCase()}`, qty: `${coat(2)} L`, note: `2 manos, o ${plural(cans(2), 'aerosol', 'aerosoles')}` },
        { label: 'Thinner estándar', qty: '1 L', note: 'Para desengrasar y limpiar.' },
      ]
    : [
        { label: 'Barniz transparente para metal', qty: `${coat(2)} L`, note: `2 manos, o ${plural(cans(2), 'aerosol', 'aerosoles')}` },
        { label: 'Fibra abrasiva verde', qty: '2 pzas' },
        { label: 'Thinner estándar', qty: '1 L', note: 'Para desengrasar.' },
      ];
  finish.push({ label: 'Mascarilla para vapores de pintura', qty: '1 pza' });

  return [
    {
      title: 'Material',
      lines: [
        {
          label: tube.label,
          qty: plural(bars.length, 'tramo de 6.10 m', 'tramos de 6.10 m'),
          note: `≈ ${kg.toFixed(1)} kg. Pide que te lo corten en tramos que quepan en tu carro si hace falta.`,
        },
        { label: 'Pijas para metal 8 × 3/4"', qty: '1 bolsa (25 pzas)', note: 'Para fijar la madera.' },
      ],
    },
    { title: 'Soldadura', lines: welding },
    {
      title: 'Abrasivos',
      lines: [
        { label: 'Disco de corte 4½" × 1 mm', qty: plural(Math.ceil(cuts / CUTS_PER_DISC), 'pza', 'pzas'), note: `${cuts} cortes en total` },
        { label: 'Disco de láminas (flap) 4½" grano 60', qty: plural(Math.max(1, Math.ceil(d.joints / 16)), 'pza', 'pzas') },
      ],
    },
    { title: 'Acabado', lines: finish },
  ];
}

/** Display name of a tool, with the chosen process's machine for 'welder'. */
export function toolLabel(d: WeldDesign, id: ToolId): string {
  return id === 'welder' ? d.process.machine : TOOL_LABELS[id];
}

/** The shopping list as plain text, for sharing or copying to a phone. */
export function shoppingText(d: WeldDesign, title: string, bars: BarLayout[]): string {
  const lines = [`Lista de compras — ${title}`, ''];
  for (const g of shoppingList(d, bars)) {
    lines.push(g.title.toUpperCase());
    for (const l of g.lines) lines.push(`- ${l.label}: ${l.qty}${l.note ? ` (${l.note})` : ''}`);
    lines.push('');
  }
  lines.push('HERRAMIENTA');
  for (const t of d.tools) lines.push(`- ${toolLabel(d, t)}`);
  lines.push('', 'SEGURIDAD');
  for (const s of SAFETY_GEAR) lines.push(`- ${s}`);
  return lines.join('\n');
}
