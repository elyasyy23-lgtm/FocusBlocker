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

/**
 * Rubika ID of the developer (v1.3.3: @yasmajyd). The http link and the custom
 * scheme are both derived from it, so this one string is the only place to
 * change the support contact.
 */
export const DEVELOPER_RUBIKA_ID = 'yasmajyd';

export const DEVELOPER_RUBIKA_URL = `https://rubika.ir/${DEVELOPER_RUBIKA_ID}`;

/** Rubika also answers custom schemes; tried first, then the https URL. */
export const DEVELOPER_RUBIKA_SCHEME = `rubika://${DEVELOPER_RUBIKA_ID}`;

/**
 * Donation (v1.3.0) — the "Support Us" sheet in Settings.
 *
 * Paste your OWN wallet address here; the sheet shows it with a Copy button.
 * Left empty, the app says the address is not set yet — it must never display a
 * placeholder, because someone could copy it and send money to a stranger.
 */
export const DONATION_WALLET = 'TANP1ibS4DsF2C1p1rBGAZ5MrGZyS5sUmU';

/** Shown next to the address so the supporter knows which network to use. */
export const DONATION_NETWORK = 'USDT (TRC20)';

/**
 * v1.3.2 — domestic (inside Iran) donation route: the owner's ZarinPal payment
 * link. Same rule as the wallet: never invent a destination. Intentionally
 * empty (owner decision 2026-11-13) — the "Support from inside Iran" button
 * opens a sheet that says the link is not set yet, instead of sending money
 * somewhere the owner never approved.
 */
export const DONATION_ZARINPAL_URL = '';
