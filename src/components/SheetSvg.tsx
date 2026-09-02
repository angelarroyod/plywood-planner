import type { NestingConfig, SheetLayout } from '../engine/types.ts';
import { DEFAULT_CONFIG } from '../engine/types.ts';

interface Props {
  sheet: SheetLayout;
  labels: Record<string, string>; // panelId → Spanish label
  className?: string;
  config?: NestingConfig;
}

const MONO = 'IBM Plex Mono, ui-monospace, monospace';

/** One plywood sheet as SVG, 1 SVG unit = 1 mm. Shared by screen view and print report. */
export function SheetSvg({ sheet, labels, className, config = DEFAULT_CONFIG.nesting }: Props) {
  const { sheetWidth: w, sheetLength: h } = config;
  const tick = 90; // corner registration mark length

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} role="img" aria-label="Plan de corte">
      <defs>
        {/* ponytail: fixed id — several sheets render per page but the pattern is identical */}
        <pattern id="ply-grain" width="26" height="26" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="26" stroke="#8a5a25" strokeWidth="2.5" />
        </pattern>
      </defs>

      <rect x={0} y={0} width={w} height={h} fill="#faf6ef" stroke="#c9bda6" strokeWidth={6} />

      {sheet.pieces.map((p) => (
        <g key={`${p.panelId}-${p.instance}`}>
          <rect
            x={p.x}
            y={p.y}
            width={p.width}
            height={p.length}
            fill="#e9c186"
            stroke="#8a5a25"
            strokeWidth={5}
          />
          <text
            x={p.x + p.width / 2}
            y={p.y + p.length / 2 - 10}
            fontSize={42}
            fontFamily={MONO}
            fontWeight={600}
            textAnchor="middle"
            fill="#3d2a11"
          >
            {labels[p.panelId] ?? p.panelId} #{p.instance + 1}
          </text>
          <text
            x={p.x + p.width / 2}
            y={p.y + p.length / 2 + 40}
            fontSize={34}
            fontFamily={MONO}
            textAnchor="middle"
            fill="#8a5a25"
          >
            {p.width} × {p.length}
          </text>
        </g>
      ))}

      {/* Grain runs the full 2440 mm length and does not stop at cut lines. */}
      <rect x={0} y={0} width={w} height={h} fill="url(#ply-grain)" opacity={0.14} />

      {[
        [0, 0, 1, 1],
        [w, 0, -1, 1],
        [0, h, 1, -1],
        [w, h, -1, -1],
      ].map(([x, y, sx, sy], i) => (
        <path
          key={i}
          d={`M ${x! + sx! * tick} ${y} H ${x} V ${y! + sy! * tick}`}
          stroke="#1d1913"
          strokeWidth={7}
          fill="none"
        />
      ))}

      <text
        x={26}
        y={h / 2}
        fontSize={40}
        fontFamily={MONO}
        fill="#75695a"
        letterSpacing={10}
        textAnchor="middle"
        transform={`rotate(-90 26 ${h / 2})`}
      >
        ↑ VETA
      </text>
    </svg>
  );
}
