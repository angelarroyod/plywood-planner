import { useMemo, useState } from 'react';
import {
  BAR_LENGTH,
  CUT_KERF,
  END_ANGLE as ENDS,
  SAFETY_GEAR,
  SQUARE_END_STEP,
  WELD_REF,
  barCutTip,
  planBars,
  settingsNote,
  shoppingList,
  shoppingText,
  toolLabel,
  type BarLayout,
  type WeldDesign,
  type WeldStep,
} from '../../engine/index.ts';
import { useAppStore } from '../../state/store.ts';
import { StepsPanel } from '../StepsPanel.tsx';
import { Viewer3D, type Finish } from '../Viewer3D.tsx';
import { FocusRig, ToolDemo } from './ToolDemo.tsx';

/** Paint reads as a satin coat; bare steel as metal. */
export function finishOf(d: WeldDesign): Finish {
  return d.finish.painted
    ? { color: d.finish.hex, metalness: 0.25, roughness: d.finish.gloss ? 0.3 : 0.7 }
    : { color: d.finish.hex, metalness: 0.85, roughness: 0.35 };
}

const MONO = 'Atkinson Hyperlegible Mono, ui-monospace, monospace';
const DEMO = { cut: 'Corte con disco', grind: 'Esmerilado', tack: 'Punteo', weld: 'Cordón', measure: 'Medición', paint: 'Pintura' } as const;

function StaleBadge() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center px-4">
      <span className="rounded-full bg-cut-tint px-3.5 py-1.5 text-[13px] font-semibold text-cut-ink shadow-[0_1px_4px_rgb(20_26_43/0.12)]">
        Corrige los errores para actualizar el modelo
      </span>
    </div>
  );
}

