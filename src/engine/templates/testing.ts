import type { Design } from '../types.ts';

/** Pairs of 3D boxes (placements and fittings) whose volumes overlap; touching faces don't count. */
export function overlappingBoxes(d: Design): string[] {
  const boxes = [
    ...d.placements.map((p) => ({ name: `${p.panelId}#${p.instance}`, position: p.position, size: p.size })),
    ...d.fittings.map((f) => ({ name: `${f.id}#${f.instance}`, position: f.position, size: f.size })),
  ];
  const out: string[] = [];
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      if ([0, 1, 2].every((k) => Math.abs(a.position[k]! - b.position[k]!) < (a.size[k]! + b.size[k]!) / 2 - 0.001)) {
        out.push(`${a.name} × ${b.name}`);
      }
    }
  return out;
}

/** Smallest vertical gap between a drawer box part and a fixed horizontal panel above or below it (closed position). */
export function drawerBoxClearance(d: Design): number {
  const flats = d.placements.filter((p) => ['top', 'bottom', 'drawer-shelf', 'hat-shelf', 'shelf'].includes(p.panelId));
  const boxes = d.placements.filter((p) => ['drawer-side', 'drawer-end', 'drawer-bottom'].includes(p.panelId));
  let min = Infinity;
  for (const b of boxes)
    for (const f of flats) {
      if (Math.abs(b.position[0] - f.position[0]) >= (b.size[0] + f.size[0]) / 2) continue; // not over each other
      const bLow = b.position[1] - b.size[1] / 2;
      const bHigh = b.position[1] + b.size[1] / 2;
      const fLow = f.position[1] - f.size[1] / 2;
      const fHigh = f.position[1] + f.size[1] / 2;
      min = Math.min(min, bLow >= fHigh ? bLow - fHigh : fLow - bHigh);
    }
  return min;
}
