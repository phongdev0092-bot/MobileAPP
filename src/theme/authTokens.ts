/**
 * Bảng màu & thông số giao diện Đăng nhập NextSu AI (Light & Dark Mode).
 */

export interface AuthThemePalette {
  isDark: boolean;
  background: string;
  backgroundGradient: [string, string, string];
  foreground: string;
  card: string;
  glassCardBg: string;
  glassCardBorder: string;
  primary: string;
  primaryGradientEnd: string;
  primaryForeground: string;
  primarySoftBg: string;
  primarySoftBorder: string;
  accent: string;
  muted: string;
  mutedForeground: string;
  border: string;
  inputBorder: string;
  inputBg: string;
  errorBg: string;
  errorBorder: string;
  errorText: string;
  successBg: string;
  successBorder: string;
  successText: string;
  success: string;
  strengthWeak: string;
  strengthMedium: string;
  strengthStrong: string;
  overlayBg: string;
  glowPrimary: string;
  glowTeal: string;
  gridDot: string;
  gridLine: string;
}

export const LIGHT_AUTH_TOKENS: AuthThemePalette = {
  isDark: false,
  background: '#F8FAFC',
  backgroundGradient: ['#E8F0FE', '#EEF2FF', '#ECFEFF'],
  foreground: '#0F172A',
  card: '#FFFFFF',
  glassCardBg: 'rgba(255, 255, 255, 0.90)',
  glassCardBorder: 'rgba(226, 232, 240, 0.95)',
  primary: '#2563EB',
  primaryGradientEnd: '#1D4ED8',
  primaryForeground: '#F8FAFC',
  primarySoftBg: 'rgba(37, 99, 235, 0.10)',
  primarySoftBorder: 'rgba(37, 99, 235, 0.25)',
  accent: '#EA580C',
  muted: '#F1F5F9',
  mutedForeground: '#64748B',
  border: '#E2E8F0',
  inputBorder: '#D8E0EB',
  inputBg: 'rgba(248, 250, 252, 0.92)',
  errorBg: 'rgba(254, 242, 242, 0.96)',
  errorBorder: '#FECACA',
  errorText: '#B91C1C',
  successBg: 'rgba(236, 253, 245, 0.96)',
  successBorder: '#A7F3D0',
  successText: '#047857',
  success: '#059669',
  strengthWeak: '#EF4444',
  strengthMedium: '#F59E0B',
  strengthStrong: '#10B981',
  overlayBg: 'rgba(2, 6, 23, 0.55)',
  glowPrimary: 'rgba(37, 99, 235, 0.16)',
  glowTeal: 'rgba(20, 184, 166, 0.16)',
  gridDot: 'rgba(37, 99, 235, 0.22)',
  gridLine: 'rgba(37, 99, 235, 0.07)',
};

export const DARK_AUTH_TOKENS: AuthThemePalette = {
  isDark: true,
  background: '#090E1A',
  backgroundGradient: ['#090E1A', '#11182E', '#0B1D26'],
  foreground: '#F1F5F9',
  card: '#0E1525',
  glassCardBg: 'rgba(14, 21, 37, 0.90)',
  glassCardBorder: 'rgba(51, 65, 85, 0.65)',
  primary: '#3B82F6',
  primaryGradientEnd: '#2563EB',
  primaryForeground: '#FFFFFF',
  primarySoftBg: 'rgba(59, 130, 246, 0.15)',
  primarySoftBorder: 'rgba(59, 130, 246, 0.32)',
  accent: '#F97316',
  muted: '#1B263B',
  mutedForeground: '#94A3B8',
  border: '#1E293B',
  inputBorder: '#233044',
  inputBg: 'rgba(9, 14, 26, 0.85)',
  errorBg: 'rgba(69, 10, 10, 0.55)',
  errorBorder: 'rgba(127, 29, 29, 0.75)',
  errorText: '#FCA5A5',
  successBg: 'rgba(6, 78, 59, 0.45)',
  successBorder: 'rgba(16, 185, 129, 0.45)',
  successText: '#6EE7B7',
  success: '#34D399',
  strengthWeak: '#EF4444',
  strengthMedium: '#F59E0B',
  strengthStrong: '#10B981',
  overlayBg: 'rgba(2, 6, 23, 0.72)',
  glowPrimary: 'rgba(30, 64, 175, 0.32)',
  glowTeal: 'rgba(15, 118, 110, 0.28)',
  gridDot: 'rgba(59, 130, 246, 0.25)',
  gridLine: 'rgba(59, 130, 246, 0.08)',
};

export const AUTH_METRICS = {
  cardRadius: 20,
  dialogRadius: 16,
  controlRadius: 12,
  chipRadius: 12,
  inputHeight: 44,
  dialogInputHeight: 42,
  topChipHeight: 36,
  cardMaxWidth: 420,
  dialogMaxWidth: 440,
} as const;
