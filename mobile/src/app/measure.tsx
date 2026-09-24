import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Rect } from 'react-native-svg';
import {
  BackLink,
  Body,
  Display,
  IssueNote,
  Kicker,
  Mono,
  PrimaryButton,
  ScreenHeader,
} from '@/components/ui';
import { Slider } from '@/components/slider';
import { nest, resolveParams, templates } from '@/lib/engine';
import { useApp } from '@/lib/store';
import { color, font, radius, space } from '@/theme';

export default function Measure() {
  const insets = useSafeAreaInsets();
  const { templateId, paramsByTemplate, setParam, setTab, design, issues, stale } = useApp();
  const template = templates.find((t) => t.id === templateId) ?? templates[0]!;
  const raw = paramsByTemplate[templateId] ?? {};
  const params = resolveParams(template.params, raw);

  const summary = useMemo(() => {
    if (!design) return null;
    const layout = nest(design.panels);
    const pieces = design.panels.reduce((n, p) => n + p.qty, 0);
    const sheets = layout.byStock
      .map((g) => `${g.sheets} hoja${g.sheets > 1 ? 's' : ''} de ${g.stock.label.toLowerCase()}`)
      .join(' y ');
    return `Con estas medidas salen ${pieces} piezas en ${sheets}.`;
  }, [design]);

  return (
    <View style={styles.root}>
      <ScreenHeader>
        <View style={styles.headRow}>
          <BackLink label="Plantilla" onPress={() => router.back()} />
          <Pressable
            onPress={() => router.push('/camera')}
            style={({ pressed }) => [styles.measureBtn, pressed && { transform: [{ scale: 0.97 }] }]}
            accessibilityRole="button"
          >
            <Svg viewBox="0 0 20 20" width={15} height={15}>
              <Rect x={1.5} y={4.5} width={17} height={12} rx={2} fill="none" stroke={color.red} strokeWidth={1.6} />
              <Circle cx={10} cy={10.5} r={3.4} fill="none" stroke={color.text} strokeWidth={1.6} />
              <Rect x={7} y={2.5} width={6} height={2.4} rx={1} fill={color.red} />
            </Svg>
            <Mono size={10} style={{ letterSpacing: 1.2, textTransform: 'uppercase' }}>
              Medir
            </Mono>
          </Pressable>
        </View>
        <Display size={32} style={{ marginTop: 8 }}>
          Medidas
        </Display>
        <Kicker tone={color.textFaint} style={{ marginTop: 2 }}>
          Measurements · mm
        </Kicker>
      </ScreenHeader>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: space.xl }]}>
        {template.params.map((spec) => {
          const value = params[spec.key]!;
          const fieldIssues = issues.filter((i) => i.paramKey === spec.key);
          const bad = fieldIssues.length > 0;
          return (
            <View key={spec.key}>
              <View style={styles.fieldTop}>
                <Text style={styles.fieldLabel}>{spec.label}</Text>
                {spec.kind === 'number' && (
                  <View style={[styles.chip, bad && styles.chipBad]}>
                    <Text style={[styles.chipValue, bad && { color: color.errChip }]}>
                      {value}
                      <Text style={styles.chipUnit}>{spec.unit ? ` ${spec.unit}` : ''}</Text>
                    </Text>
                  </View>
                )}
              </View>

              {spec.kind === 'number' ? (
                <View>
                  <Slider
                    min={spec.min}
                    max={spec.max}
                    step={spec.step}
                    value={value}
                    invalid={bad}
                    accessibilityLabel={spec.label}
                    onChange={(v) => setParam(spec.key, v)}
                  />
                  <View style={styles.minmax}>
                    <Mono tone={color.textFaint} size={10}>
                      {spec.min}
                    </Mono>
                    <Mono tone={color.textFaint} size={10}>
                      {spec.max}
                    </Mono>
                  </View>
                </View>
              ) : (
                <View style={styles.options}>
                  {spec.options.map((opt) => {
                    const on = opt.value === value;
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => setParam(spec.key, opt.value)}
                        style={({ pressed }) => [
                          styles.option,
                          on && { borderColor: color.red, backgroundColor: color.red },
                          pressed && { transform: [{ scale: 0.97 }] },
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                      >
                        <Mono tone={on ? color.white : color.textMuted} size={13}>
                          {opt.label}
                        </Mono>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {fieldIssues.map((issue, n) => (
                <IssueNote key={n} message={issue.message} />
              ))}
            </View>
          );
        })}

        {issues
          .filter((i) => !i.paramKey)
          .map((issue, n) => (
            <IssueNote key={n} message={issue.message} />
          ))}

        {summary && (
          <View style={styles.summary}>
            <Mono tone={color.red} size={10}>
              ≈
            </Mono>
            <Body style={{ flex: 1 }}>{summary}</Body>
          </View>
        )}
      </ScrollView>

      <View style={[styles.cta, { paddingBottom: insets.bottom + space.md }]}>
        <PrimaryButton
          label="Ver diseño"
          disabled={stale}
          onPress={() => {
            setTab('model');
            router.push('/result');
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  measureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 38,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.card,
    paddingHorizontal: 12,
  },
  body: { paddingHorizontal: space.xl, paddingTop: 20, gap: 22 },
  fieldTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  fieldLabel: {
    fontFamily: font.displaySemi,
    fontSize: 20,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: color.text,
  },
  chip: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.raised,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipBad: { borderColor: color.red, backgroundColor: color.errBg },
  chipValue: { fontFamily: font.monoMed, fontSize: 18, color: color.text },
  chipUnit: { fontFamily: font.mono, fontSize: 11, color: color.textSoft },
  minmax: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -6 },
  options: { gap: 8, marginTop: 10 },
  option: {
    minHeight: 48,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.card,
  },
  summary: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.card,
    padding: 14,
  },
  cta: {
    paddingHorizontal: space.xl,
    paddingTop: 14,
    backgroundColor: color.bg,
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
});
