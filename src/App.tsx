import { useMemo, useRef } from 'react';
import { templates } from './engine/index.ts';
import type { Design } from './engine/types.ts';
import { useAppStore } from './state/store.ts';
import { TemplatePicker } from './components/TemplatePicker.tsx';
import { ParamForm } from './components/ParamForm.tsx';
import { Viewer3D } from './components/Viewer3D.tsx';

export default function App() {
  const templateId = useAppStore((s) => s.templateId);
  const paramsByTemplate = useAppStore((s) => s.paramsByTemplate);
  const template = templates.find((t) => t.id === templateId) ?? templates[0]!;
  const params = paramsByTemplate[template.id] ?? {};

  const result = useMemo(() => template.generate(params), [template, params]);

  // keep rendering the last valid design while the user fixes an invalid combo
  const lastGood = useRef<Design | null>(null);
  if (result.ok) lastGood.current = result.design;
  const design = result.ok ? result.design : lastGood.current;

  return (
    <div className="flex h-screen bg-neutral-100 text-neutral-900">
      <aside className="w-80 shrink-0 overflow-y-auto border-r border-neutral-200 bg-white p-4">
        <h1 className="text-lg font-bold">Planificador de triplay</h1>
        <TemplatePicker />
        <ParamForm template={template} params={params} issues={result.ok ? [] : result.issues} />
      </aside>
      <main className="relative flex-1">
        {design && <Viewer3D design={design} stale={!result.ok} />}
      </main>
    </div>
  );
}
