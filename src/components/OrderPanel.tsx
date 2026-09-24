import { useMemo, useState } from 'react';
import { missingPricesText, orderCost } from '../engine/cost.ts';
import { edgeCodes } from '../engine/edge-banding.ts';
import { nest } from '../engine/nesting.ts';
import { ORDER_BAND_NOTE, buildOrder, orderText } from '../engine/order.ts';
import type { Design } from '../engine/types.ts';
import { useAppStore } from '../state/store.ts';
import { HARDWARE_LABELS } from './labels.ts';

const GRAIN_LABEL = { length: 'largo', width: 'ancho' } as const;

/** The lumber-yard order: what to ask for, shared as text, plus the full cost from the user's prices. */
export function OrderPanel({ design, title, stale }: { design: Design; title: string; stale: boolean }) {
  const order = useMemo(() => buildOrder(design, nest(design.panels), title), [design, title]);
  const text = useMemo(() => orderText(order), [order]);
  const prices = useAppStore((s) => s.prices);
  const setSheetPrice = useAppStore((s) => s.setSheetPrice);
  const setCutPrice = useAppStore((s) => s.setCutPrice);
  const setCutUnit = useAppStore((s) => s.setCutUnit);
  const setBandPrice = useAppStore((s) => s.setBandPrice);
  const setHardwarePrice = useAppStore((s) => s.setHardwarePrice);
  const cost = orderCost(order, prices);
  const [status, setStatus] = useState<string | null>(null);

  const canShare = typeof navigator.share === 'function';

  async function share() {
    try {
      await navigator.share({ title: `Pedido — ${title}`, text });
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

  function setPriceByKey(key: string, value: number) {
    if (key.startsWith('sheet:')) setSheetPrice(Number(key.slice('sheet:'.length)), value);
    else if (key === 'cut') setCutPrice(value);
    else if (key.startsWith('band:')) setBandPrice(key.slice('band:'.length), value);
    else if (key.startsWith('hw:')) setHardwarePrice(key.slice('hw:'.length), value);
  }

  return (
    <div
      className={`relative h-full overflow-y-auto bg-panel px-8 py-7 transition-opacity duration-300 ${
        stale ? 'opacity-40' : ''
      }`}
    >
      <div className="mx-auto max-w-[1200px]">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="display text-2xl font-extrabold">Pedido para maderería</h2>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
              {title} · medidas en mm, largo × ancho
            </p>
          </div>
          <div className="flex items-center gap-2">
            {status && (
              <span role="status" className="font-mono text-[11px] text-ink-soft">
                {status}
              </span>
            )}
            {canShare && (
              <button
                onClick={share}
                disabled={stale}
                className="rounded-md bg-cut px-4 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-white transition-[filter] hover:brightness-110 disabled:pointer-events-none disabled:opacity-50"
              >
                Compartir
              </button>
            )}
            <button
              onClick={copy}
              disabled={stale}
              className="rounded-md border border-rule bg-raised px-4 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink transition-colors hover:border-ink-soft disabled:pointer-events-none disabled:opacity-50"
            >
              Copiar
            </button>
          </div>
        </header>

        <div className="mt-8 flex flex-wrap items-start gap-10">
          <section className="min-w-0 flex-1 space-y-8">
            {order.groups.map((g) => (
              <div key={g.stock.id}>
                <h3 className="rule-label">
                  {g.stock.label} — {g.sheets} {g.sheets === 1 ? 'hoja' : 'hojas'}
                </h3>
                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr className="border-b border-rule-strong text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                      <th className="pb-1.5 font-medium">#</th>
                      <th className="pb-1.5 font-medium">Pieza</th>
                      <th className="pb-1.5 text-right font-medium">Largo</th>
                      <th className="pb-1.5 text-right font-medium">Ancho</th>
                      <th className="pb-1.5 text-right font-medium">Cant.</th>
                      <th className="pb-1.5 pl-4 font-medium">Veta</th>
                      <th className="pb-1.5 font-medium">Cubrecanto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.lines.map((l) => (
                      <tr key={l.n} className="border-b border-rule/70">
                        <td className="py-1.5 pr-2 font-mono text-xs tabular-nums text-ink-soft">{l.n}</td>
                        <td className="py-1.5 pr-2">{l.label}</td>
                        <td className="py-1.5 text-right font-mono text-xs tabular-nums">{l.length}</td>
                        <td className="py-1.5 text-right font-mono text-xs tabular-nums">{l.width}</td>
                        <td className="py-1.5 text-right font-mono text-xs tabular-nums">{l.qty}</td>
                        <td className="py-1.5 pl-4 font-mono text-xs text-ink-soft">
                          {l.grain ? GRAIN_LABEL[l.grain] : '—'}
                        </td>
                        <td className="py-1.5 font-mono text-xs text-ink-soft">{edgeCodes(l.edges)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

            <div>
              <h3 className="rule-label">Totales</h3>
              <ul className="mt-3 space-y-1.5 text-sm">
                {order.bands.map((b) => (
                  <li key={b.label}>
                    {b.label}: <span className="font-mono tabular-nums">{b.meters.toFixed(1)} m</span>
                    {order.edgeBanding !== 'none' && (
                      <span className="text-ink-soft"> — {ORDER_BAND_NOTE[order.edgeBanding]}</span>
                    )}
                  </li>
                ))}
                <li>
                  Cortes:{' '}
                  <span className="font-mono tabular-nums">
                    {order.cuts.count} ({order.cuts.meters.toFixed(1)} m lineales)
                  </span>
                </li>
                {order.hardware.map((h, i) => (
                  <li key={i}>
                    {HARDWARE_LABELS[h.type]} {h.size}: <span className="font-mono tabular-nums">× {h.qty}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="w-96 shrink-0">
            <h3 className="rule-label">Costo</h3>
            <p className="mt-2 text-xs text-ink-soft">Precios de tu maderería en MXN. Se guardan en este navegador.</p>
            <ul className="mt-4 space-y-3">
              {cost.lines.map((l) => (
                <li key={l.key}>
                  <div className="flex items-baseline justify-between gap-2">
                    <label htmlFor={`price-${l.key}`} className="text-sm">
                      {l.label}
                    </label>
                    {l.key === 'cut' && (
                      <div role="group" aria-label="Cobro del corte" className="flex gap-1">
                        {(['meter', 'cut'] as const).map((u) => (
                          <button
                            key={u}
                            onClick={() => setCutUnit(u)}
                            aria-pressed={prices.cut.unit === u}
                            className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
                              prices.cut.unit === u
                                ? 'border-cut bg-cut text-white'
                                : 'border-rule bg-panel text-ink-soft hover:border-ink-soft'
                            }`}
                          >
                            {u === 'meter' ? 'por metro' : 'por corte'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="font-mono text-xs text-ink-soft">$</span>
                    {/* uncontrolled so values like "0.5" can be typed without the store eating the "0." */}
                    <input
                      id={`price-${l.key}`}
                      type="number"
                      min={0}
                      step="any"
                      defaultValue={l.price ?? ''}
                      onChange={(e) => setPriceByKey(l.key, Number(e.target.value) || 0)}
                      placeholder="0"
                      className="w-28 rounded-md border border-rule bg-panel px-2.5 py-1.5 font-mono text-sm tabular-nums transition-colors focus:border-cut focus:outline-none"
                    />
                    <span className="font-mono text-xs text-ink-soft">por {l.unit}</span>
                    <span className="ml-auto font-mono text-xs tabular-nums text-ink-soft">
                      × {l.qty}
                      {l.subtotal !== null && <> = ${l.subtotal.toFixed(2)}</>}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-5 border-t border-rule pt-3 text-sm">
              Total: <strong className="font-mono text-ink">${cost.total.toFixed(2)} MXN</strong>
              {cost.missing > 0 && <span className="text-ink-soft"> ({missingPricesText(cost.missing)})</span>}
            </p>
          </section>
        </div>
      </div>

      {stale && (
        <div className="pointer-events-none absolute inset-x-0 top-5 flex justify-center">
          <span className="rounded-full border border-cut bg-cut-tint px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-cut">
            Corrige los errores para actualizar el modelo
          </span>
        </div>
      )}
    </div>
  );
}
