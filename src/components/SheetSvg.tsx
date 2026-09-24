import type { SheetLayout } from '../engine/types.ts';

interface Props {
  sheet: SheetLayout;
  labels: Record<string, string>; // panelId → Spanish label
  className?: string;
}

const MONO = 'Roboto Mono, ui-monospace, monospace';

/** One sheet as SVG, 1 SVG unit = 1 mm, sized by its stock. Shared by screen view and print report. */
export function SheetSvg({ sheet, labels, className }: Props) {
  const { width: w, length: h } = sheet.stock.sheet;
  const tick = 90; // corner registration mark length

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} role="img" aria-label={`Plan de corte — ${sheet.stock.label}`}>
      <defs>
        {/* ponytail: fixed id — several sheets render per page but the pattern is identical */}
        <pattern id="ply-grain" width="26" height="26" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="26" stroke="var(--color-grain)" strokeWidth="2.5" />
        </pattern>
      </defs>

      <rect
        x={0}
        y={0}
        width={w}
        height={h}
        fill="var(--color-sheet)"
        stroke="var(--color-sheet-edge)"
        strokeWidth={6}
      />

      {sheet.pieces.map((p) => (
        <g key={`${p.panelId}-${p.instance}`}>
          <rect
            x={p.x}
            y={p.y}
            width={p.width}
            height={p.length}
            fill="var(--color-piece)"
            stroke="var(--color-piece-edge)"
            strokeWidth={5}
          />
          <text
            x={p.x + p.width / 2}
            y={p.y + p.length / 2 - 10}
            fontSize={42}
            fontFamily={MONO}
            fontWeight={600}
            textAnchor="middle"
            fill="var(--color-piece-label)"
          >
            {labels[p.panelId] ?? p.panelId} #{p.instance + 1}
          </text>
          <text
            x={p.x + p.width / 2}
            y={p.y + p.length / 2 + 40}
            fontSize={34}
            fontFamily={MONO}
            textAnchor="middle"
            fill="var(--color-piece-dims)"
          >
            {p.width} × {p.length}
          </text>
        </g>
      ))}

      {/* Grain runs the full sheet length and does not stop at cut lines. Grain-free boards get none. */}
      {sheet.stock.hasGrain && (
        <rect x={0} y={0} width={w} height={h} fill="url(#ply-grain)" opacity={0.14} />
      )}

      {[
        [0, 0, 1, 1],
        [w, 0, -1, 1],
        [0, h, 1, -1],
        [w, h, -1, -1],
      ].map(([x, y, sx, sy], i) => (
        <path
          key={i}
          d={`M ${x! + sx! * tick} ${y} H ${x} V ${y! + sy! * tick}`}
          stroke="var(--color-mark)"
          strokeWidth={7}
          fill="none"
        />
      ))}

      {sheet.stock.hasGrain && (
        <text
          x={26}
          y={h / 2}
          fontSize={40}
          fontFamily={MONO}
          fill="var(--color-ink-faint)"
          letterSpacing={10}
          textAnchor="middle"
          transform={`rotate(-90 26 ${h / 2})`}
        >
          ↑ VETA
        </text>
      )}
    </svg>
  );
}
