import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Display, PrimaryButton } from '@/components/ui';
import { color, font, space } from '@/theme';

/** The four bars are the app's mark: plywood plies seen edge-on. */
const BARS = [
  { h: 52, bg: color.red },
  { h: 64, bg: color.text },
  { h: 38, bg: color.red },
  { h: 58, bg: color.borderStrong },
];

const POINTS = [
  ['Elige plantilla y medidas.', 'Te avisamos si el claro se va a pandear.'],
  ['Llévate el plan de corte.', 'Cuántas hojas, cuánto desperdicio, cuánto cuesta.'],
  ['Arma paso por paso.', 'Con el 3D resaltando la pieza de cada paso.'],
];

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const go = () => router.push('/projects');

  return (
    <View style={[styles.root, { paddingTop: insets.top + 64, paddingBottom: insets.top + 24 }]}>
      <View style={styles.bars}>
        {BARS.map((b, i) => (
          <View key={i} style={{ width: 13, height: b.h, backgroundColor: b.bg }} />
        ))}
      </View>

      <Display size={56} style={styles.title}>
        {'Diseña,\ncorta,\narma.'}
      </Display>
      <Body size={15} style={{ marginTop: 14 }}>
        Un mueble bien planeado, sin cuentas a mano ni desperdicio de más.
      </Body>

      <View style={styles.points}>
        {POINTS.map(([lead, rest], i) => (
          <View key={i} style={styles.point}>
            <Text style={styles.num}>{String(i + 1).padStart(2, '0')}</Text>
            <Text style={styles.pointText}>
              <Text style={styles.pointLead}>{lead}</Text>
              <Text style={{ color: color.textMuted }}> {rest}</Text>
            </Text>
          </View>
        ))}
      </View>

      <PrimaryButton label="Empezar" onPress={go} style={{ marginTop: 26 }} />
      <Pressable onPress={go} style={styles.signIn} accessibilityRole="button">
        <Text style={styles.signInLabel}>Ya tengo proyectos · Sign in</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg, paddingHorizontal: 26 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 64 },
  title: { marginTop: 24, lineHeight: 50 },
  points: { marginTop: 'auto', gap: 14 },
  point: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  num: { fontFamily: font.mono, fontSize: 10, paddingTop: 3, color: color.red },
  pointText: { flex: 1, fontFamily: font.body, fontSize: 14, lineHeight: 21, color: color.text },
  pointLead: { fontFamily: font.bodySemi, color: color.text },
  signIn: { marginTop: 10, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  signInLabel: {
    fontFamily: font.mono,
    fontSize: 11,
    letterSpacing: 1.76,
    textTransform: 'uppercase',
    color: color.textMuted,
  },
});
