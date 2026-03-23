export const colors = {
  // Backgrounds
  bg: '#0D0D1A',
  bgSecondary: '#141428',
  bgTertiary: '#1C1C3A',
  bgCard: '#1A1A32',
  bgInput: '#12122A',

  // Primary
  primary: '#6C5CE7',
  primaryLight: '#8B7CF0',
  primaryDark: '#5A4BD6',
  primaryMuted: 'rgba(108, 92, 231, 0.15)',

  // Semantic
  success: '#00D68F',
  successMuted: 'rgba(0, 214, 143, 0.15)',
  danger: '#FF4757',
  dangerMuted: 'rgba(255, 71, 87, 0.15)',
  warning: '#FFA502',
  warningMuted: 'rgba(255, 165, 2, 0.15)',

  // Text
  text: '#FFFFFF',
  textSecondary: '#A0A0C0',
  textTertiary: '#6B6B8D',
  textMuted: '#4A4A6A',

  // Borders
  border: '#2A2A4A',
  borderLight: '#3A3A5A',

  // Order Book
  bidBg: 'rgba(0, 214, 143, 0.08)',
  askBg: 'rgba(255, 71, 87, 0.08)',
  bidBar: 'rgba(0, 214, 143, 0.20)',
  askBar: 'rgba(255, 71, 87, 0.20)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const borderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 999,
} as const;

export const typography = {
  h1: {
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 22,
    fontWeight: '600' as const,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600' as const,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
  },
  bodyBold: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  caption: {
    fontSize: 13,
    fontWeight: '400' as const,
  },
  captionBold: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  mono: {
    fontSize: 14,
    fontWeight: '500' as const,
    fontFamily: undefined as string | undefined, // Platform sets monospace
  },
  monoLarge: {
    fontSize: 20,
    fontWeight: '700' as const,
    fontFamily: undefined as string | undefined,
  },
  tabular: {
    fontSize: 14,
    fontWeight: '500' as const,
    fontVariant: ['tabular-nums'] as const,
  },
} as const;

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  button: {
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
} as const;

const theme = { colors, spacing, borderRadius, typography, shadows } as const;
export type Theme = typeof theme;
export default theme;
