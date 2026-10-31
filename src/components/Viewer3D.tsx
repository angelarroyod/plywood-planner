import { Canvas, useThree } from '@react-three/fiber';
import { Edges, Html, Line, OrbitControls } from '@react-three/drei';
import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { Vector3, type BufferGeometry, type PerspectiveCamera } from 'three';
import { WELD_REF, type Tube, type TubeEnd, type TubePlacement } from '../engine/index.ts';
import type { Fitting, Placement, Step, Vec3 } from '../engine/types.ts';
import { useAppStore, type Theme } from '../state/store.ts';
import { beadGeometry, capGeometry, tubeGeometry } from './weld/tubeMesh.ts';

const EXPLODE_FACTOR = 1.6; // panels move away from the centroid by this factor
const HOME: Vec3 = [1600, 1400, 2000]; // camera start before framing; its direction is kept
const FIT_MARGIN = 1.25; // room for the dimension labels and the stage's corner overlays

/**
 * WebGL cannot read CSS variables, so the notebook palette is mirrored here per
 * theme. In a step, the parts it names turn highlighter yellow and the rest
 * fade to a pencil ghost, so the subject always out-contrasts the page.
 */
const PALETTE: Record<Theme, {
  base: string; // plywood
  edge: string; // plywood outline
  highlight: string; // highlighter: the step's parts, and the dimension being dragged
  ink: string; // ballpoint: dimension lines
  ghost: string; // everything else in a step
  ghostEdge: string;
  ghostOpacity: number;
  steel: string; // rod, handles, and the outline on painted tube
  plug: string; // plastic caps in open tube ends
  sky: string;
  ground: string;
  rim: string; // back light that separates dark tube from the night page
  shadow: number;
  gridCell: string;
  gridSection: string;
}> = {
  light: {
    base: '#d49a5c',
    edge: '#6e4318',
    highlight: '#ffd83a',
    ink: '#2340c8',
    ghost: '#e3ecf6',
    ghostEdge: '#6f9fcb',
    ghostOpacity: 0.35,
    steel: '#6c7685',
    plug: '#2a2d33',
    sky: '#ffffff',
    ground: '#c9d6e6',
    rim: '#ffffff',
    shadow: 0.22,
    gridCell: '#cfe4f4',
    gridSection: '#92c3e6',
  },
  dark: {
    base: '#d9a066',
    edge: '#3d2410',
    highlight: '#ffe14d',
    ink: '#9fb0ff',
    ghost: '#33467f',
    ghostEdge: '#7f97e0',
    ghostOpacity: 0.3,
    steel: '#b6c0d2',
    plug: '#454b58',
    sky: '#e3e9ff',
    ground: '#0c1226',
    rim: '#9fb0ff',
    shadow: 0.5,
    gridCell: '#1d2b55',
    gridSection: '#2f4687',
  },
};

/** Paint or bare steel for welded projects; boards keep the plywood palette. */
export interface Finish {
  color: string;
  metalness: number;
  roughness: number;
}

