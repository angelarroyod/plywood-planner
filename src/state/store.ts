import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TemplateParams } from '../engine/types.ts';
import { templates } from '../engine/index.ts';
import { EMPTY_PRICES, normalizePrices, type Prices } from '../engine/cost.ts';

export type View = 'design' | 'cuts' | 'steps' | 'order';

interface AppState {
  templateId: string;
  paramsByTemplate: Record<string, TemplateParams>; // sparse: only user-touched keys
  exploded: boolean;
  view: View;
  activeStep: number | null; // Step.order, null = no highlight
  prices: Prices; // user-entered MXN prices; the only state saved across visits
  setTemplate: (id: string) => void;
  setParam: (key: string, value: number) => void;
  toggleExploded: () => void;
  setView: (view: View) => void;
  setActiveStep: (order: number | null) => void;
  setSheetPrice: (stockId: number, price: number) => void;
  setCutPrice: (price: number) => void;
  setCutUnit: (unit: Prices['cut']['unit']) => void;
  setBandPrice: (label: string, price: number) => void;
  setHardwarePrice: (key: string, price: number) => void;
}

const clamp = (price: number) => Math.max(0, price);

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      templateId: templates[0]!.id,
      paramsByTemplate: {},
      exploded: false,
      view: 'design',
      activeStep: null,
      prices: EMPTY_PRICES,
      setTemplate: (id) => set({ templateId: id, activeStep: null }),
      setParam: (key, value) =>
        set((s) => ({
          paramsByTemplate: {
            ...s.paramsByTemplate,
            [s.templateId]: { ...s.paramsByTemplate[s.templateId], [key]: value },
          },
          // the Cubrecanto choice adds/removes a step, so step numbers shift
          ...(key === 'edgeBanding' ? { activeStep: null } : null),
        })),
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
