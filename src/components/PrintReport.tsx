import { useMemo } from 'react';
import { estimateCost, nest } from '../engine/nesting.ts';
import { templates } from '../engine/index.ts';
import type { Design } from '../engine/types.ts';
import { useAppStore } from '../state/store.ts';
import { SheetSvg } from './SheetSvg.tsx';
import { HARDWARE_LABELS } from './labels.ts';

/** Full build report. Hidden on screen; becomes the document when printing (Exportar PDF). */
export function PrintReport({ design }: { design: Design | null }) {
  const price = useAppStore((s) => s.pricePerSheet);
  const layout = useMemo(() => (design ? nest(design.panels) : null), [design]);
  if (!design || !layout) return null;

  const template = templates.find((t) => t.id === design.templateId);
  const labels = Object.fromEntries(design.panels.map((p) => [p.id, p.label]));
  const paramLine = template?.params
    .map((s) => `${s.label}: ${design.params[s.key] ?? s.default}${s.unit ? ` ${s.unit}` : ''}`)
    .join(' · ');

  return (
    <div className="hidden print:block">
      <h1 className="display text-3xl font-extrabold">{template?.name ?? design.templateId}</h1>
      <p className="mt-1 font-mono text-[11px] text-ink-soft">{paramLine}</p>

      <h2 className="mt-7 border-b border-ink pb-1 display text-lg font-bold">Lista de cortes</h2>
      <table className="mt-2 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink/40 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
            <th className="py-1">Pieza</th>
            <th>Largo × ancho × grosor (mm)</th>
            <th>Cantidad</th>
          </tr>
        </thead>
        <tbody>
          {design.panels.map((p) => (
            <tr key={p.id} className="border-b border-rule">
              <td className="py-1">{p.label}</td>
              <td className="font-mono text-xs tabular-nums">
                {p.length} × {p.width} × {p.thickness}
              </td>
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
        Hojas de triplay: {layout.sheets.length} (1220 × 2440 mm) · desperdicio{' '}
        {layout.wastePercent.toFixed(1)}%
        {price > 0 ? ` · costo estimado de triplay $${estimateCost(layout, price).toFixed(2)} MXN` : ''}
      </p>

      <h2 className="mt-7 border-b border-ink pb-1 display text-lg font-bold">Plan de corte</h2>
      <div className="mt-2 flex flex-wrap gap-4">
        {layout.sheets.map((sheet, i) => (
          <figure key={i} className="break-inside-avoid">
            <SheetSvg sheet={sheet} labels={labels} className="h-[26rem] border border-rule" />
            <figcaption className="mt-1 text-xs">
              Hoja {i + 1} — triplay de {sheet.thickness} mm · veta a lo largo
            </figcaption>
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
