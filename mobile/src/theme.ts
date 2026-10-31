/**
 * "Cuaderno de cuadro" tokens, mirrored from DESIGN.md (the web app's @theme).
 * Two palettes on one set of names: notebook paper by day, ink-blue paper at night.
 * Three inks with fixed jobs: ballpoint `accent` for what you chose or can press,
 * margin-red `cut` for cuts and errors, highlighter `hi` for where you are now.
 * Coloured text always uses an `-Ink` token; only those hold 5:1 in both palettes.
 */
import { createContext, createElement, useContext, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

const day = {
  paper: '#f4f7fb',
  panel: '#ffffff',
  raised: '#eef2f8',
  ink: '#141a2b',
  inkSoft: '#4a5263',
  inkFaint: '#5d6576',
  rule: '#dfe5ee',
  ruleStrong: '#b7c2d3',
  accent: '#2340c8',
  accentInk: '#2340c8',
  accentTint: '#e9edff',
  hi: '#ffe14d',
  cut: '#d93a2f',
  cutInk: '#b8281e',
  cutTint: '#fdecea',
  ply: '#b5763a',
  plyTint: '#f6e6d2',
  plyDeep: '#8a5a25',
  grid: '#dcecf7',
  gridMajor: '#b3d6ee',
  sheet: '#ffffff',
  sheetEdge: '#b7c2d3',
  piece: '#f1d4ae',
  pieceEdge: '#9b6430',
  pieceLabel: '#3a2410',
  pieceDims: '#6b4b22',
  grain: '#9b6430',
  mark: '#d93a2f',
  onMark: '#ffffff', // cut-badge numerals
  stageNear: '#fbfdff',
  stageFar: '#eaf1f8',
};

export type Palette = typeof day;

const night: Palette = {
  paper: '#0c1226',
  panel: '#121a33',
  raised: '#1b2546',
  ink: '#eef2ff',
  inkSoft: '#b3bdd6',
  inkFaint: '#97a2bf',
  rule: '#26315a',
  ruleStrong: '#34427a',
  accent: '#3d5be8',
  accentInk: '#9fb0ff',
  accentTint: '#1d2a5c',
  hi: '#ffe14d',
  cut: '#ff6b5e',
  cutInk: '#ff8a7f',
  cutTint: '#3a1620',
  ply: '#d9a066',
  plyTint: '#2a2418',
  plyDeep: '#d9a066',
  grid: '#172245',
  gridMajor: '#24356a',
  sheet: '#121a33',
  sheetEdge: '#34427a',
  piece: '#d9a066',
  pieceEdge: '#9b6430',
  pieceLabel: '#1a1206',
  // DESIGN.md's #eef2ff measures 2.0:1 on the night piece, and white 2.8:1 on the
  // night mark, so these two hold AA with dark ink instead (6.4:1 and 6.2:1).
  pieceDims: '#3a2410',
  grain: '#6b4b22',
  mark: '#ff6b5e',
  onMark: '#141a2b',
  stageNear: '#142047',
  stageFar: '#0c1226',
};

/** Same in both palettes: text on a ballpoint fill, and the dark ink the highlighter always sits under. */
export const ON_ACCENT = '#ffffff';
export const HI_INK = '#141a2b';

export type Scheme = 'day' | 'night';

const PaletteContext = createContext<Palette>(day);

/**
 * The one place the system appearance is read. Context, not a hook per
 * component, so a live light/dark flip reaches every screen in one pass.
 */
export function PaletteProvider({ children }: { children: ReactNode }) {
  const palette = useColorScheme() === 'dark' ? night : day;
  return createElement(PaletteContext.Provider, { value: palette }, children);
}

export function usePalette(): Palette {
  return useContext(PaletteContext);
}

export function useScheme(): Scheme {
  return usePalette() === night ? 'night' : 'day';
}

/**
 * Module-level StyleSheets can't follow the system theme, so screens build theirs
 * from the palette. One sheet per palette, cached — there are only two.
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(build: (c: Palette) => T) {
  const cache = new Map<Palette, T>();
  return function useStyles(): T {
    const c = usePalette();
    let sheet = cache.get(c);
    if (!sheet) cache.set(c, (sheet = StyleSheet.create(build(c))));
    return sheet;
  };
}

export const font = {
  regular: 'AtkinsonHyperlegibleNext_400Regular',
  semi: 'AtkinsonHyperlegibleNext_600SemiBold',
  bold: 'AtkinsonHyperlegibleNext_700Bold',
  heavy: 'AtkinsonHyperlegibleNext_800ExtraBold',
  mono: 'AtkinsonHyperlegibleMono_400Regular',
  monoBold: 'AtkinsonHyperlegibleMono_700Bold',
} as const;

/** Every number is set in the mono with tabular figures so columns line up. */
export const TNUM = ['tabular-nums'] as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 20, xl: 28, xxl: 32 } as const;

export const radius = { md: 6, lg: 8, xl: 12, xxl: 16, pill: 999 } as const;

/** Soft, graphite-tinted, zero x-offset — DESIGN.md's shadow vocabulary. */
export const shadow = {
  contact: { shadowColor: '#141a2b', shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  lift: { shadowColor: '#141a2b', shadowOpacity: 0.16, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  float: { shadowColor: '#141a2b', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  sheet: { shadowColor: '#141a2b', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
} as const;

/** iOS minimum comfortable target; workshop mode grows the important ones. */
export const TOUCH = 44;
export const TOUCH_TALLER = 56;
