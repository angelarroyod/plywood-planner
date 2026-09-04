import { useMemo, type ReactNode } from 'react';
import { estimateCost, nest } from '../engine/nesting.ts';
import type { Design } from '../engine/types.ts';
import { useAppStore } from '../state/store.ts';
import { SheetSvg } from './SheetSvg.tsx';
import { HARDWARE_LABELS } from './labels.ts';

export function CutDiagram({ design }: { design: Design }) {
  const layout = useMemo(() => nest(design.panels), [design]);
  const price = useAppStore((s) => s.pricePerSheet);
  const setPrice = useAppStore((s) => s.setPricePerSheet);
  const labels = useMemo(
    () => Object.fromEntries(design.panels.map((p) => [p.id, p.label])),
    [design],
  );

  return (
    <div className="h-full overflow-y-auto bg-panel px-8 py-7">
      <div className="mx-auto max-w-[1400px]">
        <header>
          <h2 className="display text-2xl font-extrabold">Plan de corte</h2>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
            Hoja 1220 × 2440 mm · veta a lo largo · sierra 3 mm
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Stat label="Hojas" value={String(layout.sheets.length)} unit="triplay" />
            <Stat
              label="Desperdicio"
              value={`${layout.wastePercent.toFixed(1)}%`}
              unit="del material"
            >
              <span className="mt-2 block h-1 w-full overflow-hidden rounded-full bg-rule">
                <span
                  className="block h-full rounded-full bg-cut"
                  style={{ width: `${Math.min(100, layout.wastePercent)}%` }}
                />
              </span>
            </Stat>
            <Stat
              label="Costo triplay"
              value={price > 0 ? `$${estimateCost(layout, price).toFixed(0)}` : '—'}
              unit={price > 0 ? 'MXN estimado' : 'define precio'}
            />
          </div>
        </header>

        <div className="mt-8 flex flex-wrap items-start gap-10">
          <section className="flex flex-wrap gap-6">
            {layout.sheets.map((sheet, i) => (
              <figure key={i}>
                <SheetSvg
                  sheet={sheet}
                  labels={labels}
                  className="h-[30rem] rounded-md border border-rule bg-panel shadow-[3px_3px_0_0_var(--color-rule)]"
                />
                <figcaption className="mt-2 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">
                  Hoja {i + 1} — {sheet.thickness} mm
                </figcaption>
              </figure>
            ))}
          </section>

          <section className="w-80 shrink-0 space-y-8">
            <div>
              <h3 className="rule-label">Lista de cortes</h3>
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="border-b border-rule-strong text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                    <th className="pb-1.5 font-medium">Pieza</th>
                    <th className="pb-1.5 font-medium">mm</th>
                    <th className="pb-1.5 text-right font-medium">Cant.</th>
                  </tr>
                </thead>
                <tbody>
                  {design.panels.map((p) => (
                    <tr key={p.id} className="border-b border-rule/70">
                      <td className="py-1.5 pr-2">{p.label}</td>
                      <td className="py-1.5 font-mono text-xs tabular-nums text-ink-soft">
                        {p.length} × {p.width} × {p.thickness}
                      </td>
                      <td className="py-1.5 text-right font-mono text-xs tabular-nums">{p.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <h3 className="rule-label">Tornillería</h3>
              <ul className="mt-3 space-y-1.5 text-sm">
                {design.hardware.map((h, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-2">
                    <span>
                      {HARDWARE_LABELS[h.type]}{' '}
                      <span className="font-mono text-xs text-ink-soft">{h.size}</span>
                    </span>
                    <span className="font-mono text-xs tabular-nums text-ply-deep">×{h.qty}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="rule-label">Costo</h3>
              <label
                className="mt-3 block font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft"
                htmlFor="price"
              >
                Precio por hoja (MXN)
              </label>
              <input
                id="price"
                type="number"
                min={0}
                value={price || ''}
                onChange={(e) => setPrice(Number(e.target.value) || 0)}
                className="mt-1.5 w-full rounded-md border border-rule bg-panel px-2.5 py-2 font-mono text-sm tabular-nums transition-colors focus:border-cut focus:outline-none"
                placeholder="950"
              />
              {price > 0 && (
                <p className="mt-2 text-sm text-ink-soft">
                  {layout.sheets.length} × ${price} ={' '}
                  <strong className="font-mono text-ink">
                    ${estimateCost(layout, price).toFixed(2)} MXN
                  </strong>
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  children,
}: {
  label: string;
  value: string;
  unit: string;
  children?: ReactNode;
}) {
  return (
    <div className="min-w-[10rem] flex-1 rounded-lg border border-rule bg-panel px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">{label}</div>
      <div className="display mt-1 text-2xl font-extrabold tabular-nums">{value}</div>
      <div className="font-mono text-[10px] text-ink-faint">{unit}</div>
      {children}
    </div>
  );
}
