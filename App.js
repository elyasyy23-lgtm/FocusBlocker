import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  ImageBackground,
  Linking,
  Modal,
  PermissionsAndroid,
  Platform,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as FocusGuard from './modules/focus-guard';
import { createTranslator } from './src/i18n';
import { COLORS, textAlign } from './src/theme';
import { ActionButton } from './src/components/ui';
import Drawer from './src/components/Drawer';
import DonateSheet from './src/components/DonateSheet';
import HomeScreen from './src/screens/HomeScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import HelpScreen from './src/screens/HelpScreen';
import LockScreen from './src/screens/LockScreen';
import { DEFAULT_KEYWORDS, APP_SHARE_URL, DEVELOPER_RUBIKA_SCHEME, DEVELOPER_RUBIKA_URL } from './src/defaults';
import { VERSION, VERSION_LABEL } from './src/buildInfo';

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

export default function App() {
  const [config, setConfig] = useState(FocusGuard.EMPTY_CONFIG);
  const [keywordsText, setKeywordsText] = useState('');
  const [domainsText, setDomainsText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingDomains, setSavingDomains] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [message, setMessage] = useState(null);
  const [screen, setScreen] = useState('main');
  const [appState, setAppState] = useState(AppState.currentState);

  // v1.4.5: the side drawer.
  const [drawerOpen, setDrawerOpen] = useState(false);
  // v1.4.5: Support Us is a drawer action now, so its sheet lives up here.
  const [donateMode, setDonateMode] = useState(null);

  // v1.4.2 Delay Mode: the challenge lives behind a modal; nothing is written
  // to the native store until the typed text matches exactly. v1.4.5: the same
  // modal now guards BOTH turning Protection off and turning Delay Mode off.
  const [delayOpen, setDelayOpen] = useState(false);
  const [delayTyped, setDelayTyped] = useState('');
  const [delayError, setDelayError] = useState(null);
  const [delayIntent, setDelayIntent] = useState('protection'); // 'protection' | 'delayMode'

  // v1.4.2: update checker — `null` while unknown, `{ latest, url }` when a
  // strictly newer version is published on the Pages site.
  const [updateInfo, setUpdateInfo] = useState(null);
  const updateCheckedRef = useRef(false);

  // v1.3.1 strict lock: the app is gated on every foreground while a Partner
  // PIN exists. Nothing else in the app asks for it — Settings and the
  // Protection switch stay free (owner decision, 2026-11-12).
  const [sessionUnlocked, setSessionUnlocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  const [lang, setLang] = useState('en');
  const keywordsDirtyRef = useRef(false);
  const domainsDirtyRef = useRef(false);
  const seededRef = useRef(false);
  // v1.4.6: consume the "an update turned Protection off" notice exactly once.
  const updateResetCheckedRef = useRef(false);

  const t = useMemo(() => createTranslator(lang), [lang]);
  const align = textAlign(lang);
  const isRtl = lang === 'fa';
  // Localised challenge the user must retype (same sentence in both languages).
  const challengeText = t(DELAY_CHALLENGE);

  // v1.4.5: while Protection is ON the Settings screen is closed and the Home
  // editors are read-only. `config.enabled` is the single source of truth.
  const settingsLocked = Boolean(config.enabled);
  const readOnly = Boolean(config.enabled);

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
        setDrawerOpen(false);
      }
    });
    return () => subscription.remove();
  }, [refresh]);

  // v1.4.6: installing a new build forces Protection OFF (nobody may bypass the
  // guard by updating). v1.4.7: Delay Mode is reset too, so an update also
  // restores the one-tap-protection-off behaviour the new build ships with.
  // The native side raises a one-shot flag; we surface it in the user's
  // language so the silent reset never looks like a bug. Runs once, after the
  // first config load so the language is known.
  useEffect(() => {
    if (loading || updateResetCheckedRef.current) return;
    updateResetCheckedRef.current = true;
    FocusGuard.consumeUpdateReset().then((reset) => {
      if (reset) {
        setMessage(
          t(
            'The app was updated — Protection and Delay Mode were turned off automatically. Turn Protection back on to keep the guard active.'
          )
        );
      }
    });
  }, [loading, t]);

  // v1.4.5: hardware Back — close the drawer first, then return to Home.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (drawerOpen) {
        setDrawerOpen(false);
        return true;
      }
      if (screen !== 'main') {
        setScreen('main');
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [drawerOpen, screen]);

  // v1.4.5: if Protection is turned on while Settings is open, bounce to Home.
  useEffect(() => {
    if (settingsLocked && screen === 'settings') {
      setScreen('main');
    }
  }, [settingsLocked, screen]);

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

  const openDelay = (intent) => {
    setDelayIntent(intent);
    setDelayTyped('');
    setDelayError(null);
    setDelayOpen(true);
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
  const applyEnabled = async (value, { afterChallenge = false } = {}) => {
    setToggling(true);
    setMessage(null);
    try {
      if (afterChallenge) {
        // The challenge was typed — this is the one native path allowed to
        // write Protection OFF while Delay Mode is on.
        await FocusGuard.disableProtectionAfterChallenge();
      } else {
        await FocusGuard.setEnabled(value);
      }
      await refresh();
    } catch (error) {
      // The native layer refused an OFF write because Delay Mode is on. Never a
      // silent failure — open the challenge instead of leaving Protection on
      // with no explanation.
      if (!value && /Delay Mode/i.test(String(error && error.message))) {
        openDelay('protection');
        return;
      }
      setMessage(error.message || t('Could not change the blocker state.'));
    } finally {
      setToggling(false);
    }
  };

  /**
   * v1.4.3 gate. Delay Mode is a NATIVE fact, so it is read live from the store
   * at the moment of the tap — a stale `config` render can never let Protection
   * slip off. While Delay Mode is on, the OFF direction only opens the challenge
   * modal and writes nothing to the store.
   */
  const toggleBlocking = async (value) => {
    if (!value) {
      let delayOn = config.delayMode;
      try {
        const live = await FocusGuard.getConfig();
        delayOn = Boolean(live.delayMode);
      } catch (error) {
        // Native hiccup — fall back to the last known value rather than risk
        // switching Protection off without the challenge.
      }
      if (delayOn) {
        openDelay('protection');
        return;
      }
    }
    applyEnabled(value);
  };

  /**
   * v1.4.5: Delay Mode is now symmetric — turning it OFF while it is ON needs
   * the same typed challenge (otherwise one tap disables the guard and then a
   * second tap turns Protection off). Turning it ON is always immediate.
   */
  const toggleDelayMode = async (value) => {
    if (!value) {
      let delayOn = config.delayMode;
      try {
        const live = await FocusGuard.getConfig();
        delayOn = Boolean(live.delayMode);
      } catch (error) {
        // Fall back to the cached value.
      }
      if (delayOn) {
        openDelay('delayMode');
        return;
      }
    }
    try {
      await FocusGuard.setDelayMode(value);
      await refresh();
      setMessage(
        value
          ? t('Delay Mode is on — turning Protection off now requires typing the full text.')
          : t('Delay Mode is off — Protection can be switched off again directly.')
      );
    } catch (error) {
      if (!value && /Delay Mode/i.test(String(error && error.message))) {
        openDelay('delayMode');
        return;
      }
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
    // Nothing was written — Protection/Delay Mode stay exactly as they were.
    setDelayOpen(false);
    setDelayTyped('');
    setDelayError(null);
  };

  const confirmDelay = async () => {
    if (normalizeChallenge(delayTyped) !== normalizeChallenge(challengeText)) {
      setDelayError(
        t('The text does not match yet. Keep typing — or cancel to keep it on.')
      );
      return;
    }
    const intent = delayIntent;
    setDelayOpen(false);
    setDelayTyped('');
    setDelayError(null);
    if (intent === 'delayMode') {
      setToggling(true);
      try {
        await FocusGuard.disableDelayModeAfterChallenge();
        await refresh();
        setMessage(t('Delay Mode is off — Protection can be switched off again directly.'));
      } catch (error) {
        setMessage(error.message || t('Could not change Delay Mode.'));
      } finally {
        setToggling(false);
      }
      return;
    }
    await applyEnabled(false, { afterChallenge: true });
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

  // -------------------------------------------------- drawer actions (v1.4.5)
  const shareApp = useCallback(async () => {
    try {
      await Share.share({
        message: `${t(
          'Tavakkol — a free guard for your phone. Blocked words and sites close themselves while you type.'
        )}\n\n${t('Tavakkol')} v${VERSION_LABEL}\n${APP_SHARE_URL}`,
      });
    } catch (error) {
      setMessage(t('Could not open the share sheet.'));
    }
  }, [t]);

  const contactDeveloper = useCallback(async () => {
    // Rubika's own scheme first, then the plain web link (works even without
    // the app installed, because rubika.ir answers in a browser).
    const opened =
      (await FocusGuard.openUrl(DEVELOPER_RUBIKA_SCHEME)) ||
      (await FocusGuard.openUrl(DEVELOPER_RUBIKA_URL));
    if (!opened) {
      try {
        await Linking.openURL(DEVELOPER_RUBIKA_URL);
      } catch (error) {
        setMessage(t('Could not open the link.'));
      }
    }
  }, [t]);

  const openDonate = useCallback((mode) => setDonateMode(mode), []);

  const navigate = useCallback(
    (name) => {
      if (name === 'settings' && settingsLocked) {
        setMessage(t('To open Settings, first turn Protection off.'));
        return;
      }
      setScreen(name);
    },
    [settingsLocked, t]
  );

  const blockedSettings = useCallback(() => {
    setMessage(t('To open Settings, first turn Protection off.'));
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
        <LockScreen t={t} lang={lang} busy={unlocking} onSubmit={unlockApp} />
      </ImageBackground>
    );
  }

  const delayIsProtection = delayIntent === 'protection';

  return (
    <View style={styles.appRoot}>
      {screen === 'help' ? (
        <HelpScreen t={t} lang={lang} onOpenDrawer={() => setDrawerOpen(true)} />
      ) : screen === 'settings' && !settingsLocked ? (
        <SettingsScreen
          t={t}
          lang={lang}
          onOpenDrawer={() => setDrawerOpen(true)}
          onChangeLanguage={changeLanguage}
          excluded={config.excludedApps}
          onToggleExcluded={toggleExcluded}
          onClearExcluded={clearExcluded}
          isAvailable={FocusGuard.isAvailable}
          onMessage={setMessage}
          message={message}
          musicMuted={config.musicMuted}
          onToggleMusicMuted={toggleMusicMuted}
          config={config}
          onRefresh={refresh}
        />
      ) : (
        <HomeScreen
          t={t}
          lang={lang}
          isAvailable={FocusGuard.isAvailable}
          config={config}
          keywordsText={keywordsText}
          onChangeKeywords={(value) => {
            keywordsDirtyRef.current = true;
            setKeywordsText(value);
          }}
          domainsText={domainsText}
          onChangeDomains={(value) => {
            domainsDirtyRef.current = true;
            setDomainsText(value);
          }}
          keywordsPreview={keywordsPreview}
          domainsPreview={domainsPreview}
          keywordsSaved={keywordsSaved}
          domainsSaved={domainsSaved}
          saving={saving}
          savingDomains={savingDomains}
          toggling={toggling}
          message={message}
          blockingReady={blockingReady}
          readOnly={readOnly}
          onSaveKeywords={saveKeywords}
          onSaveDomains={saveDomains}
          onToggleBlocking={toggleBlocking}
          onToggleDelayMode={toggleDelayMode}
          onOpenDrawer={() => setDrawerOpen(true)}
          onMessage={setMessage}
        />
      )}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        t={t}
        lang={lang}
        currentScreen={screen}
        settingsLocked={settingsLocked}
        onNavigate={navigate}
        onBlockedSettings={blockedSettings}
        onShare={shareApp}
        onContact={contactDeveloper}
        onSupport={() => openDonate('iran')}
      />

      <DonateSheet
        visible={donateMode !== null}
        mode={donateMode}
        onClose={() => setDonateMode(null)}
        t={t}
        lang={lang}
        onMessage={setMessage}
      />

      {/* v1.4.2/1.4.5 Delay Mode: the only way to switch Protection — or Delay
          Mode itself — off is to type the whole text. Paste is blocked
          (contextMenuHidden + the change-size guard), cancelling writes nothing. */}
      <Modal visible={delayOpen} animationType="slide" onRequestClose={cancelDelay}>
        <View style={styles.delayRoot}>
          <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
          <Text style={[styles.delayTitle, { textAlign: align }]}>{t('Delay Mode')}</Text>
          <Text style={[styles.delaySub, { textAlign: align }]}>
            {delayIsProtection
              ? t(
                  'To turn Protection off, type the text below exactly as it is written — copying and pasting is not allowed. Close this window and Protection stays on.'
                )
              : t(
                  'To turn Delay Mode off, type the text below exactly as it is written — copying and pasting is not allowed. Close this window and Delay Mode stays on.'
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
              label={delayIsProtection ? t('Turn Protection off') : t('Turn Delay Mode off')}
              onPress={confirmDelay}
              busy={toggling}
            />
            <View style={styles.delayGap} />
            <ActionButton
              label={t('Cancel — keep it on')}
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
              {t('A new version of the app is ready! Please update to get the latest features.')}
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
    </View>
  );
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
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
  delayRoot: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
    paddingTop: (StatusBar.currentHeight || 24) + 16,
  },
  delayTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '700',
  },
  delaySub: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  delayScroll: {
    flex: 1,
    marginTop: 16,
  },
  delayScrollContent: {
    paddingBottom: 40,
  },
  challengeBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 14,
  },
  challengeText: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 22,
  },
  input: {
    color: COLORS.text,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  delayInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  delayProgress: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 8,
  },
  delayError: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  delayGap: {
    height: 8,
  },
  updateBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(3,6,10,0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  updateCard: {
    width: '100%',
    backgroundColor: '#101820',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
  },
  updateTitle: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 10,
  },
  updateBody: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 8,
  },
  updateMeta: {
    color: COLORS.muted,
    fontSize: 12,
    marginBottom: 14,
  },
});
