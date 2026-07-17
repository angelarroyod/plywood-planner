import { Canvas } from '@react-three/fiber';
import { Edges, OrbitControls } from '@react-three/drei';
import { useMemo } from 'react';
import type { Design, Vec3 } from '../engine/types.ts';
import { useAppStore } from '../state/store.ts';

const EXPLODE_FACTOR = 1.6; // panels move away from the centroid by this factor

export function Viewer3D({ design, stale }: { design: Design; stale: boolean }) {
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

  return (
    <div className={`h-full ${stale ? 'opacity-40' : ''}`}>
      <Canvas camera={{ position: [1600, 1400, 2000], fov: 45, near: 10, far: 30000 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[1500, 3000, 2000]} intensity={1.4} />
        {design.placements.map((p) => {
          const pos: Vec3 = exploded
            ? [
                centroid[0] + (p.position[0] - centroid[0]) * EXPLODE_FACTOR,
                centroid[1] + (p.position[1] - centroid[1]) * EXPLODE_FACTOR,
                centroid[2] + (p.position[2] - centroid[2]) * EXPLODE_FACTOR,
              ]
            : p.position;
          return (
            <mesh key={`${p.panelId}-${p.instance}`} position={pos}>
              <boxGeometry args={p.size} />
              <meshStandardMaterial color="#d9a05b" />
              <Edges color="#8a5a25" />
            </mesh>
          );
        })}
        <gridHelper args={[4000, 20, '#bbbbbb', '#dddddd']} />
        <OrbitControls target={centroid} makeDefault />
      </Canvas>
      {stale && (
        <div className="pointer-events-none absolute inset-x-0 top-4 text-center text-sm font-medium text-red-600">
          Corrige los errores para actualizar el modelo
        </div>
      )}
    </div>
  );
}
