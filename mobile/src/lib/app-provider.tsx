import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useKeepAwake } from 'expo-keep-awake';
import { templates, type Design, type TemplateParams } from './engine';
import { AppContext, type AppState, type ResultTab } from './store';

const INITIAL: AppState = {
  templateId: templates[0]!.id,
  paramsByTemplate: {},
  exploded: false,
  tab: 'model',
  activeStep: 1,
  checked: [],
  doneSteps: [],
  taller: false,
};

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
  const params: TemplateParams = s.paramsByTemplate[template.id] ?? {};
  const result = useMemo(() => template.generate(params), [template, params]);

  // Keep showing the last valid design while the user fixes an out-of-range combo.
  const lastGood = useRef<Design | null>(null);
  if (result.ok) lastGood.current = result.design;
  const design = result.ok ? result.design : lastGood.current;

  const value = useMemo(
    () => ({
      ...s,
      toast,
      design,
      stale: !result.ok,
      issues: result.ok ? [] : result.issues,
      setTemplate: (id: string) =>
        setS((p) => ({ ...p, templateId: id, activeStep: 1, checked: [], doneSteps: [] })),
      setParam: (key: string, value: number) =>
        setS((p) => ({
          ...p,
          paramsByTemplate: {
            ...p.paramsByTemplate,
            [p.templateId]: { ...p.paramsByTemplate[p.templateId], [key]: value },
          },
          // cut ids ("{sheet}:{n}") follow the layout, which any param can change
          checked: [],
          // the Cubrecanto choice adds/removes a step, so step numbers shift
          ...(key === 'edgeBanding' ? { activeStep: INITIAL.activeStep, doneSteps: [] } : null),
        })),
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
    [s, toast, design, result, flash],
  );

  return (
    <AppContext.Provider value={value}>
      {s.taller && <KeepAwake />}
      {children}
    </AppContext.Provider>
  );
}

/** Workshop mode promises "pantalla encendida" — this is what keeps that true. */
function KeepAwake() {
  useKeepAwake();
  return null;
}
