import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Body, Display, Mono } from '@/components/ui';
import { Viewer3D } from '@/components/viewer-3d';
import { useApp } from '@/lib/store';
import { color, font, radius, space } from '@/theme';

const RING = 52;
const R = 23;
const CIRC = 2 * Math.PI * R;

export function StepsPane() {
  const { design, exploded, activeStep, setActiveStep, doneSteps, toggleStepDone, stale, taller } =
    useApp();
  const steps = design!.steps;
  // A step may reference a fitting (the rod); panel labels win on a shared id.
  const labels = useMemo(
    () => Object.fromEntries([...design!.fittings, ...design!.panels].map((p) => [p.id, p.label])),
    [design],
  );
  const step = steps.find((s) => s.order === activeStep) ?? null;
  const done = doneSteps.length;
  const pct = steps.length ? done / steps.length : 0;

  return (
    <View style={styles.root}>
      <View style={[styles.viewport, stale && { opacity: 0.45 }]}>
        <Viewer3D design={design!} exploded={exploded} highlightStep={step} />
        <View pointerEvents="none" style={styles.hintWrap}>
          <View style={styles.hint}>
            <Mono tone={color.textMuted} size={9} style={styles.hintText}>
              {activeStep ? `Paso ${activeStep} resaltado` : 'Toca un paso para resaltar'}
            </Mono>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.list}>
        <View style={styles.header}>
          <View style={styles.ring}>
            <Svg width={RING} height={RING}>
              <Circle cx={RING / 2} cy={RING / 2} r={R} stroke={color.border} strokeWidth={5} fill="none" />
              <Circle
                cx={RING / 2}
                cy={RING / 2}
                r={R}
                stroke={color.red}
                strokeWidth={5}
                fill="none"
                strokeDasharray={`${CIRC * pct} ${CIRC}`}
                strokeLinecap="butt"
                transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
              />
            </Svg>
            <View style={styles.ringLabel} pointerEvents="none">
              <Mono size={12} style={{ fontFamily: font.monoMed }}>
                {`${done}/${steps.length}`}
              </Mono>
            </View>
          </View>
          <View style={{ minWidth: 0, flex: 1 }}>
            <Display size={28}>Armado</Display>
            <Mono tone={color.textSoft} size={10} style={styles.sub}>
              {done === steps.length ? 'Terminado · nice work' : 'Toca un paso para verlo en 3D'}
            </Mono>
          </View>
        </View>

        <View style={{ gap: 10, marginTop: 16 }}>
          {steps.map((st) => {
            const active = st.order === activeStep;
            const isDone = doneSteps.includes(st.order);
            return (
              <View
                key={st.order}
                style={[
                  styles.card,
                  taller && { borderWidth: 2, padding: 16 },
                  active && !isDone && styles.cardActive,
                  isDone && { backgroundColor: color.cardAlt, opacity: 0.72 },
                ]}
              >
                <View style={styles.cardRow}>
                  <Pressable
                    onPress={() => toggleStepDone(st.order)}
                    style={[styles.check, isDone && { borderColor: color.red, backgroundColor: color.red }]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isDone }}
                    accessibilityLabel={`Marcar paso ${st.order}`}
                  >
                    <Text style={{ fontSize: 17, color: isDone ? color.white : 'transparent' }}>✓</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setActiveStep(st.order)}
                    style={{ flex: 1, minWidth: 0 }}
                    accessibilityRole="button"
                  >
                    <View style={styles.titleRow}>
                      <Mono tone={color.red} size={10}>
                        {String(st.order).padStart(2, '0')}
                      </Mono>
                      <Text
                        style={[
                          styles.title,
                          isDone && { color: color.textSoft, textDecorationLine: 'line-through' },
                        ]}
                      >
                        {st.title}
                      </Text>
                    </View>
                    <Body size={13} style={{ marginTop: 4 }}>
                      {st.description}
                    </Body>

                    {st.panelRefs.length > 0 && (
                      <View style={styles.refs}>
                        {st.panelRefs.map((id) => (
                          <View
                            key={id}
                            style={[
                              styles.refChip,
                              active && !isDone && { borderColor: color.red, backgroundColor: color.errBg },
                            ]}
                          >
                            <Mono tone={active && !isDone ? color.errRef : color.textMuted} size={10}>
                              {labels[id] ?? id}
                            </Mono>
                          </View>
                        ))}
                      </View>
                    )}
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  viewport: { height: 250, backgroundColor: color.void },
  hintWrap: { position: 'absolute', left: 0, right: 0, bottom: 8, alignItems: 'center' },
  hint: {
    borderRadius: radius.sm,
    backgroundColor: 'rgba(30,33,38,0.85)',
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  hintText: { letterSpacing: 1.3, textTransform: 'uppercase' },
  list: { paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.xxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ring: { height: RING, width: RING, alignItems: 'center', justifyContent: 'center' },
  ringLabel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sub: { marginTop: 2, letterSpacing: 1.4, textTransform: 'uppercase' },
  card: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.card,
    padding: 12,
  },
  cardActive: {
    borderColor: color.red,
    borderLeftWidth: 3,
    borderLeftColor: color.red,
    backgroundColor: color.redTintBg,
  },
  cardRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  check: {
    height: 44,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: color.borderMuted,
    backgroundColor: color.bg,
  },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  title: {
    flex: 1,
    fontFamily: font.displaySemi,
    fontSize: 21,
    letterSpacing: 0.63,
    textTransform: 'uppercase',
    color: color.text,
  },
  refs: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 },
  refChip: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.raised,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
});
