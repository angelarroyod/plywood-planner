import type { ReactNode } from 'react';
import type { Step } from '../engine/types.ts';
import { useAppStore } from '../state/store.ts';

/**
 * Step list beside a 3D view. Shared by boards and welded projects: the caller
 * supplies the viewer for the active step and, optionally, extra detail per step.
 * On a phone the viewer sits on top and the list scrolls under it.
 */
export function StepsPanel<S extends Step>({
  steps,
  labels,
  viewer,
  detail,
}: {
  steps: S[];
  labels: Record<string, string>; // ref id → display name
  viewer: (active: S | null) => ReactNode;
  detail?: (step: S) => ReactNode; // rendered inside the card
}) {
  const activeStep = useAppStore((s) => s.activeStep);
  const setActiveStep = useAppStore((s) => s.setActiveStep);
  const index = steps.findIndex((s) => s.order === activeStep);
  const step = steps[index] ?? null;
  const go = (i: number) => setActiveStep(steps[i]?.order ?? null);

  return (
    <div className="flex flex-col lg:h-full lg:flex-row">
      <div className="relative h-[45dvh] min-w-0 lg:h-auto lg:flex-1">{viewer(step)}</div>

      <aside className="flex flex-col border-t border-rule bg-panel lg:w-[24rem] lg:shrink-0 lg:border-l lg:border-t-0">
        <div className="sticky top-16 z-10 flex items-center justify-between gap-3 border-b border-rule bg-panel px-5 py-4 lg:static">
          <div>
            <h2 className="display text-xl">Pasos de armado</h2>
            <p className="text-[13px] text-ink-soft">
              {step ? `Paso ${step.order} de ${steps.length}` : `${steps.length} pasos · toca uno para verlo`}
            </p>
          </div>
          <div className="flex gap-1.5">
            {[
              { label: 'anterior', to: index <= 0 ? steps.length - 1 : index - 1, d: 'M12.5 4.5 7 10l5.5 5.5' },
              { label: 'siguiente', to: index + 1 >= steps.length ? 0 : index + 1, d: 'M7.5 4.5 13 10l-5.5 5.5' },
            ].map((b) => (
              <button
                key={b.label}
                onClick={() => go(b.to)}
                aria-label={`Paso ${b.label}`}
                title={`Paso ${b.label}`}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-rule text-ink-soft transition-colors hover:border-rule-strong hover:text-ink"
              >
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={b.d} />
                </svg>
              </button>
            ))}
          </div>
        </div>

        <ol className="flex-1 px-4 py-4 lg:overflow-y-auto">
          {steps.map((st, i) => {
            const active = st.order === activeStep;
            const last = i === steps.length - 1;
            return (
              <li key={st.order} className="relative flex gap-3 pb-2">
                {/* the line the steps hang on */}
                {!last && <span aria-hidden className="absolute bottom-0 left-[15px] top-9 w-px bg-rule" />}
                <span
                  aria-hidden
                  className={`relative z-10 mt-2.5 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full font-mono text-[13px] font-bold transition-colors ${
                    active ? 'bg-accent text-white' : 'border border-rule-strong bg-panel text-ink-soft'
                  }`}
                >
                  {st.order}
                </span>
                <button
                  onClick={() => setActiveStep(active ? null : st.order)}
                  aria-pressed={active}
                  className={`min-w-0 flex-1 rounded-xl p-3 text-left transition-colors ${
                    active ? 'bg-accent-tint' : 'hover:bg-raised'
                  }`}
                >
                  <div className="text-[16px] font-bold leading-snug">
                    <span className={active ? 'hi' : ''}>{st.title}</span>
                  </div>
                  <div className="mt-1 text-sm leading-relaxed text-ink-soft">{st.description}</div>
                  {st.panelRefs.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {st.panelRefs.map((id) => (
                        <span
                          key={id}
                          className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                            active ? 'bg-panel text-accent-ink' : 'bg-raised text-ink-soft'
                          }`}
                        >
                          {labels[id] ?? id}
                        </span>
                      ))}
                    </div>
                  )}
                  {detail?.(st)}
                </button>
              </li>
            );
          })}
        </ol>
      </aside>
    </div>
  );
}
