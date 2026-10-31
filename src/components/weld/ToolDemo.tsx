import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ToolAction, Vec3 } from '../../engine/index.ts';

const LOOP = 3.2; // seconds per demo pass
const START = 0.12; // share of the loop the tool waits before moving
const TRAVEL = 0.7; // share of the loop spent moving from → to
const SPARKS = 48;
const DISC_R = 57; // 4½" disc
const UP = new THREE.Vector3(0, 1, 0);
const TOOL_BODY = '#3b6e8f'; // not the signal red, which marks the highlighted parts

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const rand = (i: number, k: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const v3 = (v: Vec3) => new THREE.Vector3(...v);
const align = (dir: THREE.Vector3) => new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());

/**
 * A looping, illustrative demo of one build step: the tool the step needs, moving
 * along the engine's from → to path in assembly space (mm). Drawn from primitives —
 * a grinder, a torch, a tape or a spray gun — with sparks and arc glow where real.
 */
export function ToolDemo({ action }: { action: ToolAction }) {
  const still = useMemo(reducedMotion, []);
  const from = useMemo(() => v3(action.from), [action]);
  const to = useMemo(() => v3(action.to), [action]);
  const normal = useMemo(() => v3(action.normal).normalize(), [action]);
  const tip = useMemo(() => new THREE.Vector3(), []);

  const tool = useRef<THREE.Group>(null);
  const disc = useRef<THREE.Mesh>(null);
  const arc = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const bead = useRef<THREE.Mesh>(null);
  const tape = useRef<THREE.Mesh>(null);
  const mist = useRef<THREE.Mesh>(null);
  const sparks = useRef<THREE.Points>(null);

  const kind = action.kind;
  const grinder = kind === 'cut' || kind === 'grind';
  const torch = kind === 'tack' || kind === 'weld';

  // Tool orientation, fixed per action.
  const pose = useMemo(() => {
    const travel = to.clone().sub(from);
    const len = travel.length();
    // the motor points away from the viewer so the disc and sparks stay in sight
    const sideways = Math.abs(normal.y) > 0.9 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
    if (kind === 'cut') {
      // disc stands on its rim, facing along its cut (square or 45°); the motor sticks out square to it
      const body = new THREE.Vector3().crossVectors(UP, normal).normalize();
      return { disc: align(normal), discAt: new THREE.Vector3(0, DISC_R, 0), body: align(body), bodyDir: body, travel, len };
    }
    if (kind === 'grind') {
      return { disc: align(normal), discAt: normal.clone().multiplyScalar(5), body: align(sideways), bodyDir: sideways, travel, len };
    }
    // torch and spray gun come in along the face normal, leaning up and toward the viewer
    const approach = normal.clone().add(new THREE.Vector3(0, 1, 0.15)).normalize();
    return { disc: align(normal), discAt: new THREE.Vector3(), body: align(approach), bodyDir: approach, travel, len };
  }, [from, to, normal, kind]);

  const sparkGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3));
    return g;
  }, []);
  useEffect(() => () => sparkGeo.dispose(), [sparkGeo]);

  useFrame(({ clock }, dt) => {
    const time = clock.elapsedTime;
    const cycle = still ? 0.6 : (time % LOOP) / LOOP;
    const p = Math.min(1, Math.max(0, (cycle - START) / TRAVEL));
    const working = !still && cycle > START && cycle < START + TRAVEL;
    tip.lerpVectors(from, to, p);
    tool.current?.position.copy(tip);

    if (disc.current && !still) disc.current.rotation.y += dt * 60;

    // A tack is a 1-second burst in the middle of the loop; a weld runs the whole travel.
    const arcOn = torch && (kind === 'weld' ? working : cycle > 0.35 && cycle < 0.6) && !still;
    if (arc.current) {
      arc.current.visible = arcOn;
      arc.current.scale.setScalar(0.8 + rand(Math.floor(time * 30), 1) * 0.6);
    }
    if (light.current) light.current.intensity = arcOn ? 2.5 + rand(Math.floor(time * 25), 2) * 2 : 0;

    if (bead.current) {
      if (kind === 'weld') {
        const done = Math.max(p * pose.len, 0.01);
        bead.current.scale.set(1, done, 1);
        bead.current.position.copy(from).addScaledVector(pose.travel, p / 2);
      } else {
        bead.current.visible = cycle > 0.45 || still;
      }
    }
    if (tape.current) {
      const out = Math.max(p * pose.len, 0.01);
      tape.current.scale.set(1, out, 1);
      tape.current.position.copy(from).addScaledVector(pose.travel, p / 2);
    }
    if (mist.current) mist.current.visible = working || still;

    const sparksOn = (grinder && working) || arcOn;
    if (sparks.current) {
      sparks.current.visible = sparksOn;
      if (sparksOn) {
        const pos = sparkGeo.getAttribute('position') as THREE.BufferAttribute;
        const life = kind === 'weld' || kind === 'tack' ? 0.12 : 0.3;
        const speed = grinder ? 1800 : 700;
        for (let i = 0; i < SPARKS; i++) {
          const age = ((time + rand(i, 3)) % life);
          // grinders throw a fan toward the viewer; the arc spatters around the puddle
          const vx = (rand(i, 4) - 0.5) * speed * 0.8;
          const vy = grinder ? rand(i, 5) * speed * 0.4 : (rand(i, 5) - 0.2) * speed;
          const vz = grinder ? (0.4 + rand(i, 6)) * speed : (rand(i, 6) - 0.5) * speed;
          pos.setXYZ(i, tip.x + vx * age, tip.y + vy * age - 4900 * age * age, tip.z + vz * age);
        }
        pos.needsUpdate = true;
      }
    }
  });

  const weldBeadDir = useMemo(() => align(pose.len > 0 ? pose.travel : normal), [pose, normal]);

  return (
    <group>
      <group ref={tool}>
        {grinder && (
          <group position={pose.discAt}>
            <group quaternion={pose.disc}>
              <mesh ref={disc}>
                <cylinderGeometry args={[DISC_R, DISC_R, kind === 'cut' ? 1.6 : 8, 40]} />
                <meshStandardMaterial color={kind === 'cut' ? '#3b3f45' : '#8a7458'} roughness={0.9} />
              </mesh>
              {/* gear head over the disc */}
              <mesh position={[0, 30, 0]}>
                <cylinderGeometry args={[26, 30, 44, 20]} />
                <meshStandardMaterial color="#5d6168" metalness={0.5} roughness={0.4} />
              </mesh>
              {/* half guard */}
              <mesh position={[0, 6, 0]} rotation={[0, Math.PI / 2, 0]}>
                <cylinderGeometry args={[DISC_R + 6, DISC_R + 6, 10, 32, 1, true, 0, Math.PI]} />
                <meshStandardMaterial color="#2c2f33" side={THREE.DoubleSide} />
              </mesh>
            </group>
            {/* motor body leaves the gear head at right angles to the spindle */}
            <group position={pose.bodyDir.clone().multiplyScalar(150).addScaledVector(normal, 30)} quaternion={pose.body}>
              <mesh>
                <cylinderGeometry args={[30, 34, 240, 20]} />
                <meshStandardMaterial color={TOOL_BODY} roughness={0.5} />
              </mesh>
              <mesh position={[0, 135, 0]}>
                <cylinderGeometry args={[22, 30, 40, 16]} />
                <meshStandardMaterial color="#1f2125" roughness={0.8} />
              </mesh>
            </group>
          </group>
        )}

        {torch && (
          <group quaternion={pose.body}>
            <mesh position={[0, 42, 0]}>
              <cylinderGeometry args={[7, 10, 60, 16]} />
              <meshStandardMaterial color="#b87333" metalness={0.8} roughness={0.3} />
            </mesh>
            <mesh position={[0, 160, 0]}>
              <cylinderGeometry args={[12, 12, 180, 16]} />
              <meshStandardMaterial color="#2b2d31" roughness={0.6} />
            </mesh>
            <mesh position={[0, 300, 0]}>
              <cylinderGeometry args={[17, 15, 120, 16]} />
              <meshStandardMaterial color={TOOL_BODY} roughness={0.5} />
            </mesh>
          </group>
        )}

        {kind === 'paint' && (
          <group quaternion={align(normal)}>
            <mesh position={[0, 40, 0]}>
              <boxGeometry args={[50, 80, 50]} />
              <meshStandardMaterial color="#d9dce0" metalness={0.4} roughness={0.4} />
            </mesh>
            <mesh position={[0, 60, -70]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[14, 14, 120, 12]} />
              <meshStandardMaterial color="#1f2125" />
            </mesh>
            {/* mist cone toward the work */}
            <mesh ref={mist} position={[0, -120, 0]}>
              <coneGeometry args={[110, 240, 24, 1, true]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.18} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
          </group>
        )}

        {kind === 'measure' && (
          <mesh position={[0, 20, 0]}>
            <boxGeometry args={[60, 60, 30]} />
            <meshStandardMaterial color="#f2c230" roughness={0.6} />
          </mesh>
        )}

        {torch && (
          <>
            <mesh ref={arc}>
              <sphereGeometry args={[7, 12, 12]} />
              <meshBasicMaterial color="#e8f6ff" toneMapped={false} />
            </mesh>
            <pointLight ref={light} color="#9fd4ff" decay={0} distance={700} intensity={0} />
          </>
        )}
      </group>

      {kind === 'weld' && (
        <mesh ref={bead} quaternion={weldBeadDir}>
          <cylinderGeometry args={[4, 4, 1, 10]} />
          <meshStandardMaterial color="#c7c2b8" emissive="#ff5a00" emissiveIntensity={0.35} metalness={0.6} roughness={0.4} />
        </mesh>
      )}
      {kind === 'tack' && (
        <mesh ref={bead} position={from}>
          <sphereGeometry args={[5, 10, 10]} />
          <meshStandardMaterial color="#c7c2b8" emissive="#ff5a00" emissiveIntensity={0.35} />
        </mesh>
      )}
      {kind === 'measure' && (
        <mesh ref={tape} quaternion={weldBeadDir}>
          <boxGeometry args={[19, 1, 1.5]} />
          <meshStandardMaterial color="#f2c230" />
        </mesh>
      )}

      <points ref={sparks} geometry={sparkGeo} frustumCulled={false}>
        <pointsMaterial color="#ffb347" size={7} toneMapped={false} />
      </points>
    </group>
  );
}

