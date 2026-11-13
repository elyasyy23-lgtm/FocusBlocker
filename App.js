import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  FlatList,
  ImageBackground,
  Linking,
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as FocusGuard from './modules/focus-guard';
import { createTranslator } from './src/i18n';
import { COLORS, textAlign } from './src/theme';
import { ActionButton, Chip, GiftNote, Section, StatusPill } from './src/components/ui';
import { DEFAULT_KEYWORDS } from './src/defaults';
import { VERSION, VERSION_LABEL } from './src/buildInfo';
import SettingsScreen from './src/screens/SettingsScreen';
import HelpScreen from './src/screens/HelpScreen';
import LockScreen from './src/screens/LockScreen';

const BACKGROUND = require('./assets/background.jpg');

// v1.4.2: calm loop behind the app, deliberately quiet (owner: 30 %).
const BACKGROUND_MUSIC = require('./assets/background_music.mp3');
const MUSIC_VOLUME = 0.3;

/**
 * v1.4.2 Delay Mode challenge. The English string IS the i18n key, so the
 * Persian build shows the Persian text and the typed answer is compared
 * against whichever language is on screen.
 */
const DELAY_CHALLENGE =
  'I am standing here to protect myself, my mind, and my future. I know this urge is temporary, and if I wait a few minutes, it will pass. I am stronger than to ruin my peace and values for a fleeting moment of pleasure. I am striving for bigger dreams and a more deserving life. Every time I resist this urge, my willpower grows stronger. I choose to stay loyal to myself today, and I am writing this text with focus and calm to prove that I am in control of my life.';

