import { useMemo } from 'react';
import type { Design } from '../engine/types.ts';
import { useAppStore } from '../state/store.ts';
import { Viewer3D } from './Viewer3D.tsx';

export function StepsPanel({ design, stale }: { design: Design; stale: boolean }) {
  const activeStep = useAppStore((s) => s.activeStep);
  const setActiveStep = useAppStore((s) => s.setActiveStep);
  const labels = useMemo(
    () => Object.fromEntries(design.panels.map((p) => [p.id, p.label])),
    [design],
  );
  const step = design.steps.find((s) => s.order === activeStep) ?? null;

  return (
    <div className="flex h-full">
      <div className="relative flex-1">
        <Viewer3D design={design} stale={stale} highlightStep={step} />
      </div>
      <aside className="w-80 shrink-0 overflow-y-auto border-l border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-neutral-600">Pasos de armado</h2>
        <p className="mt-1 text-xs text-neutral-400">
          Toca un paso para resaltar sus piezas en el modelo.
        </p>
        <ol className="mt-3 space-y-2">
          {design.steps.map((st) => (
            <li key={st.order}>
              <button
                onClick={() => setActiveStep(st.order === activeStep ? null : st.order)}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  st.order === activeStep
                    ? 'border-amber-600 bg-amber-50'
                    : 'border-neutral-200 hover:border-neutral-400'
                }`}
              >
                <div className="font-medium">
                  {st.order}. {st.title}
                </div>
                <div className="mt-1 text-xs text-neutral-600">{st.description}</div>
                {st.panelRefs.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {st.panelRefs.map((id) => (
                      <span
                        key={id}
                        className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-900"
                      >
                        {labels[id] ?? id}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
