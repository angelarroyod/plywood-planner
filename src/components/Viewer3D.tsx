import { Canvas } from '@react-three/fiber';
import { Edges, OrbitControls } from '@react-three/drei';
import { useMemo } from 'react';
import type { Design, Step, Vec3 } from '../engine/types.ts';
import { useAppStore, type Theme } from '../state/store.ts';

const EXPLODE_FACTOR = 1.6; // panels move away from the centroid by this factor

/** WebGL cannot read CSS variables, so the palette is mirrored here per theme. */
const PALETTE: Record<Theme, {
  base: string;
  highlight: string;
  dimmed: string;
  edge: string;
  sky: string;
  ground: string;
  bounce: string;
  shadow: number;
  gridCell: string;
  gridSection: string;
}> = {
  dark: {
    base: '#c08a4e', // plywood amber
    highlight: '#db011c', // signal red — the step being explained
    dimmed: '#4a5057', // graphite — everything else in that step
    edge: '#1a1c20',
    sky: '#dfe4ea',
    ground: '#14161a',
    bounce: '#ff5a68',
    shadow: 0.55,
    gridCell: '#2e3238',
    gridSection: '#4a5057',
  },
  light: {
    base: '#c08a4e',
    highlight: '#b03410',
    dimmed: '#cfc6b5',
    edge: '#8a5f2c',
    sky: '#ffffff',
    ground: '#c9bda6',
    bounce: '#ffd9a0',
    shadow: 0.28,
    gridCell: '#cfc3ad',
    gridSection: '#a8977c',
  },
};

export function Viewer3D({
  design,
  stale,
  highlightStep = null,
}: {
  design: Design;
  stale: boolean;
  highlightStep?: Step | null;
}) {
  const exploded = useAppStore((s) => s.exploded);
  const c = PALETTE[useAppStore((s) => s.theme)];

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

  return (
    <div
      className={`relative h-full bg-[radial-gradient(circle_at_50%_32%,var(--color-stage-near)_0%,var(--color-stage-far)_100%)] transition-opacity duration-300 ${
        stale ? 'opacity-40' : ''
      }`}
    >
      <Canvas
        shadows="soft"
        dpr={[1, 2]}
        gl={{ antialias: true }}
        camera={{ position: [1600, 1400, 2000], fov: 45, near: 10, far: 30000 }}
      >
        <hemisphereLight args={[c.sky, c.ground, 0.65]} />
        <directionalLight
          position={[1500, 3000, 2000]}
          intensity={1.25}
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
        {/* Bounce so the shadow side picks up the accent, not mud. */}
        <directionalLight position={[-2000, 1200, -1500]} intensity={0.22} color={c.bounce} />

        {design.placements.map((p) => {
          let pos: Vec3 = exploded
            ? [
                centroid[0] + (p.position[0] - centroid[0]) * EXPLODE_FACTOR,
                centroid[1] + (p.position[1] - centroid[1]) * EXPLODE_FACTOR,
                centroid[2] + (p.position[2] - centroid[2]) * EXPLODE_FACTOR,
              ]
            : p.position;
          const stepOffset = highlightIds ? stepOffsets[p.panelId] : undefined;
          if (stepOffset) {
            pos = [pos[0] + stepOffset[0], pos[1] + stepOffset[1], pos[2] + stepOffset[2]];
          }
          const color = !highlightIds
            ? c.base
            : highlightIds.has(p.panelId)
              ? c.highlight
              : c.dimmed;
          return (
            <mesh key={`${p.panelId}-${p.instance}`} position={pos} castShadow>
              <boxGeometry args={p.size} />
              <meshStandardMaterial color={color} roughness={0.68} metalness={0} />
              <Edges color={c.edge} />
            </mesh>
          );
        })}

        {/* Catches the key light's shadow without painting a visible floor slab. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 1, 0]} receiveShadow>
          <planeGeometry args={[9000, 9000]} />
          <shadowMaterial color="#000000" opacity={c.shadow} />
        </mesh>

        {/* 100 mm cells over 500 mm sections — the drawing grid, read at two scales. */}
        <gridHelper
          args={[8000, 80, c.gridCell, c.gridCell]}
          material-transparent
          material-opacity={0.55}
        />
        <gridHelper
          args={[8000, 16, c.gridSection, c.gridSection]}
          material-transparent
          material-opacity={0.8}
        />

        <OrbitControls target={centroid} makeDefault />
      </Canvas>

      <div className="pointer-events-none absolute bottom-4 left-4 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
        Cuadrícula 100 mm · arrastra para girar
      </div>

      {stale && (
        <div className="pointer-events-none absolute inset-x-0 top-5 flex justify-center">
          <span className="rounded-full border border-cut bg-cut-tint px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-cut">
            Corrige los errores para actualizar el modelo
          </span>
        </div>
      )}
    </div>
  );
}
