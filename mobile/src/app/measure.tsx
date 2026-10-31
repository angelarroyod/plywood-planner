import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import {
  BackLink,
  Body,
  Chip,
  Display,
  IssueNote,
  Mono,
  PrimaryButton,
  ScreenHeader,
  Toast,
} from '@/components/ui';
import { Slider } from '@/components/slider';
import { nest, planBars, resolveParams, templates, weldTemplates } from '@/lib/engine';
import { useApp } from '@/lib/store';
import { Suggestions } from '@/screens/result/weld';
import { HI_INK, TNUM, font, makeStyles, radius, space, usePalette } from '@/theme';

export default function Measure() {
  const insets = useSafeAreaInsets();
  const c = usePalette();
  const s = useStyles();
  const { mode, templateId, weldTemplateId, paramsByTemplate, setParam, setTab, design, weld, issues, stale, toast } = useApp();
  const [dragging, setDragging] = useState<string | null>(null);
  const metal = mode === 'metal';
  const template = metal
    ? (weldTemplates.find((t) => t.id === weldTemplateId) ?? weldTemplates[0]!)
    : (templates.find((t) => t.id === templateId) ?? templates[0]!);
  const raw = paramsByTemplate[template.id] ?? {};
  const params = resolveParams(template.params, raw);

  const summary = useMemo(() => {
    if (metal) {
      if (!weld) return null;
      const bars = planBars(weld.members).length;
      const pieces = weld.members.reduce((n, m) => n + m.qty, 0);
      return `Con estas medidas salen ${pieces} piezas de ${bars} ${bars === 1 ? 'tramo' : 'tramos'} de ${weld.tube.label}.`;
    }
    if (!design) return null;
    const layout = nest(design.panels);
    const pieces = design.panels.reduce((n, p) => n + p.qty, 0);
    const sheets = layout.byStock
      .map((g) => `${g.sheets} hoja${g.sheets > 1 ? 's' : ''} de ${g.stock.label.toLowerCase()}`)
      .join(' y ');
    return `Con estas medidas salen ${pieces} piezas en ${sheets}.`;
  }, [metal, design, weld]);

  return (
    <View style={s.root}>
      <ScreenHeader>
        <View style={s.headRow}>
          <BackLink label="Plantilla" onPress={() => router.back()} />
          <Pressable
            onPress={() => router.push('/camera')}
            style={({ pressed }) => [s.measureBtn, pressed && { backgroundColor: c.raised }]}
            accessibilityRole="button"
          >
            <Svg viewBox="0 0 20 20" width={16} height={16}>
              <Path d="M3 6.5h3l1.5-2h5l1.5 2h3v9H3z" fill="none" stroke={c.accentInk} strokeWidth={1.5} strokeLinejoin="round" />
              <Circle cx={10} cy={10.8} r={2.8} fill="none" stroke={c.accentInk} strokeWidth={1.5} />
            </Svg>
            <Text style={s.measureLabel}>Medir</Text>
          </Pressable>
        </View>
        <Display>Medidas</Display>
        <Body size={14}>{template.name} · todo en milímetros</Body>
      </ScreenHeader>

      <ScrollView contentContainerStyle={[s.body, { paddingBottom: space.xl }]}>
        {template.params.map((spec) => {
          const value = params[spec.key]!;
          const fieldIssues = issues.filter((i) => i.paramKey === spec.key);
          const bad = fieldIssues.length > 0;
          const lit = dragging === spec.key && !bad;
          return (
            <View key={spec.key}>
              <View style={s.fieldTop}>
                <Text style={s.fieldLabel}>{spec.label}</Text>
                {spec.kind === 'number' && (
                  <View style={[s.well, bad && s.wellBad, lit && s.wellLit]}>
                    <Text style={[s.wellValue, bad && { color: c.cutInk }, lit && { color: HI_INK }]}>
                      {value}
                      {spec.unit ? <Text style={[s.wellUnit, lit && { color: HI_INK }]}> {spec.unit}</Text> : null}
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
                    onActive={(on) => setDragging(on ? spec.key : null)}
                  />
                  <View style={s.minmax}>
                    <Mono tone={c.inkFaint} size={11}>
                      {spec.min}
                    </Mono>
                    <Mono tone={c.inkFaint} size={11}>
                      {spec.max}
                    </Mono>
                  </View>
                </View>
              ) : (
                <View style={s.options}>
                  {spec.options.map((opt) => (
                    <Chip
                      key={opt.value}
                      label={opt.label}
                      swatch={opt.swatch}
                      on={opt.value === value}
                      onPress={() => setParam(spec.key, opt.value)}
                    />
                  ))}
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
          <View style={s.summary}>
            <Body tone={c.ink} size={14}>
              {summary}
            </Body>
          </View>
        )}

        {metal && weld && <Suggestions design={weld} />}
      </ScrollView>

      <View style={[s.cta, { paddingBottom: insets.bottom + space.md }]}>
        <PrimaryButton
          label="Ver diseño"
          disabled={stale}
          onPress={() => {
            setTab('model');
            router.push('/result');
          }}
        />
      </View>

      <Toast message={toast} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.paper },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  measureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.rule,
    backgroundColor: c.panel,
    paddingHorizontal: 12,
  },
  measureLabel: { fontFamily: font.bold, fontSize: 14, color: c.accentInk },
  body: { paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.lg },
  fieldTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  fieldLabel: { flex: 1, fontFamily: font.bold, fontSize: 15, color: c.ink },
  well: {
    minWidth: 96,
    minHeight: 36,
    alignItems: 'flex-end',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.rule,
    backgroundColor: c.raised,
    paddingHorizontal: 10,
  },
  wellBad: { borderColor: c.cut, backgroundColor: c.cutTint },
  wellLit: { borderColor: c.hi, backgroundColor: c.hi },
  wellValue: { fontFamily: font.monoBold, fontSize: 15, fontVariant: [...TNUM], color: c.accentInk },
  wellUnit: { fontFamily: font.mono, fontSize: 12, color: c.inkFaint },
  minmax: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -6 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  summary: { borderRadius: radius.xl, backgroundColor: c.raised, padding: 14 },
  cta: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    backgroundColor: c.panel,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.rule,
  },
}));
