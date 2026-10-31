import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { Body, Display, Mono, SecondaryButton, Title, Toast } from '@/components/ui';
import { buildOrder, getStock, nest, orderText, templates } from '@/lib/engine';
import { useApp, type Mode, type ResultTab } from '@/lib/store';
import { font, makeStyles, radius, space, usePalette } from '@/theme';
import { CutsPane } from './cuts';
import { ModelPane } from './model';
import { StepsPane } from './steps';
import { WeldCutsPane, WeldModelPane, WeldShoppingPane, WeldStepsPane, shareShopping, weldTitle } from './weld';

const TABS: Record<Mode, { id: ResultTab; label: string }[]> = {
  wood: [
    { id: 'model', label: 'Diseño' },
    { id: 'cuts', label: 'Cortes' },
    { id: 'steps', label: 'Pasos' },
  ],
  metal: [
    { id: 'model', label: 'Diseño' },
    { id: 'cuts', label: 'Cortes' },
    { id: 'steps', label: 'Pasos' },
    { id: 'shop', label: 'Compras' },
  ],
};

const EXPORTS = [
  { tag: 'PDF', label: 'Plan de corte', sub: 'Hojas, lista de piezas y pasos' },
  { tag: 'TXT', label: 'Pedido para maderería', sub: 'Compártelo por WhatsApp o correo' },
  { tag: '↗', label: 'Compartir enlace', sub: 'Vista 3D en el navegador' },
  { tag: 'AD', label: 'AirDrop al carpintero', sub: 'Dispositivos cerca' },
];

