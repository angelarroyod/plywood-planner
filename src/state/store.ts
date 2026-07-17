import { create } from 'zustand';
import type { TemplateParams } from '../engine/types.ts';
import { templates } from '../engine/index.ts';

interface AppState {
  templateId: string;
  paramsByTemplate: Record<string, TemplateParams>; // sparse: only user-touched keys
  exploded: boolean;
  setTemplate: (id: string) => void;
  setParam: (key: string, value: number) => void;
  toggleExploded: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  templateId: templates[0]!.id,
  paramsByTemplate: {},
  exploded: false,
  setTemplate: (id) => set({ templateId: id }),
  setParam: (key, value) =>
    set((s) => ({
      paramsByTemplate: {
        ...s.paramsByTemplate,
        [s.templateId]: { ...s.paramsByTemplate[s.templateId], [key]: value },
      },
    })),
  toggleExploded: () => set((s) => ({ exploded: !s.exploded })),
}));
