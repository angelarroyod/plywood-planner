import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useKeepAwake } from 'expo-keep-awake';
import { templates, weldTemplates, type Design, type TemplateParams, type WeldDesign } from './engine';
import { AppContext, type AppState, type ResultTab } from './store';

const INITIAL: AppState = {
  mode: 'wood',
  templateId: templates[0]!.id,
  weldTemplateId: weldTemplates[0]!.id,
  paramsByTemplate: {},
  exploded: false,
  tab: 'model',
  activeStep: 1,
  checked: [],
  doneSteps: [],
  taller: false,
};

// Params whose change adds or removes a step, so step numbers shift.
const STEP_KEYS = new Set(['edgeBanding', 'lower']);

/** Keeps the last valid design so the views stay put while the user fixes an out-of-range combo. */
function useLastGood<T>(design: T | null): T | null {
  const last = useRef<T | null>(null);
  if (design) last.current = design;
  return last.current;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<AppState>(INITIAL);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const flash = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const template = templates.find((t) => t.id === s.templateId) ?? templates[0]!;
  const weldTemplate = weldTemplates.find((t) => t.id === s.weldTemplateId) ?? weldTemplates[0]!;
  const params: TemplateParams = s.paramsByTemplate[template.id] ?? {};
  const weldParams: TemplateParams = s.paramsByTemplate[weldTemplate.id] ?? {};
  const result = useMemo(() => template.generate(params), [template, params]);
  const weldResult = useMemo(() => weldTemplate.generate(weldParams), [weldTemplate, weldParams]);
  const design = useLastGood<Design>(result.ok ? result.design : null);
  const weld = useLastGood<WeldDesign>(weldResult.ok ? weldResult.design : null);
  const active = s.mode === 'metal' ? weldResult : result;

  const value = useMemo(
    () => ({
      ...s,
      toast,
      design,
      weld,
      stale: !active.ok,
      issues: active.ok ? [] : active.issues,
      setMode: (mode: AppState['mode']) =>
        setS((p) => (p.mode === mode ? p : { ...p, mode, tab: 'model', activeStep: 1, checked: [], doneSteps: [] })),
      setTemplate: (id: string) =>
        setS((p) => ({
          ...p,
          ...(p.mode === 'metal' ? { weldTemplateId: id } : { templateId: id }),
          activeStep: 1,
          checked: [],
          doneSteps: [],
        })),
      setParam: (key: string, value: number) => setParams({ [key]: value }),
      setParams,
      setTab: (tab: ResultTab) => setS((p) => ({ ...p, tab })),
      setActiveStep: (order: number) => setS((p) => ({ ...p, activeStep: order })),
      toggleExploded: () => setS((p) => ({ ...p, exploded: !p.exploded })),
      toggleCut: (id: string) =>
        setS((p) => ({
          ...p,
          checked: p.checked.includes(id)
            ? p.checked.filter((x) => x !== id)
            : [...p.checked, id],
        })),
      toggleStepDone: (order: number) =>
        setS((p) => ({
          ...p,
          activeStep: order,
          doneSteps: p.doneSteps.includes(order)
            ? p.doneSteps.filter((x) => x !== order)
            : [...p.doneSteps, order],
        })),
      toggleTaller: () => setS((p) => ({ ...p, taller: !p.taller })),
      flash,
    }),
    [s, toast, design, weld, active, flash],
  );

  return (
    <AppContext.Provider value={value}>
      {s.taller && <KeepAwake />}
      {children}
    </AppContext.Provider>
  );

  function setParams(next: TemplateParams) {
    setS((p) => {
      const id = p.mode === 'metal' ? p.weldTemplateId : p.templateId;
      const current = p.paramsByTemplate[id];
      if (Object.entries(next).every(([k, v]) => current?.[k] === v)) return p;
      return {
        ...p,
        paramsByTemplate: { ...p.paramsByTemplate, [id]: { ...current, ...next } },
        // cut ids ("{sheet}:{n}") follow the layout, which any param can change
        checked: [],
        ...(Object.keys(next).some((k) => STEP_KEYS.has(k)) ? { activeStep: INITIAL.activeStep, doneSteps: [] } : null),
      };
    });
  }
}

/** Workshop mode promises "pantalla encendida" — this is what keeps that true. */
function KeepAwake() {
  useKeepAwake();
  return null;
}
