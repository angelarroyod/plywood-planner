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
