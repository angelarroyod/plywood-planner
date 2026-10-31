import type { ReactNode } from 'react';
import { templates, weldTemplates } from '../engine/index.ts';
import { useAppStore } from '../state/store.ts';

/** Front elevations drawn in one 1.5 px stroke on a 40 px square, one per template id. */
const THUMBS: Record<string, ReactNode> = {
  bookshelf: <path d="M11 4h18v32H11zM11 12h18M11 20h18M11 28h18" />,
  'side-table': <path d="M6 12h28M9 12v22M31 12v22M9 28h22" />,
  closet: <path d="M8 4h24v32H8zM20 4v32M8 9h24M12 14h4m8 0h4M8 31h24" />,
  'tv-stand': <path d="M4 14h32v16H4zM20 14v16M8 22h8M24 22h8M7 30v4m26-4v4" />,
  'weld-table': <path d="M4 13h32M4 15.5h32M7 15.5v20M33 15.5v20M7 29h26" />,
  'weld-stool': <path d="M11 10h18M11 12.5h18M13 12.5v24M27 12.5v24M13 26h14" />,
  'weld-shelf': <path d="M9 4v32M31 4v32M9 6h22M9 16h22M9 26h22M9 34h22" />,
};

export function TemplatePicker() {
  const metal = useAppStore((s) => s.mode === 'metal');
  const templateId = useAppStore((s) => (metal ? s.weldTemplateId : s.templateId));
  const setTemplate = useAppStore((s) => s.setTemplate);
  const items = metal ? weldTemplates : templates;

  return (
    <section>
      <h2 className="rule-label">Plantilla</h2>
      {/* A chip row on phones keeps the sizes right under the stage; full rows with descriptions on a desk. */}
      <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:grid lg:grid-cols-1 lg:gap-1.5 lg:overflow-visible lg:px-0">
        {items.map((t) => {
          const active = t.id === templateId;
          return (
            <button
              key={t.id}
              onClick={() => setTemplate(t.id)}
              aria-pressed={active}
              className={`flex shrink-0 items-center gap-2.5 rounded-xl border p-1.5 pr-3.5 text-left transition-colors lg:w-full lg:shrink lg:gap-3 lg:p-2.5 ${
                active ? 'border-accent bg-accent-tint' : 'border-rule hover:bg-raised lg:border-transparent'
              }`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border lg:h-12 lg:w-12 ${
                  active ? 'border-accent/30 bg-panel text-accent-ink' : 'border-rule bg-panel text-ink-soft'
                }`}
              >
                <svg viewBox="0 0 40 40" className="h-8 w-8 lg:h-9 lg:w-9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
                  {THUMBS[t.id]}
                </svg>
              </span>
              <span className="min-w-0">
                <span className="block whitespace-nowrap text-sm font-bold leading-snug lg:whitespace-normal lg:text-[15px]">{t.name}</span>
                <span className="mt-0.5 hidden text-[13px] leading-snug text-ink-soft lg:block">{t.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
