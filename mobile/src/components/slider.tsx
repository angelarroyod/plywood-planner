import * as Haptics from 'expo-haptics';
import { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import { color, radius } from '@/theme';

const THUMB = 30;
const TRACK = 4;
/** Full 44pt row so the thumb is grabbable anywhere on the line. */
const ROW = 44;

interface Props {
  min: number;
  max: number;
  step: number;
  value: number;
  invalid?: boolean;
  onChange: (value: number) => void;
  accessibilityLabel?: string;
}

/**
 * The design's caliper slider: hairline track, white puck in a red collar.
 * Hand-rolled rather than @expo/ui's native Slider because the look is the point,
 * and a SwiftUI slider cannot be restyled this far.
 */
export function Slider({ min, max, step, value, invalid, onChange, accessibilityLabel }: Props) {
  const [width, setWidth] = useState(0);
  const travel = Math.max(1, width - THUMB);
  const lastEmitted = useRef(value);

  const pct = max === min ? 0 : (value - min) / (max - min);
  const left = pct * travel;

  const emit = useMemo(
    () => (x: number) => {
      if (!width) return;
      const ratio = Math.min(1, Math.max(0, x / travel));
      const raw = min + ratio * (max - min);
      const snapped = Math.round(raw / step) * step;
      const next = Math.min(max, Math.max(min, snapped));
      if (next !== lastEmitted.current) {
        lastEmitted.current = next;
        Haptics.selectionAsync();
        onChange(next);
      }
    },
    [width, travel, min, max, step, onChange],
  );

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // Touch anywhere jumps the thumb there, then drags from it.
        onPanResponderGrant: (e) => emit(e.nativeEvent.locationX - THUMB / 2),
        onPanResponderMove: (e) => emit(e.nativeEvent.locationX - THUMB / 2),
      }),
    [emit],
  );

  return (
    <View
      style={styles.row}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value }}
      {...pan.panHandlers}
    >
      <View style={styles.track} />
      <View
        pointerEvents="none"
        style={[
          styles.thumb,
          { left },
          invalid && { backgroundColor: color.red, borderColor: color.text },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: ROW, justifyContent: 'center' },
  track: { height: TRACK, borderRadius: TRACK / 2, backgroundColor: color.border },
  thumb: {
    position: 'absolute',
    height: THUMB,
    width: THUMB,
    borderRadius: radius.pill,
    borderWidth: 4,
    borderColor: color.red,
    backgroundColor: color.text,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});
