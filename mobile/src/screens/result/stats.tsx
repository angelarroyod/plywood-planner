import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Caption, Mono } from '@/components/ui';
import { nest, type Design } from '@/lib/engine';
import { makeStyles, radius, usePalette } from '@/theme';

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

/** The summary strip: ruled cells on one sheet-white card, value over label. */
export function StatCards({ cards }: { cards: { label: string; value: string; sub?: string }[] }) {
  const s = useStyles();
  const sc = usePalette();
  return (
    <View style={s.row}>
      {cards.map((c, i) => (
        <View key={`${c.label}-${i}`} style={[s.cell, i > 0 && s.divider]}>
          <Mono size={20} bold>
            {c.value}
          </Mono>
          <Caption tone={sc.inkSoft}>{c.label}</Caption>
          {c.sub && <Caption numberOfLines={2}>{c.sub}</Caption>}
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  row: {
    flexDirection: 'row',
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.rule,
    backgroundColor: c.panel,
    overflow: 'hidden',
  },
  cell: { flex: 1, paddingHorizontal: 10, paddingVertical: 10, gap: 2 },
  divider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: c.rule },
}));
