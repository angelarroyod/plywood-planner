import { useMemo, useRef } from 'react';
import { templates } from './engine/index.ts';
import { DEFAULT_CONFIG } from './engine/types.ts';
import type { Design } from './engine/types.ts';
import { useAppStore, type View } from './state/store.ts';
import { TemplatePicker } from './components/TemplatePicker.tsx';
import { ParamForm } from './components/ParamForm.tsx';
import { Viewer3D } from './components/Viewer3D.tsx';
import { CutDiagram } from './components/CutDiagram.tsx';
import { StepsPanel } from './components/StepsPanel.tsx';
import { PrintReport } from './components/PrintReport.tsx';

const TABS: { id: View; label: string; hint: string }[] = [
  { id: 'design', label: 'Diseño', hint: '3D' },
  { id: 'cuts', label: 'Cortes', hint: 'Hojas' },
  { id: 'steps', label: 'Pasos', hint: 'Armado' },
];

export default function App() {
  const templateId = useAppStore((s) => s.templateId);
  const paramsByTemplate = useAppStore((s) => s.paramsByTemplate);
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const template = templates.find((t) => t.id === templateId) ?? templates[0]!;
  const params = paramsByTemplate[template.id] ?? {};

  const result = useMemo(() => template.generate(params), [template, params]);

  // keep rendering the last valid design while the user fixes an invalid combo
  const lastGood = useRef<Design | null>(null);
  if (result.ok) lastGood.current = result.design;
  const design = result.ok ? result.design : lastGood.current;

  return (
    <>
      <div className="flex h-screen bg-paper text-ink print:hidden">
        <aside className="flex w-[21rem] shrink-0 flex-col border-r border-rule bg-panel">
          <header className="flex items-center gap-3 px-5 pb-4 pt-5">
            <Wordmark />
            <div className="leading-tight">
              <h1 className="display text-[17px] font-extrabold">Planificador</h1>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
                Muebles de triplay y melamina
              </p>
            </div>
          </header>
          <div className="ruler h-1.5 shrink-0 opacity-70" />
          <div className="flex-1 overflow-y-auto px-5 pb-8 pt-6">
            <TemplatePicker />
            <ParamForm
              template={template}
              params={params}
              issues={result.ok ? [] : result.issues}
            />
          </div>
          <footer className="border-t border-rule px-5 py-3 font-mono text-[10px] leading-relaxed text-ink-soft">
            Sierra {DEFAULT_CONFIG.nesting.kerf} mm
            <br />
            Todas las medidas en milímetros
          </footer>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <nav className="flex items-end gap-6 border-b border-rule px-6 pt-4">
            {TABS.map((tab) => {
              const active = view === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setView(tab.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`group -mb-px border-b-2 pb-3 text-left transition-colors ${
                    active
                      ? 'border-cut text-ink'
                      : 'border-transparent text-ink-soft hover:border-rule hover:text-ink'
                  }`}
                >
                  <span className="display block text-base font-bold">{tab.label}</span>
                  <span
                    className={`block font-mono text-[9px] uppercase tracking-[0.18em] ${
                      active ? 'text-cut' : 'text-ink-faint'
                    }`}
                  >
                    {tab.hint}
                  </span>
                </button>
              );
            })}
            <div className="ml-auto pb-3">
              <button
                onClick={() => window.print()}
                className="rounded-md bg-cut px-4 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-white transition-[filter] hover:brightness-110"
              >
                Exportar PDF
              </button>
            </div>
          </nav>
          <div key={view} className="rise relative flex-1 overflow-hidden">
            {design && view === 'design' && <Viewer3D design={design} stale={!result.ok} />}
            {design && view === 'cuts' && <CutDiagram design={design} />}
            {design && view === 'steps' && <StepsPanel design={design} stale={!result.ok} />}
          </div>
        </main>
      </div>
      <PrintReport design={design} />
    </>
  );
}

/** Plywood edge-grain: stacked veneer plies seen from the cut side. */
function Wordmark() {
  return (
    <svg viewBox="0 0 32 32" className="h-9 w-9 shrink-0" aria-hidden="true">
      <rect width="32" height="32" rx="3" fill="#db011c" />
      {['#ffffff', '#f5f6f7', '#ffffff', '#f5f6f7', '#ffffff'].map((fill, i) => (
        <rect key={i} x="6" y={7 + i * 3.8} width="20" height="2.6" rx="1" fill={fill} />
      ))}
    </svg>
  );
}
