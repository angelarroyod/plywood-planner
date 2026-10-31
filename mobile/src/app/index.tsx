import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Display, Mark, Mono, PrimaryButton } from '@/components/ui';
import { HI_INK, font, makeStyles, usePalette } from '@/theme';

const POINTS = [
  ['Elige plantilla y medidas.', 'Te avisamos si el claro se va a pandear.'],
  ['Llévate el plan de corte.', 'Cuántas hojas, cuánto desperdicio, cuánto cuesta.'],
  ['Arma paso por paso.', 'Con el 3D resaltando la pieza de cada paso.'],
];

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const c = usePalette();
  const s = useStyles();
  const go = () => router.push('/projects');

  return (
    <View style={[s.root, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 16 }]}>
      <Mark />

      <Display size={40} style={s.title}>
        {'Diseña, corta, '}
        <Text style={{ backgroundColor: c.hi, color: HI_INK }}>arma.</Text>
      </Display>
      <Body size={16} style={{ marginTop: 12 }}>
        Un mueble bien planeado, sin cuentas a mano ni desperdicio de más.
      </Body>

      <View style={s.points}>
        {POINTS.map(([lead, rest], i) => (
          <View key={i} style={s.point}>
            <View style={s.marker}>
              <Mono tone={c.accentInk} size={13} bold>
                {i + 1}
              </Mono>
            </View>
            <Text style={s.pointText}>
              <Text style={s.pointLead}>{lead}</Text>
              <Text style={{ color: c.inkSoft }}> {rest}</Text>
            </Text>
          </View>
        ))}
      </View>

      <PrimaryButton label="Empezar" onPress={go} style={{ marginTop: 28 }} />
      <Pressable onPress={go} style={s.signIn} accessibilityRole="button">
        <Text style={s.signInLabel}>Ya tengo proyectos · Entrar</Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.paper, paddingHorizontal: 24 },
  title: { marginTop: 28, lineHeight: 50 },
  points: { marginTop: 'auto', gap: 16 },
  point: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  marker: {
    height: 30,
    width: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: c.ruleStrong,
    backgroundColor: c.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointText: { flex: 1, fontFamily: font.regular, fontSize: 15, lineHeight: 22, color: c.ink, paddingTop: 3 },
  pointLead: { fontFamily: font.bold, color: c.ink },
  signIn: { marginTop: 8, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  signInLabel: { fontFamily: font.bold, fontSize: 14, color: c.accentInk },
}));
