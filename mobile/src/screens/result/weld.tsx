import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, G, Line, Path, Pattern, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import {
  Body,
  Caption,
  Chip,
  Display,
  GridBackdrop,
  Mono,
  PrimaryButton,
  RuleLabel,
  ScaleChip,
  SecondaryButton,
  StalePill,
  Title,
  WarnIcon,
} from '@/components/ui';
import { Viewer3D, type Finish } from '@/components/viewer-3d';
import {
  BAR_LENGTH,
  CUT_KERF,
  END_ANGLE,
  SAFETY_GEAR,
  SQUARE_END_STEP,
  barCutTip,
  planBars,
  settingsNote,
  shoppingList,
  shoppingText,
  toolLabel,
  weldTemplates,
  type BarLayout,
  type WeldDesign,
} from '@/lib/engine';
import { useApp } from '@/lib/store';
import { HI_INK, TNUM, font, makeStyles, radius, space, usePalette, useScheme } from '@/theme';
import { StatCards } from './stats';
import { StepList } from './steps';

// ponytail: same mapping as finishOf in the web WeldPanels — rendering numbers, not copy
/** Paint reads as a satin coat; bare steel as metal. */
export function finishOf(d: WeldDesign): Finish {
  return d.finish.painted
    ? { color: d.finish.hex, metalness: 0.25, roughness: d.finish.gloss ? 0.3 : 0.7 }
    : { color: d.finish.hex, metalness: 0.85, roughness: 0.35 };
}

export function weldTitle(d: WeldDesign): string {
  return weldTemplates.find((t) => t.id === d.templateId)?.name ?? '';
}

/** Where to set the machine for this tube and process. */
function SettingsCard({ design }: { design: WeldDesign }) {
  const c = usePalette();
  const s = useStyles();
  const { settings, process, tube } = design;
  const rows: [string, string][] = [
    ['Consumible', settings.consumable],
    ...(settings.tungsten ? ([['Tungsteno', settings.tungsten]] as [string, string][]) : []),
    ['Polaridad', settings.polarity],
    ['Gas', settings.gas ?? 'No usa'],
    ['Material', `${tube.label} · pared ${tube.wall} mm`],
    ['Técnica', settings.technique],
  ];
  return (
    <View style={s.card}>
      <RuleLabel>Ajuste de máquina</RuleLabel>
      <Title style={{ marginTop: space.md }}>{process.label}</Title>
      <View style={s.ampsRow}>
        <Text style={s.amps}>{settings.start}</Text>
        <Text style={s.ampsUnit}>A</Text>
        <Mono tone={c.inkSoft} size={13} style={{ marginLeft: 'auto' }}>
          {`${settings.amps[0]}–${settings.amps[1]} A`}
        </Mono>
      </View>
      <View style={{ marginTop: space.md, gap: 6 }}>
        {rows.map(([k, v]) => (
          <View key={k} style={{ flexDirection: 'row', gap: 8 }}>
            <Text style={s.dt}>{k}</Text>
            <Body tone={c.ink} size={13} style={{ flex: 1 }}>
              {v}
            </Body>
          </View>
        ))}
      </View>
      <View style={s.note}>
        <Body size={13}>{settingsNote(design)}</Body>
      </View>
    </View>
  );
}

/** 3D model in its final color, with the machine settings under it. */
export function WeldModelPane() {
  const s = useStyles();
  const { weld, exploded, toggleExploded, stale, setTab } = useApp();
  const d = weld!;
  const p = d.params;
  return (
    <ScrollView style={s.root} contentContainerStyle={{ paddingBottom: space.xxl }}>
      <View style={s.stage}>
        <Viewer3D design={d} exploded={exploded} finish={finishOf(d)} style={stale && { opacity: 0.45 }} />
        <ScaleChip />
        {stale && <StalePill />}
      </View>
      <View style={s.body}>
        <View style={s.rowCenter}>
          <Mono size={18} bold style={{ flex: 1 }}>{`${p.width} × ${p.depth} × ${p.height} mm`}</Mono>
          <Chip label="Explosión" on={exploded} onPress={toggleExploded} />
        </View>
        <StatCards
          cards={[
            { label: 'Peso', value: `${d.weight} kg` },
            { label: 'Uniones', value: String(d.joints) },
            { label: 'Cordón', value: `${(d.weldLength / 1000).toFixed(1)} m` },
          ]}
        />
        <SettingsCard design={d} />
        <View style={s.rowCenter}>
          <SecondaryButton label="Ajustar medidas" onPress={() => router.back()} style={{ flex: 1 }} />
          <PrimaryButton label="Ver cortes" onPress={() => setTab('cuts')} style={{ flex: 1, minHeight: 48 }} />
        </View>
      </View>
    </ScrollView>
  );
}

