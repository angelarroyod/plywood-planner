import { create } from 'zustand';
import type { TemplateParams } from '../engine/types.ts';
import { templates } from '../engine/index.ts';

export type View = 'design' | 'cuts' | 'steps';

interface AppState {
  templateId: string;
  paramsByTemplate: Record<string, TemplateParams>; // sparse: only user-touched keys
  exploded: boolean;
  view: View;
  activeStep: number | null; // Step.order, null = no highlight
  pricesByStock: Record<number, number>; // MXN per sheet, keyed by Stock.id; missing = not set
  setTemplate: (id: string) => void;
  setParam: (key: string, value: number) => void;
  toggleExploded: () => void;
  setView: (view: View) => void;
  setActiveStep: (order: number | null) => void;
  setPrice: (stockId: number, price: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  templateId: templates[0]!.id,
  paramsByTemplate: {},
  exploded: false,
  view: 'design',
  activeStep: null,
  pricesByStock: {},
  setTemplate: (id) => set({ templateId: id, activeStep: null }),
  setParam: (key, value) =>
    set((s) => ({
      paramsByTemplate: {
        ...s.paramsByTemplate,
        [s.templateId]: { ...s.paramsByTemplate[s.templateId], [key]: value },
      },
    })),
  toggleExploded: () => set((s) => ({ exploded: !s.exploded })),
  setView: (view) => set({ view }),
  setActiveStep: (order) => set({ activeStep: order }),
  setPrice: (stockId, price) =>
    set((s) => ({ pricesByStock: { ...s.pricesByStock, [stockId]: Math.max(0, price) } })),
}));
