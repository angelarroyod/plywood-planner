import { useMemo } from 'react';
import { missingPricesText, orderCost } from '../engine/cost.ts';
import { CUT_TIP, cutText, sheetCuts } from '../engine/cuts.ts';
import { nest } from '../engine/nesting.ts';
import { ORDER_BAND_NOTE, buildOrder } from '../engine/order.ts';
import { EDGE_BANDING_NOTE, edgeBandTotals, edgeCodes } from '../engine/edge-banding.ts';
import { templates } from '../engine/index.ts';
import type { Design } from '../engine/types.ts';
import { useAppStore } from '../state/store.ts';
import { SheetSvg } from './SheetSvg.tsx';
import { HARDWARE_LABELS } from './labels.ts';

/** Full build report. Hidden on screen; becomes the document when printing (Exportar PDF). */
export function PrintReport({ design }: { design: Design | null }) {
  const prices = useAppStore((s) => s.prices);
  const layout = useMemo(() => (design ? nest(design.panels) : null), [design]);
  if (!design || !layout) return null;

  const template = templates.find((t) => t.id === design.templateId);
  const order = buildOrder(design, layout, template?.name ?? design.templateId);
  const cost = orderCost(order, prices);
  const labels = Object.fromEntries(design.panels.map((p) => [p.id, p.label]));
  const edges = Object.fromEntries(design.panels.map((p) => [p.id, p.edges]));
  const bandTotals = edgeBandTotals(design.panels);
  const banded = design.edgeBanding !== 'none';
  const paramLine = template?.params
    .map((s) => {
      const v = design.params[s.key] ?? s.default;
      const shown =
        s.kind === 'select'
          ? (s.options.find((o) => o.value === v)?.label ?? String(v))
          : `${v}${s.unit ? ` ${s.unit}` : ''}`;
      return `${s.label}: ${shown}`;
    })
    .join(' · ');

  return (
    <div className="hidden print:block">
      <section className="break-after-page">
        <h1 className="display text-3xl font-extrabold">Pedido para maderería — {order.title}</h1>
        <p className="mt-1 font-mono text-[11px] text-ink-soft">Medidas en mm: largo × ancho.</p>
        {order.groups.map((g) => (
          <div key={g.stock.id} className="break-inside-avoid">
            <h2 className="mt-6 border-b border-ink pb-1 display text-lg font-bold">
              {g.stock.label} — {g.sheets} {g.sheets === 1 ? 'hoja' : 'hojas'} de {g.stock.sheet.width} ×{' '}
              {g.stock.sheet.length}
            </h2>
            <table className="mt-2 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-ink/40 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                  <th className="py-1">#</th>
                  <th>Pieza</th>
                  <th>Largo</th>
                  <th>Ancho</th>
                  <th>Cant.</th>
                  <th>Veta</th>
                  <th>Cubrecanto</th>
                </tr>
              </thead>
              <tbody>
                {g.lines.map((l) => (
                  <tr key={l.n} className="border-b border-rule">
                    <td className="py-1 font-mono text-xs tabular-nums">{l.n}</td>
                    <td>{l.label}</td>
                    <td className="font-mono text-xs tabular-nums">{l.length}</td>
                    <td className="font-mono text-xs tabular-nums">{l.width}</td>
                    <td className="font-mono text-xs tabular-nums">{l.qty}</td>
                    <td className="font-mono text-xs">
                      {l.grain === 'length' ? 'largo' : l.grain === 'width' ? 'ancho' : '—'}
                    </td>
                    <td className="font-mono text-xs">{edgeCodes(l.edges)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        <ul className="mt-4 space-y-1 text-sm">
          {order.bands.map((b) => (
            <li key={b.label}>
              {b.label}: {b.meters.toFixed(1)} m
              {order.edgeBanding !== 'none' && ` — ${ORDER_BAND_NOTE[order.edgeBanding]}`}
            </li>
          ))}
          <li>
            Cortes: {order.cuts.count} ({order.cuts.meters.toFixed(1)} m lineales)
          </li>
          {order.hardware.map((h, i) => (
            <li key={i}>
              {HARDWARE_LABELS[h.type]} {h.size} × {h.qty}
            </li>
          ))}
        </ul>
        {cost.total > 0 && (
          <p className="mt-3 text-sm">
            Costo estimado: ${cost.total.toFixed(2)} MXN
            {cost.missing > 0 && ` (${missingPricesText(cost.missing)})`}
          </p>
        )}
      </section>
      <h1 className="display text-3xl font-extrabold">{template?.name ?? design.templateId}</h1>
      <p className="mt-1 font-mono text-[11px] text-ink-soft">{paramLine}</p>

      <h2 className="mt-7 border-b border-ink pb-1 display text-lg font-bold">Lista de cortes</h2>
      <table className="mt-2 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink/40 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
            <th className="py-1">Pieza</th>
            <th>Largo × ancho × grosor (mm)</th>
            {banded && <th>Cubrecanto</th>}
            <th>Cantidad</th>
          </tr>
        </thead>
        <tbody>
          {design.panels.map((p) => (
            <tr key={p.id} className="border-b border-rule">
              <td className="py-1">{p.label}</td>
              <td className="font-mono text-xs tabular-nums">
                {p.length} × {p.width} × {p.stock.thickness}
              </td>
              {banded && <td className="font-mono text-xs">{edgeCodes(p.edges)}</td>}
              <td className="font-mono text-xs tabular-nums">{p.qty}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mt-7 border-b border-ink pb-1 display text-lg font-bold">Tornillería</h2>
      <ul className="mt-2 list-disc pl-5 text-sm">
        {design.hardware.map((h, i) => (
          <li key={i}>
            {HARDWARE_LABELS[h.type]} {h.size} — {h.qty} piezas
          </li>
        ))}
      </ul>

      <p className="mt-3 text-sm">
        Hojas:{' '}
        {layout.byStock
          .map(
            (g) =>
              `${g.sheets} de ${g.stock.label.toLowerCase()} (${g.stock.sheet.width} × ${g.stock.sheet.length} mm, ` +
              `desperdicio ${g.wastePercent.toFixed(1)}%)`,
          )
          .join(' · ')}
      </p>

      {bandTotals.length > 0 && design.edgeBanding !== 'none' && (
        <>
          <h2 className="mt-7 border-b border-ink pb-1 display text-lg font-bold">Cubrecanto</h2>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {bandTotals.map((t) => (
              <li key={t.label}>
                {t.label} — {t.meters.toFixed(1)} m
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-ink-soft">{EDGE_BANDING_NOTE[design.edgeBanding]}</p>
        </>
      )}

      <h2 className="mt-7 border-b border-ink pb-1 display text-lg font-bold">Plan de corte</h2>
      <p className="mt-1 text-xs text-ink-soft">{CUT_TIP}</p>
      <div className="mt-2 flex flex-wrap gap-4">
        {layout.sheets.map((sheet, i) => (
          <figure key={i} className="break-inside-avoid">
            <SheetSvg sheet={sheet} labels={labels} edges={edges} className="h-[26rem] border border-rule" />
            <figcaption className="mt-1 text-xs">
              Hoja {i + 1} — {sheet.stock.label}
              {sheet.stock.hasGrain ? ' · veta a lo largo' : ''}
            </figcaption>
            <ol className="mt-1 space-y-0.5 font-mono text-[10px] tabular-nums">
              {sheetCuts(sheet).map((c) => (
                <li key={c.n}>
                  {c.n}. {cutText(c)}
                </li>
              ))}
            </ol>
          </figure>
        ))}
      </div>

      <h2 className="mt-7 break-before-page border-b border-ink pb-1 display text-lg font-bold">Pasos de armado</h2>
      <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
        {design.steps.map((st) => (
          <li key={st.order} className="break-inside-avoid">
            <span className="font-medium">{st.title}.</span> {st.description}
          </li>
        ))}
      </ol>
    </div>
  );
}
