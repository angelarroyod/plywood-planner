import { createContext, useContext } from 'react';
import type { Design, TemplateParams } from './engine';

export type Screen = 'onboarding' | 'projects' | 'templates' | 'measure' | 'camera' | 'result';
export type ResultTab = 'model' | 'cuts' | 'steps';

export interface AppState {
  templateId: string;
  paramsByTemplate: Record<string, TemplateParams>;
  exploded: boolean;
  tab: ResultTab;
  activeStep: number | null;
  /** `${panelId}#${instance}` for every cut ticked off in the checklist. */
  checked: string[];
  /** Step.order values marked done. */
  doneSteps: number[];
  /** Workshop mode: screen stays awake, targets and borders grow. */
  taller: boolean;
}

export interface AppActions {
  setTemplate: (id: string) => void;
  setParam: (key: string, value: number) => void;
  setTab: (tab: ResultTab) => void;
  setActiveStep: (order: number) => void;
  toggleExploded: () => void;
  toggleCut: (id: string) => void;
  toggleStepDone: (order: number) => void;
  toggleTaller: () => void;
  flash: (message: string) => void;
}

export interface AppContextValue extends AppState, AppActions {
  toast: string | null;
  design: Design | null;
  /** True while params are invalid and `design` is the last good one. */
  stale: boolean;
  issues: { paramKey?: string; message: string }[];
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