/** Whitespace-insensitive compare — the challenge is long, nothing else is forgiven. */
function normalizeChallenge(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

// v1.4.2: the update check reads this tiny JSON from the GitHub Pages site.
const UPDATE_MANIFEST_URL = 'https://elyasyy23-lgtm.github.io/FocusBlocker/version.json';

/** "1.4.10" → [1, 4, 10]; anything unparsable → null (never a false update). */
function parseVersion(value) {
  const raw = String(value || '')
    .trim()
    .replace(/^v/i, '');
  if (!raw) return null;
  const parts = raw.split('.').map((part) => parseInt(part, 10));
  if (parts.length === 0 || parts.some((part) => !Number.isFinite(part))) return null;
  return parts;
}

function isNewerVersion(latest, current) {
  const next = parseVersion(latest);
  const now = parseVersion(current);
  if (!next || !now) return false;
  const length = Math.max(next.length, now.length);
  for (let index = 0; index < length; index += 1) {
    const a = next[index] || 0;
    const b = now[index] || 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return false;
}

function normalizeDomain(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
    .replace(/[/?#].*$/, '')
    .replace(/:\d+$/, '')
    .replace(/^www\./, '')
    .replace(/\.+$/, '');
}

const LOG_TYPE_COLORS = {
  service_connected: '#7DD3FC',
  service_unbound: '#F87171',
  service_destroyed: '#F87171',
  service_interrupted: '#FBBF24',
  fgs_started: '#4ADE80',
  fgs_failed: '#F87171',
  fgs_fallback: '#FBBF24',
  watchdog_started: '#4ADE80',
  watchdog_wakeup: '#7DD3FC',
  watchdog_task_removed: '#7DD3FC',
  watchdog_destroyed: '#F87171',
  watchdog_failed: '#F87171',
  guard_missing: '#F87171',
  guard_recovered: '#4ADE80',
  guard_alert: '#FBBF24',
  guard_alert_failed: '#F87171',
  alarm_failed: '#FBBF24',
  job_failed: '#FBBF24',
  job_tick: '#7DD3FC',
  autostart_opened: '#8C9AAB',
  keyword_detected: '#FBBF24',
  domain_detected: '#FBBF24',
  block_triggered: '#F87171',
  block_recheck_back: '#FBBF24',
  block_recheck_home: '#FBBF24',
  block_recheck_clear: '#7DD3FC',
  scan_failed: '#FBBF24',
};

function logTypeColor(type) {
  return LOG_TYPE_COLORS[type] || COLORS.muted;
}

function formatLogTime(value) {
  if (!value) return '--:--:--';
  const date = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}:${pad(date.getSeconds())}`;
}

function shortPackage(pkg) {
  const parts = String(pkg || '').split('.');
  return parts.slice(-2).join('.');
}

/** "42s ago" / "12min ago" / "never" — how long the watchdog has been silent. */
function formatHeartbeat(ageMs, t) {
  if (ageMs === null || ageMs === undefined || ageMs < 0) return t('never');
  const seconds = Math.round(ageMs / 1000);
  if (seconds < 90) return t('{{seconds}}s ago', { seconds });
  return t('{{minutes}}min ago', { minutes: Math.round(seconds / 60) });
}

export default function App() {
  const [config, setConfig] = useState(FocusGuard.EMPTY_CONFIG);
  const [keywordsText, setKeywordsText] = useState('');
  const [domainsText, setDomainsText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingDomains, setSavingDomains] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [message, setMessage] = useState(null);
  const [health, setHealth] = useState(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [clearingLogs, setClearingLogs] = useState(false);
  const [keepAliveBusy, setKeepAliveBusy] = useState(false);
  const [screen, setScreen] = useState('main');
  const [appState, setAppState] = useState(AppState.currentState);

  // v1.4.2 Delay Mode: the challenge lives behind a modal; nothing is written
  // to the native store until the typed text matches exactly.
  const [delayOpen, setDelayOpen] = useState(false);
  const [delayTyped, setDelayTyped] = useState('');
  const [delayError, setDelayError] = useState(null);

  // v1.4.2: update checker — `null` while unknown, `{ latest, url }` when a
  // strictly newer version is published on the Pages site.
  const [updateInfo, setUpdateInfo] = useState(null);
  const updateCheckedRef = useRef(false);

  // v1.3.1 strict lock: the app is gated on every foreground while a Partner
  // PIN exists. Nothing else in the app asks for it — Settings and the
  // Protection switch stay free (owner decision, 2026-11-12).
  const [sessionUnlocked, setSessionUnlocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  // v1.3.0: the Help screen came from Settings, so Back goes back there first.
  useEffect(() => {
    if (screen === 'main') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setScreen(screen === 'help' ? 'settings' : 'main');
      return true;
    });
    return () => subscription.remove();
  }, [screen]);
  const [lang, setLang] = useState('en');
  const keywordsDirtyRef = useRef(false);
  const domainsDirtyRef = useRef(false);
  const seededRef = useRef(false);

  const t = useMemo(() => createTranslator(lang), [lang]);
  const align = textAlign(lang);
  const isRtl = lang === 'fa';
  // Localised challenge the user must retype (same sentence in both languages).
  const challengeText = t(DELAY_CHALLENGE);

  const refresh = useCallback(async () => {
    try {
      const next = await FocusGuard.getConfig();
      setConfig(next);
      setLang(next.language === 'fa' ? 'fa' : 'en');
      if (!keywordsDirtyRef.current) {
        setKeywordsText(next.keywords.join(', '));
      }
      if (!domainsDirtyRef.current) {
        setDomainsText(next.domains.join(', '));
      }
    } catch (error) {
      setMessage(error.message || 'Could not read the native configuration.');
    } finally {
      setLoading(false);
    }
    // Health rides along every foreground refresh — the Debug Log section
    // always shows the live keep-alive state without opening the modal.
    FocusGuard.getServiceHealth()
      .then(setHealth)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      setAppState(state);
      if (state === 'active') {
        refresh();
      } else {
        // Leaving the app locks it again — the next return needs the PIN.
        setSessionUnlocked(false);
      }
    });
    return () => subscription.remove();
  }, [refresh]);

  // v1.4.2: background music. One player for the whole app, looping at 30 %.
  // It pauses the moment the app leaves the foreground and stays silent while
  // the mute switch in Settings is on.
  const musicPlayer = useAudioPlayer(BACKGROUND_MUSIC);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  useEffect(() => {
    // Wait for the native prefs before deciding: a muted app must not blip.
    if (!musicPlayer || loading) return;
    try {
      musicPlayer.loop = true;
      musicPlayer.volume = MUSIC_VOLUME;
      if (appState === 'active' && !config.musicMuted) {
        musicPlayer.play();
      } else {
        musicPlayer.pause();
      }
    } catch (error) {
      // A missing/invalid audio file must never break the guard screen.
    }
  }, [appState, config.musicMuted, loading, musicPlayer]);

  useEffect(() => {
    // v1.4.2: silent update check, once per app launch. Any failure (offline,
    // Pages hiccup, malformed JSON) is swallowed — a guard app must never open
    // with an error just because the update server was unreachable.
    if (updateCheckedRef.current) return undefined;
    updateCheckedRef.current = true;
    let cancelled = false;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = setTimeout(() => {
      if (controller) controller.abort();
    }, 8000);

    (async () => {
      try {
        // Cache-buster: Pages/carriers love serving a stale JSON otherwise.
        const response = await fetch(`${UPDATE_MANIFEST_URL}?t=${Date.now()}`, {
          signal: controller ? controller.signal : undefined,
          headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
        });
        if (!response.ok) return;
        const data = await response.json();
        const latest = String((data && data.latestVersion) || '');
        const url = String((data && data.downloadUrl) || '');
        // Only an https link ever leaves the app — the manifest cannot point
        // the browser at an http/intent URL.
        if (!/^https:\/\//i.test(url)) return;
        if (!isNewerVersion(latest, VERSION)) return;
        if (!cancelled) setUpdateInfo({ latest, url });
      } catch (error) {
        // Silent by design.
      } finally {
        clearTimeout(timer);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    // Android 13+: without the notification permission the persistent guard
    // notification stays hidden (the guard itself still runs fine).
    if (Platform.OS === 'android' && Platform.Version >= 33 && FocusGuard.isAvailable) {
      PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS').catch(() => {});
    }
  }, []);

  useEffect(() => {
    // v1.1.4: every launch re-arms all three keep-alive paths. This is also the
    // recovery path after a force-stop, which wipes alarms and jobs.
    if (Platform.OS === 'android' && FocusGuard.isAvailable) {
      FocusGuard.ensureKeepAlive().catch(() => {});
    }
  }, []);

  useEffect(() => {
    // v1.2.0: a fresh install starts with a useful list instead of an empty
    // guard. Written to SharedPreferences exactly once — clearing the list
    // afterwards is respected, because saving any list sets `defaultsSeeded`.
    if (!FocusGuard.isAvailable || loading || seededRef.current) return;
    if (config.defaultsSeeded) {
      seededRef.current = true;
      return;
    }
    seededRef.current = true;
    (async () => {
      try {
        await FocusGuard.saveKeywords(config.keywords.length > 0 ? config.keywords : DEFAULT_KEYWORDS);
        keywordsDirtyRef.current = false;
        await refresh();
      } catch (error) {
        // Nothing to do: the guard simply stays empty until the user saves.
      }
    })();
  }, [config.defaultsSeeded, config.keywords, loading, refresh]);

  const saveKeywords = async () => {
    const keywords = keywordsText
      .split(/[,\n]/)
      .map((keyword) => keyword.trim())
      .filter((keyword) => keyword.length > 0);

    setSaving(true);
    setMessage(null);
    try {
      await FocusGuard.saveKeywords(keywords);
      keywordsDirtyRef.current = false;
      await refresh();
      setMessage(
        keywords.length === 0
          ? t('Block list cleared — nothing is blocked right now.')
          : t('Saved {{count}} keyword(s).', { count: keywords.length })
      );
    } catch (error) {
      setMessage(error.message || t('Saving the block list failed.'));
    } finally {
      setSaving(false);
    }
  };

  const saveDomains = async () => {
    const domains = domainsText
      .split(/[,\n]/)
      .map((domain) => normalizeDomain(domain))
      .filter((domain) => domain.length > 0);

    setSavingDomains(true);
    setMessage(null);
    try {
      await FocusGuard.saveDomains(domains);
      domainsDirtyRef.current = false;
      await refresh();
      setMessage(
        domains.length === 0
          ? t('Domain list cleared — no website is blocked.')
          : t('Saved {{count}} domain(s).', { count: domains.length })
      );
    } catch (error) {
      setMessage(error.message || t('Saving the domain list failed.'));
    } finally {
      setSavingDomains(false);
    }
  };

  /**
   * v1.3.1: the Protection switch is a plain switch — no PIN, no dialog. The
   * v1.3.2: the Partner PIN only guards entering the app (LockScreen). The
   * system device-admin / app-info pages are guarded by the accessibility
   * service whenever Protection is ON — no PIN involved.
   * v1.4.2: when Delay Mode is ON, switching OFF is gated behind typing a long
   * challenge. A cancel, a wrong answer or closing the modal leaves Protection
   * exactly as it was — ON.
   */
  const applyEnabled = async (value) => {
    setToggling(true);
    setMessage(null);
    try {
      await FocusGuard.setEnabled(value);
      await refresh();
    } catch (error) {
      setMessage(error.message || t('Could not change the blocker state.'));
    } finally {
      setToggling(false);
    }
  };

  const toggleBlocking = (value) => {
    if (!value && config.delayMode) {
      setDelayTyped('');
      setDelayError(null);
      setDelayOpen(true);
      return;
    }
    applyEnabled(value);
  };

  const toggleDelayMode = async (value) => {
    try {
      await FocusGuard.setDelayMode(value);
      await refresh();
      setMessage(
        value
          ? t('Delay Mode is on — turning Protection off now requires typing the full text.')
          : t('Delay Mode is off — Protection can be switched off again directly.')
      );
    } catch (error) {
      setMessage(error.message || t('Could not change Delay Mode.'));
    }
  };

  const toggleMusicMuted = async (muted) => {
    try {
      await FocusGuard.setMusicMuted(muted);
      await refresh();
    } catch (error) {
      setMessage(error.message || t('Could not change the music setting.'));
    }
  };

  /** Paste guard: one change that adds a whole block of text is not typing. */
  const handleDelayChange = (next) => {
    if (next.length - delayTyped.length > 10) return;
    if (next.length > challengeText.length + 40) return;
    setDelayTyped(next);
    if (delayError) setDelayError(null);
  };

  const cancelDelay = () => {
    // Protection was never touched — it is still ON.
    setDelayOpen(false);
    setDelayTyped('');
    setDelayError(null);
  };

  const confirmDelayOff = async () => {
    if (normalizeChallenge(delayTyped) !== normalizeChallenge(challengeText)) {
      setDelayError(
        t('The text does not match yet. Keep typing — or cancel to keep Protection on.')
      );
      return;
    }
    setDelayOpen(false);
    setDelayTyped('');
    setDelayError(null);
    await applyEnabled(false);
  };

  /** Update modal → browser. The native bridge is tried first, then Linking. */
  const openUpdateDownload = async () => {
    const url = updateInfo ? updateInfo.url : null;
    setUpdateInfo(null);
    if (!url) return;
    try {
      const opened = await FocusGuard.openUrl(url);
      if (!opened) await Linking.openURL(url);
    } catch (error) {
      Linking.openURL(url).catch(() => {});
    }
  };

  const unlockApp = async (pin) => {
    setUnlocking(true);
    try {
      const ok = await FocusGuard.verifyPartnerPin(pin);
      if (ok) {
        setSessionUnlocked(true);
        refresh();
      }
      return ok;
    } catch (error) {
      return false;
    } finally {
      setUnlocking(false);
    }
  };

  const openAccessibility = async () => {
    try {
      await FocusGuard.openAccessibilitySettings();
      setMessage(t('Find “Tavakkol guard (keywords + domains)” in the list and switch it on.'));
    } catch (error) {
      setMessage(error.message || t('Could not open Accessibility settings.'));
    }
  };

  const enableDeviceAdmin = async () => {
    try {
      await FocusGuard.requestDeviceAdmin();
      setMessage(t('Confirm the system dialog to keep Tavakkol installed.'));
      setTimeout(refresh, 1200);
    } catch (error) {
      setMessage(error.message || t('Could not open the device admin dialog.'));
    }
  };

  const runPanicLock = async () => {
    try {
      await FocusGuard.lockScreen();
    } catch (error) {
      setMessage(error.message || t('Locking the screen failed.'));
    }
  };

  const clearCounter = async () => {
    try {
      await FocusGuard.resetBlockCount();
      await refresh();
      setMessage(t('Block counter reset.'));
    } catch (error) {
      setMessage(error.message || t('Could not reset the counter.'));
    }
  };

  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const [nextLogs, nextHealth] = await Promise.all([
        FocusGuard.getDebugLogs(),
        FocusGuard.getServiceHealth(),
      ]);
      setLogs(nextLogs);
      setHealth(nextHealth);
    } catch (error) {
      setMessage(error.message || t('Could not read the debug log.'));
      setLogsOpen(false);
    } finally {
      setLogsLoading(false);
    }
  };

  const openLogs = async () => {
    setLogsOpen(true);
    await loadLogs();
  };

  const closeLogs = () => setLogsOpen(false);

  const clearLogs = async () => {
    setClearingLogs(true);
    try {
      await FocusGuard.clearDebugLogs();
      setLogs([]);
    } catch (error) {
      setMessage(error.message || t('Could not clear the log.'));
    } finally {
      setClearingLogs(false);
    }
  };

  const fixBattery = async () => {
    try {
      await FocusGuard.requestIgnoreBatteryOptimizations();
      setMessage(t('Confirm the system dialog so Android stops killing the guard.'));
      setTimeout(loadLogs, 1500);
    } catch (error) {
      setMessage(error.message || t('Could not open the battery dialog.'));
    }
  };

  const startKeepAlive = async () => {
    setKeepAliveBusy(true);
    try {
      await FocusGuard.ensureKeepAlive();
      await refresh();
      setMessage(
        t('Keep-alive armed: watchdog started, 15-minute alarm and persisted job scheduled.')
      );
    } catch (error) {
      setMessage(error.message || t('Could not start the keep-alive.'));
    } finally {
      setKeepAliveBusy(false);
    }
  };

  const openAutostart = async () => {
    try {
      const result = await FocusGuard.openAutostartSettings();
      setMessage(
        result.opened === 'autostart'
          ? t('Switch Autostart ON for Tavakkol on this screen, then come back.')
          : t(
              'Find “Autostart” (or “Battery usage / Allow background activity”) on this screen and allow Tavakkol.'
            )
      );
    } catch (error) {
      setMessage(error.message || t('Could not open the autostart screen.'));
    }
  };

  // ---------------------------------------------------------------- settings
  const changeLanguage = useCallback(async (code) => {
    setLang(code);
    await FocusGuard.setLanguage(code);
  }, []);

  const toggleExcluded = useCallback(
    async (pkg) => {
      const set = new Set(config.excludedApps);
      if (set.has(pkg)) set.delete(pkg);
      else set.add(pkg);
      const next = Array.from(set).sort();
      setConfig((previous) => ({ ...previous, excludedApps: next }));
      try {
        await FocusGuard.saveExcludedApps(next);
      } catch (error) {
        setMessage(error.message || t('Could not save the excluded apps.'));
      }
    },
    [config.excludedApps, t]
  );

  const clearExcluded = useCallback(async () => {
    setConfig((previous) => ({ ...previous, excludedApps: [] }));
    try {
      await FocusGuard.saveExcludedApps([]);
    } catch (error) {
      setMessage(error.message || t('Could not save the excluded apps.'));
    }
  }, [t]);

  const keywordsPreview = Array.from(
    new Set(
      keywordsText
        .split(/[,\n]/)
        .map((keyword) => keyword.trim())
        .filter(Boolean)
    )
  );

  const domainsPreview = Array.from(
    new Set(
      domainsText
        .split(/[,\n]/)
        .map((domain) => normalizeDomain(domain))
        .filter(Boolean)
    )
  );

  // v1.3.2: a save button is GREEN while the editor text is exactly what is
  // stored (the save went through) and turns WHITE the moment the text changes,
  // so "white" always means "there are unsaved edits". Derived from the stored
  // list, so the state survives restarts without extra flags.
  const keywordsSaved = !loading && keywordsText === config.keywords.join(', ');
  const domainsSaved = !loading && domainsText === config.domains.join(', ');

  const blockingReady =
    config.accessibilityEnabled &&
    config.enabled &&
    (config.keywords.length > 0 || config.domains.length > 0);

  // The first millisecond has no config yet — show a bare loader so a locked
  // app never flashes its content before the gate decides.
  if (loading && FocusGuard.isAvailable) {
    return (
      <ImageBackground source={BACKGROUND} style={styles.root} resizeMode="cover">
        <View style={styles.overlay} />
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.pageBackground} />
        <View style={styles.bootLoader}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      </ImageBackground>
    );
  }

  // v1.3.1: with a Partner PIN saved, nothing in the app is reachable until
  // the PIN is entered — the gate sits above every screen (main/settings/help).
  const appLocked =
    FocusGuard.isAvailable && config.pinSet && config.enabled && !sessionUnlocked;

  if (appLocked) {
    return (
      <ImageBackground source={BACKGROUND} style={styles.root} resizeMode="cover">
        <View style={styles.overlay} />
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.pageBackground} />
        <LockScreen
          t={t}
          lang={lang}
          busy={unlocking}
          onSubmit={unlockApp}
        />
      </ImageBackground>
    );
  }

  if (screen === 'help') {
    return (
      <HelpScreen
        t={t}
        lang={lang}
        onBack={() => setScreen('settings')}
      />
    );
  }

  if (screen === 'settings') {
    return (
      <SettingsScreen
        t={t}
        lang={lang}
        onBack={() => setScreen('main')}
        onChangeLanguage={changeLanguage}
        excluded={config.excludedApps}
        onToggleExcluded={toggleExcluded}
        onClearExcluded={clearExcluded}
        isAvailable={FocusGuard.isAvailable}
        onOpenHelp={() => setScreen('help')}
        onMessage={setMessage}
        message={message}
        musicMuted={config.musicMuted}
        onToggleMusicMuted={toggleMusicMuted}
      />
    );
  }

  return (
    <ImageBackground source={BACKGROUND} style={styles.root} resizeMode="cover">
      <View style={styles.overlay} />
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.pageBackground} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={[styles.brandRow, isRtl && styles.brandRowRtl]}>
          <View style={styles.brandText}>
            <Text style={[styles.brand, { textAlign: align }]}>{t('Tavakkol')}</Text>
            <Text style={[styles.brandSub, { textAlign: align }]}>{t('Personal guard')}</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('Help')}
              onPress={() => setScreen('help')}
              style={({ pressed }) => [styles.gear, pressed && styles.pressed]}>
              <Text style={styles.helpIcon}>?</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('Settings')}
              onPress={() => setScreen('settings')}
              style={({ pressed }) => [styles.gear, pressed && styles.pressed]}>
              <Text style={styles.gearIcon}>⚙</Text>
            </Pressable>
          </View>
        </View>

        <Text style={[styles.tagline, { textAlign: align }]}>
          {t(
            'A guard for your own phone. It watches text as it changes on screen — a blocked keyword or domain in a search bar, address bar or chat closes the app immediately.'
          )}
        </Text>

        <GiftNote
          lang={lang}
          text={t('This app is completely free. Please remember us in your prayers.')}
        />

        {!FocusGuard.isAvailable ? (
          <View style={styles.warningBox}>
            <Text style={[styles.warningTitle, { textAlign: align }]}>
              {t('Native build required')}
            </Text>
            <Text style={[styles.warningText, { textAlign: align }]}>
              {t(
                'Expo Go cannot run accessibility services. Build the APK (eas build -p android --profile preview) and install it — every control below works there.'
              )}
            </Text>
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator color={COLORS.accent} style={styles.loader} />
        ) : (
          <>
            <View style={styles.heroCard}>
              <Text style={[styles.heroLabel, { textAlign: align }]}>{t('Protection')}</Text>
              <Text
                style={[
                  styles.heroState,
                  blockingReady ? styles.heroOn : styles.heroOff,
                  { textAlign: align },
                ]}>
                {blockingReady ? t('Active') : t('Not active yet')}
              </Text>
              <Text style={[styles.heroHint, { textAlign: align }]}>
                {config.enabled
                  ? t('{{keywords}} keyword(s) + {{domains}} domain(s) watched', {
                      keywords: config.keywords.length,
                      domains: config.domains.length,
                    })
                  : t('Blocker paused')}
                {' · '}
                {t('{{count}} block(s) so far', { count: config.blockCount })}
              </Text>
              <View style={[styles.switchGrid, isRtl && styles.switchGridRtl]}>
                <View style={styles.switchCell}>
                  <Text style={[styles.switchTitle, { textAlign: align }]}>{t('Protection')}</Text>
                  <Text style={[styles.switchHint, { textAlign: align }]}>
                    {config.accessibilityEnabled
                      ? t('Accessibility service is running')
                      : t('Service is off — enable it below')}
                  </Text>
                  <View style={styles.switchControl}>
                    <Switch
                      value={config.enabled}
                      onValueChange={toggleBlocking}
                      disabled={toggling || !FocusGuard.isAvailable}
                      trackColor={{ false: COLORS.border, true: COLORS.accentSoft }}
                      thumbColor={config.enabled ? COLORS.accent : '#5A6779'}
                    />
                  </View>
                </View>

                <View style={styles.switchCell}>
                  <Text style={[styles.switchTitle, { textAlign: align }]}>{t('Delay Mode')}</Text>
                  <Text style={[styles.switchHint, { textAlign: align }]}>
                    {config.delayMode
                      ? t('On — Protection can only be turned off by typing the full text')
                      : t('Off — Protection turns off with one tap')}
                  </Text>
                  <View style={styles.switchControl}>
                    <Switch
                      value={config.delayMode}
                      onValueChange={toggleDelayMode}
                      disabled={!FocusGuard.isAvailable}
                      trackColor={{ false: COLORS.border, true: COLORS.accentSoft }}
                      thumbColor={config.delayMode ? COLORS.accent : '#5A6779'}
                    />
                  </View>
                </View>
              </View>
            </View>

            <Section
              lang={lang}
              title={t('{{n}}. {{title}}', { n: 1, title: t('Blocked keywords') })}
              subtitle={t(
                'Any text that changes on screen is checked — search bars, the browser address bar and chat messages (Telegram, Rubika). Separate keywords with a comma. Matching is whole-word only, so a short word never fires inside a longer one.'
              )}>
              <TextInput
                value={keywordsText}
                onChangeText={(value) => {
                  keywordsDirtyRef.current = true;
                  setKeywordsText(value);
                }}
                placeholder="sex, porn, casino"
                placeholderTextColor="#5A6779"
                autoCapitalize="none"
                autoCorrect={false}
                multiline
                style={[styles.input, { textAlign: align }]}
              />
              <View style={styles.chipRow}>
                {keywordsPreview.length === 0 ? (
                  <Text style={styles.emptyHint}>
                    {t('No keywords yet — nothing will be blocked.')}
                  </Text>
                ) : (
                  keywordsPreview.map((keyword) => (
                    <Chip key={keyword} label={keyword} lang={lang} />
                  ))
                )}
              </View>
              <ActionButton
                label={t('Save block list')}
                onPress={saveKeywords}
                busy={saving}
                saved={keywordsSaved}
                disabled={!FocusGuard.isAvailable}
              />
            </Section>

            <Section
              lang={lang}
              title={t('{{n}}. {{title}}', { n: 2, title: t('Blocked domains') })}
              subtitle={t(
                'The guard reads the address bar of Chrome and other browsers. http://, https://, www. and paths are removed automatically — just type the domain.'
              )}>
              <TextInput
                value={domainsText}
                onChangeText={(value) => {
                  domainsDirtyRef.current = true;
                  setDomainsText(value);
                }}
                placeholder="facebook.com, instagram.com"
                placeholderTextColor="#5A6779"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                multiline
                style={[styles.input, { textAlign: align }]}
              />
              <View style={styles.chipRow}>
                {domainsPreview.length === 0 ? (
                  <Text style={styles.emptyHint}>
                    {t('No domains yet — the browser stays open.')}
                  </Text>
                ) : (
                  domainsPreview.map((domain) => (
                    <Chip key={domain} label={domain} danger lang={lang} />
                  ))
                )}
              </View>
              <ActionButton
                label={t('Save domain list')}
                onPress={saveDomains}
                busy={savingDomains}
                saved={domainsSaved}
                disabled={!FocusGuard.isAvailable}
              />
            </Section>

            <Section
              lang={lang}
              title={t('{{n}}. {{title}}', { n: 3, title: t('Accessibility service') })}
              subtitle={t(
                'This is what lets the app read the screen and press Back. Android shows a warning — that warning is normal for any accessibility app.'
              )}>
              <View style={styles.statusRow}>
                <View style={styles.statusTextWrap}>
                  <Text style={[styles.statusTitle, { textAlign: align }]}>
                    {t('Service status')}
                  </Text>
                  <Text style={[styles.statusHint, { textAlign: align }]}>
                    {t('Settings → Accessibility → Installed apps')}
                  </Text>
                </View>
                <StatusPill
                  active={config.accessibilityEnabled}
                  labels={[t('Enabled'), t('Disabled')]}
                />
              </View>
              <ActionButton
                label={t('Open Accessibility settings')}
                variant="secondary"
                onPress={openAccessibility}
                disabled={!FocusGuard.isAvailable}
              />
            </Section>

            <Section
              lang={lang}
              title={t('{{n}}. {{title}}', { n: 4, title: t('Device admin (anti-uninstall)') })}
              subtitle={t(
                'While device admin is active, Android refuses to uninstall Tavakkol. Deactivate it in Settings → Security → Device admin apps if you ever want the app gone.'
              )}>
              <View style={styles.statusRow}>
                <View style={styles.statusTextWrap}>
                  <Text style={[styles.statusTitle, { textAlign: align }]}>
                    {t('Device admin')}
                  </Text>
                  <Text style={[styles.statusHint, { textAlign: align }]}>
                    {t('Uses the force-lock policy')}
                  </Text>
                </View>
                <StatusPill
                  active={config.deviceAdminActive}
                  labels={[t('Active'), t('Inactive')]}
                />
              </View>
              {config.deviceAdminActive ? (
                <ActionButton
                  label={t('Panic lock screen')}
                  variant="secondary"
                  onPress={runPanicLock}
                />
              ) : (
                <ActionButton
                  label={t('Activate device admin')}
                  variant="secondary"
                  onPress={enableDeviceAdmin}
                  disabled={!FocusGuard.isAvailable}
                />
              )}
            </Section>

            <Section
              lang={lang}
              title={t('Stats')}
              subtitle={t('Stored on this device only — nothing is uploaded.')}>
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{config.blockCount}</Text>
                  <Text style={styles.statLabel}>{t('Blocks')}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{config.keywords.length}</Text>
                  <Text style={styles.statLabel}>{t('Keywords')}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{config.domains.length}</Text>
                  <Text style={styles.statLabel}>{t('Domains')}</Text>
                </View>
              </View>
              <Text style={[styles.lastBlockLine, { textAlign: align }]}>
                {`${t('Last block')}: ${
                  config.lastBlockPackage
                    ? `${config.lastBlockPackage.split('.').pop()}${
                        config.lastBlockReason ? ` (${config.lastBlockReason})` : ''
                      }`
                    : t('nothing yet')
                }`}
              </Text>
              <ActionButton
                label={t('Reset counter')}
                variant="secondary"
                onPress={clearCounter}
              />
            </Section>

            <Section
              lang={lang}
              title={t('{{n}}. {{title}}', { n: 5, title: t('Keep-alive') })}
              subtitle={t(
                'Android — and MIUI/HyperOS especially — kills background apps. Three independent restarters bring the guard back by themselves: a restartable foreground watchdog, a 15-minute alarm and a 15-minute job, plus a boot receiver.'
              )}>
              <View style={styles.statusRow}>
                <View style={styles.statusTextWrap}>
                  <Text style={[styles.statusTitle, { textAlign: align }]}>
                    {t('Watchdog service')}
                  </Text>
                  <Text style={[styles.statusHint, { textAlign: align }]}>
                    {health
                      ? `${formatHeartbeat(health.heartbeatAgeMs, t)}${
                          health.manufacturer ? ` · ${health.manufacturer}` : ''
                        }`
                      : t('checking…')}
                  </Text>
                </View>
                <StatusPill
                  active={Boolean(health && health.watchdogRunning)}
                  labels={[t('Up'), t('Down')]}
                />
              </View>
              <ActionButton
                label={t('Start keep-alive now')}
                variant="secondary"
                onPress={startKeepAlive}
                busy={keepAliveBusy}
                disabled={!FocusGuard.isAvailable}
              />
              <ActionButton
                label={
                  health && health.manufacturer
                    ? t('Open Autostart settings ({{manufacturer}})', {
                        manufacturer: health.manufacturer,
                      })
                    : t('Open Autostart settings')
                }
                variant="secondary"
                onPress={openAutostart}
                disabled={!FocusGuard.isAvailable}
              />
              <Text style={[styles.keepAliveHint, { textAlign: align }]}>
                {t(
                  'One-time setup on Redmi / POCO / Xiaomi: 1) Autostart → Tavakkol ON, 2) Battery saver → No restrictions, 3) in Recents, pull Tavakkol down to lock it. Without Autostart even a foreground service gets killed within hours.'
                )}
              </Text>
            </Section>

            <Section
              lang={lang}
              title={t('{{n}}. {{title}}', { n: 6, title: t('Debug Log') })}
              subtitle={t(
                'Everything the background guard does — service starts and stops, foreground-service state, watchdog wake-ups, keyword/domain hits and blocks — recorded on this device, never uploaded. Survives crashes and restarts.'
              )}>
              {health ? (
                <Text
                  style={[
                    styles.healthLine,
                    health.serviceRunning && health.foregroundActive
                      ? styles.healthOk
                      : styles.healthWarn,
                    { textAlign: align },
                  ]}>
                  {`${t('Service {{state}}', {
                    state: health.serviceRunning ? t('running') : t('NOT running'),
                  })} · ${
                    health.foregroundActive
                      ? t('foreground notification active')
                      : t('NO foreground notification')
                  } · ${t('watchdog {{state}} ({{age}})', {
                    state: health.watchdogRunning ? t('up') : t('DOWN'),
                    age: formatHeartbeat(health.heartbeatAgeMs, t),
                  })} · ${
                    health.batteryOptimizationIgnored
                      ? t('battery unrestricted')
                      : t('battery RESTRICTED — Android may kill the guard')
                  }`}
                </Text>
              ) : null}
              <ActionButton
                label={t('Show Logs')}
                variant="secondary"
                onPress={openLogs}
                disabled={!FocusGuard.isAvailable}
              />
            </Section>

            {message ? <Text style={styles.message}>{message}</Text> : null}

            <Text style={[styles.footer, { textAlign: align }]}>
              {t(
                'Works fully offline. Any text that changes on screen is checked — search bars, address bars and chat messages. While the guard is running it keeps a small persistent notification: if that notification disappears, the guard was stopped. The watchdog, the 15-minute alarm, the 15-minute job and the boot receiver restart it on their own — and if the guard stays down for more than three minutes you get an alert instead of silently losing protection.'
              )}
            </Text>
            <Text style={styles.versionText}>{VERSION_LABEL}</Text>
          </>
        )}
      </ScrollView>

      <Modal visible={logsOpen} animationType="slide" onRequestClose={closeLogs}>
        <View style={styles.logModalRoot}>
          <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
          <View style={styles.logHeader}>
            <View style={styles.logHeaderTitle}>
              <Text style={styles.logTitle}>{t('Debug Log')}</Text>
              <Text style={styles.logSubtitle}>{t('Last 100 events · newest first')}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('Close debug log')}
              onPress={closeLogs}
              style={({ pressed }) => [styles.logClose, pressed && styles.pressed]}>
              <Text style={styles.logCloseText}>{t('Close')}</Text>
            </Pressable>
          </View>

          {health ? (
            <View style={styles.logHealth}>
              <Text style={styles.logHealthText}>
                {`${t('Accessibility: {{state}}', {
                  state: health.accessibilityEnabled ? t('enabled') : t('DISABLED'),
                })} · ${t('Guard bound: {{state}}', {
                  state: health.serviceRunning ? t('yes') : t('no'),
                })} · ${t('Foreground service: {{state}}', {
                  state: health.foregroundActive ? t('running') : t('DOWN'),
                })} · ${t('Watchdog: {{state}}', {
                  state: health.watchdogRunning ? t('up') : t('DOWN'),
                })} (${formatHeartbeat(health.heartbeatAgeMs, t)}) · ${t('Battery optimization')}: ${
                  health.batteryOptimizationIgnored
                    ? t('battery optimization off (safe)')
                    : t('battery optimization on (kill risk)')
                }`}
              </Text>
              {!health.batteryOptimizationIgnored ? (
                <ActionButton
                  label={t('Exclude from battery optimization')}
                  variant="secondary"
                  onPress={fixBattery}
                />
              ) : null}
            </View>
          ) : null}

          {logsLoading ? (
            <ActivityIndicator color={COLORS.accent} style={styles.logLoader} />
          ) : (
            <FlatList
              data={logs}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.logList}
              ListEmptyComponent={
                <Text style={styles.logEmpty}>
                  {t(
                    'No events recorded yet. The log fills as soon as the guard runs — tap Refresh after using the phone, or Clear to start over.'
                  )}
                </Text>
              }
              renderItem={({ item }) => (
                <View style={styles.logRow}>
                  <Text style={styles.logTime}>{formatLogTime(item.t)}</Text>
                  <Text style={[styles.logType, { color: logTypeColor(item.type) }]}>
                    {item.type}
                  </Text>
                  <View style={styles.logBody}>
                    {item.pkg ? <Text style={styles.logPkg}>{shortPackage(item.pkg)}</Text> : null}
                    {item.text ? <Text style={styles.logText}>{item.text}</Text> : null}
                  </View>
                </View>
              )}
            />
          )}

          <View style={styles.logFooter}>
            <View style={styles.logFooterButton}>
              <ActionButton label={t('Refresh')} variant="secondary" onPress={loadLogs} busy={logsLoading} />
            </View>
            <View style={styles.logFooterButton}>
              <ActionButton
                label={t('Clear log')}
                variant="secondary"
                onPress={clearLogs}
                busy={clearingLogs}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* v1.4.2 Delay Mode: the only way to switch Protection off is to type
          the whole text. Paste is blocked (contextMenuHidden + the change-size
          guard), cancelling writes nothing. */}
      <Modal
        visible={delayOpen}
        animationType="slide"
        onRequestClose={cancelDelay}>
        <View style={styles.delayRoot}>
          <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
          <Text style={[styles.delayTitle, { textAlign: align }]}>{t('Delay Mode')}</Text>
          <Text style={[styles.delaySub, { textAlign: align }]}>
            {t(
              'To turn Protection off, type the text below exactly as it is written — copying and pasting is not allowed. Close this window and Protection stays on.'
            )}
          </Text>
          <ScrollView
            style={styles.delayScroll}
            contentContainerStyle={styles.delayScrollContent}
            keyboardShouldPersistTaps="handled">
            <View style={styles.challengeBox}>
              <Text style={[styles.challengeText, { textAlign: align }]}>{challengeText}</Text>
            </View>
            <TextInput
              value={delayTyped}
              onChangeText={handleDelayChange}
              multiline
              contextMenuHidden
              autoCorrect={false}
              autoCapitalize="none"
              spellCheck={false}
              placeholder={t('Type the text here…')}
              placeholderTextColor={COLORS.muted}
              style={[styles.input, styles.delayInput, { textAlign: align }]}
            />
            <Text style={[styles.delayProgress, { textAlign: align }]}>
              {t('{{typed}} of {{total}} characters', {
                typed: delayTyped.length,
                total: challengeText.length,
              })}
            </Text>
            {delayError ? (
              <Text style={[styles.delayError, { textAlign: align }]}>{delayError}</Text>
            ) : null}
            <ActionButton
              label={t('Turn Protection off')}
              onPress={confirmDelayOff}
              busy={toggling}
            />
            <View style={styles.delayGap} />
            <ActionButton
              label={t('Cancel — keep Protection on')}
              variant="secondary"
              onPress={cancelDelay}
            />
          </ScrollView>
        </View>
      </Modal>

      {/* v1.4.2 update prompt: only shown when version.json on the Pages site
          reports a strictly newer version than this build. */}
      <Modal
        visible={Boolean(updateInfo)}
        transparent
        animationType="fade"
        onRequestClose={() => setUpdateInfo(null)}>
        <View style={styles.updateBackdrop}>
          <View style={styles.updateCard}>
            <Text style={[styles.updateTitle, { textAlign: align }]}>
              {t('New version ready')}
            </Text>
            <Text style={[styles.updateBody, { textAlign: align }]}>
              {t(
                'A new version of the app is ready! Please update to get the latest features.'
              )}
            </Text>
            <Text style={[styles.updateMeta, { textAlign: align }]}>
              {t('Installed {{current}} · available {{latest}}', {
                current: VERSION,
                latest: updateInfo ? updateInfo.latest : '',
              })}
            </Text>
            <ActionButton label={t('Download Update')} onPress={openUpdateDownload} />
            <View style={styles.delayGap} />
            <ActionButton
              label={t('Later')}
              variant="secondary"
              onPress={() => setUpdateInfo(null)}
            />
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bootLoader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlay,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: (StatusBar.currentHeight || 24) + 20,
    paddingBottom: 48,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  brandRowRtl: {
    flexDirection: 'row-reverse',
  },
  brandText: {
    flex: 1,
  },
  brand: {
    color: COLORS.pageText,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  brandSub: {
    color: COLORS.pageAccent,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  gear: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  gearIcon: {
    color: COLORS.text,
    fontSize: 20,
  },
  helpIcon: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.75,
  },
  tagline: {
    color: COLORS.pageMuted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
    marginBottom: 18,
  },
  warningBox: {
    backgroundColor: 'rgba(58,44,8,0.92)',
    borderColor: '#6B5110',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  warningTitle: {
    color: COLORS.warning,
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 4,
  },
  warningText: {
    color: '#EAD9A6',
    fontSize: 13,
    lineHeight: 19,
  },
  loader: {
    marginTop: 32,
  },
  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
  },
  heroLabel: {
    color: COLORS.muted,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroState: {
    fontSize: 26,
    fontWeight: '700',
    marginTop: 6,
  },
  heroOn: {
    color: COLORS.accent,
  },
  heroOff: {
    color: COLORS.text,
  },
  heroHint: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 6,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  // v1.4.2: Protection + Delay Mode sit side by side in one row.
  switchGrid: {
    flexDirection: 'row',
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 14,
  },
  switchGridRtl: {
    flexDirection: 'row-reverse',
  },
  switchCell: {
    flex: 1,
  },
  switchControl: {
    flexDirection: 'row',
    marginTop: 10,
  },
  switchLabel: {
    flex: 1,
    paddingRight: 12,
  },
  // v1.4.2 Delay Mode challenge screen
  delayRoot: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: (StatusBar.currentHeight || 24) + 18,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  delayTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '700',
  },
  delaySub: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  delayScroll: {
    flex: 1,
    marginTop: 14,
  },
  delayScrollContent: {
    paddingBottom: 24,
  },
  challengeBox: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  challengeText: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 24,
  },
  delayInput: {
    marginTop: 14,
    minHeight: 120,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  delayProgress: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  delayError: {
    color: COLORS.danger,
    fontSize: 13,
    marginBottom: 12,
  },
  delayGap: {
    height: 10,
  },
  // v1.4.2 update prompt
  updateBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(4,8,12,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  updateCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.background,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
  },
  updateTitle: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  updateBody: {
    color: COLORS.text,
    fontSize: 16,
    lineHeight: 26,
    marginTop: 10,
  },
  updateMeta: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 10,
    marginBottom: 16,
  },
  switchTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  switchHint: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 3,
  },
  input: {
    color: COLORS.text,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 56,
    fontSize: 15,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  emptyHint: {
    color: COLORS.muted,
    fontSize: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  statusTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  statusTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  statusHint: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 3,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  statValue: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 4,
  },
  lastBlockLine: {
    color: COLORS.muted,
    fontSize: 12,
    marginBottom: 12,
  },
  message: {
    color: COLORS.pageWarning,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 20,
    textAlign: 'center',
  },
  healthLine: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  healthOk: {
    color: COLORS.accent,
  },
  healthWarn: {
    color: COLORS.warning,
  },
  keepAliveHint: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  footer: {
    color: COLORS.pageMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 28,
  },
  versionText: {
    color: '#475569',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 14,
  },
  logModalRoot: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: (StatusBar.currentHeight || 24) + 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  logHeaderTitle: {
    flex: 1,
    paddingRight: 12,
  },
  logTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
  },
  logSubtitle: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 2,
  },
  logClose: {
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  logCloseText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  logHealth: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 10,
  },
  logHealthText: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  logLoader: {
    marginTop: 32,
  },
  logList: {
    paddingBottom: 8,
  },
  logEmpty: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 28,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
    marginBottom: 8,
  },
  logTime: {
    color: COLORS.muted,
    fontSize: 11,
    fontFamily: Platform.select({ android: 'monospace', default: undefined }),
    width: 92,
    paddingTop: 2,
  },
  logType: {
    fontSize: 11,
    fontWeight: '700',
    width: 108,
    paddingTop: 2,
  },
  logBody: {
    flex: 1,
  },
  logPkg: {
    color: '#7DD3FC',
    fontSize: 11,
    marginBottom: 2,
  },
  logText: {
    color: COLORS.text,
    fontSize: 12,
    lineHeight: 17,
  },
  logFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  logFooterButton: {
    flex: 1,
  },
});
