import { useMemo, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { CUT_KERF, cutTotals, edgeBandTotals, nest, templates, weldTemplates } from './engine/index.ts';
import { refLabels } from './engine/labels.ts';
import { DEFAULT_CONFIG } from './engine/types.ts';
import type { Design } from './engine/types.ts';
import type { WeldDesign } from './engine/welding/types.ts';
import { useAppStore, type Mode, type View } from './state/store.ts';
import { TemplatePicker } from './components/TemplatePicker.tsx';
import { ParamForm } from './components/ParamForm.tsx';
import { Viewer3D } from './components/Viewer3D.tsx';
import { CutDiagram } from './components/CutDiagram.tsx';
import { StepsPanel } from './components/StepsPanel.tsx';
import { PrintReport } from './components/PrintReport.tsx';
import { OrderPanel } from './components/OrderPanel.tsx';
import {
  Suggestions,
  WeldCuts,
  WeldDesignView,
  WeldPrintReport,
  WeldShopping,
  WeldSteps,
} from './components/weld/WeldPanels.tsx';

/** 20 px line icons in one stroke weight; the tab bar shows them on phones. */
const ICONS: Record<View, ReactNode> = {
  design: <path d="M10 2.5 17 6.3v7.4L10 17.5 3 13.7V6.3L10 2.5Zm0 0v7.6m0 0 7-3.8M10 10.1 3 6.3" />,
  cuts: <path d="M3.5 3.5h13v13h-13zM3.5 9h13M9 9v7.5M12.5 3.5V9" />,
  steps: <path d="M8 5h9M8 10h9M8 15h9M3.5 4.2l1 1 2-2M3.5 9.2l1 1 2-2M4.5 15h.01" />,
  order: <path d="M5 2.5h10v15l-2-1.3-1.5 1.3-1.5-1.3-1.5 1.3L7 16.2l-2 1.3v-15ZM7.5 6.5h5M7.5 9.5h5M7.5 12.5h3" />,
};

const TABS: Record<Mode, { id: View; label: string }[]> = {
  wood: [
    { id: 'design', label: 'Diseño' },
    { id: 'cuts', label: 'Cortes' },
    { id: 'steps', label: 'Pasos' },
    { id: 'order', label: 'Pedido' },
  ],
  metal: [
    { id: 'design', label: 'Diseño' },
    { id: 'cuts', label: 'Cortes' },
    { id: 'steps', label: 'Pasos' },
    { id: 'order', label: 'Compras' },
  ],
};

const MODES: { id: Mode; label: string; icon: ReactNode }[] = [
  { id: 'wood', label: 'Madera', icon: <path d="M2.5 6h11M2.5 8.5h11M2.5 11h11M2.5 4.5h11v8h-11z" /> },
  { id: 'metal', label: 'Metal', icon: <path d="M3 3h10v10H3zM5.5 5.5h5v5h-5z" /> },
];

/** Keeps the last valid design so the views stay put while the user fixes an invalid combo. */
function useLastGood<T>(design: T | null): T | null {
  const last = useRef<T | null>(null);
  if (design) last.current = design;
  return last.current;
}

export default function App() {
  const mode = useAppStore((s) => s.mode);
  const templateId = useAppStore((s) => s.templateId);
  const weldTemplateId = useAppStore((s) => s.weldTemplateId);
  const paramsByTemplate = useAppStore((s) => s.paramsByTemplate);
  const view = useAppStore((s) => s.view);

  const template = templates.find((t) => t.id === templateId) ?? templates[0]!;
  const weldTemplate = weldTemplates.find((t) => t.id === weldTemplateId) ?? weldTemplates[0]!;
  const params = paramsByTemplate[template.id] ?? {};
  const weldParams = paramsByTemplate[weldTemplate.id] ?? {};

  const result = useMemo(() => template.generate(params), [template, params]);
  const weldResult = useMemo(() => weldTemplate.generate(weldParams), [weldTemplate, weldParams]);
  const design = useLastGood<Design>(result.ok ? result.design : null);
  const weld = useLastGood<WeldDesign>(weldResult.ok ? weldResult.design : null);

  const metal = mode === 'metal';
  const active = metal ? weldResult : result;
  const stale = !active.ok;
  const issues = active.ok ? [] : active.issues;

  return (
    <>
      <a
        href="#main"
        className="sr-only rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70]"
      >
        Saltar al contenido
      </a>
      <div className="flex min-h-dvh flex-col bg-paper text-ink lg:h-dvh print:hidden">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-rule bg-panel px-4 lg:gap-7 lg:px-6">
          <Brand />
          <ModeSwitch />
          <ViewTabs />
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => window.print()}
              aria-label="Exportar PDF"
              className="flex h-10 items-center gap-2 rounded-lg bg-accent px-3 text-sm font-bold text-white shadow-[0_1px_2px_rgb(20_26_43/0.2)] transition-[filter] hover:brightness-110 sm:px-4"
            >
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M10 3v9m0 0-3.5-3.5M10 12l3.5-3.5M4 14.5V17h12v-2.5" />
              </svg>
              <span className="hidden sm:inline">Exportar PDF</span>
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:flex-row lg:pb-0">
          {/* The rail. On a phone it sits under the stage, and only in Diseño. */}
          <aside
            className={`${view === 'design' ? 'flex' : 'hidden'} order-2 flex-col bg-panel lg:order-none lg:flex lg:w-[340px] lg:shrink-0 lg:border-r lg:border-cut`}
          >
            <div className="flex-1 px-5 pb-8 pt-5 lg:overflow-y-auto">
              <TemplatePicker />
              <ParamForm template={metal ? weldTemplate : template} params={metal ? weldParams : params} issues={issues}>
                {metal && weld && <Suggestions design={weld} />}
              </ParamForm>
            </div>
            <footer className="border-t border-rule px-5 py-3 text-xs leading-relaxed text-ink-soft">
              {metal ? `Disco de ${CUT_KERF} mm · tramos de 6.10 m` : `Sierra de ${DEFAULT_CONFIG.nesting.kerf} mm`} ·
              todas las medidas en milímetros
            </footer>
          </aside>

          <main id="main" tabIndex={-1} className="order-1 flex min-w-0 flex-1 flex-col focus-visible:outline-none">
            <div
              key={`${mode}-${view}`}
              id="view-panel"
              role="tabpanel"
              aria-labelledby={`tab-${view}`}
              className="rise relative flex-1 lg:overflow-hidden"
            >
              {!metal && design && view === 'design' && (
                <div className="flex flex-col lg:h-full">
                  <div className="h-[58dvh] lg:h-auto lg:min-h-0 lg:flex-1">
                    <Viewer3D design={design} stale={stale} dimensions />
                  </div>
                  <WoodSummary design={design} />
                </div>
              )}
              {!metal && design && view === 'cuts' && <CutDiagram design={design} />}
              {!metal && design && view === 'steps' && (
                <StepsPanel
                  steps={design.steps}
                  labels={refLabels(design)}
                  viewer={(step) => <Viewer3D design={design} stale={stale} highlightStep={step} />}
                />
              )}
              {!metal && design && view === 'order' && (
                <OrderPanel design={design} title={template.name} stale={stale} />
              )}

              {metal && weld && view === 'design' && <WeldDesignView design={weld} stale={stale} />}
              {metal && weld && view === 'cuts' && <WeldCuts design={weld} stale={stale} />}
              {metal && weld && view === 'steps' && <WeldSteps design={weld} stale={stale} />}
              {metal && weld && view === 'order' && (
                <WeldShopping design={weld} title={weldTemplate.name} stale={stale} />
              )}
            </div>
          </main>
        </div>
      </div>
      {metal ? <WeldPrintReport design={weld} title={weldTemplate.name} /> : <PrintReport design={design} />}
    </>
  );
}

