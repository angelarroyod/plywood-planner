import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useEffect, useMemo, useRef } from 'react';
import { PanResponder, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import * as THREE from 'three';
import type { Design, Step, Vec3 } from '@/lib/engine';

const EXPLODE_FACTOR = 1.6;
const BASE = 0xc08a4e;
const HIGHLIGHT = 0xdb011c;
const DIMMED = 0x4a5057;

interface Props {
  design: Design;
  exploded: boolean;
  highlightStep?: Step | null;
  style?: StyleProp<ViewStyle>;
}

interface Orbit {
  target: Vec3;
  radius: number;
  theta: number;
  phi: number;
}

/**
 * The design prototype drives three.js imperatively; expo-gl gives us the same
 * WebGL2 context, so this is that code ported rather than a react-three-fiber
 * rewrite — fewer moving parts and no renderer/React version coupling.
 */
export function Viewer3D({ design, exploded, highlightStep = null, style }: Props) {
  // The GL callback fires once, so the loop reads the latest props through a ref.
  const props = useRef({ design, exploded, highlightStep });
  props.current = { design, exploded, highlightStep };

  const gl = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    group: THREE.Group;
    orbit: Orbit | null;
    signature: string;
    ctx: ExpoWebGLRenderingContext;
  } | null>(null);

  const place = (o: Orbit, camera: THREE.PerspectiveCamera) => {
    const s = Math.sin(o.phi) * o.radius;
    camera.position.set(
      o.target[0] + s * Math.sin(o.theta),
      o.target[1] + Math.cos(o.phi) * o.radius,
      o.target[2] + s * Math.cos(o.theta),
    );
    camera.lookAt(o.target[0], o.target[1], o.target[2]);
  };

  const pan = useMemo(() => {
    let lastX = 0;
    let lastY = 0;
    let lastPinch = 0;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        lastX = e.nativeEvent.pageX;
        lastY = e.nativeEvent.pageY;
        lastPinch = 0;
      },
      onPanResponderMove: (e) => {
        const g = gl.current;
        if (!g?.orbit) return;
        const touches = e.nativeEvent.touches;

        if (touches.length >= 2) {
          const [a, b] = touches;
          const d = Math.hypot(a!.pageX - b!.pageX, a!.pageY - b!.pageY);
          if (lastPinch) {
            g.orbit.radius = Math.max(600, Math.min(12000, g.orbit.radius * (lastPinch / d)));
            place(g.orbit, g.camera);
          }
          lastPinch = d;
          return;
        }

        lastPinch = 0;
        const { pageX, pageY } = e.nativeEvent;
        g.orbit.theta -= (pageX - lastX) * 0.006;
        g.orbit.phi = Math.max(0.08, Math.min(Math.PI / 2 - 0.02, g.orbit.phi - (pageY - lastY) * 0.006));
        lastX = pageX;
        lastY = pageY;
        place(g.orbit, g.camera);
      },
    });
  }, []);

  /** Rebuild the panel meshes only when something visible actually changed. */
  const build = () => {
    const g = gl.current;
    const { design: d, exploded: ex, highlightStep: step } = props.current;
    if (!g || !d) return;

    const sig = JSON.stringify([d.templateId, d.params, ex, step?.order ?? null]);
    if (sig === g.signature) return;
    g.signature = sig;

    while (g.group.children.length) {
      const c = g.group.children.pop()!;
      c.traverse((n) => {
        const m = n as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | undefined;
        mat?.dispose?.();
      });
    }

    const n = d.placements.length || 1;
    const centroid = d.placements.reduce<Vec3>(
      (a, p) => [a[0] + p.position[0] / n, a[1] + p.position[1] / n, a[2] + p.position[2] / n],
      [0, 0, 0],
    );
    const highlight = step ? new Set(step.panelRefs) : null;
    const offsets = step?.explodeOffsets ?? {};

    for (const p of d.placements) {
      let pos: Vec3 = ex
        ? [
            centroid[0] + (p.position[0] - centroid[0]) * EXPLODE_FACTOR,
            centroid[1] + (p.position[1] - centroid[1]) * EXPLODE_FACTOR,
            centroid[2] + (p.position[2] - centroid[2]) * EXPLODE_FACTOR,
          ]
        : [p.position[0], p.position[1], p.position[2]];
      const off = highlight ? offsets[p.panelId] : undefined;
      if (off) pos = [pos[0] + off[0], pos[1] + off[1], pos[2] + off[2]];

      const on = highlight?.has(p.panelId);
      const geo = new THREE.BoxGeometry(p.size[0], p.size[1], p.size[2]);
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        color: !highlight ? BASE : on ? HIGHLIGHT : DIMMED,
        roughness: 0.62,
      }));
      mesh.position.set(pos[0], pos[1], pos[2]);
      mesh.castShadow = true;
      mesh.add(
        new THREE.LineSegments(
          new THREE.EdgesGeometry(geo),
          new THREE.LineBasicMaterial({ color: on ? 0xffffff : 0x1a1c20 }),
        ),
      );
      g.group.add(mesh);
    }

    if (!g.orbit) {
      const off: Vec3 = [2000 - centroid[0], 1900 - centroid[1], 3000 - centroid[2]];
      const radius = Math.hypot(off[0], off[1], off[2]);
      g.orbit = { target: centroid, radius, theta: Math.atan2(off[0], off[2]), phi: Math.acos(off[1] / radius) };
    } else {
      g.orbit.target = centroid;
    }
    place(g.orbit, g.camera);
  };

  useEffect(build, [design, exploded, highlightStep]);

  const onContextCreate = (ctx: ExpoWebGLRenderingContext) => {
    const width = ctx.drawingBufferWidth;
    const height = ctx.drawingBufferHeight;

    // three needs a canvas-ish object; expo-gl only hands us the context.
    const canvas = {
      width,
      height,
      clientWidth: width,
      clientHeight: height,
      style: {},
      addEventListener: () => {},
      removeEventListener: () => {},
      getContext: () => ctx,
    } as unknown as HTMLCanvasElement;

    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, antialias: true });
    renderer.setSize(width, height, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 10, 30000);

    scene.add(new THREE.HemisphereLight(0xdfe4ea, 0x14161a, 0.65));
    const key = new THREE.DirectionalLight(0xffffff, 1.25);
    key.position.set(1500, 3000, 2000);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, {
      left: -2200, right: 2200, top: 2200, bottom: -2200, near: 100, far: 9000,
    });
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xff5a68, 0.22);
    fill.position.set(-2000, 1200, -1500);
    scene.add(fill);

    const cells = new THREE.GridHelper(8000, 80, 0x2e3238, 0x2e3238);
    (cells.material as THREE.Material).transparent = true;
    (cells.material as THREE.Material).opacity = 0.55;
    scene.add(cells);
    const sections = new THREE.GridHelper(8000, 16, 0x4a5057, 0x4a5057);
    (sections.material as THREE.Material).transparent = true;
    (sections.material as THREE.Material).opacity = 0.8;
    scene.add(sections);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(9000, 9000),
      new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.55 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 1;
    floor.receiveShadow = true;
    scene.add(floor);

    const group = new THREE.Group();
    scene.add(group);

    gl.current = { renderer, scene, camera, group, orbit: null, signature: '', ctx };
    build();

    const tick = () => {
      requestAnimationFrame(tick);
      const g = gl.current;
      if (!g) return;
      g.renderer.render(g.scene, g.camera);
      g.ctx.endFrameEXP();
    };
    tick();
  };

  return (
    <View style={[styles.root, style]} {...pan.panHandlers}>
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
});
