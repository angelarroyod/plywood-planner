import { templates } from '../engine/index.ts';
import { useAppStore } from '../state/store.ts';

export function TemplatePicker() {
  const templateId = useAppStore((s) => s.templateId);
  const setTemplate = useAppStore((s) => s.setTemplate);

  return (
    <div className="mt-4">
      <h2 className="text-sm font-semibold text-neutral-600">Plantilla</h2>
      <div className="mt-2 space-y-2">
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => setTemplate(t.id)}
            className={`w-full rounded-lg border p-3 text-left transition-colors ${
              t.id === templateId
                ? 'border-amber-600 bg-amber-50'
                : 'border-neutral-200 hover:border-neutral-400'
            }`}
          >
            <div className="font-medium">{t.name}</div>
            <div className="text-xs text-neutral-500">{t.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
