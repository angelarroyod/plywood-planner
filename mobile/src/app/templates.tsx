import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { BackLink, Body, Display, PrimaryButton, ScreenHeader, Thumb, Title } from '@/components/ui';
import { templates } from '@/lib/engine';
import { useApp } from '@/lib/store';
import { ON_ACCENT, TNUM, font, makeStyles, radius, space, usePalette } from '@/theme';

export default function Templates() {
  const insets = useSafeAreaInsets();
  const c = usePalette();
  const s = useStyles();
  const { templateId, setTemplate } = useApp();

  return (
    <View style={s.root}>
      <ScreenHeader>
        <BackLink label="Proyectos" onPress={() => router.back()} />
        <Display>¿Qué vas a hacer?</Display>
        <Body size={14}>Elige una plantilla</Body>
      </ScreenHeader>

      <ScrollView contentContainerStyle={s.list}>
        {templates.map((t) => {
          const active = t.id === templateId;
          const ranges = t.params.flatMap((p) => (p.kind === 'number' ? [p] : [])).slice(0, 3);
          return (
            <Pressable
              key={t.id}
              onPress={() => setTemplate(t.id)}
              style={({ pressed }) => [s.card, active && s.cardOn, pressed && !active && { backgroundColor: c.raised }]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <View style={s.cardTop}>
                <Thumb id={t.id} on={active} size={48} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Title size={17}>{t.name}</Title>
                  <Body size={14}>{t.description}</Body>
                </View>
                <View style={[s.check, active && s.checkOn]}>
                  {active && (
                    <Svg viewBox="0 0 20 20" width={14} height={14}>
                      <Path d="m4.5 10.5 3.5 3.5 7.5-8" fill="none" stroke={ON_ACCENT} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  )}
                </View>
              </View>

              <View style={s.chips}>
                {ranges.map((p) => (
                  <View key={p.key} style={s.chip}>
                    <Text style={s.chipLabel}>
                      {p.label}{' '}
                      <Text style={s.chipRange}>
                        {p.min}–{p.max}
                      </Text>
                    </Text>
                  </View>
                ))}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[s.cta, { paddingBottom: insets.bottom + space.md }]}>
        <PrimaryButton label="Elegir medidas" onPress={() => router.push('/measure')} />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.paper },
  list: { padding: space.lg, gap: space.md },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: c.rule,
    backgroundColor: c.panel,
    padding: 14,
  },
  cardOn: { borderColor: c.accent, backgroundColor: c.accentTint },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  check: {
    height: 24,
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.ruleStrong,
    backgroundColor: c.panel,
  },
  checkOn: { borderColor: c.accent, backgroundColor: c.accent },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  chip: {
    borderRadius: radius.md,
    backgroundColor: c.raised,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipLabel: { fontFamily: font.semi, fontSize: 12, color: c.inkSoft },
  chipRange: { fontFamily: font.mono, fontVariant: [...TNUM], color: c.ink },
  cta: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    backgroundColor: c.panel,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.rule,
  },
}));
