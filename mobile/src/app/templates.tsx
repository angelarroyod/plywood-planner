import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackLink, Body, Display, Kicker, Mono, PrimaryButton, ScreenHeader } from '@/components/ui';
import { templates } from '@/lib/engine';
import { useApp } from '@/lib/store';
import { color, radius, space } from '@/theme';

const KIND: Record<string, string> = { bookshelf: 'estantería', 'side-table': 'mesa', closet: 'clóset' };

export default function Templates() {
  const insets = useSafeAreaInsets();
  const { templateId, setTemplate } = useApp();

  return (
    <View style={styles.root}>
      <ScreenHeader>
        <BackLink label="Proyectos" onPress={() => router.back()} />
        <Display size={32} style={{ marginTop: 8 }}>
          ¿Qué vas a hacer?
        </Display>
        <Kicker tone={color.textFaint} style={{ marginTop: 2 }}>
          Pick a template
        </Kicker>
      </ScreenHeader>

      <ScrollView contentContainerStyle={styles.list}>
        {templates.map((t, i) => {
          const active = t.id === templateId;
          const chips = t.params
            .filter((p) => p.kind === 'number')
            .slice(0, 3)
            .map((p) => (p.kind === 'number' ? `${p.label} ${p.min}–${p.max}` : ''));
          return (
            <Pressable
              key={t.id}
              onPress={() => setTemplate(t.id)}
              style={({ pressed }) => [
                styles.card,
                active && { borderColor: color.red, backgroundColor: color.redTintBg },
                pressed && { transform: [{ scale: 0.985 }] },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <View style={styles.cardTop}>
                <Mono tone={color.red} size={10} style={{ letterSpacing: 1.4 }}>
                  {String(i + 1).padStart(2, '0')} · {KIND[t.id] ?? ''}
                </Mono>
                <View style={[styles.check, active && styles.checkOn]}>
                  <Text style={{ fontSize: 14, color: active ? color.white : 'transparent' }}>✓</Text>
                </View>
              </View>

              <Display size={30} style={{ marginTop: 10 }}>
                {t.name}
              </Display>
              <Body size={13} style={{ marginTop: 6 }}>
                {t.description}
              </Body>

              <View style={styles.chips}>
                {chips.map((c) => (
                  <View key={c} style={styles.chip}>
                    <Mono tone={color.textMuted} size={10}>
                      {c}
                    </Mono>
                  </View>
                ))}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.cta, { paddingBottom: insets.bottom + space.md }]}>
        <PrimaryButton label="Elegir medidas" onPress={() => router.push('/measure')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  list: { padding: space.xl, gap: space.md },
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.card,
    padding: space.lg,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  check: {
    height: 26,
    width: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.bg,
  },
  checkOn: { borderColor: color.red, backgroundColor: color.red },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  chip: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.raised,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cta: {
    paddingHorizontal: space.xl,
    paddingTop: 14,
    backgroundColor: color.bg,
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
});
