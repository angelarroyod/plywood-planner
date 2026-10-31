import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';
import {
  HI_INK,
  ON_ACCENT,
  TNUM,
  TOUCH,
  font,
  makeStyles,
  radius,
  shadow,
  space,
  usePalette,
  useScheme,
} from '@/theme';

/** View headings and the wordmark: heavy, sentence case, a touch tight. */
export function Display({
  children,
  size = 24,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  size?: number;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const c = usePalette();
  return (
    <Text
      numberOfLines={numberOfLines}
      accessibilityRole="header"
      style={[
        { fontFamily: font.heavy, fontSize: size, lineHeight: Math.round(size * 1.333), letterSpacing: -0.01 * size, color: c.ink },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** The app's mark, same as the web top bar: a ballpoint page of cuadrícula with one highlighted row. */
export function Mark({ size = 56 }: { size?: number }) {
  const c = usePalette();
  return (
    <Svg viewBox="0 0 32 32" width={size} height={size} accessibilityLabel="Planificador">
      <Rect width={32} height={32} rx={8} fill={c.accent} />
      <Rect x={7} y={17.5} width={18} height={5} rx={1.5} fill={c.hi} />
      <Path
        d="M7 9.5h18M7 14.5h18M7 19.5h18M7 24.5h18M9.5 7v18M14.5 7v18M19.5 7v18M24.5 7v18"
        stroke="#fff"
        strokeOpacity={0.55}
        strokeWidth={1}
      />
    </Svg>
  );
}

// ponytail: mirrors THUMBS in the web TemplatePicker; move both into the engine if a third client appears
const THUMBS: Record<string, string> = {
  bookshelf: 'M11 4h18v32H11zM11 12h18M11 20h18M11 28h18',
  'side-table': 'M6 12h28M9 12v22M31 12v22M9 28h22',
  closet: 'M8 4h24v32H8zM20 4v32M8 9h24M12 14h4m8 0h4M8 31h24',
  'tv-stand': 'M4 14h32v16H4zM20 14v16M8 22h8M24 22h8M7 30v4m26-4v4',
  'weld-table': 'M4 13h32M4 15.5h32M7 15.5v20M33 15.5v20M7 29h26',
  'weld-stool': 'M11 10h18M11 12.5h18M13 12.5v24M27 12.5v24M13 26h14',
  'weld-shelf': 'M9 4v32M31 4v32M9 6h22M9 16h22M9 26h22M9 34h22',
};

/** Template thumbnail: a front elevation in one line weight, ballpoint when selected. */
export function Thumb({ id, on, size = 44 }: { id: string; on?: boolean; size?: number }) {
  const c = usePalette();
  return (
    <View
      style={{
        height: size,
        width: size,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: on ? c.accent : c.rule,
        backgroundColor: c.panel,
      }}
    >
      <Svg viewBox="0 0 40 40" width={size * 0.8} height={size * 0.8}>
        <Path d={THUMBS[id] ?? ''} fill="none" stroke={on ? c.accentInk : c.inkSoft} strokeWidth={1.5} strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

/** Step titles and template names. */
export function Title({ children, size = 16, style }: { children: ReactNode; size?: number; style?: StyleProp<TextStyle> }) {
  const c = usePalette();
  return (
    <Text style={[{ fontFamily: font.bold, fontSize: size, lineHeight: Math.round(size * 1.375), color: c.ink }, style]}>
      {children}
    </Text>
  );
}

/** Section head: bold sentence case in pencil, then a hairline to the edge. */
export function RuleLabel({ children, right, style }: { children: ReactNode; right?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = usePalette();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.md }, style]}>
      <Text accessibilityRole="header" style={{ fontFamily: font.bold, fontSize: 13, lineHeight: 18, color: c.inkSoft }}>
        {children}
      </Text>
      <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.rule }} />
      {right}
    </View>
  );
}

export function Body({
  children,
  tone,
  size = 15,
  bold,
  style,
}: {
  children: ReactNode;
  tone?: string;
  size?: number;
  bold?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  const c = usePalette();
  return (
    <Text
      style={[
        { fontFamily: bold ? font.bold : font.regular, fontSize: size, lineHeight: Math.round(size * (size < 15 ? 1.625 : 1.5)), color: tone ?? c.inkSoft },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** Summary labels, units, tab labels. */
export function Caption({
  children,
  tone,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  tone?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const c = usePalette();
  return (
    <Text numberOfLines={numberOfLines} style={[{ fontFamily: font.semi, fontSize: 12, lineHeight: 16, color: tone ?? c.inkFaint }, style]}>
      {children}
    </Text>
  );
}

/** Numbers, measurements and piece codes only — never words. */
export function Mono({
  children,
  tone,
  size = 12,
  bold,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  tone?: string;
  size?: number;
  bold?: boolean;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const c = usePalette();
  return (
    <Text numberOfLines={numberOfLines} style={[{ fontFamily: bold ? font.monoBold : font.mono, fontSize: size, fontVariant: [...TNUM], color: tone ?? c.ink }, style]}>
      {children}
    </Text>
  );
}

/** The highlighter: where you are right now, always under dark ink. A marker stroke by day, a solid swatch at night. */
export function Hi({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const c = usePalette();
  // ponytail: RN can't paint half a line box, so the day stroke is a full swatch too — a View underlay breaks on wrapped titles
  return <Text style={[{ backgroundColor: c.hi, color: HI_INK, borderRadius: 3 }, style]}>{children}</Text>;
}

/** Ballpoint fill, one per bar. The design gives it a press, so it gets haptics too. */
export function PrimaryButton({
  label,
  onPress,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const s = useStyles();
  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      disabled={disabled}
      style={({ pressed }) => [s.primary, disabled && s.primaryOff, pressed && !disabled && s.pressed, style]}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
    >
      <Text style={[s.primaryLabel, disabled && s.primaryLabelOff]}>{label}</Text>
    </Pressable>
  );
}

/** Quiet: hairline border and pencil text. */
export function SecondaryButton({
  label,
  onPress,
  style,
}: {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const s = useStyles();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.quiet, pressed && s.quietPressed, style]}
      accessibilityRole="button"
    >
      <Text style={s.quietLabel}>{label}</Text>
    </Pressable>
  );
}

/** Selectable chip; `on` takes the ballpoint border, wash and ink. */
export function Chip({
  label,
  on,
  onPress,
  swatch,
  style,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  swatch?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const s = useStyles();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.chip, on && s.chipOn, pressed && { opacity: 0.85 }, style]}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
    >
      {swatch && <View style={[s.swatch, { backgroundColor: swatch }]} />}
      <Text style={[s.chipLabel, on && s.chipLabelOn]}>{label}</Text>
    </Pressable>
  );
}

/** Back chevron + label, the standard nav affordance. */
export function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  const c = usePalette();
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: TOUCH }} accessibilityRole="button" hitSlop={8}>
      <Svg viewBox="0 0 20 20" width={18} height={18}>
        <Path d="M12.5 4 6.5 10l6 6" fill="none" stroke={c.accentInk} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      <Text style={{ fontFamily: font.bold, fontSize: 15, color: c.accentInk }}>{label}</Text>
    </Pressable>
  );
}

/** Sticky screen header on sheet white, with the status-bar inset accounted for. */
export function ScreenHeader({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  return <View style={[s.header, { paddingTop: insets.top + space.xs }]}>{children}</View>;
}

/** Line warning triangle, in whatever ink the caller passes. */
export function WarnIcon({ tone, size = 16 }: { tone: string; size?: number }) {
  return (
    <Svg viewBox="0 0 20 20" width={size} height={size}>
      <Path d="M10 3 18 17H2L10 3ZM10 8v4M10 14.5h.01" fill="none" stroke={tone} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Validation issue: a full margin-red wash with a line icon — never a side stripe. */
export function IssueNote({ message }: { message: string }) {
  const c = usePalette();
  const s = useStyles();
  return (
    <View style={s.issue} accessibilityRole="alert">
      <View style={{ paddingTop: 2 }}>
        <WarnIcon tone={c.cutInk} />
      </View>
      <Body tone={c.cutInk} size={13} style={{ flex: 1, fontFamily: font.semi }}>
        {message}
      </Body>
    </View>
  );
}

/** Shown over a stage while params are invalid and the model is the last good one. */
export function StalePill() {
  const s = useStyles();
  return (
    <View pointerEvents="none" style={s.staleWrap}>
      <Text style={s.stale}>Corrige los errores para actualizar el modelo</Text>
    </View>
  );
}

/** Labels the 3D floor's cuadrícula, bottom-left of the stage, as on the web. */
export function ScaleChip({ label = 'Cuadro de 100 mm · arrastra para girar' }: { label?: string }) {
  const c = usePalette();
  const s = useStyles();
  return (
    <View pointerEvents="none" style={s.scale}>
      <Svg viewBox="0 0 24 8" width={24} height={8}>
        <Path d="M1 1v6h22V1M12 4v3" fill="none" stroke={c.inkSoft} strokeWidth={1.4} />
      </Svg>
      <Text style={s.scaleLabel}>{label}</Text>
    </View>
  );
}

/** Transient confirmation from `flash`, floated above the screen's bottom bar. */
export function Toast({ message }: { message: string | null }) {
  const insets = useSafeAreaInsets();
  const c = usePalette();
  const s = useStyles();
  if (!message) return null;
  // 92 clears both bottom bars that host it: the result tabs and the measure CTA
  return (
    <View pointerEvents="none" style={[s.toastWrap, { bottom: insets.bottom + 92 }]}>
      <View style={s.toast} accessibilityLiveRegion="polite">
        <Body tone={c.ink} size={14} style={{ fontFamily: font.semi }}>
          {message}
        </Body>
      </View>
    </View>
  );
}

/**
 * The true-scale cuadrícula — 20 pt cells under a stronger line every 100 — for
 * work stages only (cut sheets, bar plans). Never behind forms or chrome.
 */
export function GridBackdrop() {
  const c = usePalette();
  const scheme = useScheme();
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <Pattern id={`cell-${scheme}`} width={20} height={20} patternUnits="userSpaceOnUse">
          <Path d="M20 0H0V20" fill="none" stroke={c.grid} strokeWidth={1} />
        </Pattern>
        <Pattern id={`major-${scheme}`} width={100} height={100} patternUnits="userSpaceOnUse">
          <Rect width={100} height={100} fill={`url(#cell-${scheme})`} />
          <Path d="M100 0H0V100" fill="none" stroke={c.gridMajor} strokeWidth={1} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill={c.stageNear} />
      <Rect width="100%" height="100%" fill={`url(#major-${scheme})`} />
    </Svg>
  );
}

const useStyles = makeStyles((c) => ({
  primary: {
    minHeight: 52,
    borderRadius: radius.lg,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    ...shadow.contact,
  },
  primaryOff: { backgroundColor: c.raised, shadowOpacity: 0, elevation: 0 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  primaryLabel: { fontFamily: font.bold, fontSize: 16, color: ON_ACCENT },
  primaryLabelOff: { color: c.inkFaint },
  quiet: {
    minHeight: 48,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.rule,
    backgroundColor: c.panel,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  quietPressed: { borderColor: c.ruleStrong, backgroundColor: c.raised },
  quietLabel: { fontFamily: font.bold, fontSize: 15, color: c.ink },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: TOUCH,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.rule,
    backgroundColor: c.panel,
    paddingHorizontal: 12,
  },
  chipOn: { borderColor: c.accent, backgroundColor: c.accentTint },
  chipLabel: { fontFamily: font.semi, fontSize: 14, color: c.inkSoft, flexShrink: 1 },
  chipLabelOn: { fontFamily: font.bold, color: c.accentInk },
  swatch: { height: 14, width: 14, borderRadius: 7, borderWidth: 1, borderColor: c.ruleStrong },
  header: {
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    backgroundColor: c.panel,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.rule,
  },
  issue: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: radius.xl,
    backgroundColor: c.cutTint,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 10,
  },
  staleWrap: { position: 'absolute', left: 0, right: 0, top: 14, alignItems: 'center', paddingHorizontal: 16 },
  stale: {
    overflow: 'hidden',
    borderRadius: radius.pill,
    backgroundColor: c.cutTint,
    color: c.cutInk,
    fontFamily: font.bold,
    fontSize: 13,
    paddingHorizontal: 14,
    paddingVertical: 6,
    textAlign: 'center',
  },
  scale: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.lg,
    backgroundColor: c.panel,
    opacity: 0.92,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  scaleLabel: { fontFamily: font.semi, fontSize: 12, color: c.inkSoft },
  toastWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  toast: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: c.rule,
    backgroundColor: c.panel,
    paddingHorizontal: 16,
    paddingVertical: 11,
    ...shadow.float,
  },
}));

export { TOUCH };