/** Where to set the machine for this tube and process. */
export function SettingsCard({ design, className = '' }: { design: WeldDesign; className?: string }) {
  const { settings, process, tube } = design;
  return (
    <section className={`card p-4 ${className}`}>
      <h3 className="rule-label">Ajuste de máquina</h3>
      <p className="mt-3 font-bold leading-snug">{process.label}</p>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="font-mono text-[44px] font-bold leading-none text-accent-ink">{settings.start}</span>
        <span className="text-lg font-semibold text-ink-soft">A</span>
        <span className="ml-auto font-mono text-[13px] text-ink-soft">
          {settings.amps[0]}–{settings.amps[1]} A
        </span>
      </div>
      <dl className="mt-3 space-y-1.5 text-[13px] leading-snug">
        {[
          ['Consumible', settings.consumable],
          ...(settings.tungsten ? [['Tungsteno', settings.tungsten]] : []),
          ['Polaridad', settings.polarity],
          ['Gas', settings.gas ?? 'No usa'],
          ['Material', `${tube.label} · pared ${tube.wall} mm`],
        ].map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="w-[5.5rem] shrink-0 font-semibold text-ink-faint">{k}</dt>
            <dd className="text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 rounded-lg bg-raised px-3 py-2.5 text-[13px] leading-relaxed text-ink-soft">
        {settingsNote(design)}
      </p>
    </section>
  );
}

/** 3D model in its final color, with the machine settings beside it (under it on a phone). */
export function WeldDesignView({ design, stale }: { design: WeldDesign; stale: boolean }) {
  return (
    <div className="lg:relative lg:h-full">
      <div className="h-[58dvh] lg:h-full">
        <Viewer3D design={design} stale={stale} finish={finishOf(design)} dimensions />
      </div>
      <div className="space-y-3 p-4 lg:absolute lg:right-4 lg:top-4 lg:w-80 lg:p-0">
        <SettingsCard design={design} className="shadow-[0_2px_10px_rgb(20_26_43/0.08)]" />
        <dl className="card grid grid-cols-3 divide-x divide-rule text-center">
          {[
            ['Peso', `${design.weight} kg`],
            ['Uniones', String(design.joints)],
            ['Cordón', `${(design.weldLength / 1000).toFixed(1)} m`],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col-reverse px-2 py-2.5">
              <dt className="text-xs font-semibold text-ink-faint">{k}</dt>
              <dd className="font-mono text-[15px] font-bold">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/** Advice earned by the user's choices, each with a one-click fix where there is one. */
export function Suggestions({ design }: { design: WeldDesign }) {
  const setParams = useAppStore((s) => s.setParams);
  return (
    <>
      <h2 className="rule-label mt-7">Sugerencias</h2>
      {design.suggestions.length === 0 ? (
        <p className="mt-3 text-[13px] text-ink-soft">Todo en orden con estas medidas y este proceso.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {design.suggestions.map((s, i) => {
            const warn = s.level === 'warn';
            return (
              <li key={i} className={`flex gap-2.5 rounded-xl px-3.5 py-3 ${warn ? 'bg-cut-tint' : 'bg-accent-tint'}`}>
                <svg viewBox="0 0 20 20" className={`mt-0.5 h-4 w-4 shrink-0 ${warn ? 'text-cut-ink' : 'text-accent-ink'}`} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  {warn ? <path d="M10 3 18 17H2L10 3ZM10 8v4M10 14.5h.01" /> : <path d="M7.5 15h5M8 17.5h4M10 2.5a5 5 0 0 0-3 9c.6.5 1 1.2 1 2V14h4v-.5c0-.8.4-1.5 1-2a5 5 0 0 0-3-9Z" />}
                </svg>
                <div className="min-w-0">
                  <span className={`text-xs font-bold ${warn ? 'text-cut-ink' : 'text-accent-ink'}`}>
                    {warn ? 'Atención' : 'Consejo'}
                  </span>
                  <p className="mt-0.5 text-sm leading-relaxed text-ink">{s.message}</p>
                  {s.fix && (
                    <button
                      onClick={() => setParams(s.fix!.params)}
                      className="mt-2 h-9 rounded-lg border border-rule bg-panel px-3 text-[13px] font-bold text-accent-ink transition-colors hover:border-accent"
                    >
                      {s.fix.label}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/** One bar drawn to scale: pieces in cut order, kerfs as gaps, the leftover hatched. */
function BarSvg({ bar, side, lit = null }: { bar: BarLayout; side: number; lit?: string | null }) {
  const H = 260;
  const y = 40;
  const bevel = 90; // drawn 45° end, exaggerated so it reads at this scale
  return (
    <svg viewBox={`0 0 ${BAR_LENGTH} ${H + 80}`} className="w-full" role="img" aria-label="Tramo de 6.10 m con sus piezas">
      <defs>
        <pattern id="remnant" width="60" height="60" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="60" stroke="var(--color-sheet-edge)" strokeWidth="14" />
        </pattern>
      </defs>
      <rect x={0} y={y} width={BAR_LENGTH} height={H} fill="url(#remnant)" stroke="var(--color-sheet-edge)" strokeWidth={8} />
      {bar.pieces.map((p, i) => {
        const x0 = p.offset;
        const x1 = p.offset + p.length;
        const m = p.ends === 'miter' ? bevel : 0;
        const wide = p.length > 700;
        return (
          <g key={i}>
            <polygon
              points={`${x0},${y} ${x1},${y} ${x1 - m},${y + H} ${x0 + m},${y + H}`}
              fill={p.memberId === lit ? 'var(--color-hi)' : 'var(--color-piece)'}
              stroke="var(--color-piece-edge)"
              strokeWidth={8}
            />
            <text x={(x0 + x1) / 2} y={y + H / 2 - (wide ? 20 : -30)} textAnchor="middle" fontSize={wide ? 96 : 110} fontFamily={MONO} fill="var(--color-piece-label)">
              {i + 1}
            </text>
            {wide && (
              <text x={(x0 + x1) / 2} y={y + H / 2 + 90} textAnchor="middle" fontSize={76} fontFamily={MONO} fill="var(--color-piece-label)">
                {p.length}
              </text>
            )}
          </g>
        );
      })}
      <text x={BAR_LENGTH - 20} y={y + H + 70} textAnchor="end" fontSize={64} fontFamily={MONO} fill="var(--color-ink-soft)">
        {bar.remnant > 0 ? `sobrante ${bar.remnant} mm` : 'sin sobrante'} · tubo de {Math.round(side)} mm
      </text>
    </svg>
  );
}

/** Bar-by-bar cut plan, numbered in saw order. */
export function WeldCuts({ design, stale }: { design: WeldDesign; stale: boolean }) {
  const bars = useMemo(() => planBars(design.members), [design]);
  const [lit, setLit] = useState<string | null>(null); // a piece row lights its cuts on every bar
  const longest = Math.max(...design.members.map((m) => m.length));
  return (
    <div className={`relative bg-paper px-4 py-5 transition-opacity duration-300 lg:h-full lg:overflow-y-auto lg:px-8 lg:py-7 ${stale ? 'opacity-45' : ''}`}>
      <div className="mx-auto max-w-[1100px]">
        <h2 className="display text-2xl">Plan de cortes</h2>
        <p className="mt-1 text-sm text-ink-soft">
          {design.tube.label} · {bars.length} {bars.length === 1 ? 'tramo' : 'tramos'} de 6.10 m · disco {CUT_KERF} mm
        </p>

        <div className="mt-8 flex flex-col gap-10 lg:flex-row lg:items-start">
          <section className="min-w-0 flex-1 space-y-8">
            {bars.map((bar, b) => (
              <div key={b}>
                <h3 className="rule-label">Tramo {b + 1}</h3>
                <div className="stage-grid mt-3 rounded-xl border border-rule p-3">
                  <BarSvg bar={bar} side={design.tube.side} lit={lit} />
                </div>
                <ol className="mt-2 space-y-1 text-sm">
                  <li className="text-[13px] text-ink-soft">
                    <span className="font-mono font-bold text-cut-ink">0.</span> {SQUARE_END_STEP}
                  </li>
                  {bar.pieces.map((p, i) => (
                    <li key={i}>
                      <span className="font-mono font-bold text-cut-ink">{i + 1}.</span> Mide{' '}
                      <strong className="font-mono tabular-nums">{p.length} mm</strong> desde la punta y corta a{' '}
                      {ENDS[p.ends]} — <span className="text-ink-soft">{p.label}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </section>

          <section className="w-full lg:w-80 lg:shrink-0">
            <h3 className="rule-label">Lista de piezas</h3>
            <div className="overflow-x-auto"><table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-rule-strong text-left text-xs text-ink-soft">
                  <th className="pb-1.5 font-semibold">Pieza</th>
                  <th className="pb-1.5 text-right font-semibold">Largo</th>
                  <th className="pb-1.5 text-right font-semibold">Cant.</th>
                  <th className="pb-1.5 text-right font-semibold">Corte</th>
                </tr>
              </thead>
              <tbody>
                {design.members.map((m) => (
                  <tr
                    key={m.id}
                    onPointerEnter={() => setLit(m.id)}
                    onPointerLeave={() => setLit(null)}
                    className={`border-b border-rule transition-colors ${lit === m.id ? 'bg-accent-tint' : ''}`}
                  >
                    <td className="py-2 pr-2">
                      {m.label}
                      {/* true-scale length against the longest piece */}
                      <span aria-hidden className="mt-1 block h-1 rounded-full bg-accent/70" style={{ width: `${(m.length / longest) * 100}%` }} />
                    </td>
                    <td className="py-2 text-right font-mono text-[13px] font-bold">{m.length}</td>
                    <td className="py-2 text-right font-mono text-[13px]">{m.qty}</td>
                    <td className="py-2 text-right font-mono text-[13px]">{ENDS[m.ends]}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            <p className="mt-4 rounded-lg bg-raised px-3 py-2.5 text-[13px] leading-relaxed text-ink-soft">
              {barCutTip(design.members)}
            </p>
          </section>
        </div>
      </div>
      {stale && <StaleBadge />}
    </div>
  );
}

/** Steps beside the 3D model, with a looping demo of the tool each step uses. */
export function WeldSteps({ design, stale }: { design: WeldDesign; stale: boolean }) {
  const labels = useMemo(
    () => ({ ...Object.fromEntries(design.members.map((m) => [m.id, m.label])), [WELD_REF]: 'Cordones de soldadura' }),
    [design],
  );
  const finish = finishOf(design);
  // beads appear once they are welded, plugs once the paint is dry
  const weldedAt = design.steps.find((s) => s.action?.kind === 'weld')?.order ?? Infinity;
  const pluggedAt = design.steps.find((s) => s.action?.kind === 'paint')?.order ?? Infinity;

  const viewer = (step: WeldStep | null) => {
    const a = step?.action;
    const focus = a ? ([0, 1, 2].map((k) => (a.from[k]! + a.to[k]!) / 2) as [number, number, number]) : null;
    const span = a ? Math.hypot(a.to[0] - a.from[0], a.to[1] - a.from[1], a.to[2] - a.from[2]) : 0;
    return (
      <div className="relative h-full">
        <Viewer3D
          design={design}
          stale={stale}
          highlightStep={step}
          finish={finish}
          showWelds={!step || step.order >= weldedAt}
          showCaps={!step || step.order >= pluggedAt}
        >
          {a && <ToolDemo key={step!.order} action={a} />}
          <FocusRig focus={focus} distance={Math.max(950, span * 1.4)} />
        </Viewer3D>
        {a && (
          <div className="pointer-events-none absolute right-3 top-3 rounded-xl border border-rule bg-panel/95 px-3.5 py-2.5 shadow-[0_2px_8px_rgb(20_26_43/0.1)]">
            <p className="font-bold">
              Paso {step!.order}: <span className="hi">{DEMO[a.kind]}</span>
            </p>
          </div>
        )}
        {!step && (
          <div className="pointer-events-none absolute right-3 top-3 rounded-xl border border-rule bg-panel/95 px-3.5 py-2.5 text-[13px] font-semibold text-ink-soft">
            Elige un paso para ver cómo se hace
          </div>
        )}
      </div>
    );
  };

  return (
    <StepsPanel
      steps={design.steps}
      labels={labels}
      viewer={viewer}
      detail={(st) => (
        <div className="mt-2 border-t border-rule pt-2">
          <span className="text-xs text-ink-faint">Herramienta</span>
          <p className="mt-0.5 text-[11px] leading-snug text-ink-soft">{st.tools.map((t) => toolLabel(design, t)).join(' · ')}</p>
        </div>
      )}
    />
  );
}

/** What to buy and what to have on hand, shareable as plain text. */
export function WeldShopping({ design, title, stale }: { design: WeldDesign; title: string; stale: boolean }) {
  const bars = useMemo(() => planBars(design.members), [design]);
  const groups = useMemo(() => shoppingList(design, bars), [design, bars]);
  const text = useMemo(() => shoppingText(design, title, bars), [design, title, bars]);
  const [status, setStatus] = useState<string | null>(null);
  const canShare = typeof navigator.share === 'function';

  async function share() {
    try {
      await navigator.share({ title: `Lista de compras — ${title}`, text });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setStatus('No se pudo compartir');
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Copiado');
    } catch {
      setStatus('No se pudo copiar');
    }
  }

  return (
    <div className={`relative bg-paper px-4 py-5 transition-opacity lg:h-full lg:overflow-y-auto lg:px-8 lg:py-7 duration-300 ${stale ? 'opacity-40' : ''}`}>
      <div className="mx-auto max-w-[1200px]">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="display text-2xl">Lista de compras</h2>
            <p className="mt-1 text-sm text-ink-soft">
              {title} · ferretería y tienda de aceros
            </p>
          </div>
          <div className="flex items-center gap-2">
            {status && (
              <span role="status" className="text-[13px] font-semibold text-ink-soft">
                {status}
              </span>
            )}
            {canShare && (
              <button
                onClick={share}
                disabled={stale}
                className="h-10 rounded-lg bg-accent px-4 text-sm font-bold text-white transition-[filter] hover:brightness-110 disabled:pointer-events-none disabled:opacity-50"
              >
                Compartir
              </button>
            )}
            <button
              onClick={copy}
              disabled={stale}
              className="h-10 rounded-lg border border-rule bg-panel px-4 text-sm font-bold text-ink transition-colors hover:border-ink-soft disabled:pointer-events-none disabled:opacity-50"
            >
              Copiar
            </button>
          </div>
        </header>

        <div className="mt-8 flex flex-col gap-10 lg:flex-row lg:items-start">
          <section className="min-w-0 flex-1 space-y-8">
            {groups.map((g) => (
              <div key={g.title}>
                <h3 className="rule-label">{g.title}</h3>
                <div className="overflow-x-auto"><table className="mt-3 w-full text-sm">
                  <tbody>
                    {g.lines.map((l) => (
                      <tr key={l.label} className="border-b border-rule align-top">
                        <td className="py-2 pr-4">
                          {l.label}
                          {l.note && <div className="mt-0.5 text-xs text-ink-soft">{l.note}</div>}
                        </td>
                        <td className="whitespace-nowrap py-2 text-right font-mono text-xs tabular-nums">{l.qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              </div>
            ))}
          </section>

          <section className="w-full space-y-8 lg:w-96 lg:shrink-0">
            <SettingsCard design={design} />
            <div>
              <h3 className="rule-label">Herramienta</h3>
              <ul className="mt-3 space-y-1.5 text-sm">
                {design.tools.map((t) => (
                  <li key={t} className="flex gap-2">
                    <span aria-hidden className="mt-2 h-1 w-1 shrink-0 bg-accent" />
                    {toolLabel(design, t)}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="rule-label">Seguridad</h3>
              <ul className="mt-3 space-y-1.5 text-sm">
                {SAFETY_GEAR.map((s) => (
                  <li key={s} className="flex gap-2">
                    <span aria-hidden className="mt-2 h-1 w-1 shrink-0 bg-accent" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </div>
      {stale && <StaleBadge />}
    </div>
  );
}

/** Build report for printing (Exportar PDF) in metal mode. */
export function WeldPrintReport({ design, title }: { design: WeldDesign | null; title: string }) {
  const bars = useMemo(() => (design ? planBars(design.members) : []), [design]);
  if (!design) return null;
  const groups = shoppingList(design, bars);
  return (
    <div className="hidden print:block">
      <section className="break-after-page">
        <h1 className="display text-3xl font-extrabold">{title}</h1>
        <p className="mt-1 font-mono text-[11px] text-ink-soft">
          {design.tube.label} · {design.process.label} · {design.finish.label} · ≈ {design.weight} kg
        </p>
        <SettingsCard design={design} className="mt-5 break-inside-avoid" />
        <h2 className="mt-6 border-b border-ink pb-1 display text-lg font-bold">Cortes</h2>
        {bars.map((bar, b) => (
          <div key={b} className="mt-3 break-inside-avoid">
            <p className="font-mono text-[11px] text-ink-soft">Tramo {b + 1}</p>
            <BarSvg bar={bar} side={design.tube.side} />
            <p className="text-sm">
              {bar.pieces.map((p, i) => `${i + 1}. ${p.label} ${p.length} mm a ${ENDS[p.ends]}`).join(' · ')}
            </p>
          </div>
        ))}
      </section>
      <section className="break-after-page">
        <h2 className="border-b border-ink pb-1 display text-lg font-bold">Lista de compras</h2>
        {groups.map((g) => (
          <div key={g.title} className="mt-3 break-inside-avoid">
            <h3 className="text-xs text-ink-soft">{g.title}</h3>
            <ul className="mt-1 text-sm">
              {g.lines.map((l) => (
                <li key={l.label}>
                  {l.label}: <strong className="font-mono">{l.qty}</strong>
                  {l.note && <span className="text-ink-soft"> — {l.note}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <h3 className="mt-4 text-xs text-ink-soft">Herramienta y seguridad</h3>
        <p className="mt-1 text-sm">{[...design.tools.map((t) => toolLabel(design, t)), ...SAFETY_GEAR].join(' · ')}</p>
      </section>
      <section>
        <h2 className="border-b border-ink pb-1 display text-lg font-bold">Pasos</h2>
        <ol className="mt-3 space-y-3">
          {design.steps.map((s) => (
            <li key={s.order} className="break-inside-avoid">
              <strong className="display text-base">
                {s.order}. {s.title}
              </strong>
              <p className="text-sm">{s.description}</p>
              <p className="font-mono text-[11px] text-ink-soft">{s.tools.map((t) => toolLabel(design, t)).join(' · ')}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