/** What the design asks of the lumber yard, at a glance under the stage. */
function WoodSummary({ design }: { design: Design }) {
  const layout = useMemo(() => nest(design.panels), [design]);
  const cuts = cutTotals(layout);
  const band = edgeBandTotals(design.panels).reduce((m, t) => m + t.meters, 0);
  const sheet = layout.sheets[0]?.stock.sheet;
  const cells = [
    { label: 'Hojas', value: String(layout.sheets.length), unit: sheet ? `de ${sheet.width} × ${sheet.length}` : '' },
    { label: 'Piezas', value: String(design.panels.reduce((n, p) => n + p.qty, 0)), unit: '' },
    { label: 'Cortes', value: String(cuts.count), unit: `${cuts.meters.toFixed(1)} m` },
    { label: 'Cubrecanto', value: design.edgeBanding === 'none' ? '—' : `${band.toFixed(1)} m`, unit: '' },
  ];
  return (
    <dl className="grid shrink-0 grid-cols-4 divide-x divide-rule border-t border-rule bg-panel">
      {cells.map((c) => (
        <div key={c.label} className="flex min-w-0 flex-col-reverse px-3 py-2.5 lg:px-5 lg:py-3">
          <dt className="truncate text-xs font-semibold text-ink-faint">
            {c.label}
            {c.unit && <span className="hidden font-normal sm:inline"> · {c.unit}</span>}
          </dt>
          <dd className="font-mono text-lg font-bold lg:text-xl">{c.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Notebook square: a cuadrícula in ballpoint with one highlighted row. */
function Brand() {
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <rect width="32" height="32" rx="8" fill="var(--color-accent)" />
        <rect x="7" y="17.5" width="18" height="5" rx="1.5" fill="#ffe14d" />
        <path d="M7 9.5h18M7 14.5h18M7 19.5h18M7 24.5h18M9.5 7v18M14.5 7v18M19.5 7v18M24.5 7v18" stroke="#fff" strokeOpacity=".55" strokeWidth="1" />
      </svg>
      <span className="display hidden text-lg sm:inline">Planificador</span>
    </div>
  );
}

/** Wood or metal: two workshops sharing one shell, one 3D viewer and one step list. */
function ModeSwitch() {
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);
  return (
    <div role="group" aria-label="Tipo de proyecto" className="flex rounded-xl bg-raised p-1">
      {MODES.map((m) => {
        const active = m.id === mode;
        return (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            aria-pressed={active}
            className={`flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-bold transition-colors ${
              active ? 'bg-panel text-ink shadow-[0_1px_3px_rgb(20_26_43/0.16)]' : 'text-ink-soft hover:text-ink'
            }`}
          >
            <svg viewBox="0 0 16 16" className={`h-4 w-4 ${active ? 'text-accent-ink' : ''}`} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" aria-hidden>
              {m.icon}
            </svg>
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The four views. One tablist: tabs in the top bar on a desk, a thumb-reach bar
 * along the bottom on a phone. Arrows and Home/End move between views.
 */
function ViewTabs() {
  const mode = useAppStore((s) => s.mode);
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const ids = TABS[mode].map((t) => t.id);
    const i = ids.indexOf(view);
    const moves: Record<string, number> = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: ids.length - 1 };
    const next = moves[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const id = ids[(next + ids.length) % ids.length]!;
    setView(id);
    document.getElementById(`tab-${id}`)?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label="Vistas"
      onKeyDown={onKey}
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-rule bg-panel pb-[env(safe-area-inset-bottom)] lg:static lg:h-full lg:gap-7 lg:border-0 lg:bg-transparent lg:pb-0"
    >
      {TABS[mode].map((tab) => {
        const active = view === tab.id;
        return (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            role="tab"
            aria-selected={active}
            aria-controls="view-panel"
            tabIndex={active ? 0 : -1}
            onClick={() => setView(tab.id)}
            className={`flex h-16 flex-1 flex-col items-center justify-center gap-1 text-xs font-bold transition-colors lg:h-full lg:flex-none lg:flex-row lg:border-b-2 lg:text-[15px] ${
              active
                ? 'text-accent-ink lg:border-accent lg:text-ink'
                : 'text-ink-soft hover:text-ink lg:border-transparent'
            }`}
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5 lg:hidden" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {ICONS[tab.id]}
            </svg>
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/** Paper by day, ink-blue by night. Print is always paper. */
function ThemeToggle() {
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const label = `Cambiar a tema ${theme === 'dark' ? 'claro' : 'oscuro'}`;

  return (
    <button
      onClick={toggleTheme}
      title={label}
      aria-label={label}
      className="flex h-10 w-10 items-center justify-center rounded-lg border border-rule text-ink-soft transition-colors hover:border-rule-strong hover:text-ink"
    >
      <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
        {theme === 'dark' ? (
          <>
            <circle cx="10" cy="10" r="3.6" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
              <line key={a} x1="10" y1="2" x2="10" y2="3.8" transform={`rotate(${a} 10 10)`} />
            ))}
          </>
        ) : (
          <path d="M16.2 12.4A6.8 6.8 0 0 1 7.6 3.8a6.9 6.9 0 1 0 8.6 8.6Z" />
        )}
      </svg>
    </button>
  );
}
