/**
 * App-wide constants and the starter configuration for a fresh install.
 */

/**
 * Keywords written into SharedPreferences ONLY when the app has never saved a
 * list on this install (see `defaultsSeeded` in the native config). After the
 * first save the list is entirely the user's — clearing it stays cleared.
 *
 * Replace this array with your own comma-separated list — one entry per line.
 */
export const DEFAULT_KEYWORDS = [
  'sex',
  'porn',
  'casino',
];

/** Public download page — what the "Share App" button sends. */
export const APP_SHARE_URL = 'https://github.com/elyasyy23-lgtm/FocusBlocker/releases/latest';

/** Rubika ID of the developer. Change it to your own Rubika username. */
export const DEVELOPER_RUBIKA_ID = 'TavakkolSupport';

export const DEVELOPER_RUBIKA_URL = `https://rubika.ir/${DEVELOPER_RUBIKA_ID}`;

/** Rubika also answers custom schemes; tried first, then the https URL. */
export const DEVELOPER_RUBIKA_SCHEME = `rubika://${DEVELOPER_RUBIKA_ID}`;
