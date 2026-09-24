import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Body, Display, Mono } from '@/components/ui';
import { SheetSvg } from '@/components/sheet-svg';
import { HARDWARE_LABELS } from '@/lib/engine';
import { useApp } from '@/lib/store';
import { color, font, radius, space } from '@/theme';
import { StatCards, useStats } from './stats';

export function CutsPane() {
  const { design, checked, toggleCut, taller } = useApp();
  const { layout, cards } = useStats(design!);

  const labels = useMemo(
    () => Object.fromEntries(design!.panels.map((p) => [p.id, p.label])),
    [design],
  );
  const allPieces = useMemo(() => layout.sheets.flatMap((s) => s.pieces), [layout]);
  const done = allPieces.filter((p) => checked.includes(`${p.panelId}#${p.instance}`)).length;
  const pct = allPieces.length ? (done / allPieces.length) * 100 : 0;

  const shopping = [
    {
      name: `Triplay ${design!.params.thickness} mm · 1220 × 2440`,
      qty: `${layout.sheets.length} hoja${layout.sheets.length > 1 ? 's' : ''}`,
    },
    ...design!.hardware.map((h) => ({
      name: `${HARDWARE_LABELS[h.type]} ${h.size}`,
      qty: `${h.qty} pzas`,
    })),
    { name: 'Lija grano 180', qty: '2 pliegos' },
  ];

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: space.xxl }}>
      <View style={styles.head}>
        <Display size={32}>Plan de corte</Display>
        <Mono tone={color.textSoft} size={10} style={styles.meta}>
          {`${layout.sheets.length} hoja${layout.sheets.length > 1 ? 's' : ''} · 1220 × 2440 mm · sierra 3 mm`}
        </Mono>
        <View style={{ marginTop: 16 }}>
          <StatCards cards={cards} />
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sheets}
        snapToAlignment="center"
        decelerationRate="fast"
      >
        {layout.sheets.map((sheet, i) => (
          <View key={i}>
            <View style={styles.sheetFrame}>
              <SheetSvg sheet={sheet} labels={labels} checked={checked} />
            </View>
            <Mono tone={color.textSoft} size={10} style={styles.caption}>
              {`Hoja ${i + 1} de ${layout.sheets.length} — ${sheet.thickness} mm`}
            </Mono>
          </View>
        ))}
      </ScrollView>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Display size={22} semi style={{ letterSpacing: 0.66 }}>
            Lista de cortes
          </Display>
          <Mono tone={color.red} size={11}>
            {`${done} de ${allPieces.length} cortes`}
          </Mono>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` }]} />
        </View>

        <View style={{ marginTop: 12, gap: 6 }}>
          {allPieces.map((p) => {
            const id = `${p.panelId}#${p.instance}`;
            const isDone = checked.includes(id);
            return (
              <Pressable
                key={id}
                onPress={() => toggleCut(id)}
                style={({ pressed }) => [
                  styles.check,
                  taller && { minHeight: 68, borderWidth: 2 },
                  isDone && { backgroundColor: color.cardAlt, opacity: 0.7 },
                  pressed && { transform: [{ scale: 0.99 }] },
                ]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isDone }}
              >
                <View style={[styles.box, isDone && { borderColor: color.red, backgroundColor: color.red }]}>
                  <Text style={{ fontSize: 15, color: isDone ? color.white : 'transparent' }}>✓</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={[
                      styles.checkLabel,
                      isDone && { color: color.textSoft, textDecorationLine: 'line-through' },
                    ]}
                  >
                    {`${labels[p.panelId] ?? p.panelId} ${p.instance + 1}`}
                  </Text>
                  <Mono tone={color.textSoft} size={11}>
                    {`${p.width} × ${p.length} mm`}
                  </Mono>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Display size={22} semi style={{ letterSpacing: 0.66 }}>
          Lista de compras
        </Display>
        <View style={styles.shopping}>
          {shopping.map((row, i) => (
            <View key={row.name} style={[styles.shopRow, i > 0 && styles.shopDivider]}>
              <Body tone={color.text} size={14} style={{ flex: 1 }}>
                {row.name}
              </Body>
              <Mono tone={color.red} size={13}>
                {row.qty}
              </Mono>
            </View>
          ))}
        </View>
        <Mono tone={color.textFaint} size={10} style={styles.footnote}>
          Precio de referencia · maderería local
        </Mono>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  head: { paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: 20 },
  meta: { marginTop: 3, letterSpacing: 1.4, textTransform: 'uppercase' },
  sheets: { paddingHorizontal: space.xl, gap: 14, paddingBottom: 6 },
  sheetFrame: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.sheet,
    overflow: 'hidden',
  },
  caption: { marginTop: 8, textAlign: 'center', letterSpacing: 1.4, textTransform: 'uppercase' },
  section: { paddingHorizontal: space.xl, paddingTop: 20 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  progressTrack: { marginTop: 8, height: 5, backgroundColor: color.border },
  progressFill: { height: '100%', backgroundColor: color.red },
  check: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  box: {
    height: 28,
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: color.borderMuted,
    backgroundColor: color.bg,
  },
  checkLabel: {
    fontFamily: font.displaySemi,
    fontSize: 19,
    letterSpacing: 0.57,
    textTransform: 'uppercase',
    color: color.text,
  },
  shopping: {
    marginTop: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.card,
    overflow: 'hidden',
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  shopDivider: { borderTopWidth: 1, borderTopColor: color.border },
  footnote: { marginTop: 10, letterSpacing: 1, textTransform: 'uppercase', lineHeight: 17 },
});
