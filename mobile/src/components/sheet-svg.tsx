import Svg, { Circle, Defs, G, Line, Path, Pattern, Rect, Text as SvgText } from 'react-native-svg';
import { NO_EDGES, bandSegments, cutBadge, sheetCuts, type EdgeBands, type SheetLayout } from '@/lib/engine';
import { font, usePalette, useScheme } from '@/theme';

interface Props {
  sheet: SheetLayout;
  labels: Record<string, string>;
  /** panelId → banded edges, drawn as dark lines inside the piece. */
  edges: Record<string, EdgeBands>;
  /** `"{sheet}:{n}"` ids of saw cuts already made — their badges fade. */
  checked: string[];
  /** 1-based position of this sheet in the layout, the first half of each cut id. */
  sheetNo: number;
  /** panelId swept with the highlighter, from a tapped piece row. */
  highlight?: string | null;
  height?: number;
}

const BAND_INSET = 7; // mm; banded edges are 14 mm lines that stay inside the piece
const BADGE_PT = 9; // badge radius on screen; the number is 11 pt, readable at any sheet height
const TICK = 90; // mm, corner registration mark

/** One sheet, 1 SVG unit = 1 mm, sized by its stock — mirrors the web SheetSvg. */
export function SheetSvg({ sheet, labels, edges, checked, sheetNo, highlight = null, height = 330 }: Props) {
  const c = usePalette();
  const grainId = `grain-${useScheme()}`;
  const { width: W, length: H } = sheet.stock.sheet;
  const k = H / height; // mm per point
  const r = BADGE_PT * k;
  const fontSize = 11 * k;
  return (
    <Svg viewBox={`0 0 ${W} ${H}`} height={height} width={(height * W) / H} accessibilityLabel={`Plan de corte — ${sheet.stock.label}`}>
      <Defs>
        <Pattern id={grainId} width={26} height={26} patternUnits="userSpaceOnUse">
          <Line x1={0} y1={0} x2={0} y2={26} stroke={c.grain} strokeWidth={2.5} />
        </Pattern>
      </Defs>

      <Rect x={0} y={0} width={W} height={H} fill={c.sheet} stroke={c.sheetEdge} strokeWidth={6} />

      {sheet.pieces.map((p) => {
        const cx = p.x + p.width / 2;
        const cy = p.y + p.length / 2;
        return (
          <G key={`${p.panelId}-${p.instance}`}>
            <Rect
              x={p.x}
              y={p.y}
              width={p.width}
              height={p.length}
              fill={p.panelId === highlight ? c.hi : c.piece}
              stroke={c.pieceEdge}
              strokeWidth={5}
            />
            {bandSegments(p, edges[p.panelId] ?? NO_EDGES, BAND_INSET).map((s, i) => (
              <Line key={i} {...s} stroke={c.pieceLabel} strokeWidth={BAND_INSET * 2} />
            ))}
            <SvgText x={cx} y={cy - 10} fontSize={42} fontFamily={font.monoBold} textAnchor="middle" fill={c.pieceLabel}>
              {`${labels[p.panelId] ?? p.panelId} #${p.instance + 1}`}
            </SvgText>
            <SvgText x={cx} y={cy + 40} fontSize={34} fontFamily={font.mono} textAnchor="middle" fill={c.pieceDims}>
              {`${p.width} × ${p.length}`}
            </SvgText>
          </G>
        );
      })}

      {/* Grain runs the full length and does not stop at cut lines. Grain-free boards get none. */}
      {sheet.stock.hasGrain && <Rect x={0} y={0} width={W} height={H} fill={`url(#${grainId})`} opacity={0.14} />}

      {[
        [0, 0, 1, 1],
        [W, 0, -1, 1],
        [0, H, 1, -1],
        [W, H, -1, -1],
      ].map(([x, y, sx, sy], i) => (
        <Path key={i} d={`M ${x! + sx! * TICK} ${y} H ${x} V ${y! + sy! * TICK}`} stroke={c.mark} strokeWidth={7} fill="none" />
      ))}

      {sheet.stock.hasGrain && (
        <G>
          <Path
            d={`M 26 ${H / 2 - 70} V ${H / 2 - 230} M 12 ${H / 2 - 212} L 26 ${H / 2 - 230} L 40 ${H / 2 - 212}`}
            fill="none"
            stroke={c.inkFaint}
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <SvgText
            x={26}
            y={H / 2 + 14}
            fontSize={40}
            fontFamily={font.semi}
            fill={c.inkFaint}
            textAnchor="middle"
            transform={`rotate(-90 26 ${H / 2})`}
          >
            Veta
          </SvgText>
        </G>
      )}

      {/* Numbered cuts, drawn last so they sit on top; placed where the saw enters. */}
      {sheetCuts(sheet).map((cut) => {
        const b = cutBadge(cut, sheet.stock.sheet, r);
        const done = checked.includes(`${sheetNo}:${cut.n}`);
        return (
          <G key={cut.n}>
            <Circle cx={b.x} cy={b.y} r={r} fill={done ? c.raised : c.mark} stroke={done ? c.ruleStrong : 'none'} strokeWidth={k} />
            <SvgText
              x={b.x}
              y={b.y + fontSize * 0.35}
              fontSize={fontSize}
              fontFamily={font.monoBold}
              textAnchor="middle"
              fill={done ? c.inkFaint : c.onMark}
            >
              {String(cut.n)}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}