/** Flies the orbit camera to look at a point, then hands control back; any drag cancels the flight. */
export function FocusRig({ focus, distance }: { focus: Vec3 | null; distance: number }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as
    | (THREE.EventDispatcher<{ start: object }> & { target: THREE.Vector3; update: () => void })
    | null;
  const goal = useRef<{ target: THREE.Vector3; position: THREE.Vector3 } | null>(null);
  const [fx, fy, fz] = focus ?? [];

  useEffect(() => {
    if (fx === undefined || fy === undefined || fz === undefined) return;
    const target = new THREE.Vector3(fx, fy, fz);
    // front-right and above: where every step's demo happens
    const view = new THREE.Vector3(0.55, 0.45, 0.7).normalize().multiplyScalar(distance);
    goal.current = { target, position: target.clone().add(view) };
  }, [fx, fy, fz, distance]);

  useEffect(() => {
    if (!controls) return;
    const cancel = () => (goal.current = null);
    controls.addEventListener('start', cancel);
    return () => controls.removeEventListener('start', cancel);
  }, [controls]);

  useFrame((_, dt) => {
    const g = goal.current;
    if (!g || !controls) return;
    const k = 1 - Math.exp(-dt * 4);
    controls.target.lerp(g.target, k);
    camera.position.lerp(g.position, k);
    controls.update();
    if (camera.position.distanceTo(g.position) < 1) goal.current = null;
  });
  return null;
}