export function Result() {
  const insets = useSafeAreaInsets();
  const c = usePalette();
  const s = useStyles();
  const { mode, tab, setTab, taller, toggleTaller, toast, flash, design, weld, templateId } = useApp();
  const [sheetOpen, setSheetOpen] = useState(false);
  const template = templates.find((t) => t.id === templateId) ?? templates[0]!;
  const metal = mode === 'metal';

  const meta = useMemo(() => {
    if (metal) {
      if (!weld) return '';
      const p = weld.params;
      return `${p.width} × ${p.depth} × ${p.height} · ${weld.tube.label}`;
    }
    if (!design) return '';
    const p = design.params;
    return `${p.width} × ${p.height ?? p.depth} × ${p.depth} · ${getStock(p.material!).label}`;
  }, [metal, design, weld]);

  if (metal ? !weld : !design) return <View style={s.root} />;
  const title = metal ? weldTitle(weld!) : template.name;

  const shareOrder = () => {
    return Share.share({ message: orderText(buildOrder(design!, nest(design!.panels), template.name)) }).catch(() =>
      flash('No se pudo compartir'),
    );
  };

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: insets.top + space.xs }]}>
        <View style={s.headRow}>
          <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Atrás" style={s.back}>
            <Svg viewBox="0 0 20 20" width={22} height={22}>
              <Path d="M12.5 4 6.5 10l6 6" fill="none" stroke={c.accentInk} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Display size={18} numberOfLines={1}>
              {title}
            </Display>
            <Mono tone={c.inkSoft} size={12} style={{ marginTop: -2 }} numberOfLines={1}>
              {meta}
            </Mono>
          </View>
          <IconButton active={taller} onPress={toggleTaller} label="Modo taller">
            {(tint) => (
              <Svg viewBox="0 0 20 20" width={18} height={18}>
                <Circle cx={10} cy={10} r={3.6} fill="none" stroke={tint} strokeWidth={1.5} />
                <Path
                  d="M10 1.6v2.2M10 16.2v2.2M1.6 10h2.2M16.2 10h2.2M4.1 4.1l1.6 1.6M14.3 14.3l1.6 1.6M15.9 4.1l-1.6 1.6M5.7 14.3l-1.6 1.6"
                  stroke={tint}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                />
              </Svg>
            )}
          </IconButton>
          <IconButton
            // metal has one thing to share — the shopping list — so it skips the export sheet
            onPress={() => (metal ? shareShopping(weld!, () => flash('No se pudo compartir')) : setSheetOpen(true))}
            label={metal ? 'Compartir lista de compras' : 'Compartir'}
          >
            {(tint) => (
              <Svg viewBox="0 0 20 20" width={18} height={18}>
                <Path d="M10 13V3m0 0L6.5 6.5M10 3l3.5 3.5" fill="none" stroke={tint} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M4 12v4.5h12V12" fill="none" stroke={tint} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            )}
          </IconButton>
        </View>

        {taller && (
          <View style={s.tallerBar}>
            <View style={s.tallerDot} />
            <Text style={s.tallerLabel}>Modo taller · pantalla encendida</Text>
            <Pressable onPress={toggleTaller} style={{ marginLeft: 'auto' }} hitSlop={10} accessibilityRole="button">
              <Text style={s.tallerLabel}>Salir</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={s.body}>
        {!metal && tab === 'model' && <ModelPane />}
        {!metal && tab === 'cuts' && <CutsPane />}
        {!metal && tab === 'steps' && <StepsPane />}
        {metal && tab === 'model' && <WeldModelPane />}
        {metal && tab === 'cuts' && <WeldCutsPane />}
        {metal && tab === 'steps' && <WeldStepsPane />}
        {metal && tab === 'shop' && <WeldShoppingPane />}
      </View>

      <View style={[s.tabs, { paddingBottom: insets.bottom + space.xs }]} accessibilityRole="tablist">
        {TABS[mode].map((t) => {
          const on = tab === t.id;
          const tint = on ? c.accentInk : c.inkSoft;
          return (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              style={s.tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
            >
              <TabIcon id={t.id} tint={tint} />
              <Text style={[s.tabLabel, { color: tint }, on && { fontFamily: font.bold }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Toast message={toast} />

      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <Pressable style={s.scrim} onPress={() => setSheetOpen(false)} accessibilityLabel="Cerrar" />
        <View style={[s.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={s.grabber} />
          <Display>Compartir</Display>
          <Body size={14} style={{ marginBottom: 14 }}>
            {template.name}
          </Body>
          <View style={{ gap: 8 }}>
            {EXPORTS.map((e) => (
              <Pressable
                key={e.label}
                onPress={() => {
                  if (e.tag === 'TXT') {
                    // present the share sheet before the modal finishes dismissing (iOS drops it otherwise)
                    shareOrder().finally(() => setSheetOpen(false));
                  } else {
                    setSheetOpen(false);
                    flash(`${e.label} listo`); // the other exports are still fixtures
                  }
                }}
                style={({ pressed }) => [s.exportRow, pressed && { backgroundColor: c.raised }]}
                accessibilityRole="button"
              >
                <View style={s.exportTag}>
                  <Mono tone={c.accentInk} size={12} bold>
                    {e.tag}
                  </Mono>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Title size={15}>{e.label}</Title>
                  <Body size={13}>{e.sub}</Body>
                </View>
                <Svg viewBox="0 0 20 20" width={16} height={16}>
                  <Path d="m7.5 4 6 6-6 6" fill="none" stroke={c.inkFaint} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
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
  children: (tint: string) => ReactNode;
  onPress: () => void;
  active?: boolean;
  label: string;
}) {
  const c = usePalette();
  const s = useStyles();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
      style={({ pressed }) => [s.iconBtn, active && s.iconBtnOn, pressed && !active && { backgroundColor: c.raised }]}
    >
      {children(active ? c.accentInk : c.inkSoft)}
    </Pressable>
  );
}

function TabIcon({ id, tint }: { id: ResultTab; tint: string }) {
  if (id === 'model') {
    return (
      <Svg viewBox="0 0 24 24" width={22} height={22}>
        <Path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" fill="none" stroke={tint} strokeWidth={1.5} strokeLinejoin="round" />
        <Path d="M4 7.5l8 4.5 8-4.5M12 12v9" fill="none" stroke={tint} strokeWidth={1.5} strokeLinejoin="round" />
      </Svg>
    );
  }
  if (id === 'shop') {
    return (
      <Svg viewBox="0 0 24 24" width={22} height={22}>
        <Path d="M5 8h14l-1.2 12H6.2L5 8zM9 8V6.5a3 3 0 0 1 6 0V8" fill="none" stroke={tint} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      </Svg>
    );
  }
  if (id === 'cuts') {
    return (
      <Svg viewBox="0 0 24 24" width={22} height={22}>
        <Path d="M4 3h16v18H4z" fill="none" stroke={tint} strokeWidth={1.5} strokeLinejoin="round" />
        <Path d="M4 10h16M12 10v11" fill="none" stroke={tint} strokeWidth={1.5} />
      </Svg>
    );
  }
  return (
    <Svg viewBox="0 0 24 24" width={22} height={22}>
      <Path d="M5 7h14M5 12h14M5 17h9" fill="none" stroke={tint} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.paper },
  header: {
    paddingHorizontal: space.md,
    paddingBottom: 10,
    backgroundColor: c.panel,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.rule,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  back: { height: 44, width: 32, alignItems: 'center', justifyContent: 'center' },
  iconBtn: {
    height: 44,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.rule,
    backgroundColor: c.panel,
  },
  iconBtnOn: { borderColor: c.accent, backgroundColor: c.accentTint },
  tallerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    borderRadius: radius.lg,
    backgroundColor: c.accentTint,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tallerDot: { height: 8, width: 8, borderRadius: 4, backgroundColor: c.accent },
  tallerLabel: { fontFamily: font.bold, fontSize: 13, color: c.accentInk },
  body: { flex: 1, minHeight: 0 },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 6,
    backgroundColor: c.panel,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.rule,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 52 },
  tabLabel: { fontFamily: font.semi, fontSize: 12 },
  scrim: { flex: 1, backgroundColor: 'rgba(20,26,43,0.45)' },
  sheet: {
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    backgroundColor: c.panel,
    paddingHorizontal: space.lg,
    paddingTop: 10,
  },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.ruleStrong,
    alignSelf: 'center',
    marginBottom: 14,
  },
  exportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    borderWidth: 1,
    borderColor: c.rule,
    borderRadius: radius.xl,
    backgroundColor: c.panel,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  exportTag: {
    height: 36,
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: c.accentTint,
  },
}));
