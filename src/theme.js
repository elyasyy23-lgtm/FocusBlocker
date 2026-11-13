/**
 * Shared colours + layout helpers for Tavakkol.
 *
 * v1.3.2: the bundled background photo is bright, so the scrim on top of it is
 * now a light one and every text that sits DIRECTLY on that photo (page titles,
 * taglines, section headings, footers) uses the near-black `page*` colours.
 * Cards keep their dark translucent surface, so their own text stays light —
 * `text` / `muted` are the card colours, `pageText` / `pageMuted` the page ones.
 */
export const COLORS = {
  background: '#0B0F14',
  /** Light scrim over the background photo (readability, keeps it bright). */
  overlay: 'rgba(248,250,252,0.74)',
  overlayStrong: 'rgba(248,250,252,0.90)',
  /** Flat tone behind the photo while it loads / behind the status bar. */
  pageBackground: '#EEF3F8',
  /** Page-level (on the photo) text — very dark grey, not pure black. */
  pageText: '#0F172A',
  pageMuted: '#334155',
  pageAccent: '#15803D',
  pageWarning: '#9A3412',
  pageError: '#B91C1C',
  surface: 'rgba(20,27,34,0.88)',
  surfaceAlt: 'rgba(30,40,52,0.90)',
  border: 'rgba(58,72,90,0.9)',
  text: '#F2F6FA',
  muted: '#A6B4C5',
  accent: '#4ADE80',
  /** Green used for a completed save (v1.3.2). */
  success: '#16A34A',
  successText: '#F0FDF4',
  accentSoft: 'rgba(18,53,35,0.92)',
  danger: '#F87171',
  warning: '#FBBF24',
  onAccent: '#04130A',
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
