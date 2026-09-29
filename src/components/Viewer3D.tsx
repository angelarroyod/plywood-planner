import { Canvas } from '@react-three/fiber';
import { Edges, OrbitControls } from '@react-three/drei';
import { useMemo } from 'react';
import type { Design, Step, Vec3 } from '../engine/types.ts';
import { useAppStore } from '../state/store.ts';

const EXPLODE_FACTOR = 1.6; // panels move away from the centroid by this factor

const BASE_COLOR = '#c08a4e'; // plywood amber
const HIGHLIGHT_COLOR = '#db011c'; // signal red — the step being explained
const DIMMED_COLOR = '#4a5057'; // graphite — everything else in that step
const STEEL_COLOR = '#9aa3ad'; // brushed steel — rod and handles

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
  const boxes = useMemo(
    () => [
      ...design.placements.map((p) => ({
        key: `${p.panelId}-${p.instance}`,
        id: p.panelId,
        position: p.position,
        size: p.size,
        steel: false,
      })),
      ...design.fittings.map((f) => ({
        key: `fitting-${f.id}-${f.instance}`,
        id: f.id,
        position: f.position,
        size: f.size,
        steel: true,
      })),
    ],
    [design],
  );

  return (
    <div
      className={`relative h-full bg-[radial-gradient(circle_at_50%_32%,#23262b_0%,#0e0f11_100%)] transition-opacity duration-300 ${
        stale ? 'opacity-40' : ''
      }`}
    >
      <Canvas
        shadows="soft"
        dpr={[1, 2]}
        gl={{ antialias: true }}
        camera={{ position: [1600, 1400, 2000], fov: 45, near: 10, far: 30000 }}
      >
        <hemisphereLight args={['#dfe4ea', '#14161a', 0.65]} />
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
        {/* Cool-red bounce so the shadow side picks up the accent, not mud. */}
        <directionalLight position={[-2000, 1200, -1500]} intensity={0.22} color="#ff5a68" />

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
          const color = !highlightIds
            ? b.steel
              ? STEEL_COLOR
              : BASE_COLOR
            : highlightIds.has(b.id)
              ? HIGHLIGHT_COLOR
              : DIMMED_COLOR;
          return (
            <mesh key={b.key} position={pos} castShadow>
              <boxGeometry args={b.size} />
              <meshStandardMaterial color={color} roughness={b.steel ? 0.35 : 0.68} metalness={b.steel ? 0.6 : 0} />
              <Edges color="#1a1c20" />
            </mesh>
          );
        })}

        {/* Catches the key light's shadow without painting a visible floor slab. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 1, 0]} receiveShadow>
          <planeGeometry args={[9000, 9000]} />
          <shadowMaterial color="#000000" opacity={0.55} />
        </mesh>

        {/* 100 mm cells over 500 mm sections — the drawing grid, read at two scales. */}
        <gridHelper
          args={[8000, 80, '#2e3238', '#2e3238']}
          material-transparent
          material-opacity={0.55}
        />
        <gridHelper
          args={[8000, 16, '#4a5057', '#4a5057']}
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
