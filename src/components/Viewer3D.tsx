import { Canvas } from '@react-three/fiber';
import { ContactShadows, Edges, Grid, OrbitControls } from '@react-three/drei';
import { useMemo } from 'react';
import type { Design, Step, Vec3 } from '../engine/types.ts';
import { useAppStore } from '../state/store.ts';

const EXPLODE_FACTOR = 1.6; // panels move away from the centroid by this factor

const BASE_COLOR = '#d9a05b';
const HIGHLIGHT_COLOR = '#f0a832';
const DIMMED_COLOR = '#e6dccb';

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

  return (
    <div
      className={`relative h-full bg-[radial-gradient(circle_at_50%_30%,#fbf7ef_0%,#e8e0d0_100%)] transition-opacity duration-300 ${
        stale ? 'opacity-40' : ''
      }`}
    >
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true }}
        camera={{ position: [1600, 1400, 2000], fov: 45, near: 10, far: 30000 }}
      >
        <hemisphereLight args={['#fff6e6', '#bfae91', 0.75]} />
        <directionalLight position={[1500, 3000, 2000]} intensity={1.15} />
        <directionalLight position={[-2000, 1200, -1500]} intensity={0.35} color="#ffd9a0" />
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
            ? BASE_COLOR
            : highlightIds.has(p.panelId)
              ? HIGHLIGHT_COLOR
              : DIMMED_COLOR;
          return (
            <mesh key={`${p.panelId}-${p.instance}`} position={pos}>
              <boxGeometry args={p.size} />
              <meshStandardMaterial color={color} roughness={0.68} metalness={0} />
              <Edges color="#7a5326" />
            </mesh>
          );
        })}
        <ContactShadows
          position={[centroid[0], 1, centroid[2]]}
          scale={4000}
          resolution={512}
          blur={2.4}
          far={1500}
          opacity={0.42}
          color="#3b2a16"
        />
        <Grid
          args={[8000, 8000]}
          cellSize={100}
          cellThickness={0.6}
          cellColor="#cfc3ad"
          sectionSize={500}
          sectionThickness={1}
          sectionColor="#a8977c"
          fadeDistance={9000}
          fadeStrength={1.5}
          infiniteGrid
        />
        <OrbitControls target={centroid} makeDefault />
      </Canvas>

      <div className="pointer-events-none absolute bottom-4 left-4 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft/70">
        Cuadrícula 100 mm · arrastra para girar
      </div>

      {stale && (
        <div className="pointer-events-none absolute inset-x-0 top-5 flex justify-center">
          <span className="rounded-full border border-cut/30 bg-cut-tint px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-cut">
            Corrige los errores para actualizar el modelo
          </span>
        </div>
      )}
    </div>
  );
}
