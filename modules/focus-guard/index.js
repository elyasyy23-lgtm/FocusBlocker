import { requireNativeModule } from 'expo-modules-core';

/**
 * JS side of the local `focus-guard` Expo module.
 *
 * Every call is wrapped so the app still renders in Expo Go / on a build without
 * the native module: `isAvailable` is false there and the UI shows a warning
 * instead of crashing the bundle.
 */
let native = null;
try {
  native = requireNativeModule('FocusGuard');
} catch (error) {
  native = null;
}

export const isAvailable = native !== null;

export const EMPTY_CONFIG = {
  keywords: [],
  domains: [],
  enabled: true,
  blockCount: 0,
  lastBlockPackage: null,
  lastBlockReason: null,
  lastBlockAt: 0,
  accessibilityEnabled: false,
  deviceAdminActive: false,
  excludedApps: [],
  language: 'en',
  defaultsSeeded: false,
  pinSet: false,
  strictLocked: false,
  unlockMinutesLeft: 0,
  remoteEnabled: false,
  remoteLastAt: 0,
  remoteCount: 0,
};

/** Remote deactivation state (v1.4.0) — see getRemoteState(). */
export const EMPTY_REMOTE = {
  enabled: false,
  number: '',
  code: '',
  lastAt: 0,
  count: 0,
};

function parseConfig(raw) {
  try {
    const parsed = JSON.parse(raw);
    return {
      ...EMPTY_CONFIG,
      ...parsed,
      keywords: parsed.keywords || [],
      domains: parsed.domains || [],
      excludedApps: parsed.excludedApps || [],
    };
  } catch (error) {
    return { ...EMPTY_CONFIG };
  }
}

export async function getConfig() {
  if (!native) return { ...EMPTY_CONFIG };
  const raw = await native.getConfig();
  return parseConfig(raw);
}

export async function saveKeywords(keywords) {
  if (!native) throw new Error('Native module missing — build a dev/release APK first.');
  return native.setKeywords(keywords);
}

export async function saveDomains(domains) {
  if (!native) throw new Error('Native module missing — build a dev/release APK first.');
  return native.setDomains(domains);
}

export async function setEnabled(enabled) {
  if (!native) throw new Error('Native module missing — build a dev/release APK first.');
  return native.setEnabled(enabled);
}

// ---------------------------------------------------------------------------
// Excluded apps + language (v1.2.0)
// ---------------------------------------------------------------------------

/** Every launchable app: `[{ pkg, label }]`, sorted by label. */
export async function getInstalledApps() {
  if (!native) return [];
  try {
    const parsed = JSON.parse(await native.getInstalledApps());
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => ({
        pkg: String(entry.pkg || ''),
        label: String(entry.label || entry.pkg || ''),
      }))
      .filter((entry) => entry.pkg.length > 0);
  } catch (error) {
    return [];
  }
}

export async function getExcludedApps() {
  if (!native) return [];
  try {
    const parsed = JSON.parse(await native.getExcludedApps());
    return Array.isArray(parsed) ? parsed.filter((pkg) => typeof pkg === 'string') : [];
  } catch (error) {
    return [];
  }
}

export async function saveExcludedApps(packages) {
  if (!native) throw new Error('Native module missing — build a dev/release APK first.');
  return native.setExcludedApps(packages);
}

export async function getLanguage() {
  if (!native) return 'en';
  try {
    return (await native.getLanguage()) === 'fa' ? 'fa' : 'en';
  } catch (error) {
    return 'en';
  }
}

export async function setLanguage(language) {
  if (!native) return false;
  try {
    return await native.setLanguage(language);
  } catch (error) {
    return false;
  }
}

