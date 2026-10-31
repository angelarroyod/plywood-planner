import * as Haptics from 'expo-haptics';
import { useMemo, useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import { makeStyles, shadow } from '@/theme';

const THUMB = 22;
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
  /** Fires true on touch-down and false on release, so the caller can highlight what is being dragged. */
  onActive?: (active: boolean) => void;
  accessibilityLabel?: string;
}

/**
 * Hairline track filled in ballpoint up to a round thumb ringed in ballpoint
 * (margin red when invalid), which swells while dragged — the web slider's spec.
 * Hand-rolled rather than @expo/ui's native Slider because a SwiftUI slider
 * cannot be restyled this far.
 */
export function Slider({ min, max, step, value, invalid, onChange, onActive, accessibilityLabel }: Props) {
  const s = useStyles();
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
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

  const pan = useMemo(() => {
    const end = () => {
      setDragging(false);
      onActive?.(false);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Touch anywhere jumps the thumb there, then drags from it.
      onPanResponderGrant: (e) => {
        setDragging(true);
        onActive?.(true);
        emit(e.nativeEvent.locationX - THUMB / 2);
      },
      onPanResponderMove: (e) => emit(e.nativeEvent.locationX - THUMB / 2),
      onPanResponderRelease: end,
      onPanResponderTerminate: end,
    });
  }, [emit, onActive]);

  // VoiceOver swipes up/down by one step.
  const nudge = (dir: 1 | -1) => {
    const next = Math.min(max, Math.max(min, value + dir * step));
    if (next !== value) onChange(next);
  };

  return (
    <View
      style={s.row}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => nudge(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      {...pan.panHandlers}
    >
      <View style={s.track}>
        <View style={[s.fill, invalid && s.fillBad, { width: left + THUMB / 2 }]} />
      </View>
      <View
        pointerEvents="none"
        style={[s.thumb, invalid && s.thumbBad, { left, transform: [{ scale: dragging ? 1.15 : 1 }] }]}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  row: { height: ROW, justifyContent: 'center' },
  track: { height: TRACK, borderRadius: TRACK / 2, backgroundColor: c.rule, overflow: 'hidden' },
  fill: { height: TRACK, backgroundColor: c.accent },
  fillBad: { backgroundColor: c.cut },
  thumb: {
    position: 'absolute',
    height: THUMB,
    width: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 2,
    borderColor: c.accent,
    backgroundColor: c.panel,
    ...shadow.contact,
  },
  thumbBad: { borderColor: c.cut },
}));
