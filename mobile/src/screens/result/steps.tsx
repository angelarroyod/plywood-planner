import { useMemo, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Body, Display, Hi, Mono, ScaleChip, StalePill } from '@/components/ui';
import { Viewer3D } from '@/components/viewer-3d';
import { refLabels, type Step } from '@/lib/engine';
import { useApp } from '@/lib/store';
import { ON_ACCENT, font, makeStyles, radius, space, usePalette } from '@/theme';

const RING = 52;
const R = 22;
const CIRC = 2 * Math.PI * R;
const MARKER = 30;

export function StepsPane() {
  const { design, exploded, activeStep, stale } = useApp();
  const labels = useMemo(() => refLabels(design!), [design]);
  const step = design!.steps.find((s) => s.order === activeStep) ?? null;
  return (
    <StepList
      steps={design!.steps}
      labels={labels}
      viewer={<Viewer3D design={design!} exploded={exploded} highlightStep={step} style={stale && { opacity: 0.45 }} />}
    />
  );
}

/**
 * The step list under its 3D viewport: numbered round markers on a vertical rule.
 * The active step's marker fills ballpoint, its card takes the wash and its title
 * the highlighter. `detail` adds per-step extras below the part tags.
 */
export function StepList<S extends Step>({
  steps,
  labels,
  viewer,
  detail,
}: {
  steps: S[];
  labels: Record<string, string>;
  viewer: ReactNode;
  detail?: (step: S) => ReactNode;
}) {
  const c = usePalette();
  const s = useStyles();
  const { activeStep, setActiveStep, doneSteps, toggleStepDone, stale, taller } = useApp();
  const done = doneSteps.length;
  const pct = steps.length ? done / steps.length : 0;

  return (
    <View style={s.root}>
      <View style={s.viewport}>
        {viewer}
        <ScaleChip />
        {stale && <StalePill />}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.list}>
        <View style={s.header}>
          <View style={s.ring}>
            <Svg width={RING} height={RING}>
              <Circle cx={RING / 2} cy={RING / 2} r={R} stroke={c.rule} strokeWidth={4} fill="none" />
              {pct > 0 && <Circle
                cx={RING / 2}
                cy={RING / 2}
                r={R}
                stroke={c.accent}
                strokeWidth={4}
                fill="none"
                strokeDasharray={`${CIRC * pct} ${CIRC}`}
                strokeLinecap="round"
                transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
              />}
            </Svg>
            <View style={s.ringLabel} pointerEvents="none">
              <Mono size={12} bold>{`${done}/${steps.length}`}</Mono>
            </View>
          </View>
          <View style={{ minWidth: 0, flex: 1 }}>
            <Display>Armado</Display>
            <Body size={14}>{done === steps.length ? 'Terminado. Buen trabajo.' : 'Toca un paso para verlo en 3D'}</Body>
          </View>
        </View>

        <View style={{ marginTop: space.lg }}>
          {steps.map((st, i) => {
            const active = st.order === activeStep;
            const isDone = doneSteps.includes(st.order);
            const last = i === steps.length - 1;
            return (
              <View key={st.order} style={s.row}>
                <View style={s.rail}>
                  {!last && <View style={s.railLine} />}
                  <View style={[s.marker, active && s.markerOn]}>
                    <Mono size={13} bold tone={active ? ON_ACCENT : c.inkSoft}>
                      {st.order}
                    </Mono>
                  </View>
                </View>

                <View style={[s.card, taller && { borderWidth: 2, padding: 16 }, active && s.cardOn, isDone && !active && s.cardDone]}>
                  <Pressable onPress={() => setActiveStep(st.order)} style={{ flex: 1, minWidth: 0 }} accessibilityRole="button" accessibilityState={{ selected: active }}>
                    <Text style={[s.title, isDone && !active && { color: c.inkFaint, textDecorationLine: 'line-through' }]}>
                      {active ? <Hi>{` ${st.title} `}</Hi> : st.title}
                    </Text>
                    <Body size={14} style={{ marginTop: 4 }}>
                      {st.description}
                    </Body>

                    {st.panelRefs.length > 0 && (
                      <View style={s.refs}>
                        {st.panelRefs.map((id) => (
                          <Text key={id} style={s.refChip}>
                            {labels[id] ?? id}
                          </Text>
                        ))}
                      </View>
                    )}
                    {detail?.(st)}
                  </Pressable>

                  <Pressable
                    onPress={() => toggleStepDone(st.order)}
                    style={[s.check, isDone && s.checkOn]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isDone }}
                    accessibilityLabel={`Marcar paso ${st.order}`}
                  >
                    {isDone && (
                      <Svg viewBox="0 0 20 20" width={18} height={18}>
                        <Path d="m4.5 10.5 3.5 3.5 7.5-8" fill="none" stroke={ON_ACCENT} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
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

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.paper },
  viewport: { height: 260, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.rule },
  list: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.xxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ring: { height: RING, width: RING, alignItems: 'center', justifyContent: 'center' },
  ringLabel: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: 10, paddingBottom: 10 },
  rail: { width: MARKER, alignItems: 'center', paddingTop: 12 },
  railLine: { position: 'absolute', top: 12, bottom: -12, width: 1, backgroundColor: c.ruleStrong },
  marker: {
    height: MARKER,
    width: MARKER,
    borderRadius: MARKER / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: c.ruleStrong,
    backgroundColor: c.panel,
  },
  markerOn: { borderColor: c.accent, backgroundColor: c.accent },
  card: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: c.rule,
    backgroundColor: c.panel,
    padding: 12,
  },
  cardOn: { borderColor: c.accent, backgroundColor: c.accentTint },
  cardDone: { backgroundColor: c.raised },
  title: { fontFamily: font.bold, fontSize: 16, lineHeight: 22, color: c.ink },
  refs: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 },
  refChip: {
    overflow: 'hidden',
    borderRadius: radius.md,
    backgroundColor: c.raised,
    paddingHorizontal: 7,
    paddingVertical: 3,
    fontFamily: font.semi,
    fontSize: 12,
    color: c.inkSoft,
  },
  check: {
    height: 44,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: c.ruleStrong,
    backgroundColor: c.panel,
  },
  checkOn: { borderColor: c.accent, backgroundColor: c.accent },
}));