export function Viewer3D({
  design,
  stale,
  highlightStep = null,
  finish,
  dimensions = false,
  showWelds = true,
  showCaps = true,
  children,
}: {
  // a welded design adds its tube, so placements draw as real tube with beads and plugs
  design: { placements: Placement[]; fittings?: Fitting[]; tube?: Tube; welds?: TubeEnd[]; caps?: TubeEnd[] };
  stale: boolean;
  highlightStep?: Step | null;
  finish?: Finish;
  dimensions?: boolean; // ballpoint width/height/depth lines on the model (Diseño)
  showWelds?: boolean; // false in steps before the beads are laid
  showCaps?: boolean; // false in steps before the plugs go in
  children?: ReactNode; // extra scene content, e.g. a tool demo
}) {
  const exploded = useAppStore((s) => s.exploded);
  const readout = useAppStore((s) => s.readout);
  const c = PALETTE[useAppStore((s) => s.theme)];
  const [home, setHome] = useState(0); // bumps to fly the camera back to the start

  const centroid = useMemo<Vec3>(() => {
    const n = design.placements.length || 1;
    let x = 0, y = 0, z = 0;
    for (const p of design.placements) {
      x += p.position[0];
      y += p.position[1];
      z += p.position[2];
    }
    return [x / n, y / n, z / n];
  }, [design]);

  const highlightIds = highlightStep ? new Set(highlightStep.panelRefs) : null;
  const stepOffsets = highlightStep?.explodeOffsets ?? {};

  // Panels and fittings render alike; fittings are steel and never cut. The centroid stays the panels'.
  // A placed piece of tube carries its own geometry, with the beads and plugs at its ends.
  const boxes = useMemo(() => {
    const { tube, welds = [], caps = [] } = design;
    const at = (p: Placement, list: TubeEnd[]) => list.filter((e) => e.panelId === p.panelId && e.instance === p.instance);
    return [
      ...design.placements.map((p) => {
        const piece = tube && 'axis' in p ? (p as TubePlacement) : null;
        return {
          key: `${p.panelId}-${p.instance}`,
          id: p.panelId,
          position: p.position,
          size: p.size,
          steel: false,
          tube: piece && {
            body: tubeGeometry(piece, tube!),
            beads: at(p, welds).map((e) => beadGeometry(piece, tube!, e.end)),
            caps: at(p, caps).map((e) => capGeometry(piece, tube!, e.end)),
          },
        };
      }),
      ...(design.fittings ?? []).map((f) => ({
        key: `fitting-${f.id}-${f.instance}`,
        id: f.id,
        position: f.position,
        size: f.size,
        steel: true,
        tube: null as { body: BufferGeometry; beads: BufferGeometry[]; caps: BufferGeometry[] } | null,
      })),
    ];
  }, [design]);
  useEffect(
    () => () => {
      for (const b of boxes) if (b.tube) [b.tube.body, ...b.tube.beads, ...b.tube.caps].forEach((g) => g.dispose());
    },
    [boxes],
  );
  const beadsLit = highlightIds?.has(WELD_REF) ?? false;
  const beadsGhost = highlightIds !== null && !beadsLit;

  return (
    <div
      className={`relative h-full bg-[radial-gradient(ellipse_at_50%_35%,var(--color-stage-near)_0%,var(--color-stage-far)_100%)] transition-opacity duration-300 ${
        stale ? 'opacity-45' : ''
      }`}
    >
      <Canvas
        shadows="soft"
        dpr={[1, 2]}
        gl={{ antialias: true }}
        camera={{ position: HOME, fov: 45, near: 10, far: 30000 }}
      >
        <hemisphereLight args={[c.sky, c.ground, 0.7]} />
        <directionalLight
          position={[1500, 3000, 2000]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-left={-2200}
          shadow-camera-right={2200}
          shadow-camera-top={2200}
          shadow-camera-bottom={-2200}
          shadow-camera-near={100}
          shadow-camera-far={9000}
        />
        <directionalLight position={[-1200, 2600, -2800]} intensity={0.6} color={c.rim} />

        {boxes.map((b) => {
          let pos: Vec3 = exploded
            ? [
                centroid[0] + (b.position[0] - centroid[0]) * EXPLODE_FACTOR,
                centroid[1] + (b.position[1] - centroid[1]) * EXPLODE_FACTOR,
                centroid[2] + (b.position[2] - centroid[2]) * EXPLODE_FACTOR,
              ]
            : b.position;
          const stepOffset = highlightIds ? stepOffsets[b.id] : undefined;
          if (stepOffset) {
            pos = [pos[0] + stepOffset[0], pos[1] + stepOffset[1], pos[2] + stepOffset[2]];
          }
          const ghost = highlightIds !== null && !highlightIds.has(b.id);
          const lit = highlightIds?.has(b.id) ?? false;
          const color = ghost ? c.ghost : lit ? c.highlight : b.steel ? c.steel : (finish?.color ?? c.base);
          const edge = ghost ? c.ghostEdge : b.steel || finish ? c.steel : c.edge;
          if (b.tube) {
            const ghostMat = { transparent: true, opacity: c.ghostOpacity, depthWrite: false };
            return (
              <group key={b.key} position={pos}>
                <mesh geometry={b.tube.body} castShadow={!ghost}>
                  <meshStandardMaterial
                    color={color}
                    {...(ghost && ghostMat)}
                    roughness={lit ? 0.6 : (finish?.roughness ?? 0.5)}
                    metalness={lit ? 0 : (finish?.metalness ?? 0.4)}
                  />
                  <Edges threshold={20}>
                    <lineBasicMaterial color={edge} transparent={ghost} opacity={ghost ? 0.7 : 1} />
                  </Edges>
                </mesh>
                {showWelds &&
                  b.tube.beads.map((g, i) => (
                    <mesh key={`bead-${i}`} geometry={g} castShadow={!beadsGhost}>
                      <meshStandardMaterial
                        color={beadsGhost ? c.ghost : beadsLit ? c.highlight : (finish?.color ?? c.steel)}
                        {...(beadsGhost && ghostMat)}
                        roughness={0.85}
                        metalness={beadsLit ? 0 : (finish?.metalness ?? 0.4)}
                      />
                    </mesh>
                  ))}
                {showCaps &&
                  b.tube.caps.map((g, i) => (
                    <mesh key={`cap-${i}`} geometry={g}>
                      <meshStandardMaterial color={ghost ? c.ghost : c.plug} {...(ghost && ghostMat)} roughness={0.6} />
                    </mesh>
                  ))}
              </group>
            );
          }
          return (
            <mesh key={b.key} position={pos} castShadow={!ghost}>
              <boxGeometry args={b.size} />
              <meshStandardMaterial
                color={color}
                transparent={ghost}
                opacity={ghost ? c.ghostOpacity : 1}
                depthWrite={!ghost}
                roughness={b.steel ? 0.35 : lit ? 0.6 : (finish?.roughness ?? 0.7)}
                metalness={b.steel ? 0.6 : lit ? 0 : (finish?.metalness ?? 0)}
              />
              <Edges>
                <lineBasicMaterial color={edge} transparent={ghost} opacity={ghost ? 0.7 : 1} />
              </Edges>
            </mesh>
          );
        })}

        {/* Catches the key light's shadow without painting a visible floor slab. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 1, 0]} receiveShadow>
          <planeGeometry args={[9000, 9000]} />
          <shadowMaterial color="#000000" opacity={c.shadow} />
        </mesh>

        {/* The cuadrícula on the floor: 100 mm cells under 500 mm sections, true scale. */}
        <gridHelper args={[8000, 80, c.gridCell, c.gridCell]} />
        <gridHelper args={[8000, 16, c.gridSection, c.gridSection]} position={[0, 0.5, 0]} />

        {dimensions && !exploded && !highlightStep && (
          <Dimensions placements={design.placements} ink={c.ink} hi={c.highlight} active={readout?.key ?? null} />
        )}

        {children}

        <OrbitControls target={centroid} makeDefault />
        <FrameCamera trigger={home} boxes={boxes} target={centroid} />
      </Canvas>

      {readout && (
        <div
          aria-hidden
          className="pointer-events-none absolute left-4 top-4 rounded-xl border border-rule bg-panel/95 px-4 py-2.5 shadow-[0_2px_8px_rgb(20_26_43/0.12)]"
        >
          <div className="text-[13px] font-semibold text-ink-soft">{readout.label}</div>
          <div className="font-mono text-[44px] font-bold leading-none text-accent-ink">
            {readout.value}
            {readout.unit && <span className="ml-1.5 text-lg font-medium text-ink-soft">{readout.unit}</span>}
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 rounded-lg bg-panel/85 px-2.5 py-1.5 text-xs font-medium text-ink-soft">
        <svg viewBox="0 0 24 8" className="h-2 w-6" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
          <path d="M1 1v6h22V1M12 4v3" />
        </svg>
        <span className="sm:hidden">100 mm</span>
        <span className="hidden sm:inline">Cuadro de 100 mm · arrastra para girar</span>
      </div>

      <button
        onClick={() => setHome((n) => n + 1)}
        className="absolute bottom-3 right-3 flex h-10 items-center gap-2 rounded-lg border border-rule bg-panel/95 px-3 text-sm font-semibold text-ink-soft transition-colors hover:border-rule-strong hover:text-ink"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3.5 10a6.5 6.5 0 1 0 2-4.7M3.5 3.5v3h3" />
        </svg>
        Vista general
      </button>

      {stale && (
        <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center px-4">
          <span className="rounded-full bg-cut-tint px-3.5 py-1.5 text-[13px] font-semibold text-cut-ink shadow-[0_1px_4px_rgb(20_26_43/0.12)]">
            Corrige los errores para actualizar el modelo
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Frames the design from HOME's direction: the camera backs off just far enough
 * for every corner of every box to fit the canvas's fov and aspect, looking at
 * the panels' centroid. Runs on mount, on a template change and on "Vista
 * general" — never on a param change, so a slider drag doesn't move the camera.
 */
function FrameCamera({ trigger, boxes, target }: { trigger: number; boxes: { position: Vec3; size: Vec3 }[]; target: Vec3 }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as unknown as { target: { set: (...v: Vec3) => void }; update: () => void } | null;
  const templateKey = useAppStore((s) => (s.mode === 'metal' ? s.weldTemplateId : s.templateId));
  useLayoutEffect(() => {
    if (!boxes.length || !size.height) return;
    const back = new Vector3(...HOME).normalize(); // from the target toward the camera
    const right = new Vector3(0, 1, 0).cross(back).normalize();
    const up = back.clone().cross(right);
    const tanV = Math.tan((camera.fov * Math.PI) / 360) / FIT_MARGIN;
    const tanH = tanV * (size.width / size.height);
    const t = new Vector3(...target);
    const rel = new Vector3();
    let dist = 0;
    for (const b of boxes) {
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
        rel.set(b.position[0] + (sx * b.size[0]) / 2, b.position[1] + (sy * b.size[1]) / 2, b.position[2] + (sz * b.size[2]) / 2).sub(t);
        const z = rel.dot(back); // a corner nearer the camera needs the camera further back
        dist = Math.max(dist, z + Math.abs(rel.dot(right)) / tanH, z + Math.abs(rel.dot(up)) / tanV);
      }
    }
    camera.position.copy(back).multiplyScalar(dist).add(t);
    camera.lookAt(t);
    controls?.target.set(...target);
    controls?.update();
  }, [trigger, templateKey]); // boxes, target and size are read fresh on each framing
  return null;
}

const DIM_OFFSET = 90; // mm the dimension lines stand off the model
const DIM_TICK = 50;

/**
 * Overall width, height and depth drawn on the model the way you would on a
 * notebook sketch: ballpoint lines with end ticks and the number at the middle.
 * The dimension being dragged turns highlighter.
 */
function Dimensions({ placements, ink, hi, active }: { placements: Placement[]; ink: string; hi: string; active: string | null }) {
  const lines = useMemo(() => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const p of placements) {
      x0 = Math.min(x0, p.position[0] - p.size[0] / 2);
      x1 = Math.max(x1, p.position[0] + p.size[0] / 2);
      y0 = Math.min(y0, p.position[1] - p.size[1] / 2);
      y1 = Math.max(y1, p.position[1] + p.size[1] / 2);
      z0 = Math.min(z0, p.position[2] - p.size[2] / 2);
      z1 = Math.max(z1, p.position[2] + p.size[2] / 2);
    }
    const t = DIM_TICK / 2;
    const zf = z1 + DIM_OFFSET; // in front of the model, on the floor
    const xr = x1 + DIM_OFFSET; // right of the model
    return [
      { key: 'width', mm: x1 - x0, a: [x0, y0, zf], b: [x1, y0, zf], tick: [0, t, 0] },
      { key: 'height', mm: y1 - y0, a: [xr, y0, z1], b: [xr, y1, z1], tick: [t, 0, 0] },
      { key: 'depth', mm: z1 - z0, a: [xr, y0, z0], b: [xr, y0, z1], tick: [0, t, 0] },
    ] satisfies { key: string; mm: number; a: Vec3; b: Vec3; tick: Vec3 }[];
  }, [placements]);

  return (
    <>
      {lines.map((d) => {
        const on = d.key === active;
        const color = on ? hi : ink;
        const end = (p: Vec3): [Vec3, Vec3] => [
          [p[0] - d.tick[0], p[1] - d.tick[1], p[2] - d.tick[2]],
          [p[0] + d.tick[0], p[1] + d.tick[1], p[2] + d.tick[2]],
        ];
        const mid: Vec3 = [(d.a[0] + d.b[0]) / 2, (d.a[1] + d.b[1]) / 2, (d.a[2] + d.b[2]) / 2];
        return (
          <group key={d.key}>
            <Line points={[d.a, d.b]} color={color} lineWidth={on ? 3 : 1.5} />
            <Line points={end(d.a)} color={color} lineWidth={on ? 3 : 1.5} />
            <Line points={end(d.b)} color={color} lineWidth={on ? 3 : 1.5} />
            <Html position={mid} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
              <span
                className={`whitespace-nowrap rounded-md px-1.5 py-0.5 font-mono text-[13px] font-bold shadow-[0_1px_3px_rgb(20_26_43/0.18)] ${
                  on ? 'bg-hi text-[#141a2b]' : 'bg-panel/95 text-accent-ink'
                }`}
              >
                {Math.round(d.mm)}
              </span>
            </Html>
          </group>
        );
      })}
    </>
  );
}
