import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useEffect, useMemo, useRef } from 'react';
import { PanResponder, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import * as THREE from 'three';
import type { Fitting, Placement, Step, Vec3 } from '@/lib/engine';
import { useScheme, type Scheme } from '@/theme';

const EXPLODE_FACTOR = 1.6;

/**
 * WebGL cannot read the palette, so the notebook colors are mirrored here per
 * scheme — the same values as the web Viewer3D's PALETTE. In a step, the parts it
 * names turn highlighter yellow and the rest fade to a pencil ghost, so the
 * subject always out-contrasts the page. This is the one component that knows
 * the scheme.
 */
const PALETTE: Record<Scheme, {
  base: string; // plywood
  edge: string; // plywood outline
  highlight: string; // highlighter: the step's parts
  ghost: string; // everything else in a step
  ghostEdge: string;
  ghostOpacity: number;
  steel: string; // rod, handles
  sky: string;
  ground: string;
  rim: string; // back light that outlines the model against the page
  shadow: number;
  gridCell: string;
  gridSection: string;
  stageNear: string; // backdrop gradient, as the web's --color-stage-near/far
  stageFar: string;
}> = {
  day: {
    base: '#d49a5c',
    edge: '#6e4318',
    highlight: '#ffd83a',
    ghost: '#e3ecf6',
    ghostEdge: '#6f9fcb',
    ghostOpacity: 0.35,
    steel: '#6c7685',
    sky: '#ffffff',
    ground: '#c9d6e6',
    rim: '#ffffff',
    shadow: 0.22,
    gridCell: '#cfe4f4',
    gridSection: '#92c3e6',
    stageNear: '#fbfdff',
    stageFar: '#eaf1f8',
  },
  night: {
    base: '#d9a066',
    edge: '#3d2410',
    highlight: '#ffe14d',
    ghost: '#33467f',
    ghostEdge: '#7f97e0',
    ghostOpacity: 0.3,
    steel: '#b6c0d2',
    sky: '#e3e9ff',
    ground: '#0c1226',
    rim: '#9fb0ff',
    shadow: 0.5,
    gridCell: '#1d2b55',
    gridSection: '#2f4687',
    stageNear: '#142047',
    stageFar: '#0c1226',
  },
};

/** Paint or bare steel for welded projects; boards keep the plywood palette. */
export interface Finish {
  color: string;
  metalness: number;
  roughness: number;
}

interface Props {
  design: { templateId: string; params: unknown; placements: Placement[]; fittings?: Fitting[] };
  exploded: boolean;
  highlightStep?: Step | null;
  finish?: Finish;
  style?: StyleProp<ViewStyle>;
}

interface Orbit {
  target: Vec3;
  radius: number;
  theta: number;
  phi: number;
}

interface Scene3D {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  group: THREE.Group;
  stage: THREE.Group; // floor grids, rebuilt per scheme
  hemi: THREE.HemisphereLight;
  rim: THREE.DirectionalLight;
  floor: THREE.ShadowMaterial;
  orbit: Orbit | null;
  signature: string;
  scheme: Scheme | null;
  ctx: ExpoWebGLRenderingContext;
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** The web stage's radial gradient (ellipse at 50% 35%, near → far) as a small sRGB texture. */
function backdrop(near: string, far: string): THREE.DataTexture {
  const N = 64;
  const a = rgb(near);
  const b = rgb(far);
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      // DataTexture rows run bottom-up, so 35% from the top is 65% from the bottom
      const t = Math.min(1, Math.hypot((x / (N - 1) - 0.5) / 0.5, (y / (N - 1) - 0.65) / 0.65) / Math.SQRT2);
      const i = (y * N + x) * 4;
      for (let k = 0; k < 3; k++) data[i + k] = Math.round(a[k]! + (b[k]! - a[k]!) * t);
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, N, N);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function disposeAll(parent: THREE.Object3D) {
  while (parent.children.length) {
    const child = parent.children.pop()!;
    child.traverse((n) => {
      const m = n as THREE.Mesh;
      m.geometry?.dispose?.();
      (m.material as THREE.Material | undefined)?.dispose?.();
    });
  }
}

/**
 * Three.js driven imperatively on expo-gl's WebGL2 context — the same visual
 * spec as the web viewer without a react-three-fiber/React version coupling.
 */
export function Viewer3D({ design, exploded, highlightStep = null, finish, style }: Props) {
  const scheme = useScheme();
  // The GL callback fires once, so the loop reads the latest props through a ref.
  const props = useRef({ design, exploded, highlightStep, finish, scheme });
  props.current = { design, exploded, highlightStep, finish, scheme };

  const gl = useRef<Scene3D | null>(null);

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

  /** Recolor the stage when the scheme flips: backdrop, lights, floor shadow and grids. */
  const paintStage = (g: Scene3D, s: Scheme) => {
    if (g.scheme === s) return;
    g.scheme = s;
    const c = PALETTE[s];
    (g.scene.background as THREE.Texture | null)?.dispose();
    g.scene.background = backdrop(c.stageNear, c.stageFar);
    g.hemi.color.set(c.sky);
    g.hemi.groundColor.set(c.ground);
    g.rim.color.set(c.rim);
    g.floor.opacity = c.shadow;
    // GridHelper bakes its colors into vertex data, so swap the helpers rather than recolor them.
    disposeAll(g.stage);
    // The cuadrícula on the floor: 100 mm cells under 500 mm sections, true scale.
    g.stage.add(new THREE.GridHelper(8000, 80, c.gridCell, c.gridCell));
    const sections = new THREE.GridHelper(8000, 16, c.gridSection, c.gridSection);
    sections.position.y = 0.5;
    g.stage.add(sections);
  };

  /** Rebuild the meshes only when something visible actually changed. */
  const build = () => {
    const g = gl.current;
    const { design: d, exploded: ex, highlightStep: step, finish, scheme: s } = props.current;
    if (!g || !d) return;

    const sig = JSON.stringify([d.templateId, d.params, ex, step?.order ?? null, s, finish ?? null]);
    if (sig === g.signature) return;
    g.signature = sig;
    paintStage(g, s);
    const c = PALETTE[s];

    disposeAll(g.group);

    const n = d.placements.length || 1;
    const centroid = d.placements.reduce<Vec3>(
      (a, p) => [a[0] + p.position[0] / n, a[1] + p.position[1] / n, a[2] + p.position[2] / n],
      [0, 0, 0],
    );
    const highlight = step ? new Set(step.panelRefs) : null;
    const offsets = step?.explodeOffsets ?? {};

    // Panels and fittings render alike; fittings are steel and never cut. The centroid stays the panels'.
    const boxes = [
      ...d.placements.map((p) => ({ id: p.panelId, position: p.position, size: p.size, steel: false })),
      ...(d.fittings ?? []).map((f) => ({ id: f.id, position: f.position, size: f.size, steel: true })),
    ];
    for (const b of boxes) {
      let pos: Vec3 = ex
        ? [
            centroid[0] + (b.position[0] - centroid[0]) * EXPLODE_FACTOR,
            centroid[1] + (b.position[1] - centroid[1]) * EXPLODE_FACTOR,
            centroid[2] + (b.position[2] - centroid[2]) * EXPLODE_FACTOR,
          ]
        : [b.position[0], b.position[1], b.position[2]];
      const off = highlight ? offsets[b.id] : undefined;
      if (off) pos = [pos[0] + off[0], pos[1] + off[1], pos[2] + off[2]];

      const ghost = highlight !== null && !highlight.has(b.id);
      const lit = highlight?.has(b.id) ?? false;
      const geo = new THREE.BoxGeometry(b.size[0], b.size[1], b.size[2]);
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({
          color: ghost ? c.ghost : lit ? c.highlight : b.steel ? c.steel : (finish?.color ?? c.base),
          transparent: ghost,
          opacity: ghost ? c.ghostOpacity : 1,
          depthWrite: !ghost,
          roughness: b.steel ? 0.35 : lit ? 0.6 : (finish?.roughness ?? 0.7),
          metalness: b.steel ? 0.6 : lit ? 0 : (finish?.metalness ?? 0),
        }),
      );
      mesh.position.set(pos[0], pos[1], pos[2]);
      mesh.castShadow = !ghost;
      mesh.add(
        new THREE.LineSegments(
          new THREE.EdgesGeometry(geo),
          new THREE.LineBasicMaterial({
            color: ghost ? c.ghostEdge : b.steel || finish ? c.steel : c.edge,
            transparent: ghost,
            opacity: ghost ? 0.7 : 1,
          }),
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

  useEffect(build, [design, exploded, highlightStep, finish, scheme]);

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
    // react-three-fiber's default on the web, so the wood and highlighter read the same on both clients
    renderer.toneMapping = THREE.ACESFilmicToneMapping;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 10, 30000);

    const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.7);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(1500, 3000, 2000);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, {
      left: -2200, right: 2200, top: 2200, bottom: -2200, near: 100, far: 9000,
    });
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 0.6);
    rim.position.set(-1200, 2600, -2800);
    scene.add(rim);

    // Catches the key light's shadow without painting a visible floor slab.
    const floorMat = new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.3 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 1;
    floor.receiveShadow = true;
    scene.add(floor);

    const stage = new THREE.Group();
    scene.add(stage);
    const group = new THREE.Group();
    scene.add(group);

    gl.current = { renderer, scene, camera, group, stage, hemi, rim, floor: floorMat, orbit: null, signature: '', scheme: null, ctx };
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
