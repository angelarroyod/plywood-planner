import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Kicker, Mono, PrimaryButton, SecondaryButton } from '@/components/ui';
import { Viewer3D } from '@/components/viewer-3d';
import { useApp } from '@/lib/store';
import { color, font, radius, space } from '@/theme';
import { StatCards, useStats } from './stats';

export function ModelPane() {
  const { design, exploded, toggleExploded, stale, setTab } = useApp();
  const stats = useStats(design!);
  const p = design!.params;

  return (
    <View style={[styles.root, stale && { opacity: 0.45 }]}>
      <Viewer3D design={design!} exploded={exploded} />

      <View pointerEvents="none" style={styles.hintWrap}>
        <View style={styles.hint}>
          <Mono tone={color.textMuted} size={9} style={styles.hintText}>
            Arrastra para girar · pinza para acercar
          </Mono>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View>
            <Kicker tone={color.red}>Vista 3D / model</Kicker>
            <Mono size={19} style={{ fontFamily: font.monoMed, marginTop: 3 }}>
              {`${p.width} × ${p.height ?? p.depth} × ${p.depth} mm`}
            </Mono>
          </View>
          <Pressable
            onPress={toggleExploded}
            style={({ pressed }) => [
              styles.explode,
              exploded && { borderColor: color.red, backgroundColor: color.red },
              pressed && { transform: [{ scale: 0.96 }] },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: exploded }}
          >
            <Mono tone={exploded ? color.white : color.textMuted} size={10} style={styles.explodeLabel}>
              {exploded ? 'Armado' : 'Explosión'}
            </Mono>
          </Pressable>
        </View>

        <View style={{ marginTop: 14 }}>
          <StatCards cards={stats.cards} />
        </View>

        <View style={styles.actions}>
          <SecondaryButton label="Ajustar medidas" onPress={() => router.back()} style={{ flex: 1 }} />
          <PrimaryButton
            label="Ver cortes"
            onPress={() => setTab('cuts')}
            style={{ flex: 1, minHeight: 48 }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.void },
  hintWrap: { position: 'absolute', left: 0, right: 0, top: 16, alignItems: 'center' },
  hint: {
    borderRadius: radius.sm,
    backgroundColor: 'rgba(30,33,38,0.85)',
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  hintText: { letterSpacing: 1.4, textTransform: 'uppercase' },
  card: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    borderTopWidth: 3,
    borderTopColor: color.red,
    backgroundColor: 'rgba(20,22,26,0.95)',
    padding: space.lg,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  explode: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.card,
    paddingHorizontal: 14,
  },
  explodeLabel: { letterSpacing: 1.2, textTransform: 'uppercase' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
});
