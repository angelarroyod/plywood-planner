import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Display, Kicker, Mono, ScreenHeader } from '@/components/ui';
import { useApp } from '@/lib/store';
import { color, font, radius, space } from '@/theme';

/**
 * Design fixtures, not stored data — saved projects need Phase 4 (Supabase).
 * Opening one just seeds the template so the rest of the flow is real.
 */
const PROJECTS = [
  { name: 'Librero sala', meta: '800 × 1200 × 300 · 18 mm', when: 'hoy', bars: [60, 85, 45], template: 'bookshelf' },
  { name: 'Mesa auxiliar', meta: '500 × 350 × 450 · 15 mm', when: 'ayer', bars: [40, 55, 70], template: 'side-table' },
  { name: 'Librero taller', meta: '1100 × 1800 × 350 · 18 mm', when: 'may 12', bars: [80, 50, 90], template: 'bookshelf' },
];

const BAR_TONES = [color.ply, color.textSoft, color.red];

export default function Projects() {
  const insets = useSafeAreaInsets();
  const { setTemplate, setTab } = useApp();

  const open = (templateId: string) => {
    setTemplate(templateId);
    setTab('model');
    router.push('/result');
  };

  return (
    <View style={styles.root}>
      <ScreenHeader>
        <Kicker tone={color.red}>Mis proyectos</Kicker>
        <Display size={34} style={{ marginTop: 3 }}>
          Taller
        </Display>
      </ScreenHeader>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.lg }}>
        <View style={styles.list}>
          {PROJECTS.map((p) => (
            <Pressable
              key={p.name}
              onPress={() => open(p.template)}
              style={({ pressed }) => [styles.row, pressed && { transform: [{ scale: 0.985 }] }]}
              accessibilityRole="button"
            >
              <View style={styles.thumb}>
                {p.bars.map((h, i) => (
                  <View
                    key={i}
                    style={{ flex: 1, height: `${h}%`, backgroundColor: BAR_TONES[i] }}
                  />
                ))}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Display size={20} semi>
                  {p.name}
                </Display>
                <Mono tone={color.textMuted} size={11} style={{ marginTop: 2 }}>
                  {p.meta}
                </Mono>
              </View>
              <Mono tone={color.textFaint} size={10} style={styles.when}>
                {p.when}
              </Mono>
            </Pressable>
          ))}
        </View>

        <View style={{ paddingHorizontal: space.xl, paddingTop: space.lg }}>
          <Pressable
            onPress={() => router.push('/templates')}
            style={({ pressed }) => [styles.new, pressed && { transform: [{ scale: 0.985 }] }]}
            accessibilityRole="button"
          >
            <Text style={{ fontSize: 20, lineHeight: 22, color: color.red }}>+</Text>
            <Display size={19} semi style={{ letterSpacing: 0.76 }}>
              Nuevo proyecto
            </Display>
          </Pressable>
        </View>

        <View style={styles.account}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>A</Text>
          </View>
          <View>
            <Body tone={color.text} size={13}>
              Ángel Arroyo
            </Body>
            <Mono tone={color.textFaint} size={10} style={{ letterSpacing: 1.2 }}>
              ICLOUD · SINCRONIZADO
            </Mono>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  list: { paddingHorizontal: space.xl, paddingTop: 18, gap: 10 },
  row: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    minHeight: 74,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    borderLeftWidth: 3,
    borderLeftColor: color.red,
    backgroundColor: color.card,
    padding: 12,
  },
  thumb: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 44,
    width: 44,
    borderRadius: radius.sm,
    backgroundColor: color.raised,
    padding: 6,
  },
  when: { textTransform: 'uppercase' },
  new: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 56,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.borderMuted,
    borderRadius: radius.md,
    backgroundColor: color.cardAlt,
  },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: space.xl,
    marginTop: space.sm,
  },
  avatar: {
    height: 38,
    width: 38,
    borderRadius: radius.sm,
    backgroundColor: color.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { fontFamily: font.display, fontSize: 19, color: color.white },
});
