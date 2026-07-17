import { useMemo, useRef } from 'react';
import { templates } from './engine/index.ts';
import type { Design } from './engine/types.ts';
import { useAppStore, type View } from './state/store.ts';
import { TemplatePicker } from './components/TemplatePicker.tsx';
import { ParamForm } from './components/ParamForm.tsx';
import { Viewer3D } from './components/Viewer3D.tsx';
import { CutDiagram } from './components/CutDiagram.tsx';
import { StepsPanel } from './components/StepsPanel.tsx';
import { PrintReport } from './components/PrintReport.tsx';

const TABS: { id: View; label: string }[] = [
  { id: 'design', label: 'Diseño' },
  { id: 'cuts', label: 'Cortes' },
  { id: 'steps', label: 'Pasos' },
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
      <div className="flex h-screen bg-neutral-100 text-neutral-900 print:hidden">
        <aside className="w-80 shrink-0 overflow-y-auto border-r border-neutral-200 bg-white p-4">
          <h1 className="text-lg font-bold">Planificador de triplay</h1>
          <TemplatePicker />
          <ParamForm template={template} params={params} issues={result.ok ? [] : result.issues} />
        </aside>
        <main className="flex flex-1 flex-col">
          <nav className="flex items-center gap-1 border-b border-neutral-200 bg-white px-4 py-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setView(tab.id)}
                className={`rounded px-3 py-1 text-sm ${
                  view === tab.id
                    ? 'bg-amber-100 font-medium text-amber-900'
                    : 'text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
            <button
              onClick={() => window.print()}
              className="ml-auto rounded bg-amber-700 px-3 py-1 text-sm font-medium text-white hover:bg-amber-800"
            >
              Exportar PDF
            </button>
          </nav>
          <div className="relative flex-1 overflow-hidden">
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
