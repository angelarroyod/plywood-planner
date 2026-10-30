import { useMemo, useState } from 'react';
import { missingPricesText, orderCost } from '../engine/cost.ts';
import { CUT_TIP, cutText, cutTotals, sheetCuts } from '../engine/cuts.ts';
import { nest } from '../engine/nesting.ts';
import { buildOrder } from '../engine/order.ts';
import { EDGE_BANDING_NOTE, edgeBandTotals, edgeCodes } from '../engine/edge-banding.ts';
import { DEFAULT_CONFIG } from '../engine/types.ts';
import type { Design } from '../engine/types.ts';
import { useAppStore } from '../state/store.ts';
import { SheetSvg } from './SheetSvg.tsx';
import { hardwareText } from '../engine/labels.ts';

export function CutDiagram({ design }: { design: Design }) {
  const layout = useMemo(() => nest(design.panels), [design]);
  const prices = useAppStore((s) => s.prices);
  const setView = useAppStore((s) => s.setView);
  // the list and the sheets are one space: hovering either lights the other
  const [lit, setLit] = useState<string | null>(null);
  // title is unused by orderCost; prices are edited in the Pedido tab
  const cost = orderCost(buildOrder(design, layout, ''), prices);
  const cuts = cutTotals(layout);
  const labels = useMemo(
    () => Object.fromEntries(design.panels.map((p) => [p.id, p.label])),
    [design],
  );
  const edges = useMemo(
    () => Object.fromEntries(design.panels.map((p) => [p.id, p.edges])),
    [design],
  );
  const longest = Math.max(...design.panels.map((p) => p.length));
  const bandTotals = edgeBandTotals(design.panels);
  const banded = design.edgeBanding !== 'none';

  const summary = [
    {
      label: 'Hojas',
      value: String(layout.sheets.length),
      unit: layout.byStock.length === 1 ? layout.byStock[0]!.stock.label : `${layout.byStock.length} materiales`,
    },
    ...layout.byStock.map((g) => ({ label: 'Desperdicio', value: `${g.wastePercent.toFixed(1)} %`, unit: g.stock.label })),
    { label: 'Cortes', value: String(cuts.count), unit: `${cuts.meters.toFixed(1)} m lineales` },
    {
      label: 'Costo',
      value: cost.total > 0 ? `$${Math.round(cost.total)}` : '—',
      unit: cost.missing > 0 ? missingPricesText(cost.missing) : 'MXN estimado',
    },
  ];

  return (
    <div className="bg-paper px-4 py-5 lg:h-full lg:overflow-y-auto lg:px-8 lg:py-7">
      <div className="mx-auto max-w-[1400px]">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="display text-2xl">Plan de corte</h2>
            <p className="mt-1 text-sm text-ink-soft">Medidas en mm · sierra de {DEFAULT_CONFIG.nesting.kerf} mm</p>
          </div>
          <button
            onClick={() => setView('order')}
            className="h-10 rounded-lg border border-rule bg-panel px-3.5 text-sm font-semibold text-ink-soft transition-colors hover:border-rule-strong hover:text-ink"
          >
            Editar precios
          </button>
        </header>

        <dl className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:gap-0 sm:divide-x sm:divide-rule sm:rounded-xl sm:border sm:border-rule sm:bg-panel">
          {summary.map((s, i) => (
            <div key={i} className="min-w-0 rounded-lg border border-rule bg-panel px-4 py-3 sm:flex-1 sm:rounded-none sm:border-0 sm:bg-transparent">
              <dt className="text-[13px] font-semibold text-ink-soft">{s.label}</dt>
              <dd className="mt-0.5 font-mono text-2xl font-bold">{s.value}</dd>
              <dd className="truncate text-xs text-ink-faint" title={s.unit}>
                {s.unit}
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-4 max-w-2xl text-[13px] leading-relaxed text-ink-soft">{CUT_TIP}</p>

        <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-start">
          <section className="stage-grid flex min-w-0 flex-1 flex-wrap justify-center gap-8 rounded-2xl border border-rule p-5 lg:justify-start">
            {layout.sheets.map((sheet, i) => (
              <figure key={i} className="w-[15rem]">
                <SheetSvg
                  sheet={sheet}
                  labels={labels}
                  edges={edges}
                  highlight={lit}
                  onPiece={setLit}
                  className="h-[30rem] w-full rounded-md shadow-[0_2px_10px_rgb(20_26_43/0.12)]"
                />
                <figcaption className="mt-2.5 text-center text-[13px] font-semibold">
                  Hoja {i + 1} · {sheet.stock.label}
                  {sheet.stock.hasGrain && <span className="font-normal text-ink-soft"> · veta a lo largo</span>}
                </figcaption>
                <ol className="mt-2 space-y-0.5 rounded-lg bg-panel/90 p-2.5 text-[13px] leading-snug text-ink-soft">
                  {sheetCuts(sheet).map((c) => (
                    <li key={c.n}>
                      <span className="font-mono font-bold text-cut-ink">{c.n}.</span> {cutText(c)}
                    </li>
                  ))}
                </ol>
              </figure>
            ))}
          </section>

          <section className="w-full space-y-8 lg:w-80 lg:shrink-0">
            <div>
              <h3 className="rule-label">Piezas</h3>
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="border-b border-rule-strong text-left text-xs text-ink-soft">
                    <th className="pb-1.5 font-semibold">Pieza</th>
                    <th className="pb-1.5 font-semibold">mm</th>
                    {banded && <th className="pb-1.5 font-semibold">Canto</th>}
                    <th className="pb-1.5 text-right font-semibold">Cant.</th>
                  </tr>
                </thead>
                <tbody>
                  {design.panels.map((p) => (
                    <tr
                      key={p.id}
                      onPointerEnter={() => setLit(p.id)}
                      onPointerLeave={() => setLit(null)}
                      className={`border-b border-rule transition-colors ${lit === p.id ? 'bg-accent-tint' : ''}`}
                    >
                      <td className="py-2 pr-2">{p.label}</td>
                      <td className="py-2 pr-2 font-mono text-xs text-ink-soft">
                        {p.length} × {p.width} × {p.stock.thickness}
                        {/* true-scale length against the longest piece */}
                        <span
                          aria-hidden
                          className="mt-1 block h-1 rounded-full bg-accent/70"
                          style={{ width: `${(p.length / longest) * 100}%` }}
                        />
                      </td>
                      {banded && <td className="py-2 pr-2 font-mono text-xs text-ink-soft">{edgeCodes(p.edges)}</td>}
                      <td className="py-2 text-right font-mono text-[13px] font-bold">{p.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <h3 className="rule-label">Herrajes</h3>
              <ul className="mt-3 space-y-1.5 text-sm">
                {design.hardware.map((h, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-2">
                    <span>{hardwareText(h)}</span>
                    <span className="font-mono text-[13px] font-bold text-accent-ink">×{h.qty}</span>
                  </li>
                ))}
              </ul>
            </div>

            {bandTotals.length > 0 && design.edgeBanding !== 'none' && (
              <div>
                <h3 className="rule-label">Cubrecanto</h3>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {bandTotals.map((t) => (
                    <li key={t.label} className="flex items-baseline justify-between gap-2">
                      <span>{t.label}</span>
                      <span className="font-mono text-[13px] font-bold text-accent-ink">{t.meters.toFixed(1)} m</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[13px] text-ink-soft">{EDGE_BANDING_NOTE[design.edgeBanding]}</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
