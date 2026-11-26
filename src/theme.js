/**
 * Shared colours, spacing and shape tokens for Tavakkol.
 *
 * v1.3.2: the bundled background photo is bright, so the scrim on top of it is
 * a light one and every text that sits DIRECTLY on that photo (page titles,
 * taglines, section headings, footers) uses the near-black `page*` colours.
 * Cards keep their dark translucent surface, so their own text stays light —
 * `text` / `muted` are the card colours, `pageText` / `pageMuted` the page ones.
 *
 * v1.4.26 (visual only): one shape/spacing scale so every card, button and chip
 * agrees, plus a deeper surface palette and soft elevation. Nothing here changes
 * behaviour — screens still read exactly the same props and call the same APIs.
 */
export const COLORS = {
  background: '#080C11',
  /** Light scrim over the background photo (readability, keeps it bright). */
  overlay: 'rgba(248,250,252,0.74)',
  overlayStrong: 'rgba(248,250,252,0.90)',
  /** Flat tone behind the photo while it loads / behind the status bar. */
  pageBackground: '#EEF3F8',
  /** Page-level (on the photo) text — very dark grey, not pure black. */
  pageText: '#0B1420',
  pageMuted: '#2C3A4B',
  pageAccent: '#146B34',
  pageWarning: '#8A2E0F',
  pageError: '#B02020',
  /** Card surfaces: deeper + slightly cooler for more depth against the photo. */
  surface: 'rgba(15,21,29,0.93)',
  surfaceAlt: 'rgba(27,37,49,0.95)',
  surfaceElevated: 'rgba(35,47,61,0.97)',
  border: 'rgba(70,88,110,0.85)',
  borderSoft: 'rgba(58,74,94,0.55)',
  hairline: 'rgba(255,255,255,0.07)',
  text: '#F4F8FC',
  muted: '#A9B7C8',
  accent: '#4ADE80',
  accentDeep: '#22C55E',
  accentGlow: 'rgba(74,222,128,0.13)',
  /** Green used for a completed save (v1.3.2). */
  success: '#16A34A',
  successText: '#F0FDF4',
  accentSoft: 'rgba(18,53,35,0.92)',
  danger: '#F87171',
  dangerGlow: 'rgba(248,113,113,0.13)',
  warning: '#FBBF24',
  warningGlow: 'rgba(251,191,36,0.14)',
  onAccent: '#04130A',
};

/** One radius scale — cards, inner cards, buttons, inputs, pills. */
export const RADIUS = {
  xl: 26,
  lg: 22,
  md: 16,
  sm: 12,
  pill: 999,
};

/** One spacing scale, so vertical rhythm is consistent across screens. */
export const SPACE = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
};

/** Soft elevation for a card sitting on the photo. */
export const SHADOW_CARD = {
  shadowColor: '#02060B',
  shadowOpacity: 0.38,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 12 },
  elevation: 8,
};

/** Lighter elevation for nested boxes and pills. */
export const SHADOW_SOFT = {
  shadowColor: '#02060B',
  shadowOpacity: 0.22,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
};

/** Green glow under a primary action button. */
export const SHADOW_BUTTON = {
  shadowColor: '#0B3D1E',
  shadowOpacity: 0.45,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 5,
};

/** Overlay painted on top of the background image so text stays readable. */
export const BACKGROUND_OVERLAY = 'rgba(248,250,252,0.74)';

/**
 * Persian reads right-to-left. Forcing RTL with I18nManager needs a full app
 * restart, so the layout flips the cheap way instead: every text node and row
 * follows `direction(lang)`.
 */
export function direction(lang) {
  return lang === 'fa' ? 'rtl' : 'ltr';
}

export function textAlign(lang) {
  return lang === 'fa' ? 'right' : 'left';
}
