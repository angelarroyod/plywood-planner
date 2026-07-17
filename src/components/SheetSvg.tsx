import type { NestingConfig, SheetLayout } from '../engine/types.ts';
import { DEFAULT_CONFIG } from '../engine/types.ts';

interface Props {
  sheet: SheetLayout;
  labels: Record<string, string>; // panelId → Spanish label
  className?: string;
  config?: NestingConfig;
}

/** One plywood sheet as SVG, 1 SVG unit = 1 mm. Shared by screen view and print report. */
export function SheetSvg({ sheet, labels, className, config = DEFAULT_CONFIG.nesting }: Props) {
  return (
    <svg
      viewBox={`0 0 ${config.sheetWidth} ${config.sheetLength}`}
      className={className}
      role="img"
      aria-label="Plan de corte"
    >
      <rect
        x={0}
        y={0}
        width={config.sheetWidth}
        height={config.sheetLength}
        fill="#faf6ef"
        stroke="#a3a3a3"
        strokeWidth={6}
      />
      {sheet.pieces.map((p) => (
        <g key={`${p.panelId}-${p.instance}`}>
          <rect
            x={p.x}
            y={p.y}
            width={p.width}
            height={p.length}
            fill="#e5b877"
            stroke="#8a5a25"
            strokeWidth={4}
          />
          <text
            x={p.x + p.width / 2}
            y={p.y + p.length / 2 - 12}
            fontSize={40}
            textAnchor="middle"
            fill="#452f14"
          >
            {labels[p.panelId] ?? p.panelId} #{p.instance + 1}
          </text>
          <text
            x={p.x + p.width / 2}
            y={p.y + p.length / 2 + 34}
            fontSize={34}
            textAnchor="middle"
            fill="#7a5c34"
          >
            {p.width} × {p.length}
          </text>
        </g>
      ))}
    </svg>
  );
}
