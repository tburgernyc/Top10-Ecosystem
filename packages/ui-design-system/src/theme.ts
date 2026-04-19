/**
 * Design token registry for the "Pearled Velvet Glass × Editorial Noir" system.
 * Import this in any package that needs programmatic access to design tokens.
 * The CSS variables are injected via globals.css — this file provides JS access.
 */
export const tokens = {
  colors: {
    bgNoir: '#0B0A0E',
    bgElevated: '#161420',
    bgSunken: '#070609',
    surfaceGlass: 'rgba(255, 255, 255, 0.03)',
    surfaceGlassMd: 'rgba(255, 255, 255, 0.06)',
    surfaceBorder: 'rgba(255, 255, 255, 0.08)',
    surfaceBorderMd: 'rgba(255, 255, 255, 0.14)',
    brandPrimary: '#F24B9A',
    brandSecondary: '#C9A96E',
    brandAccent: '#7B61FF',
    brandPrimaryGlow: 'rgba(242, 75, 154, 0.25)',
    textPrimary: '#F8F4F0',
    textSecondary: 'rgba(248, 244, 240, 0.60)',
    textTertiary: 'rgba(248, 244, 240, 0.35)',
    success: '#32D74B',
    warning: '#FFD60A',
    error: '#FF453A',
    info: '#0A84FF',
  },
  fonts: {
    display: "'Bodoni Moda', Georgia, serif",
    ui: "'Satoshi', 'DM Sans', sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
  },
  easing: {
    luxury: 'cubic-bezier(0.16, 1, 0.3, 1)',
    outExpo: 'cubic-bezier(0.19, 1, 0.22, 1)',
    inOutSilk: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  radii: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    pill: '9999px',
  },
} as const;

export type DesignTokens = typeof tokens;
