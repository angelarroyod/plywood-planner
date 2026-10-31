import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Body, Caption, Display, GridBackdrop, Mono, RuleLabel } from '@/components/ui';
import { SheetSvg } from '@/components/sheet-svg';
import {
  CUT_TIP,
  EDGE_BANDING_NOTE,
  cutText,
  edgeBandTotals,
  edgeCodes,
  hardwareText,
  sheetCuts,
} from '@/lib/engine';
import { useApp } from '@/lib/store';
import { HI_INK, ON_ACCENT, makeStyles, radius, shadow, space, usePalette } from '@/theme';
import { StatCards, useStats } from './stats';

export function CutsPane() {
  const c = usePalette();
  const s = useStyles();
  const { design, checked, toggleCut, taller } = useApp();
  const { layout, cards } = useStats(design!);
  const [lit, setLit] = useState<string | null>(null); // a tapped piece row lights its pieces on every sheet

  const panelsById = useMemo(() => Object.fromEntries(design!.panels.map((p) => [p.id, p])), [design]);
  const labels = useMemo(() => Object.fromEntries(design!.panels.map((p) => [p.id, p.label])), [design]);
  const edges = useMemo(() => Object.fromEntries(design!.panels.map((p) => [p.id, p.edges])), [design]);
  const allPieces = useMemo(() => layout.sheets.flatMap((sh) => sh.pieces), [layout]);
  const longest = Math.max(...allPieces.map((p) => p.length));
  const cutsBySheet = useMemo(() => layout.sheets.map((sh) => sheetCuts(sh)), [layout]);
  const cutIds = cutsBySheet.flatMap((cuts, i) => cuts.map((cut) => `${i + 1}:${cut.n}`));
  const done = cutIds.filter((id) => checked.includes(id)).length;
  const pct = cutIds.length ? (done / cutIds.length) * 100 : 0;

  const shopping = [
    ...layout.byStock.map((g) => ({
      name: `${g.stock.label} · ${g.stock.sheet.width} × ${g.stock.sheet.length}`,
      qty: `${g.sheets} hoja${g.sheets > 1 ? 's' : ''}`,
    })),
    ...edgeBandTotals(design!.panels).map((t) => ({ name: t.label, qty: `${t.meters.toFixed(1)} m` })),
    ...design!.hardware.map((h) => ({
      name: hardwareText(h),
      qty: `${h.qty} ${h.qty === 1 ? 'pza' : 'pzas'}`,
    })),
    // melamine is wiped, not sanded
    ...(design!.panels.some((p) => p.stock.material === 'triplay')
      ? [{ name: 'Lija grano 180', qty: '2 pliegos' }]
      : []),
  ];

  return (
    <ScrollView style={s.root} contentContainerStyle={{ paddingBottom: space.xxl }}>
      <View style={s.head}>
        <Display>Plan de corte</Display>
        <Body size={14}>{`${layout.sheets.length} hoja${layout.sheets.length > 1 ? 's' : ''} · sierra de 3 mm`}</Body>
        <View style={{ marginTop: space.md }}>
          <StatCards cards={cards} />
        </View>
      </View>

      <View style={s.stage}>
        <GridBackdrop />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.sheets}
          snapToAlignment="center"
          decelerationRate="fast"
        >
          {layout.sheets.map((sheet, i) => (
            <View key={i}>
              <View style={s.sheetFrame}>
                <SheetSvg sheet={sheet} labels={labels} edges={edges} checked={checked} sheetNo={i + 1} highlight={lit} />
              </View>
              <Caption tone={c.inkSoft} style={s.caption}>
                {`Hoja ${i + 1} de ${layout.sheets.length} · ${sheet.stock.label}`}
              </Caption>
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={s.section}>
        <RuleLabel
          right={
            <Mono tone={c.inkSoft} size={13} bold>
              {`${done}/${cutIds.length}`}
            </Mono>
          }
        >
          Lista de cortes
        </RuleLabel>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${pct}%` }]} />
        </View>

        <Body size={13} style={{ marginTop: 10 }}>
          {CUT_TIP}
        </Body>

        <View style={{ marginTop: space.md, gap: 6 }}>
          {cutsBySheet.map((cuts, i) => (
            <View key={i} style={{ gap: 6 }}>
              <Caption tone={c.inkSoft} style={{ marginTop: 6 }}>
                {`Hoja ${i + 1} · ${layout.sheets[i]!.stock.label}`}
              </Caption>
              {cuts.map((cut) => {
                const id = `${i + 1}:${cut.n}`;
                const isDone = checked.includes(id);
                return (
                  <Pressable
                    key={id}
                    onPress={() => toggleCut(id)}
                    style={({ pressed }) => [
                      s.check,
                      taller && { minHeight: 68, borderWidth: 2 },
                      isDone && { backgroundColor: c.raised },
                      pressed && { backgroundColor: c.raised },
                    ]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isDone }}
                  >
                    <View style={[s.box, isDone && s.boxOn]}>
                      {isDone && (
                        <Svg viewBox="0 0 20 20" width={16} height={16}>
                          <Path d="m4.5 10.5 3.5 3.5 7.5-8" fill="none" stroke={ON_ACCENT} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
                      )}
                    </View>
                    <Mono tone={isDone ? c.inkFaint : c.cutInk} size={15} bold style={s.cutNo}>
                      {cut.n}
                    </Mono>
                    <Body
                      tone={isDone ? c.inkFaint : c.ink}
                      size={14}
                      style={[{ flex: 1 }, isDone && { textDecorationLine: 'line-through' }]}
                    >
                      {cutText(cut)}
                    </Body>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      <View style={s.section}>
        <RuleLabel>Piezas</RuleLabel>
        <Caption style={{ marginTop: 6 }}>Toca una pieza para encontrarla en la hoja.</Caption>
        <View style={s.table}>
          {allPieces.map((p, i) => {
            const band = edges[p.panelId];
            const codes = band ? edgeCodes(band) : '—';
            const panel = panelsById[p.panelId];
            const on = lit === p.panelId;
            return (
              <Pressable
                key={`${p.panelId}#${p.instance}`}
                onPress={() => setLit(on ? null : p.panelId)}
                style={[s.row, i > 0 && s.divider, on && { backgroundColor: c.hi }]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <View style={s.rowLine}>
                  <Body tone={on ? HI_INK : c.ink} size={14} style={{ flex: 1 }}>
                    {`${labels[p.panelId] ?? p.panelId} ${p.instance + 1}`}
                  </Body>
                  <Mono tone={on ? HI_INK : c.ink} size={12}>
                    {`${panel?.length ?? p.length} × ${panel?.width ?? p.width}${codes === '—' ? '' : ` · ${codes}`}`}
                  </Mono>
                </View>
                {/* true-scale length against the longest piece */}
                <View style={[s.lengthBar, { width: `${(p.length / longest) * 100}%` }, on && { backgroundColor: HI_INK }]} />
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={s.section}>
        <RuleLabel>Lista de compras</RuleLabel>
        <View style={s.table}>
          {shopping.map((row, i) => (
            <View key={row.name} style={[s.row, s.rowLine, i > 0 && s.divider]}>
              <Body tone={c.ink} size={14} style={{ flex: 1 }}>
                {row.name}
              </Body>
              <Mono size={13} bold>
                {row.qty}
              </Mono>
            </View>
          ))}
        </View>
        {design!.edgeBanding !== 'none' && (
          <Body size={13} style={{ marginTop: 8 }}>
            {EDGE_BANDING_NOTE[design!.edgeBanding]}
          </Body>
        )}
        <Caption style={{ marginTop: 10 }}>Precio de referencia · maderería local</Caption>
      </View>
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.paper },
  head: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.lg },
  stage: { overflow: 'hidden', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.rule },
  sheets: { paddingHorizontal: space.lg, paddingVertical: space.lg, gap: 16 },
  sheetFrame: { borderRadius: radius.md, backgroundColor: c.sheet, ...shadow.sheet },
  caption: { marginTop: 8, textAlign: 'center' },
  section: { paddingHorizontal: space.lg, paddingTop: space.xl },
  progressTrack: { marginTop: 10, height: 4, borderRadius: 2, backgroundColor: c.rule, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: c.accent },
  check: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: c.rule,
    backgroundColor: c.panel,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  box: {
    height: 26,
    width: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: c.ruleStrong,
    backgroundColor: c.panel,
  },
  boxOn: { borderColor: c.accent, backgroundColor: c.accent },
  cutNo: { minWidth: 22, textAlign: 'right' },
  table: {
    marginTop: 10,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.rule,
    backgroundColor: c.panel,
    overflow: 'hidden',
  },
  row: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center' },
  rowLine: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.rule },
  lengthBar: { marginTop: 6, height: 4, borderRadius: 2, backgroundColor: c.accent, opacity: 0.7 },
}));
