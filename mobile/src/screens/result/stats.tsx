import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Display, Mono } from '@/components/ui';
import { nest, type Design } from '@/lib/engine';
import { color, radius } from '@/theme';

/** Hojas / Piezas / Merma per material — the numbers that decide a trip to the maderería. */
export function useStats(design: Design) {
  return useMemo(() => {
    const layout = nest(design.panels);
    const pieces = design.panels.reduce((n, p) => n + p.qty, 0);
    return {
      layout,
      cards: [
        {
          label: 'Hojas',
          value: String(layout.sheets.length),
          sub: layout.byStock.length > 1 ? `${layout.byStock.length} materiales` : 'en total',
        },
        { label: 'Piezas', value: String(pieces), sub: 'en total' },
        ...layout.byStock.map((g) => ({
          label: 'Merma',
          value: `${g.wastePercent.toFixed(0)}%`,
          sub: g.stock.label,
        })),
      ],
    };
  }, [design]);
}

export function StatCards({ cards }: { cards: { label: string; value: string; sub: string }[] }) {
  return (
    <View style={styles.row}>
      {cards.map((c, i) => (
        <View key={`${c.label}-${i}`} style={styles.card}>
          <Mono tone={color.textSoft} size={9} style={{ letterSpacing: 1.3, textTransform: 'uppercase' }}>
            {c.label}
          </Mono>
          <Display size={26} style={{ marginTop: 3 }}>
            {c.value}
          </Display>
          <Mono tone={color.textFaint} size={9}>
            {c.sub}
          </Mono>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  card: {
    flex: 1,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.border,
    borderTopWidth: 2,
    borderTopColor: color.red,
    backgroundColor: color.card,
    padding: 10,
  },
});
