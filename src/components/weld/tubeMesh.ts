import * as THREE from 'three';
import { endPlane, type Tube, type TubePlacement } from '../../engine/index.ts';

// Geometry for one placed piece of square tube, built around the placement's box centre so the
// viewer can move it like any box. Every cut comes from the engine's endPlane, so what is drawn
// is what the cut list says.

const CORNER_SEGMENTS = 6; // per rounded corner
const CAP_LIP = 0.6; // mm a plastic plug's flange stands proud of the tube all round
const CAP_DEPTH = 3; // mm of flange outside the tube

function roundedSquare<P extends THREE.Path>(p: P, half: number, r: number): P {
  p.moveTo(-half + r, -half);
  p.lineTo(half - r, -half);
  p.absarc(half - r, -half + r, r, -Math.PI / 2, 0, false);
  p.lineTo(half, half - r);
  p.absarc(half - r, half - r, r, 0, Math.PI / 2, false);
  p.lineTo(-half + r, half);
  p.absarc(-half + r, half - r, r, Math.PI / 2, Math.PI, false);
  p.lineTo(-half, -half + r);
  p.absarc(-half + r, -half + r, r, Math.PI, 1.5 * Math.PI, false);
  return p;
}

/** Axis, outer face and third side of a placed piece, as unit vectors. */
function frame(p: TubePlacement) {
  const axis = new THREE.Vector3().setComponent(p.axis, 1);
  const across = p.outer ? new THREE.Vector3(...p.outer) : new THREE.Vector3().setComponent((p.axis + 1) % 3, 1);
  const third = new THREE.Vector3().crossVectors(axis, across);
  return { axis, across, third, basis: new THREE.Matrix4().makeBasis(across, third, axis), half: p.size[p.axis]! / 2 };
}

/** The engine's cut plane for one end, relative to the placement's centre. */
function cutPlane(p: TubePlacement, end: 0 | 1): THREE.Plane {
  const { point, normal } = endPlane(p, end);
  const at = new THREE.Vector3(...point).sub(new THREE.Vector3(...p.position));
  return new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(...normal), at);
}

/** Slides a point along the tube's axis until it lies on the cut plane. */
function slideOnto(v: THREE.Vector3, plane: THREE.Plane, axis: THREE.Vector3) {
  v.addScaledVector(axis, -plane.distanceToPoint(v) / plane.normal.dot(axis));
}

/** Hollow tube with rounded corners and its real wall, each end cut square or at 45°. */
export function tubeGeometry(p: TubePlacement, t: Tube): THREE.BufferGeometry {
  const { axis, basis, half } = frame(p);
  const shape = roundedSquare(new THREE.Shape(), t.side / 2, t.radius);
  shape.holes.push(roundedSquare(new THREE.Path(), t.side / 2 - t.wall, Math.max(t.radius - t.wall, 0.1)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: 2 * half, bevelEnabled: false, curveSegments: CORNER_SEGMENTS });
  g.translate(0, 0, -half);
  g.applyMatrix4(basis);

  const planes = [cutPlane(p, 0), cutPlane(p, 1)] as const;
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const along = v.dot(axis);
    if (Math.abs(Math.abs(along) - half) > 1e-6) continue; // not on an end
    slideOnto(v, planes[along > 0 ? 1 : 0], axis);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  // sliding along the axis keeps every wall in its own plane: only the cut faces need new normals
  const keep = (g.getAttribute('normal').array as Float32Array).slice();
  g.computeVertexNormals();
  const walls = g.groups[1]!;
  (g.getAttribute('normal').array as Float32Array).set(keep.subarray(walls.start * 3, (walls.start + walls.count) * 3), walls.start * 3);
  return g;
}

/** A fillet bead traced all round the tube's outside where its end meets what it is welded to. */
export function beadGeometry(p: TubePlacement, t: Tube, end: 0 | 1): THREE.BufferGeometry {
  const { axis, across, third, half } = frame(p);
  const plane = cutPlane(p, end);
  const pts = roundedSquare(new THREE.Path(), t.side / 2, t.radius).getSpacedPoints(64);
  pts.pop(); // closed: the last point repeats the first
  const loop = pts.map((q) => {
    const v = across.clone().multiplyScalar(q.x).addScaledVector(third, q.y).addScaledVector(axis, end === 1 ? half : -half);
    slideOnto(v, plane, axis);
    return v;
  });
  const radius = Math.max(1.2, t.wall * 1.1); // a bead about as wide as the wall is thick
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(loop, true), 128, radius, 6, true);
}

/** Plastic plug in an open, square-cut end: only its flange shows. */
export function capGeometry(p: TubePlacement, t: Tube, end: 0 | 1): THREE.BufferGeometry {
  const { basis, half } = frame(p);
  const flange = roundedSquare(new THREE.Shape(), t.side / 2 + CAP_LIP, t.radius + CAP_LIP);
  const g = new THREE.ExtrudeGeometry(flange, { depth: CAP_DEPTH, bevelEnabled: false, curveSegments: CORNER_SEGMENTS });
  g.translate(0, 0, end === 1 ? half : -half - CAP_DEPTH);
  return g.applyMatrix4(basis);
}
