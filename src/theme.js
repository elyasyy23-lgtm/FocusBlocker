/**
 * Shared colours + layout helpers for Tavakkol.
 *
 * v1.2.0: the surfaces are translucent on purpose — the bundled background
 * image (assets/background.jpg) sits behind every screen and a dark overlay
 * keeps the text readable on top of it.
 */
export const COLORS = {
  background: '#0B0F14',
  overlay: 'rgba(6,11,16,0.80)',
  overlayStrong: 'rgba(6,11,16,0.92)',
  surface: 'rgba(20,27,34,0.88)',
  surfaceAlt: 'rgba(30,40,52,0.90)',
  border: 'rgba(58,72,90,0.9)',
  text: '#F2F6FA',
  muted: '#A6B4C5',
  accent: '#4ADE80',
  accentSoft: 'rgba(18,53,35,0.92)',
  danger: '#F87171',
  warning: '#FBBF24',
  onAccent: '#04130A',
};

/** Overlay painted on top of the background image so text stays readable. */
export const BACKGROUND_OVERLAY = 'rgba(6,11,16,0.78)';

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
