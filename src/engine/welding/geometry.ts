import type { Vec3 } from '../types.ts';
import type { TubePlacement } from './types.ts';

/**
 * The plane one end of a placed tube is cut on: a point on it (on the tube's center line)
 * and the normal pointing out of the piece. A square end is the box's end face; a miter
 * leans back 45° from the long point on the outer face, so two mitered ends that meet
 * share one plane with opposite normals.
 */
export function endPlane(p: TubePlacement, end: 0 | 1): { point: Vec3; normal: Vec3 } {
  const a = p.axis;
  const sign = end === 1 ? 1 : -1;
  const point: Vec3 = [...p.position];
  point[a] += (sign * p.size[a]) / 2;
  const normal: Vec3 = [0, 0, 0];
  normal[a] = sign;
  if (p.ends === 'miter') {
    const o = p.outer;
    if (!o) throw new Error(`${p.panelId}#${p.instance} is mitered but has no outer face`);
    point[a] -= (sign * p.size[(a + 1) % 3]!) / 2; // half the section back from the long point
    for (let k = 0; k < 3; k++) normal[k] = (normal[k]! - o[k]!) * Math.SQRT1_2;
  }
  return { point, normal };
}
