import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { Body, Display, Kicker, Mono, SecondaryButton } from '@/components/ui';
import { templates } from '@/lib/engine';
import { useApp, type ResultTab } from '@/lib/store';
import { color, font, radius, space } from '@/theme';
import { CutsPane } from './cuts';
import { ModelPane } from './model';
import { StepsPane } from './steps';

const TABS: { id: ResultTab; label: string }[] = [
  { id: 'model', label: 'Diseño' },
  { id: 'cuts', label: 'Cortes' },
  { id: 'steps', label: 'Pasos' },
];

const EXPORTS = [
  { tag: 'PDF', label: 'Plan de corte', sub: 'Hojas, lista de piezas y pasos' },
  { tag: 'TXT', label: 'Lista de compras', sub: 'Para el mostrador de la maderería' },
  { tag: '↗', label: 'Compartir enlace', sub: 'Vista 3D en el navegador' },
  { tag: 'AD', label: 'AirDrop al carpintero', sub: 'Dispositivos cerca' },
];

export function Result() {
  const insets = useSafeAreaInsets();
  const { tab, setTab, taller, toggleTaller, toast, flash, design, templateId } = useApp();
  const [sheetOpen, setSheetOpen] = useState(false);
  const template = templates.find((t) => t.id === templateId) ?? templates[0]!;

  const meta = useMemo(() => {
    if (!design) return '';
    const p = design.params;
    return `${p.width} × ${p.height ?? p.depth} × ${p.depth} · ${p.thickness} mm`;
  }, [design]);

  const title = template.id === 'bookshelf' ? 'Librero sala' : 'Mesa auxiliar';

  if (!design) return <View style={styles.root} />;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <View style={styles.headRow}>
          <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button">
            <Text style={styles.back}>‹</Text>
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Display size={22} semi numberOfLines={1}>
              {title}
            </Display>
            <Mono tone={color.textSoft} size={10}>
              {meta}
            </Mono>
          </View>
          <IconButton active={taller} onPress={toggleTaller} label="Modo taller">
            <Svg viewBox="0 0 20 20" width={17} height={17}>
              <Circle cx={10} cy={10} r={3.6} fill="none" stroke="currentColor" strokeWidth={1.7} />
              <Path
                d="M10 1.6v2.2M10 16.2v2.2M1.6 10h2.2M16.2 10h2.2M4.1 4.1l1.6 1.6M14.3 14.3l1.6 1.6M15.9 4.1l-1.6 1.6M5.7 14.3l-1.6 1.6"
                stroke="currentColor"
                strokeWidth={1.7}
                strokeLinecap="round"
              />
            </Svg>
          </IconButton>
          <IconButton onPress={() => setSheetOpen(true)} label="Compartir">
            <Svg viewBox="0 0 20 20" width={16} height={16}>
              <Path d="M10 13V3m0 0L6.5 6.5M10 3l3.5 3.5" fill="none" stroke={color.text} strokeWidth={1.7} strokeLinecap="round" />
              <Path d="M4 12v4.5h12V12" fill="none" stroke={color.text} strokeWidth={1.7} strokeLinecap="round" />
            </Svg>
          </IconButton>
        </View>

        {taller && (
          <View style={styles.tallerBar}>
            <View style={styles.tallerDot} />
            <Mono tone={color.white} size={9} style={{ letterSpacing: 0.9, textTransform: 'uppercase' }}>
              Modo taller · pantalla encendida
            </Mono>
            <Pressable onPress={toggleTaller} style={{ marginLeft: 'auto' }} hitSlop={8}>
              <Mono tone={color.white} size={9} style={{ letterSpacing: 1.4, textTransform: 'uppercase' }}>
                Salir
              </Mono>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.body}>
        {tab === 'model' && <ModelPane />}
        {tab === 'cuts' && <CutsPane />}
        {tab === 'steps' && <StepsPane />}
      </View>

      <View style={[styles.tabs, { paddingBottom: insets.bottom + space.sm }]}>
        {TABS.map((t) => {
          const on = tab === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              style={[styles.tab, on && { backgroundColor: color.red }]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
            >
              <TabIcon id={t.id} tint={on ? color.white : color.textFaint} />
              <Text style={[styles.tabLabel, { color: on ? color.white : color.textFaint }]}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {toast && (
        <View pointerEvents="none" style={[styles.toastWrap, { bottom: insets.bottom + 92 }]}>
          <View style={styles.toast}>
            <Body tone={color.text}>{toast}</Body>
          </View>
        </View>
      )}

      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setSheetOpen(false)} accessibilityLabel="Cerrar" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={styles.grabber} />
          <Display size={26}>Compartir</Display>
          <Kicker tone={color.textSoft} style={{ marginTop: 4, marginBottom: 14 }}>
            {title}
          </Kicker>
          <View style={{ gap: 8 }}>
            {EXPORTS.map((e) => (
              <Pressable
                key={e.label}
                onPress={() => {
                  setSheetOpen(false);
                  flash(`${e.label} listo`);
                }}
                style={({ pressed }) => [styles.exportRow, pressed && { borderColor: color.borderStrong }]}
                accessibilityRole="button"
              >
                <View style={styles.exportTag}>
                  <Mono tone={color.white} size={12} style={{ fontFamily: font.monoBold }}>
                    {e.tag}
                  </Mono>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Display size={19} semi>
                    {e.label}
                  </Display>
                  <Body tone={color.textSoft} size={12}>
                    {e.sub}
                  </Body>
                </View>
                <Text style={{ color: color.textFaint }}>›</Text>
              </Pressable>
            ))}
          </View>
          <SecondaryButton label="Cancelar" onPress={() => setSheetOpen(false)} style={{ marginTop: 12, minHeight: 52 }} />
        </View>
      </Modal>
    </View>
  );
}

function IconButton({
  children,
  onPress,
  active,
  label,
}: {
  children: React.ReactNode;
  onPress: () => void;
  active?: boolean;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.iconBtn,
        active && { borderColor: color.red, backgroundColor: color.red },
        pressed && { transform: [{ scale: 0.95 }] },
      ]}
    >
      <View style={{ opacity: active ? 1 : 0.75 }}>{children}</View>
    </Pressable>
  );
}

function TabIcon({ id, tint }: { id: ResultTab; tint: string }) {
  if (id === 'model') {
    return (
      <Svg viewBox="0 0 24 24" width={22} height={22}>
        <Path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" fill="none" stroke={tint} strokeWidth={1.6} strokeLinejoin="round" />
        <Path d="M4 7.5l8 4.5 8-4.5M12 12v9" fill="none" stroke={tint} strokeWidth={1.4} />
      </Svg>
    );
  }
  if (id === 'cuts') {
    return (
      <Svg viewBox="0 0 24 24" width={22} height={22}>
        <Path d="M4 3h16v18H4z" fill="none" stroke={tint} strokeWidth={1.6} />
        <Path d="M4 10h16M12 10v11" fill="none" stroke={tint} strokeWidth={1.4} />
      </Svg>
    );
  }
  return (
    <Svg viewBox="0 0 24 24" width={22} height={22}>
      <Path d="M5 7h14M5 12h14M5 17h9" fill="none" stroke={tint} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  header: {
    paddingHorizontal: 18,
    paddingBottom: 10,
    backgroundColor: color.bg,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { fontSize: 26, lineHeight: 28, color: color.red, paddingRight: 4 },
  iconBtn: {
    minHeight: 40,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.card,
  },
  tallerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    borderRadius: radius.sm,
    backgroundColor: color.red,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  tallerDot: { height: 7, width: 7, borderRadius: 4, backgroundColor: color.white },
  body: { flex: 1, minHeight: 0 },
  tabs: {
    flexDirection: 'row',
    gap: 2,
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: color.void,
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 52,
    borderRadius: radius.sm,
    paddingVertical: 6,
  },
  tabLabel: {
    fontFamily: font.displaySemi,
    fontSize: 13,
    letterSpacing: 0.78,
    textTransform: 'uppercase',
  },
  toastWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  toast: {
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: color.red,
    backgroundColor: color.raised,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  scrim: { flex: 1, backgroundColor: 'rgba(8,9,11,0.6)' },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 3,
    borderTopColor: color.red,
    backgroundColor: color.bg,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: color.borderStrong,
    alignSelf: 'center',
    marginBottom: 14,
  },
  exportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.sm,
    backgroundColor: color.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  exportTag: {
    height: 34,
    width: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: color.red,
  },
});
