import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Chip, Mono, PrimaryButton, ScaleChip, SecondaryButton, StalePill } from '@/components/ui';
import { Viewer3D } from '@/components/viewer-3d';
import { useApp } from '@/lib/store';
import { makeStyles, space } from '@/theme';
import { StatCards, useStats } from './stats';

export function ModelPane() {
  const s = useStyles();
  const { design, exploded, toggleExploded, stale, setTab } = useApp();
  const stats = useStats(design!);
  const p = design!.params;

  return (
    <View style={s.root}>
      <View style={s.stage}>
        <Viewer3D design={design!} exploded={exploded} style={stale && { opacity: 0.45 }} />
        <ScaleChip />
        {stale && <StalePill />}
      </View>

      <View style={s.card}>
        <View style={s.cardTop}>
          <Mono size={18} bold style={{ flex: 1 }}>
            {`${p.width} × ${p.height ?? p.depth} × ${p.depth} mm`}
          </Mono>
          <Chip label="Explosión" on={exploded} onPress={toggleExploded} />
        </View>

        <StatCards cards={stats.cards} />

        <View style={s.actions}>
          <SecondaryButton label="Ajustar medidas" onPress={() => router.back()} style={{ flex: 1 }} />
          <PrimaryButton label="Ver cortes" onPress={() => setTab('cuts')} style={{ flex: 1, minHeight: 48 }} />
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.paper },
  stage: { flex: 1 },
  card: {
    gap: space.md,
    backgroundColor: c.panel,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.rule,
    padding: space.lg,
    paddingTop: space.md,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actions: { flexDirection: 'row', gap: 8 },
}));