const BAR_H = 700; // drawn tube thickness — exaggerated so a 6.10 m bar reads on a phone
const BEVEL = 200; // drawn 45° end, exaggerated for the same reason

/** One bar to scale lengthwise: pieces in cut order, kerfs as gaps, the leftover hatched. */
function BarSvg({ bar, lit }: { bar: BarLayout; lit: string | null }) {
  const c = usePalette();
  const id = `remnant-${useScheme()}`;
  // the stage spans the screen less the section gutters and its own padding
  const width = useWindowDimensions().width - 2 * space.lg - 2 * 12 - 2;
  const y = 30;
  return (
    <Svg viewBox={`0 0 ${BAR_LENGTH} ${BAR_H + 60}`} width={width} height={(width * (BAR_H + 60)) / BAR_LENGTH}>
      <Defs>
        <Pattern id={id} width={120} height={120} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <Line x1={0} y1={0} x2={0} y2={120} stroke={c.sheetEdge} strokeWidth={28} />
        </Pattern>
      </Defs>
      <Rect x={0} y={y} width={BAR_LENGTH} height={BAR_H} fill={c.sheet} />
      <Rect x={0} y={y} width={BAR_LENGTH} height={BAR_H} fill={`url(#${id})`} stroke={c.sheetEdge} strokeWidth={16} />
      {bar.pieces.map((p, i) => {
        const x0 = p.offset;
        const x1 = p.offset + p.length;
        const m = p.ends === 'miter' ? BEVEL : 0;
        const wide = p.length > 900; // room for the length under the number
        const cx = (x0 + x1) / 2;
        return (
          <G key={i}>
            <Polygon
              points={`${x0},${y} ${x1},${y} ${x1 - m},${y + BAR_H} ${x0 + m},${y + BAR_H}`}
              fill={p.memberId === lit ? c.hi : c.piece}
              stroke={c.pieceEdge}
              strokeWidth={16}
            />
            <SvgText x={cx} y={y + BAR_H / 2 + (wide ? -20 : 120)} textAnchor="middle" fontSize={340} fontFamily={font.monoBold} fill={c.pieceLabel}>
              {String(i + 1)}
            </SvgText>
            {wide && (
              <SvgText x={cx} y={y + BAR_H / 2 + 260} textAnchor="middle" fontSize={220} fontFamily={font.mono} fill={c.pieceDims}>
                {String(p.length)}
              </SvgText>
            )}
          </G>
        );
      })}
    </Svg>
  );
}

