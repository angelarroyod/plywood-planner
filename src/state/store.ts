import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TemplateParams } from '../engine/types.ts';
import { templates, weldTemplates } from '../engine/index.ts';
import { EMPTY_PRICES, normalizePrices, type Prices } from '../engine/cost.ts';

export type View = 'design' | 'cuts' | 'steps' | 'order';
export type Theme = 'dark' | 'light';
export type Mode = 'wood' | 'metal'; // furniture from boards, or welded tube projects

// ponytail: its own key — `persist` below is named for prices and resets
// everything else, and the theme has to be readable before React mounts.
const THEME_KEY = 'planificador.theme';

/** A saved choice wins; otherwise follow the system, since the app is used both at a desk and in daylight. */
function initialTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

interface AppState {
  mode: Mode;
  templateId: string;
  weldTemplateId: string;
  paramsByTemplate: Record<string, TemplateParams>; // sparse: only user-touched keys; wood and metal ids never collide
  exploded: boolean;
  view: View;
  activeStep: number | null; // Step.order, null = no highlight
  prices: Prices; // user-entered MXN prices, saved across visits
  theme: Theme; // saved across visits under its own key
  readout: Readout | null; // the slider being dragged, shown big over the stage
  setMode: (mode: Mode) => void;
  setTemplate: (id: string) => void; // in the current mode
  setParam: (key: string, value: number) => void;
  setParams: (params: TemplateParams) => void; // several at once, e.g. a suggestion's fix
  toggleExploded: () => void;
  setView: (view: View) => void;
  setActiveStep: (order: number | null) => void;
  setSheetPrice: (stockId: number, price: number) => void;
  setCutPrice: (price: number) => void;
  setCutUnit: (unit: Prices['cut']['unit']) => void;
  setBandPrice: (label: string, price: number) => void;
  setHardwarePrice: (key: string, price: number) => void;
  setBoringPrice: (price: number) => void;
  toggleTheme: () => void;
  setReadout: (readout: Readout | null) => void;
}

export interface Readout {
  key: string; // param key, e.g. 'width'
  label: string;
  value: number;
  unit: string;
}

const clamp = (price: number) => Math.max(0, price);

// Params whose change adds or removes a step, so step numbers shift.
const STEP_KEYS = new Set(['edgeBanding', 'lower']);

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      mode: 'wood',
      templateId: templates[0]!.id,
      weldTemplateId: weldTemplates[0]!.id,
      paramsByTemplate: {},
      exploded: false,
      view: 'design',
      activeStep: null,
      prices: EMPTY_PRICES,
      theme: initialTheme(),
      readout: null,
      setMode: (mode) => set({ mode, activeStep: null }),
      setTemplate: (id) =>
        set((s) => (s.mode === 'metal' ? { weldTemplateId: id, activeStep: null } : { templateId: id, activeStep: null })),
      setParam: (key, value) => get().setParams({ [key]: value }),
      setParams: (params) =>
        set((s) => {
          const id = s.mode === 'metal' ? s.weldTemplateId : s.templateId;
          return {
            paramsByTemplate: { ...s.paramsByTemplate, [id]: { ...s.paramsByTemplate[id], ...params } },
            ...(Object.keys(params).some((k) => STEP_KEYS.has(k)) ? { activeStep: null } : null),
          };
        }),
      toggleExploded: () => set((s) => ({ exploded: !s.exploded })),
      setView: (view) => set({ view }),
      setActiveStep: (order) => set({ activeStep: order }),
      setSheetPrice: (stockId, price) =>
        set((s) => ({ prices: { ...s.prices, sheets: { ...s.prices.sheets, [stockId]: clamp(price) } } })),
      setCutPrice: (price) => set((s) => ({ prices: { ...s.prices, cut: { ...s.prices.cut, price: clamp(price) } } })),
      setCutUnit: (unit) => set((s) => ({ prices: { ...s.prices, cut: { ...s.prices.cut, unit } } })),
      setBandPrice: (label, price) =>
        set((s) => ({ prices: { ...s.prices, bands: { ...s.prices.bands, [label]: clamp(price) } } })),
      setHardwarePrice: (key, price) =>
        set((s) => ({ prices: { ...s.prices, hardware: { ...s.prices.hardware, [key]: clamp(price) } } })),
      setBoringPrice: (price) => set((s) => ({ prices: { ...s.prices, boring: clamp(price) } })),
      setReadout: (readout) => set({ readout }),
      toggleTheme: () =>
        set((s) => {
          const theme: Theme = s.theme === 'dark' ? 'light' : 'dark';
          localStorage.setItem(THEME_KEY, theme);
          return { theme };
        }),
    }),
    {
      // ponytail: only prices persist; designs stay derived and params stay per-session
      name: 'planificador.prices',
      version: 1,
      partialize: (s) => ({ prices: s.prices }),
      // a hand-edited or stale stored `prices` must never replace the in-memory one wholesale
      merge: (persisted, current) => ({
        ...current,
        prices: normalizePrices((persisted as { prices?: unknown } | undefined)?.prices),
      }),
    },
  ),
);
