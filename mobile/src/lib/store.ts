import { createContext, useContext } from 'react';
import type { Design, TemplateParams, WeldDesign } from './engine';

export type Screen = 'onboarding' | 'projects' | 'templates' | 'measure' | 'camera' | 'result';
/** `shop` is metal mode's Compras tab. */
export type ResultTab = 'model' | 'cuts' | 'steps' | 'shop';
/** Furniture from boards, or welded tube projects — two workshops on one set of screens. */
export type Mode = 'wood' | 'metal';

export interface AppState {
  mode: Mode;
  templateId: string;
  weldTemplateId: string;
  /** Sparse: only user-touched keys. Wood and metal template ids never collide. */
  paramsByTemplate: Record<string, TemplateParams>;
  exploded: boolean;
  tab: ResultTab;
  activeStep: number | null;
  /** `"{sheet}:{n}"` for every saw cut ticked off in the checklist (sheet 1-based). */
  checked: string[];
  /** Step.order values marked done. */
  doneSteps: number[];
  /** Workshop mode: screen stays awake, targets and borders grow. */
  taller: boolean;
}

export interface AppActions {
  setMode: (mode: Mode) => void;
  /** In the current mode. */
  setTemplate: (id: string) => void;
  setParam: (key: string, value: number) => void;
  /** Several at once, e.g. a suggestion's one-click fix. */
  setParams: (params: TemplateParams) => void;
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
  /** Last valid wood design. */
  design: Design | null;
  /** Last valid metal design. */
  weld: WeldDesign | null;
  /** True while the current mode's params are invalid and its design is the last good one. */
  stale: boolean;
  issues: { paramKey?: string; message: string }[];
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