/** Bar-by-bar cut plan, numbered in saw order, and the piece list that lights its pieces. */
export function WeldCutsPane() {
  const c = usePalette();
  const s = useStyles();
  const { weld } = useApp();
  const d = weld!;
  const bars = useMemo(() => planBars(d.members), [d]);
  const [lit, setLit] = useState<string | null>(null);
  const longest = Math.max(...d.members.map((m) => m.length));

  return (
    <ScrollView style={s.root} contentContainerStyle={{ paddingBottom: space.xxl }}>
      <View style={s.head}>
        <Display>Plan de cortes</Display>
        <Body size={14}>{`${d.tube.label} · ${bars.length} ${bars.length === 1 ? 'tramo' : 'tramos'} de 6.10 m · disco de ${CUT_KERF} mm`}</Body>
      </View>

      {bars.map((bar, b) => (
        <View key={b} style={s.section}>
          <RuleLabel>{`Tramo ${b + 1}`}</RuleLabel>
          <View style={s.barStage}>
            <GridBackdrop />
            <View>
              <BarSvg bar={bar} lit={lit} />
              <Caption tone={c.inkSoft} style={{ marginTop: 6, textAlign: 'right' }}>
                {bar.remnant > 0 ? `Sobrante ${bar.remnant} mm` : 'Sin sobrante'}
              </Caption>
            </View>
          </View>
          <View style={{ marginTop: space.sm, gap: 6 }}>
            <Text style={s.cutLine}>
              <Text style={s.cutNo}>0. </Text>
              <Text style={{ color: c.inkSoft }}>{SQUARE_END_STEP}</Text>
            </Text>
            {bar.pieces.map((p, i) => (
              <Text key={i} style={s.cutLine}>
                <Text style={s.cutNo}>{`${i + 1}. `}</Text>
                {'Mide '}
                <Text style={s.cutLen}>{`${p.length} mm`}</Text>
                {` desde la punta y corta a ${END_ANGLE[p.ends]} — `}
                <Text style={{ color: c.inkSoft }}>{p.label}</Text>
              </Text>
            ))}
          </View>
        </View>
      ))}

      <View style={s.section}>
        <RuleLabel>Lista de piezas</RuleLabel>
        <Caption style={{ marginTop: 6 }}>Toca una pieza para encontrarla en los tramos.</Caption>
        <View style={s.table}>
          <View style={[s.tr, s.thead]}>
            <Caption tone={c.inkSoft} style={{ flex: 1 }}>Pieza</Caption>
            <Caption tone={c.inkSoft} style={s.colNum}>Largo</Caption>
            <Caption tone={c.inkSoft} style={s.colQty}>Cant.</Caption>
            <Caption tone={c.inkSoft} style={s.colQty}>Corte</Caption>
          </View>
          {d.members.map((m) => {
            const on = lit === m.id;
            const ink = on ? HI_INK : c.ink;
            return (
              <Pressable
                key={m.id}
                onPress={() => setLit(on ? null : m.id)}
                style={[s.trBody, on && { backgroundColor: c.hi }]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <View style={s.tr}>
                  <Body tone={ink} size={14} style={{ flex: 1 }}>{m.label}</Body>
                  <Mono tone={ink} size={13} bold style={s.colNum}>{m.length}</Mono>
                  <Mono tone={ink} size={13} style={s.colQty}>{m.qty}</Mono>
                  <Mono tone={ink} size={13} style={s.colQty}>{END_ANGLE[m.ends]}</Mono>
                </View>
                {/* true-scale length against the longest piece */}
                <View style={[s.lengthBar, { width: `${(m.length / longest) * 100}%` }, on && { backgroundColor: HI_INK }]} />
              </Pressable>
            );
          })}
        </View>
        <View style={s.note}>
          <Body size={13}>{barCutTip(d.members)}</Body>
        </View>
      </View>
    </ScrollView>
  );
}

/** Steps beside the 3D model, each with the tools it needs. */
export function WeldStepsPane() {
  const c = usePalette();
  const { weld, exploded, activeStep, stale } = useApp();
  const d = weld!;
  const labels = useMemo(() => Object.fromEntries(d.members.map((m) => [m.id, m.label])), [d]);
  const step = d.steps.find((s) => s.order === activeStep) ?? null;
  return (
    <StepList
      steps={d.steps}
      labels={labels}
      viewer={<Viewer3D design={d} exploded={exploded} highlightStep={step} finish={finishOf(d)} style={stale && { opacity: 0.45 }} />}
      detail={(st) => (
        <View style={{ marginTop: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.rule }}>
          <Caption>Herramienta</Caption>
          <Body size={13}>{st.tools.map((t) => toolLabel(d, t)).join(' · ')}</Body>
        </View>
      )}
    />
  );
}

/** Share the shopping list as plain text through the iOS share sheet. */
export function shareShopping(d: WeldDesign, onError: () => void) {
  const title = weldTitle(d);
  return Share.share({ message: shoppingText(d, title, planBars(d.members)) }).catch(onError);
}

/** What to buy and what to have on hand. */
export function WeldShoppingPane() {
  const c = usePalette();
  const s = useStyles();
  const { weld, stale, flash } = useApp();
  const d = weld!;
  const groups = useMemo(() => shoppingList(d, planBars(d.members)), [d]);

  return (
    <ScrollView style={s.root} contentContainerStyle={{ paddingBottom: space.xxl }}>
      <View style={s.head}>
        <Display>Lista de compras</Display>
        <Body size={14}>{`${weldTitle(d)} · ferretería y tienda de aceros`}</Body>
        <PrimaryButton
          label="Compartir lista"
          disabled={stale}
          onPress={() => shareShopping(d, () => flash('No se pudo compartir'))}
          style={{ marginTop: space.md }}
        />
      </View>

      {groups.map((g) => (
        <View key={g.title} style={s.section}>
          <RuleLabel>{g.title}</RuleLabel>
          <View style={s.table}>
            {g.lines.map((l, i) => (
              <View key={l.label} style={[s.trBody, i > 0 && s.divider]}>
                <View style={[s.tr, { alignItems: 'baseline' }]}>
                  <Body tone={c.ink} size={14} style={{ flex: 1 }}>{l.label}</Body>
                  {/* quantities read as words ("2 tramos de 6.10 m"), so sans with tabular figures */}
                  <Body tone={c.ink} size={14} bold style={{ maxWidth: '45%', textAlign: 'right', fontVariant: [...TNUM] }}>
                    {l.qty}
                  </Body>
                </View>
                {l.note && <Body size={13}>{l.note}</Body>}
              </View>
            ))}
          </View>
        </View>
      ))}

      <View style={s.section}>
        <SettingsCard design={d} />
      </View>

      {[
        { title: 'Herramienta', items: d.tools.map((t) => toolLabel(d, t)) },
        { title: 'Seguridad', items: SAFETY_GEAR },
      ].map((list) => (
        <View key={list.title} style={s.section}>
          <RuleLabel>{list.title}</RuleLabel>
          <View style={{ marginTop: space.sm, gap: 6 }}>
            {list.items.map((it) => (
              <View key={it} style={{ flexDirection: 'row', gap: 10 }}>
                <View style={s.bullet} />
                <Body tone={c.ink} size={14} style={{ flex: 1 }}>{it}</Body>
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

/** Advice earned by the user's choices, each with a one-click fix where there is one. */
export function Suggestions({ design }: { design: WeldDesign }) {
  const c = usePalette();
  const s = useStyles();
  const { setParams } = useApp();
  return (
    <View>
      <RuleLabel>Sugerencias</RuleLabel>
      {design.suggestions.length === 0 ? (
        <Body size={13} style={{ marginTop: space.sm }}>Todo en orden con estas medidas y este proceso.</Body>
      ) : (
        <View style={{ marginTop: space.sm, gap: 8 }}>
          {design.suggestions.map((sug, i) => {
            const warn = sug.level === 'warn';
            const ink = warn ? c.cutInk : c.accentInk;
            return (
              <View key={i} style={[s.suggestion, { backgroundColor: warn ? c.cutTint : c.accentTint }]}>
                <View style={{ paddingTop: 2 }}>
                  {warn ? (
                    <WarnIcon tone={ink} />
                  ) : (
                    <Svg viewBox="0 0 20 20" width={16} height={16}>
                      <Path
                        d="M7.5 15h5M8 17.5h4M10 2.5a5 5 0 0 0-3 9c.6.5 1 1.2 1 2V14h4v-.5c0-.8.4-1.5 1-2a5 5 0 0 0-3-9Z"
                        fill="none"
                        stroke={ink}
                        strokeWidth={1.6}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[s.sugLevel, { color: ink }]}>{warn ? 'Atención' : 'Consejo'}</Text>
                  <Body tone={c.ink} size={14}>{sug.message}</Body>
                  {sug.fix && (
                    <Pressable
                      onPress={() => setParams(sug.fix!.params)}
                      style={({ pressed }) => [s.fix, pressed && { borderColor: c.accent }]}
                      accessibilityRole="button"
                    >
                      <Text style={s.fixLabel}>{sug.fix.label}</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.paper },
  stage: { height: 340, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.rule },
  body: { padding: space.lg, gap: space.md },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  head: { paddingHorizontal: space.lg, paddingTop: space.lg },
  section: { paddingHorizontal: space.lg, paddingTop: space.xl },
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.rule,
    backgroundColor: c.panel,
    padding: 16,
  },
  ampsRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 },
  amps: { fontFamily: font.monoBold, fontSize: 44, lineHeight: 48, fontVariant: [...TNUM], color: c.accentInk },
  ampsUnit: { fontFamily: font.semi, fontSize: 18, color: c.inkSoft },
  dt: { width: 88, fontFamily: font.semi, fontSize: 13, lineHeight: 21, color: c.inkFaint },
  note: { marginTop: space.md, borderRadius: radius.lg, backgroundColor: c.raised, paddingHorizontal: 12, paddingVertical: 10 },
  barStage: {
    marginTop: space.md,
    overflow: 'hidden',
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.rule,
    padding: 12,
  },
  cutLine: { fontFamily: font.regular, fontSize: 14, lineHeight: 21, color: c.ink },
  cutNo: { fontFamily: font.monoBold, fontVariant: [...TNUM], color: c.cutInk },
  cutLen: { fontFamily: font.monoBold, fontVariant: [...TNUM], color: c.ink },
  table: {
    marginTop: 10,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.rule,
    backgroundColor: c.panel,
    overflow: 'hidden',
  },
  thead: { paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.ruleStrong },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trBody: { paddingHorizontal: 14, paddingVertical: 10, minHeight: 48, justifyContent: 'center', gap: 2 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.rule },
  colNum: { width: 56, textAlign: 'right' },
  colQty: { width: 44, textAlign: 'right' },
  lengthBar: { marginTop: 6, height: 4, borderRadius: 2, backgroundColor: c.accent, opacity: 0.7 },
  bullet: { marginTop: 9, height: 4, width: 4, backgroundColor: c.accent },
  suggestion: { flexDirection: 'row', gap: 10, borderRadius: radius.xl, paddingHorizontal: 14, paddingVertical: 12 },
  sugLevel: { fontFamily: font.bold, fontSize: 12 },
  fix: {
    alignSelf: 'flex-start',
    marginTop: 8,
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.rule,
    backgroundColor: c.panel,
    paddingHorizontal: 12,
  },
  fixLabel: { fontFamily: font.bold, fontSize: 14, color: c.accentInk },
}));
