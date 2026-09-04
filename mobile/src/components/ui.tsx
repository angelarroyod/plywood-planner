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
import { color, font, radius, space, TOUCH } from '@/theme';

/** Condensed caps — every title in the design. */
export function Display({
  children,
  size = 32,
  style,
  semi,
  numberOfLines,
}: {
  children: ReactNode;
  size?: number;
  style?: StyleProp<TextStyle>;
  semi?: boolean;
  numberOfLines?: number;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          fontFamily: semi ? font.displaySemi : font.display,
          fontSize: size,
          lineHeight: size * 1.02,
          letterSpacing: size * 0.01,
          textTransform: 'uppercase',
          color: color.text,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** Mono micro-label: the small-caps kicker above almost every section. */
export function Kicker({
  children,
  tone = color.textMuted,
  style,
}: {
  children: ReactNode;
  tone?: string;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      style={[
        {
          fontFamily: font.mono,
          fontSize: 10,
          letterSpacing: 1.4,
          textTransform: 'uppercase',
          color: tone,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Body({
  children,
  tone = color.textMuted,
  size = 13,
  style,
}: {
  children: ReactNode;
  tone?: string;
  size?: number;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      style={[{ fontFamily: font.body, fontSize: size, lineHeight: size * 1.5, color: tone }, style]}
    >
      {children}
    </Text>
  );
}

export function Mono({
  children,
  tone = color.text,
  size = 12,
  style,
}: {
  children: ReactNode;
  tone?: string;
  size?: number;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text style={[{ fontFamily: font.mono, fontSize: size, color: tone }, style]}>{children}</Text>
  );
}

/** Primary red action. The design gives it scale-down feedback, so it gets haptics too. */
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
  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primary,
        disabled && { backgroundColor: color.border },
        pressed && !disabled && { backgroundColor: color.redPressed, transform: [{ scale: 0.985 }] },
        style,
      ]}
      accessibilityRole="button"
    >
      <Text
        style={[
          styles.primaryLabel,
          disabled && { color: color.textFaint },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  style,
}: {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.secondary, pressed && { transform: [{ scale: 0.98 }] }, style]}
      accessibilityRole="button"
    >
      <Text style={styles.secondaryLabel}>{label}</Text>
    </Pressable>
  );
}

/** Back chevron + label, the design's standard nav affordance. */
export function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.back} accessibilityRole="button" hitSlop={8}>
      <Text style={{ fontFamily: font.body, fontSize: 19, lineHeight: 21, color: color.red }}>‹</Text>
      <Text style={{ fontFamily: font.body, fontSize: 15, color: color.red }}>{label}</Text>
    </Pressable>
  );
}

/** Sticky screen header with the status-bar inset already accounted for. */
export function ScreenHeader({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>{children}</View>
  );
}

/** Validation issue: red left rule, dark red ground, a bang in mono. */
export function IssueNote({ message }: { message: string }) {
  return (
    <View style={styles.issue}>
      <Mono tone={color.errMark} size={12} style={{ fontFamily: font.monoBold }}>
        !
      </Mono>
      <Body tone={color.errText} style={{ flex: 1 }}>
        {message}
      </Body>
    </View>
  );
}

const styles = StyleSheet.create({
  primary: {
    minHeight: 56,
    borderRadius: radius.md,
    backgroundColor: color.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    fontFamily: font.display,
    fontSize: 21,
    letterSpacing: 0.84,
    textTransform: 'uppercase',
    color: color.white,
  },
  secondary: {
    minHeight: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontFamily: font.displaySemi,
    fontSize: 17,
    letterSpacing: 0.68,
    textTransform: 'uppercase',
    color: color.text,
  },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 34 },
  header: {
    paddingHorizontal: space.xl,
    paddingBottom: 14,
    backgroundColor: color.bg,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  issue: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: color.red,
    backgroundColor: color.errBg,
    padding: space.md,
    marginTop: 10,
  },
});

export { TOUCH };
