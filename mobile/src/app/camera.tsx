import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Body, Caption, PrimaryButton, SecondaryButton } from '@/components/ui';
import { useApp } from '@/lib/store';
import { TNUM, font, makeStyles, radius, shadow, space, usePalette } from '@/theme';

/**
 * Simulated reading. Real LiDAR distance needs ARKit via a custom native module
 * (expo-camera has no depth API), so the preview below is genuine but the number
 * is not measured — the UI says so rather than dressing a constant up as a scan.
 */
const SIMULATED_MM = 812;
const APPLIED_MM = 810; // snapped to the width slider's 10 mm step

export default function Camera() {
  const insets = useSafeAreaInsets();
  const c = usePalette();
  const s = useStyles();
  const { setParam, flash } = useApp();
  const [permission, requestPermission] = useCameraPermissions();
  const scan = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scan, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scan, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scan]);

  const apply = () => {
    setParam('width', APPLIED_MM);
    flash(`Ancho actualizado a ${APPLIED_MM} mm`);
    router.back();
  };

  return (
    <View style={s.root}>
      {permission?.granted ? (
        <CameraView style={StyleSheet.absoluteFill} facing="back" />
      ) : (
        <View style={[StyleSheet.absoluteFill, s.fallback]} />
      )}

      {/* The width being measured, swept with the highlighter like a dimension being dragged. */}
      <Animated.View
        pointerEvents="none"
        style={[
          s.scan,
          {
            opacity: scan.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.15, 0.45, 0.15] }),
            transform: [{ translateY: scan.interpolate({ inputRange: [0, 1], outputRange: [-38, 38] }) }],
          },
        ]}
      />
      <View pointerEvents="none" style={s.frame} />
      <View pointerEvents="none" style={s.readingWrap}>
        <View style={s.reading}>
          <Text style={s.readingLabel}>Ancho del hueco</Text>
          <Text style={s.readingValue}>
            {SIMULATED_MM}
            <Text style={s.readingUnit}> mm</Text>
          </Text>
        </View>
      </View>

      <View style={[s.top, { top: insets.top + space.sm }]}>
        <Pressable onPress={() => router.back()} style={s.close} accessibilityRole="button" accessibilityLabel="Cerrar">
          <Svg viewBox="0 0 20 20" width={16} height={16}>
            <Path d="m5 5 10 10M15 5 5 15" stroke={c.ink} strokeWidth={1.8} strokeLinecap="round" />
          </Svg>
        </Pressable>
        <View style={s.badge}>
          <Text style={s.badgeLabel}>Medir muro · LiDAR</Text>
        </View>
      </View>

      <View style={[s.bottom, { bottom: insets.bottom + space.md }]}>
        {!permission?.granted && (
          <SecondaryButton label="Permitir cámara" onPress={requestPermission} style={{ marginBottom: space.md }} />
        )}
        <Body tone={c.ink} size={14} style={{ textAlign: 'center' }}>
          Apunta a los dos extremos del hueco. Mantén el teléfono paralelo al muro.
        </Body>
        <Caption style={{ textAlign: 'center', marginTop: 4, marginBottom: 12 }}>
          Lectura simulada: el LiDAR real requiere un módulo nativo
        </Caption>
        <View style={s.actions}>
          <SecondaryButton label="Cancelar" onPress={() => router.back()} style={{ flex: 1, minHeight: 52 }} />
          <PrimaryButton label={`Usar ${SIMULATED_MM} mm`} onPress={apply} style={{ flex: 2 }} />
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: '#08090b' }, // under the camera feed, whatever the theme
  fallback: { backgroundColor: '#1b2546' },
  scan: { position: 'absolute', left: 0, right: 0, top: '38%', height: 120, backgroundColor: c.hi },
  frame: {
    position: 'absolute',
    left: 56,
    right: 56,
    top: '34%',
    height: 150,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.7)',
  },
  readingWrap: {
    position: 'absolute',
    left: 40,
    right: 40,
    top: '34%',
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reading: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: c.rule,
    backgroundColor: c.panel,
    paddingHorizontal: 16,
    paddingVertical: 10,
    ...shadow.float,
  },
  readingLabel: { fontFamily: font.semi, fontSize: 13, color: c.inkSoft },
  readingValue: { fontFamily: font.monoBold, fontSize: 44, lineHeight: 48, fontVariant: [...TNUM], color: c.accentInk },
  readingUnit: { fontFamily: font.semi, fontSize: 18, color: c.inkSoft },
  top: { position: 'absolute', left: space.lg, right: space.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: {
    height: 44,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: c.panel,
    ...shadow.float,
  },
  badge: { borderRadius: radius.pill, backgroundColor: c.panel, paddingHorizontal: 14, paddingVertical: 8, ...shadow.float },
  badgeLabel: { fontFamily: font.bold, fontSize: 13, color: c.accentInk },
  bottom: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    borderRadius: radius.xxl,
    backgroundColor: c.panel,
    padding: space.lg,
    ...shadow.float,
  },
  actions: { flexDirection: 'row', gap: 10 },
}));
