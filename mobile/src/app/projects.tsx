import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Caption, Display, Mono, RuleLabel, ScreenHeader, Thumb, Title } from '@/components/ui';
import { useApp } from '@/lib/store';
import { ON_ACCENT, font, makeStyles, radius, space, usePalette } from '@/theme';

/**
 * Design fixtures, not stored data — saved projects need Phase 6 (Supabase).
 * Opening one just seeds the template so the rest of the flow is real.
 */
const PROJECTS = [
  { name: 'Librero sala', meta: '800 × 1200 × 300 · 18 mm', when: 'hoy', template: 'bookshelf' },
  { name: 'Mesa auxiliar', meta: '500 × 350 × 450 · 15 mm', when: 'ayer', template: 'side-table' },
  { name: 'Librero taller', meta: '1100 × 1800 × 350 · 18 mm', when: '12 may', template: 'bookshelf' },
];

export default function Projects() {
  const insets = useSafeAreaInsets();
  const c = usePalette();
  const s = useStyles();
  const { setTemplate, setTab } = useApp();

  const open = (templateId: string) => {
    setTemplate(templateId);
    setTab('model');
    router.push('/result');
  };

  return (
    <View style={s.root}>
      <ScreenHeader>
        <Display style={{ marginTop: space.sm }}>Mis proyectos</Display>
      </ScreenHeader>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.lg }}>
        <View style={s.list}>
          <RuleLabel>Recientes</RuleLabel>
          {PROJECTS.map((p) => (
            <Pressable
              key={p.name}
              onPress={() => open(p.template)}
              style={({ pressed }) => [s.row, pressed && s.pressed]}
              accessibilityRole="button"
            >
              <Thumb id={p.template} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Title>{p.name}</Title>
                <Mono tone={c.inkSoft} size={12} style={{ marginTop: 2 }}>
                  {p.meta}
                </Mono>
              </View>
              <Caption>{p.when}</Caption>
            </Pressable>
          ))}

          <Pressable
            onPress={() => router.push('/templates')}
            style={({ pressed }) => [s.new, pressed && s.pressed]}
            accessibilityRole="button"
          >
            <Text style={s.newLabel}>+ Nuevo proyecto</Text>
          </Pressable>
        </View>

        <View style={s.account}>
          <View style={s.avatar}>
            <Text style={s.avatarLetter}>A</Text>
          </View>
          <View>
            <Body tone={c.ink} size={14} bold>
              Ángel Arroyo
            </Body>
            <Caption>iCloud · sincronizado</Caption>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.paper },
  list: { paddingHorizontal: space.lg, paddingTop: space.lg, gap: 10 },
  row: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    minHeight: 72,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.rule,
    backgroundColor: c.panel,
    padding: 12,
  },
  pressed: { backgroundColor: c.raised },
  new: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: c.ruleStrong,
    borderRadius: radius.xl,
  },
  newLabel: { fontFamily: font.bold, fontSize: 15, color: c.accentInk },
  account: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: space.lg, marginTop: space.sm },
  avatar: {
    height: 38,
    width: 38,
    borderRadius: 19,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { fontFamily: font.heavy, fontSize: 17, color: ON_ACCENT },
}));
