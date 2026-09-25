import { useMemo } from 'react';
import type { Design } from '../engine/types.ts';
import { useAppStore } from '../state/store.ts';
import { Viewer3D } from './Viewer3D.tsx';

export function StepsPanel({ design, stale }: { design: Design; stale: boolean }) {
  const activeStep = useAppStore((s) => s.activeStep);
  const setActiveStep = useAppStore((s) => s.setActiveStep);
  // A step may reference a fitting (the rod); panel labels win on a shared id.
  const labels = useMemo(
    () => Object.fromEntries([...design.fittings, ...design.panels].map((p) => [p.id, p.label])),
    [design],
  );
  const step = design.steps.find((s) => s.order === activeStep) ?? null;

  return (
    <div className="flex h-full">
      <div className="relative min-w-0 flex-1">
        <Viewer3D design={design} stale={stale} highlightStep={step} />
      </div>

      <aside className="flex w-[22rem] shrink-0 flex-col border-l border-rule bg-panel">
        <div className="px-5 pb-3 pt-5">
          <h2 className="display text-lg font-extrabold">Pasos de armado</h2>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">
            {design.steps.length} pasos · toca para resaltar
          </p>
        </div>
        <div className="ruler h-1.5 shrink-0 opacity-70" />

        <ol className="flex-1 overflow-y-auto px-5 py-5">
          {design.steps.map((st, i) => {
            const active = st.order === activeStep;
            const last = i === design.steps.length - 1;
            return (
              <li key={st.order} className="relative flex gap-3 pb-3">
                {/* timeline spine */}
                {!last && (
                  <span
                    aria-hidden
                    className="absolute left-[13px] top-8 bottom-0 w-px bg-rule"
                  />
                )}
                <span
                  aria-hidden
                  className={`relative z-10 mt-1 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border font-mono text-[11px] tabular-nums transition-colors ${
                    active
                      ? 'border-cut bg-cut text-white'
                      : 'border-rule bg-panel text-ink-soft'
                  }`}
                >
                  {st.order}
                </span>
                <button
                  onClick={() => setActiveStep(active ? null : st.order)}
                  aria-pressed={active}
                  className={`min-w-0 flex-1 rounded-lg border p-3 text-left transition-all ${
                    active
                      ? 'border-cut bg-raised shadow-[2px_2px_0_0_var(--color-cut)]'
                      : 'border-rule bg-panel hover:border-ink-soft'
                  }`}
                >
                  <div className="display text-[15px] font-bold leading-snug">
                    {st.title}
                  </div>
                  <div className="mt-1 text-xs leading-relaxed text-ink-soft">{st.description}</div>
                  {st.panelRefs.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {st.panelRefs.map((id) => (
                        <span
                          key={id}
                          className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${
                            active
                              ? 'border-ply/40 bg-panel text-ply'
                              : 'border-rule bg-raised text-ply'
                          }`}
                        >
                          {labels[id] ?? id}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </aside>
    </div>
  );
}
