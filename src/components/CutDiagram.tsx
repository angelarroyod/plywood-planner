import { useMemo } from 'react';
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
    <div className="h-full overflow-y-auto p-6">
      <div className="flex flex-wrap gap-10">
        <section>
          <h2 className="font-semibold">Plan de corte — {layout.sheets.length} hoja(s)</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Hoja estándar 1220 × 2440 mm · veta a lo largo · sierra de 3 mm · desperdicio{' '}
            {layout.wastePercent.toFixed(1)}%
          </p>
          <div className="mt-4 flex flex-wrap gap-6">
            {layout.sheets.map((sheet, i) => (
              <figure key={i}>
                <SheetSvg
                  sheet={sheet}
                  labels={labels}
                  className="h-[28rem] rounded border border-neutral-300 bg-white"
                />
                <figcaption className="mt-1 text-center text-xs text-neutral-500">
                  Hoja {i + 1} — triplay de {sheet.thickness} mm
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="w-72 space-y-6">
          <div>
            <h2 className="font-semibold">Lista de cortes</h2>
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-300 text-left text-neutral-500">
                  <th className="py-1 font-medium">Pieza</th>
                  <th className="font-medium">mm</th>
                  <th className="font-medium">Cant.</th>
                </tr>
              </thead>
              <tbody>
                {design.panels.map((p) => (
                  <tr key={p.id} className="border-b border-neutral-100">
                    <td className="py-1">{p.label}</td>
                    <td className="tabular-nums">
                      {p.length} × {p.width} × {p.thickness}
                    </td>
                    <td className="tabular-nums">{p.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h2 className="font-semibold">Tornillería</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {design.hardware.map((h, i) => (
                <li key={i}>
                  {HARDWARE_LABELS[h.type]} {h.size} — {h.qty} piezas
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="font-semibold">Costo</h2>
            <label className="mt-2 block text-sm text-neutral-600" htmlFor="price">
              Precio por hoja (MXN)
            </label>
            <input
              id="price"
              type="number"
              min={0}
              value={price || ''}
              onChange={(e) => setPrice(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm"
              placeholder="p. ej. 950"
            />
            {price > 0 && (
              <p className="mt-2 text-sm">
                Costo estimado de triplay:{' '}
                <strong>${estimateCost(layout, price).toFixed(2)} MXN</strong>
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
