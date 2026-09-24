import Svg, { Defs, G, Line, Pattern, Rect, Text as SvgText } from 'react-native-svg';
import type { SheetLayout } from '@/lib/engine';
import { color, piece as pieceTone } from '@/theme';

interface Props {
  sheet: SheetLayout;
  labels: Record<string, string>;
  /** `${panelId}#${instance}` ids already cut — they grey out on the sheet. */
  checked: string[];
  height?: number;
}

/** One sheet, 1 SVG unit = 1 mm, sized by its stock — same geometry the web app draws. */
export function SheetSvg({ sheet, labels, checked, height = 330 }: Props) {
  const { width: W, length: H } = sheet.stock.sheet;
  return (
    <Svg viewBox={`0 0 ${W} ${H}`} height={height} width={(height * W) / H}>
      <Defs>
        <Pattern id="m-grain" width={26} height={26} patternUnits="userSpaceOnUse">
          <Line x1={0} y1={0} x2={0} y2={26} stroke={color.plyGrain} strokeWidth={2.5} />
        </Pattern>
      </Defs>

      <Rect x={0} y={0} width={W} height={H} fill={color.sheet} stroke={color.borderStrong} strokeWidth={6} />

      {sheet.pieces.map((p) => {
        const done = checked.includes(`${p.panelId}#${p.instance}`);
        const tone = done ? pieceTone.done : pieceTone.todo;
        const cx = p.x + p.width / 2;
        const cy = p.y + p.length / 2;
        return (
          <G key={`${p.panelId}-${p.instance}`}>
            <Rect
              x={p.x}
              y={p.y}
              width={p.width}
              height={p.length}
              fill={tone.fill}
              stroke={tone.stroke}
              strokeWidth={5}
            />
            <SvgText x={cx} y={cy - 8} fontSize={46} fontWeight="700" textAnchor="middle" fill={tone.label}>
              {`${labels[p.panelId] ?? p.panelId} ${p.instance + 1}`}
            </SvgText>
            <SvgText x={cx} y={cy + 42} fontSize={38} textAnchor="middle" fill={tone.sub}>
              {`${p.width} × ${p.length}`}
            </SvgText>
          </G>
        );
      })}

      {/* Grain runs the full length and does not stop at cut lines. Grain-free boards get none. */}
      {sheet.stock.hasGrain && (
        <Rect x={0} y={0} width={W} height={H} fill="url(#m-grain)" opacity={0.1} />
      )}

      {sheet.stock.hasGrain && (
        <SvgText
          x={30}
          y={H / 2}
          fontSize={44}
          fill={color.textFaint}
          letterSpacing={10}
          textAnchor="middle"
          transform={`rotate(-90 30 ${H / 2})`}
        >
          ↑ VETA
        </SvgText>
      )}
    </Svg>
  );
}
