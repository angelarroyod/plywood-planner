/**
 * "Taller Nocturno" tokens, lifted from Planificador Móvil.dc.html.
 * Red is reserved for action, active piece and error — nothing else competes.
 */

export const color = {
  // grounds, darkest to lightest
  void: '#0E0F11',
  bg: '#14161A',
  card: '#1E2126',
  cardAlt: '#191B1F',
  raised: '#23262B',
  sheet: '#1A1C20',

  // lines
  border: '#2E3238',
  borderStrong: '#3A3F45',
  borderMuted: '#4A5057',

  // type
  text: '#F5F6F7',
  textMuted: '#9BA0A6',
  textSoft: '#8B9198',
  textFaint: '#6E747C',

  // the one accent
  red: '#DB011C',
  redPressed: '#B30017',
  redBright: '#F0182F',
  redTintBg: '#23181A',

  // errors
  errBg: '#2A0F14',
  errText: '#FFD3D8',
  errMark: '#FF4B5C',
  errChip: '#FF6B78',
  errRef: '#FF9AA4',

  // plywood — the only warm tone in the app
  ply: '#C08A4E',
  plyEdge: '#8A5F2C',
  plyGrain: '#6B4B22',
  plyLabel: '#1A1206',
  plySub: '#5C3D18',

  white: '#FFFFFF',
} as const;

/** Cut-diagram piece colors. */
export const piece = { fill: color.ply, stroke: color.plyEdge, label: color.plyLabel, sub: color.plySub } as const;

export const font = {
  display: 'BarlowCondensed_700Bold',
  displaySemi: 'BarlowCondensed_600SemiBold',
  body: 'Archivo_400Regular',
  bodyMed: 'Archivo_500Medium',
  bodySemi: 'Archivo_600SemiBold',
  mono: 'RobotoMono_400Regular',
  monoMed: 'RobotoMono_500Medium',
  monoBold: 'RobotoMono_700Bold',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 22, xxl: 32 } as const;

export const radius = { sm: 3, md: 4, lg: 6, pill: 999 } as const;

/** iOS minimum comfortable target; workshop mode grows the important ones. */
export const TOUCH = 44;
export const TOUCH_TALLER = 56;
