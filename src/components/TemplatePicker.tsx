import { templates } from '../engine/index.ts';
import { useAppStore } from '../state/store.ts';

export function TemplatePicker() {
  const templateId = useAppStore((s) => s.templateId);
  const setTemplate = useAppStore((s) => s.setTemplate);

  return (
    <section>
      <h2 className="rule-label">Plantilla</h2>
      <div className="mt-3 space-y-2">
        {templates.map((t, i) => {
          const active = t.id === templateId;
          return (
            <button
              key={t.id}
              onClick={() => setTemplate(t.id)}
              aria-pressed={active}
              className={`relative flex w-full gap-3 rounded-lg border p-3 text-left transition-all ${
                active
                  ? 'border-ink bg-ply-tint shadow-[2px_2px_0_0_var(--color-ink)]'
                  : 'border-rule bg-panel hover:border-ink-soft hover:bg-ply-tint/30'
              }`}
            >
              <span
                className={`mt-0.5 font-mono text-[10px] tabular-nums ${
                  active ? 'text-ply-deep' : 'text-ink-soft/60'
                }`}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0">
                <span className="block font-display text-[15px] font-bold leading-snug tracking-tight">
                  {t.name}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-ink-soft">
                  {t.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
