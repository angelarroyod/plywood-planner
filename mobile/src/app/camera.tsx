import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Mono, PrimaryButton, SecondaryButton } from '@/components/ui';
import { useApp } from '@/lib/store';
import { color, font, radius, space } from '@/theme';

/**
 * Simulated reading. Real LiDAR distance needs ARKit via a custom native module
 * (expo-camera has no depth API), so the preview below is genuine but the number
 * is not measured — the UI says so rather than dressing a constant up as a scan.
 */
const SIMULATED_MM = 812;
const APPLIED_MM = 810; // snapped to the width slider's 10 mm step

export default function Camera() {
  const insets = useSafeAreaInsets();
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
    <View style={styles.root}>
      {permission?.granted ? (
        <CameraView style={StyleSheet.absoluteFill} facing="back" />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.fallback]} />
      )}

      <Animated.View
        pointerEvents="none"
        style={[
          styles.scan,
          {
            opacity: scan.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.2, 0.85, 0.2] }),
            transform: [{ translateY: scan.interpolate({ inputRange: [0, 1], outputRange: [-38, 38] }) }],
          },
        ]}
      />
      <View pointerEvents="none" style={styles.frame} />
      <View pointerEvents="none" style={styles.readingWrap}>
        <View style={styles.reading}>
          <Text style={styles.readingValue}>
            {SIMULATED_MM}
            <Text style={styles.readingUnit}>mm</Text>
          </Text>
        </View>
      </View>

      <View style={[styles.top, { top: insets.top + space.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.close} accessibilityRole="button">
          <Text style={{ color: color.text, fontSize: 16 }}>✕</Text>
        </Pressable>
        <View style={styles.badge}>
          <Mono tone={color.white} size={10} style={{ letterSpacing: 1.2, textTransform: 'uppercase' }}>
            Medir muro · LiDAR
          </Mono>
        </View>
      </View>

      <View style={[styles.bottom, { bottom: insets.bottom + space.xl }]}>
        {!permission?.granted && (
          <SecondaryButton
            label="Permitir cámara"
            onPress={requestPermission}
            style={{ marginBottom: space.md }}
          />
        )}
        <Body tone={color.textMuted} size={14} style={{ textAlign: 'center', marginBottom: 6 }}>
          Apunta a los dos extremos del hueco. Mantén el teléfono paralelo al muro.
        </Body>
        <Mono tone={color.textFaint} size={9} style={styles.disclaimer}>
          Lectura simulada · LiDAR real requiere módulo nativo
        </Mono>
        <View style={styles.actions}>
          <SecondaryButton label="Cancelar" onPress={() => router.back()} style={{ flex: 1, minHeight: 52 }} />
          <PrimaryButton
            label={`Usar ${SIMULATED_MM} mm`}
            onPress={apply}
            style={{ flex: 2, minHeight: 52 }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#08090B' },
  fallback: { backgroundColor: '#16181B' },
  scan: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '38%',
    height: 120,
    backgroundColor: 'rgba(219,1,28,0.28)',
  },
  frame: {
    position: 'absolute',
    left: 56,
    right: 56,
    top: '34%',
    height: 150,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(245,246,247,0.45)',
  },
  readingWrap: {
    position: 'absolute',
    left: 56,
    right: 56,
    top: '34%',
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reading: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: color.red,
    backgroundColor: 'rgba(8,9,11,0.8)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  readingValue: { fontFamily: font.monoMed, fontSize: 24, color: color.text },
  readingUnit: { fontFamily: font.mono, fontSize: 11, color: color.textSoft },
  top: { position: 'absolute', left: space.xl, right: space.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: {
    minHeight: 40,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: 'rgba(8,9,11,0.65)',
  },
  badge: { borderRadius: radius.sm, backgroundColor: color.red, paddingHorizontal: 12, paddingVertical: 8 },
  bottom: { position: 'absolute', left: space.xl, right: space.xl },
  disclaimer: { textAlign: 'center', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 },
  actions: { flexDirection: 'row', gap: 10 },
});
