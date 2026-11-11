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
};

function parseConfig(raw) {
  try {
    const parsed = JSON.parse(raw);
    return {
      ...EMPTY_CONFIG,
      ...parsed,
      keywords: parsed.keywords || [],
      domains: parsed.domains || [],
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