/** Opens a URL; returns false when no app can handle it (fallback in JS). */
export async function openUrl(url) {
  if (!native) return false;
  try {
    return await native.openUrl(url);
  } catch (error) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Strict lock (v1.3.1)
// ---------------------------------------------------------------------------

/** Stores the Partner PIN (4-8 digits). Throws on an invalid PIN. */
export async function setPartnerPin(pin) {
  if (!native) throw new Error('Native module missing — build a dev/release APK first.');
  return native.setPartnerPin(pin);
}

/** True when the PIN is correct; also opens the 15-minute Settings window. */
export async function verifyPartnerPin(pin) {
  if (!native) return false;
  try {
    return Boolean(await native.verifyPartnerPin(pin));
  } catch (error) {
    return false;
  }
}

/** Removes the PIN — only when the current PIN is supplied. */
export async function clearPartnerPin(pin) {
  if (!native) return false;
  try {
    return Boolean(await native.clearPartnerPin(pin));
  } catch (error) {
    return false;
  }
}

/** { pinSet, locked, unlockMinutesLeft } — the guard's own view of the lock. */
export async function getStrictState() {
  if (!native) return { pinSet: false, locked: false, unlockMinutesLeft: 0 };
  try {
    const parsed = JSON.parse(await native.getStrictState());
    return {
      pinSet: Boolean(parsed.pinSet),
      locked: Boolean(parsed.locked),
      unlockMinutesLeft: Number(parsed.unlockMinutesLeft) || 0,
    };
  } catch (error) {
    return { pinSet: false, locked: false, unlockMinutesLeft: 0 };
  }
}

// ---------------------------------------------------------------------------
// Remote deactivation via SMS (v1.4.0)
// ---------------------------------------------------------------------------

/** { enabled, number, code, lastAt, count } — the receiver's live view. */
export async function getRemoteState() {
  if (!native) return { ...EMPTY_REMOTE };
  try {
    const parsed = JSON.parse(await native.getRemoteState());
    return {
      enabled: Boolean(parsed.enabled),
      number: String(parsed.number || ''),
      code: String(parsed.code || ''),
      lastAt: Number(parsed.lastAt) || 0,
      count: Number(parsed.count) || 0,
    };
  } catch (error) {
    return { ...EMPTY_REMOTE };
  }
}

/**
 * Saves the partner number + code and flips the feature. Switching it ON starts
 * a new listening window, so only SMS that arrive afterwards are processed.
 */
export async function setRemoteDeactivation({ enabled, number, code }) {
  if (!native) throw new Error('Native module missing — build a dev/release APK first.');
  return native.setRemoteDeactivation(Boolean(enabled), String(number || ''), String(code || ''));
}

export async function openAccessibilitySettings() {
  if (!native) throw new Error('Native module missing — build a dev/release APK first.');
  return native.openAccessibilitySettings();
}

export async function requestDeviceAdmin() {
  if (!native) throw new Error('Native module missing — build a dev/release APK first.');
  return native.requestDeviceAdmin();
}

export async function lockScreen() {
  if (!native) throw new Error('Native module missing — build a dev/release APK first.');
  return native.lockScreen();
}

export async function resetBlockCount() {
  if (!native) throw new Error('Native module missing — build a dev/release APK first.');
  return native.resetBlockCount();
}

export const EMPTY_HEALTH = {
  accessibilityEnabled: false,
  serviceRunning: false,
  foregroundActive: false,
  watchdogRunning: false,
  watchdogForeground: false,
  heartbeatAgeMs: -1,
  batteryOptimizationIgnored: false,
  sdkInt: 0,
  manufacturer: '',
  brand: '',
  autostartAvailable: false,
};

function parseJson(raw, fallback) {
  try {
    return { ...fallback, ...JSON.parse(raw) };
  } catch (error) {
    return { ...fallback };
  }
}

export async function getServiceHealth() {
  if (!native) return { ...EMPTY_HEALTH };
  return parseJson(await native.getServiceHealth(), EMPTY_HEALTH);
}

export async function requestIgnoreBatteryOptimizations() {
  if (!native) throw new Error('Native module missing — build a dev/release APK first.');
  return native.requestIgnoreBatteryOptimizations();
}

/**
 * Arms all three keep-alive paths (sticky watchdog + 15-minute alarm +
 * persisted job). Safe to call any time; it is what the app does on launch.
 */
export async function ensureKeepAlive() {
  if (!native) return false;
  try {
    return await native.ensureKeepAlive();
  } catch (error) {
    return false;
  }
}

/**
 * Opens the OEM "autostart / startup manager" screen (MIUI Autostart on
 * Redmi/POCO/Xiaomi) and returns `{ opened: 'autostart' | 'app_details' }`.
 */
export async function openAutostartSettings() {
  if (!native) throw new Error('Native module missing — build a dev/release APK first.');
  try {
    return { opened: 'app_details', ...JSON.parse(await native.openAutostartSettings()) };
  } catch (error) {
    return { opened: 'app_details' };
  }
}

/** Returns the last 100 guard events, NEWEST first (native stores oldest first). */
export async function getDebugLogs() {
  if (!native) return [];
  try {
    const parsed = JSON.parse(await native.getDebugLogs());
    if (!Array.isArray(parsed)) return [];
    return parsed.slice().reverse().map((entry, index) => ({
      id: `${entry.t}-${index}`,
      t: entry.t || 0,
      type: entry.type || 'unknown',
      pkg: entry.pkg || null,
      text: entry.text || '',
    }));
  } catch (error) {
    return [];
  }
}

export async function clearDebugLogs() {
  if (!native) throw new Error('Native module missing — build a dev/release APK first.');
  return native.clearDebugLogs();
}
