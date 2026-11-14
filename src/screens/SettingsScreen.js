import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ImageBackground,
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
import * as FocusGuard from '../../modules/focus-guard';
import { ActionButton, Section, StatusPill } from '../components/ui';
import PinPad from '../components/PinPad';
import { COLORS, textAlign } from '../theme';
import { LANGUAGES } from '../i18n';
import { VERSION_LABEL } from '../buildInfo';

const BACKGROUND = require('../../assets/background.jpg');

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

/**
 * Settings screen (v1.4.5) — everything advanced, reached from the drawer.
 *
 * v1.4.5 moved the whole "system" half of the app here (accessibility service,
 * device admin, keep-alive, stats and the debug log) so the Home screen shows
 * only the two switches and the two lists. The screen is CLOSED entirely while
 * Protection is ON — App.js never routes here in that state and the drawer row
 * reports the reason instead.
 */
export default function SettingsScreen({
  t,
  lang,
  onOpenDrawer,
  onChangeLanguage,
  excluded,
  onToggleExcluded,
  onClearExcluded,
  isAvailable,
  onMessage,
  message,
  // v1.4.2: background music (the player lives in App.js)
  musicMuted,
  onToggleMusicMuted,
  // v1.4.5: live config (statuses/stats) + a way to refresh it after a change
  config,
  onRefresh,
}) {
  const align = textAlign(lang);
  const isRtl = lang === 'fa';

  const [apps, setApps] = useState([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [query, setQuery] = useState('');
  const [busyPkg, setBusyPkg] = useState(null);
  // v1.3.2: only the first three apps are listed until "Show more" is tapped.
  const [showAllApps, setShowAllApps] = useState(false);

  // v1.4.5: keep-alive health + debug log live here now.
  const [health, setHealth] = useState(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [clearingLogs, setClearingLogs] = useState(false);
  const [keepAliveBusy, setKeepAliveBusy] = useState(false);

  // v1.3.1: the Partner PIN is set/removed here.
  const [pinSet, setPinSet] = useState(false);
  const [pinDialog, setPinDialog] = useState({
    mode: null, // 'set' | 'change' | 'remove'
    step: 'new',
    value: '',
    first: '',
    error: null,
    busy: false,
  });

  // v1.4.0: remote deactivation via SMS.
  const [remote, setRemote] = useState({
    enabled: false,
    number: '',
    code: '',
    lastAt: 0,
    count: 0,
  });
  const [remoteNumber, setRemoteNumber] = useState('');
  const [remoteCode, setRemoteCode] = useState('');
  const [remoteBusy, setRemoteBusy] = useState(false);
  const [smsGranted, setSmsGranted] = useState(true);

  useEffect(() => {
    let alive = true;
    FocusGuard.getStrictState()
      .then((state) => {
        if (alive) setPinSet(Boolean(state.pinSet));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const state = await FocusGuard.getRemoteState();
      if (!alive) return;
      setRemote(state);
      setRemoteNumber(state.number);
      setRemoteCode(state.code);
      if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.check('android.permission.RECEIVE_SMS');
          if (alive) setSmsGranted(Boolean(granted));
        } catch (error) {
          // A failed check is not a denial — let the toggle ask for the grant.
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await FocusGuard.getInstalledApps();
      if (!alive) return;
      setApps(list);
      setLoadingApps(false);
      if (isAvailable && list.length === 0) {
        onMessage(t('Could not load the app list.'));
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAvailable]);

  // v1.4.5: health rides along on mount so the keep-alive + debug sections show
  // live state without opening the log modal.
  useEffect(() => {
    FocusGuard.getServiceHealth()
      .then(setHealth)
      .catch(() => {});
  }, []);

  const excludedSet = useMemo(() => new Set(excluded), [excluded]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return apps;
    return apps.filter(
      (app) =>
        app.label.toLowerCase().includes(needle) || app.pkg.toLowerCase().includes(needle)
    );
  }, [apps, query]);

  const searching = query.trim().length > 0;
  const visibleApps = showAllApps || searching ? filtered : filtered.slice(0, 3);
  const hiddenCount = filtered.length - visibleApps.length;

  const toggleApp = useCallback(
    async (pkg) => {
      if (busyPkg) return;
      setBusyPkg(pkg);
      try {
        await onToggleExcluded(pkg);
      } finally {
        setBusyPkg(null);
      }
    },
    [busyPkg, onToggleExcluded]
  );

  // -------------------------------------------------------------------
  // Partner PIN (v1.3.1) — set, change or remove the app-lock PIN.
  // -------------------------------------------------------------------

  const closePinDialog = () =>
    setPinDialog({ mode: null, step: 'new', value: '', first: '', error: null, busy: false });

  const openPinDialog = (mode) => {
    if (!isAvailable) {
      onMessage(t('Native build required'));
      return;
    }
    setPinDialog({
      mode,
      step: mode === 'set' ? 'new' : 'current',
      value: '',
      first: '',
      error: null,
      busy: false,
    });
  };

  const savePin = async (pin) => {
    setPinDialog((prev) => ({ ...prev, busy: true, error: null }));
    try {
      await FocusGuard.setPartnerPin(pin);
      setPinSet(true);
      closePinDialog();
      onMessage(t('Partner PIN saved. The app now asks for it when it opens.'));
    } catch (error) {
      setPinDialog((prev) => ({
        ...prev,
        busy: false,
        error: error.message || t('Could not save the PIN.'),
      }));
    }
  };

  const submitPinDialog = async () => {
    const { mode, step, value, first } = pinDialog;
    if (value.length < 4 || pinDialog.busy) return;

    if (mode === 'set') {
      if (step === 'new') {
        setPinDialog((prev) => ({ ...prev, step: 'confirm', value: '', first: value, error: null }));
        return;
      }
      if (value !== first) {
        setPinDialog({
          mode: 'set',
          step: 'new',
          value: '',
          first: '',
          error: t('PINs do not match. Start again.'),
          busy: false,
        });
        return;
      }
      await savePin(value);
      return;
    }

    if (mode === 'change') {
      if (step === 'current') {
        setPinDialog((prev) => ({ ...prev, busy: true, error: null }));
        try {
          const ok = await FocusGuard.verifyPartnerPin(value);
          if (!ok) {
            setPinDialog((prev) => ({
              ...prev,
              busy: false,
              value: '',
              error: t('Wrong PIN. Try again.'),
            }));
            return;
          }
          setPinDialog({ mode, step: 'new', value: '', first: '', error: null, busy: false });
        } catch (error) {
          setPinDialog((prev) => ({
            ...prev,
            busy: false,
            error: error.message || t('Wrong PIN. Try again.'),
          }));
        }
        return;
      }
      if (step === 'new') {
        setPinDialog((prev) => ({ ...prev, step: 'confirm', value: '', first: value, error: null }));
        return;
      }
      if (value !== first) {
        setPinDialog({
          mode: 'change',
          step: 'new',
          value: '',
          first: '',
          error: t('PINs do not match. Start again.'),
          busy: false,
        });
        return;
      }
      await savePin(value);
      return;
    }

    if (mode === 'remove') {
      setPinDialog((prev) => ({ ...prev, busy: true, error: null }));
      try {
        const ok = await FocusGuard.clearPartnerPin(value);
        if (!ok) {
          setPinDialog((prev) => ({
            ...prev,
            busy: false,
            value: '',
            error: t('Wrong PIN. Try again.'),
          }));
          return;
        }
        setPinSet(false);
        closePinDialog();
        onMessage(t('PIN removed. The app no longer asks for it.'));
      } catch (error) {
        setPinDialog((prev) => ({
          ...prev,
          busy: false,
          error: error.message || t('Could not save the PIN.'),
        }));
      }
    }
  };

  const pinDialogCopy = () => {
    const { mode, step } = pinDialog;
    if (mode === 'remove') {
      return {
        title: t('Remove Partner PIN'),
        body: t('Enter the current PIN to remove the app lock.'),
        ok: t('Remove'),
      };
    }
    if (step === 'current') {
      return {
        title: t('Enter the current PIN'),
        body: t('The current PIN is needed to choose a new one.'),
        ok: t('Continue'),
      };
    }
    if (step === 'confirm') {
      return {
        title: t('Repeat the PIN'),
        body: t('Enter the same PIN again.'),
        ok: t('Save'),
      };
    }
    return {
      title: pinSet ? t('Choose a new PIN') : t('Set the Partner PIN'),
      body: t('4 to 8 digits. This PIN is asked for when the app opens.'),
      ok: t('Continue'),
    };
  };

  // -------------------------------------------------------------------
  // Remote deactivation via SMS (v1.4.0)
  // -------------------------------------------------------------------

  const requestSmsPermission = useCallback(async () => {
    if (Platform.OS !== 'android') return true;
    try {
      const result = await PermissionsAndroid.request('android.permission.RECEIVE_SMS');
      const granted = result === PermissionsAndroid.RESULTS.GRANTED;
      setSmsGranted(granted);
      if (!granted) onMessage(t('SMS permission is required for remote deactivation.'));
      return granted;
    } catch (error) {
      onMessage(t('SMS permission is required for remote deactivation.'));
      return false;
    }
  }, [onMessage, t]);

  const applyRemote = useCallback(
    async (enabled) => {
      if (!isAvailable) {
        onMessage(t('Native build required'));
        return;
      }
      if (enabled && !(await requestSmsPermission())) return;
      setRemoteBusy(true);
      try {
        await FocusGuard.setRemoteDeactivation({
          enabled,
          number: remoteNumber,
          code: remoteCode,
        });
        const state = await FocusGuard.getRemoteState();
        setRemote(state);
        setRemoteNumber(state.number);
        setRemoteCode(state.code);
        onMessage(
          enabled
            ? t('Remote deactivation is on. A partner SMS turns Protection off.')
            : t('Remote settings saved. Remote deactivation is off.')
        );
      } catch (error) {
        onMessage(error.message || t('Could not save the remote settings.'));
      } finally {
        setRemoteBusy(false);
      }
    },
    [isAvailable, onMessage, remoteCode, remoteNumber, requestSmsPermission, t]
  );

  const remoteDirty = remoteNumber.trim() !== remote.number || remoteCode.trim() !== remote.code;

  // -------------------------------------------------------------------
  // System sections moved here in v1.4.5 (accessibility / admin / keep-alive)
  // -------------------------------------------------------------------

  const openAccessibility = async () => {
    try {
      await FocusGuard.openAccessibilitySettings();
      onMessage(t('Find “Tavakkol guard (keywords + domains)” in the list and switch it on.'));
    } catch (error) {
      onMessage(error.message || t('Could not open Accessibility settings.'));
    }
  };

  const enableDeviceAdmin = async () => {
    try {
      await FocusGuard.requestDeviceAdmin();
      onMessage(t('Confirm the system dialog to keep Tavakkol installed.'));
      setTimeout(() => {
        if (onRefresh) onRefresh();
      }, 1200);
    } catch (error) {
      onMessage(error.message || t('Could not open the device admin dialog.'));
    }
  };

  const runPanicLock = async () => {
    try {
      await FocusGuard.lockScreen();
    } catch (error) {
      onMessage(error.message || t('Locking the screen failed.'));
    }
  };

  const clearCounter = async () => {
    try {
      await FocusGuard.resetBlockCount();
      if (onRefresh) await onRefresh();
      onMessage(t('Block counter reset.'));
    } catch (error) {
      onMessage(error.message || t('Could not reset the counter.'));
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
      onMessage(error.message || t('Could not read the debug log.'));
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
      onMessage(error.message || t('Could not clear the log.'));
    } finally {
      setClearingLogs(false);
    }
  };

  const fixBattery = async () => {
    try {
      await FocusGuard.requestIgnoreBatteryOptimizations();
      onMessage(t('Confirm the system dialog so Android stops killing the guard.'));
      setTimeout(loadLogs, 1500);
    } catch (error) {
      onMessage(error.message || t('Could not open the battery dialog.'));
    }
  };

  const startKeepAlive = async () => {
    setKeepAliveBusy(true);
    try {
      await FocusGuard.ensureKeepAlive();
      if (onRefresh) await onRefresh();
      FocusGuard.getServiceHealth()
        .then(setHealth)
        .catch(() => {});
      onMessage(
        t('Keep-alive armed: watchdog started, 15-minute alarm and persisted job scheduled.')
      );
    } catch (error) {
      onMessage(error.message || t('Could not start the keep-alive.'));
    } finally {
      setKeepAliveBusy(false);
    }
  };

  const openAutostart = async () => {
    try {
      const result = await FocusGuard.openAutostartSettings();
      onMessage(
        result.opened === 'autostart'
          ? t('Switch Autostart ON for Tavakkol on this screen, then come back.')
          : t(
              'Find “Autostart” (or “Battery usage / Allow background activity”) on this screen and allow Tavakkol.'
            )
      );
    } catch (error) {
      onMessage(error.message || t('Could not open the autostart screen.'));
    }
  };

  const cfg = config || {
    accessibilityEnabled: false,
    deviceAdminActive: false,
    blockCount: 0,
    keywords: [],
    domains: [],
    lastBlockPackage: '',
    lastBlockReason: '',
  };

  return (
    <ImageBackground source={BACKGROUND} style={styles.root} resizeMode="cover">
      <View style={styles.overlay} />
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.pageBackground} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={[styles.header, isRtl && styles.headerRtl]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Menu')}
            onPress={onOpenDrawer}
            style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}>
            <Text style={styles.menuIcon}>☰</Text>
          </Pressable>
          <View style={styles.headerText}>
            <Text style={[styles.title, { textAlign: align }]}>{t('Settings')}</Text>
            <Text style={[styles.subtitle, { textAlign: align }]}>{t('Tavakkol')}</Text>
          </View>
        </View>

        <Section
          title={t('{{n}}. {{title}}', { n: 1, title: t('Accessibility service') })}
          subtitle={t(
            'This is what lets the app read the screen and press Back. Android shows a warning — that warning is normal for any accessibility app.'
          )}
          lang={lang}>
          <View style={styles.statusRow}>
            <View style={styles.statusTextWrap}>
              <Text style={[styles.statusTitle, { textAlign: align }]}>{t('Service status')}</Text>
              <Text style={[styles.statusHint, { textAlign: align }]}>
                {t('Settings → Accessibility → Installed apps')}
              </Text>
            </View>
            <StatusPill
              active={cfg.accessibilityEnabled}
              labels={[t('Enabled'), t('Disabled')]}
            />
          </View>
          <ActionButton
            label={t('Open Accessibility settings')}
            variant="secondary"
            onPress={openAccessibility}
            disabled={!isAvailable}
          />
        </Section>

        <Section
          title={t('{{n}}. {{title}}', { n: 2, title: t('Device admin (anti-uninstall)') })}
          subtitle={t(
            'While device admin is active, Android refuses to uninstall Tavakkol. Deactivate it in Settings → Security → Device admin apps if you ever want the app gone.'
          )}
          lang={lang}>
          <View style={styles.statusRow}>
            <View style={styles.statusTextWrap}>
              <Text style={[styles.statusTitle, { textAlign: align }]}>{t('Device admin')}</Text>
              <Text style={[styles.statusHint, { textAlign: align }]}>
                {t('Uses the force-lock policy')}
              </Text>
            </View>
            <StatusPill
              active={cfg.deviceAdminActive}
              labels={[t('Active'), t('Inactive')]}
            />
          </View>
          {cfg.deviceAdminActive ? (
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
              disabled={!isAvailable}
            />
          )}
        </Section>

        <Section
          title={t('{{n}}. {{title}}', { n: 3, title: t('Keep-alive') })}
          subtitle={t(
            'Android — and MIUI/HyperOS especially — kills background apps. Three independent restarters bring the guard back by themselves: a restartable foreground watchdog, a 15-minute alarm and a 15-minute job, plus a boot receiver.'
          )}
          lang={lang}>
          <View style={styles.statusRow}>
            <View style={styles.statusTextWrap}>
              <Text style={[styles.statusTitle, { textAlign: align }]}>{t('Watchdog service')}</Text>
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
            disabled={!isAvailable}
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
            disabled={!isAvailable}
          />
          <Text style={[styles.hint, { textAlign: align }]}>
            {t(
              'One-time setup on Redmi / POCO / Xiaomi: 1) Autostart → Tavakkol ON, 2) Battery saver → No restrictions, 3) in Recents, pull Tavakkol down to lock it. Without Autostart even a foreground service gets killed within hours.'
            )}
          </Text>
        </Section>

        <Section
          title={t('{{n}}. {{title}}', { n: 4, title: t('Debug Log') })}
          subtitle={t(
            'Everything the background guard does — service starts and stops, foreground-service state, watchdog wake-ups, keyword/domain hits and blocks — recorded on this device, never uploaded. Survives crashes and restarts.'
          )}
          lang={lang}>
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
            disabled={!isAvailable}
          />
        </Section>

        <Section
          lang={lang}
          title={t('Stats')}
          subtitle={t('Stored on this device only — nothing is uploaded.')}>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{cfg.blockCount}</Text>
              <Text style={styles.statLabel}>{t('Blocks')}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{cfg.keywords.length}</Text>
              <Text style={styles.statLabel}>{t('Keywords')}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{cfg.domains.length}</Text>
              <Text style={styles.statLabel}>{t('Domains')}</Text>
            </View>
          </View>
          <Text style={[styles.lastBlockLine, { textAlign: align }]}>
            {`${t('Last block')}: ${
              cfg.lastBlockPackage
                ? `${cfg.lastBlockPackage.split('.').pop()}${
                    cfg.lastBlockReason ? ` (${cfg.lastBlockReason})` : ''
                  }`
                : t('nothing yet')
            }`}
          </Text>
          <ActionButton label={t('Reset counter')} variant="secondary" onPress={clearCounter} />
        </Section>

        <Section
          title={t('Partner PIN')}
          subtitle={t(
            'The app asks for this PIN when it opens — never inside the app. While Protection is on, the Device-admin page is kept closed too.'
          )}
          lang={lang}>
          <Text style={[styles.body, { textAlign: align }]}>
            {pinSet
              ? t('The app lock is on.')
              : t('No PIN yet — the app opens without asking.')}
          </Text>
          <ActionButton
            label={pinSet ? t('Change PIN') : t('Set Partner PIN')}
            onPress={() => openPinDialog(pinSet ? 'change' : 'set')}
          />
          {pinSet ? (
            <ActionButton
              label={t('Remove PIN')}
              variant="secondary"
              onPress={() => openPinDialog('remove')}
            />
          ) : null}
        </Section>

        <Section
          title={t('Remote Control')}
          subtitle={t(
            'A trusted phone can turn Protection off with one SMS. The message is used only once, and messages that arrived before the switch was turned on are ignored.'
          )}
          lang={lang}>
          <View style={[styles.remoteRow, isRtl && styles.headerRtl]}>
            <View style={styles.remoteLabel}>
              <Text style={[styles.remoteTitle, { textAlign: align }]}>
                {t('Enable Remote Deactivation')}
              </Text>
              <Text style={[styles.remoteHint, { textAlign: align }]}>
                {remote.enabled
                  ? t('On — waiting for the partner SMS')
                  : t('Off — incoming SMS are ignored')}
              </Text>
            </View>
            <Switch
              value={remote.enabled}
              onValueChange={(next) => applyRemote(next)}
              disabled={remoteBusy || !isAvailable}
              trackColor={{ false: COLORS.border, true: COLORS.accentSoft }}
              thumbColor={remote.enabled ? COLORS.accent : '#5A6779'}
            />
          </View>

          <Text style={[styles.fieldLabel, { textAlign: align }]}>{t('Partner Phone Number')}</Text>
          <TextInput
            value={remoteNumber}
            onChangeText={setRemoteNumber}
            placeholder="09xxxxxxxxx"
            placeholderTextColor="#5A6779"
            keyboardType="phone-pad"
            autoCorrect={false}
            style={[styles.input, { textAlign: align }]}
          />

          <Text style={[styles.fieldLabel, { textAlign: align }]}>{t('Secret Command')}</Text>
          <TextInput
            value={remoteCode}
            onChangeText={setRemoteCode}
            placeholder={t('For example: TURN OFF')}
            placeholderTextColor="#5A6779"
            autoCapitalize="characters"
            autoCorrect={false}
            style={[styles.input, { textAlign: align }]}
          />

          <ActionButton
            label={t('Save remote settings')}
            onPress={() => applyRemote(remote.enabled)}
            busy={remoteBusy}
            saved={remoteDirty ? false : true}
            disabled={!isAvailable}
          />

          <Text style={[styles.hint, { textAlign: align }]}>
            {smsGranted
              ? t('SMS permission granted.')
              : t('SMS permission is not granted yet — the switch stays off.')}
          </Text>
          {!smsGranted ? (
            <ActionButton
              label={t('Allow SMS access')}
              variant="secondary"
              onPress={requestSmsPermission}
            />
          ) : null}
          <Text style={[styles.hint, { textAlign: align }]}>
            {t('The partner SMS contains the secret command and turns Protection off by itself.')}
          </Text>
          {remote.lastAt > 0 ? (
            <Text style={[styles.hint, { textAlign: align }]}>
              {t('Remote stops so far: {{count}} · last at {{time}}', {
                count: remote.count,
                time: new Date(remote.lastAt).toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-GB'),
              })}
            </Text>
          ) : null}
        </Section>

        <Section
          title={t('Excluded Apps')}
          subtitle={t('Checked apps are never inspected — no keyword or domain block inside them.')}
          lang={lang}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('Search apps')}
            placeholderTextColor="#5A6779"
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, { textAlign: align }]}
          />

          <View style={[styles.excludedMeta, isRtl && styles.headerRtl]}>
            <Text style={styles.excludedCount}>
              {t('{{count}} selected', { count: excluded.length })}
            </Text>
            {excluded.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={onClearExcluded}
                style={({ pressed }) => [pressed && styles.pressed]}>
                <Text style={styles.clearLink}>{t('Clear selection')}</Text>
              </Pressable>
            ) : null}
          </View>

          {loadingApps ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={COLORS.accent} size="small" />
              <Text style={styles.loadingText}>{t('Loading apps…')}</Text>
            </View>
          ) : filtered.length === 0 ? (
            <Text style={styles.emptyText}>{t('No app matches this search.')}</Text>
          ) : (
            visibleApps.map((app) => {
              const checked = excludedSet.has(app.pkg);
              const busy = busyPkg === app.pkg;
              return (
                <Pressable
                  key={app.pkg}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  accessibilityLabel={app.label}
                  onPress={() => toggleApp(app.pkg)}
                  style={({ pressed }) => [
                    styles.appRow,
                    checked && styles.appRowChecked,
                    isRtl && styles.headerRtl,
                    pressed && styles.pressed,
                  ]}>
                  <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                    {busy ? (
                      <ActivityIndicator color={COLORS.onAccent} size="small" />
                    ) : checked ? (
                      <Text style={styles.checkmark}>✓</Text>
                    ) : null}
                  </View>
                  <View style={styles.appInfo}>
                    <Text style={[styles.appLabel, { textAlign: align }]} numberOfLines={1}>
                      {app.label}
                    </Text>
                    <Text style={[styles.appPkg, { textAlign: align }]} numberOfLines={1}>
                      {app.pkg}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          )}

          {hiddenCount > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowAllApps(true)}
              style={({ pressed }) => [styles.showMore, pressed && styles.pressed]}>
              <Text style={styles.showMoreText}>
                {t('Show more ({{count}})', { count: hiddenCount })}
              </Text>
            </Pressable>
          ) : null}
          {showAllApps && !searching && filtered.length > 3 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowAllApps(false)}
              style={({ pressed }) => [styles.showMore, pressed && styles.pressed]}>
              <Text style={styles.showMoreText}>{t('Show less')}</Text>
            </Pressable>
          ) : null}

          <Text style={[styles.hint, { textAlign: align }]}>
            {t('Excluded apps are saved instantly.')}
          </Text>
        </Section>

        <Section
          title={t('Language')}
          subtitle={t('Choose the language of the app.')}
          lang={lang}>
          <View style={styles.langRow}>
            {LANGUAGES.map((option) => {
              const active = option.code === lang;
              return (
                <Pressable
                  key={option.code}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => onChangeLanguage(option.code)}
                  style={({ pressed }) => [
                    styles.langOption,
                    active && styles.langOptionActive,
                    pressed && styles.pressed,
                  ]}>
                  <Text
                    style={[
                      styles.langText,
                      active && styles.langTextActive,
                      { textAlign: 'center' },
                    ]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section
          title={t('Background Music')}
          subtitle={t('A calm loop plays while the app is open. Turn it off any time.')}
          lang={lang}>
          <View style={[styles.remoteRow, isRtl && styles.headerRtl]}>
            <View style={styles.remoteLabel}>
              <Text style={[styles.remoteTitle, { textAlign: align }]}>{t('Music')}</Text>
              <Text style={[styles.remoteHint, { textAlign: align }]}>
                {musicMuted ? t('Muted') : t('Playing at 30% volume')}
              </Text>
            </View>
            <Switch
              value={!musicMuted}
              onValueChange={(next) => onToggleMusicMuted(!next)}
              trackColor={{ false: COLORS.border, true: COLORS.accentSoft }}
              thumbColor={!musicMuted ? COLORS.accent : '#5A6779'}
            />
          </View>
        </Section>

        <Text style={styles.version}>{t('Version {{version}}', { version: VERSION_LABEL })}</Text>
        <Text style={styles.footer}>{t('Tavakkol')}</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </ScrollView>

      <Modal
        visible={logsOpen}
        animationType="slide"
        onRequestClose={closeLogs}>
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

      <Modal
        visible={pinDialog.mode !== null}
        transparent
        animationType="fade"
        onRequestClose={closePinDialog}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={[styles.modalTitle, { textAlign: align }]}>
              {pinDialogCopy().title}
            </Text>
            <Text style={[styles.body, { textAlign: align }]}>{pinDialogCopy().body}</Text>

            {pinDialog.error ? (
              <Text style={[styles.pinError, { textAlign: align }]}>{pinDialog.error}</Text>
            ) : null}

            <View style={styles.pinPad}>
              <PinPad
                value={pinDialog.value}
                onChange={(next) =>
                  setPinDialog((prev) => ({ ...prev, value: next, error: null }))
                }
                onComplete={submitPinDialog}
                disabled={pinDialog.busy}
                okLabel={pinDialogCopy().ok}
              />
            </View>

            <ActionButton
              label={t('Cancel')}
              variant="secondary"
              onPress={closePinDialog}
              disabled={pinDialog.busy}
            />
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
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
    paddingTop: (StatusBar.currentHeight || 24) + 14,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerRtl: {
    flexDirection: 'row-reverse',
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  menuIcon: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 26,
  },
  headerText: {
    flex: 1,
    paddingHorizontal: 12,
  },
  title: {
    color: COLORS.pageText,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: COLORS.pageMuted,
    fontSize: 13,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.75,
  },
  langRow: {
    flexDirection: 'row',
    gap: 10,
  },
  langOption: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  langOptionActive: {
    backgroundColor: COLORS.accentSoft,
    borderColor: COLORS.accent,
  },
  langText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  langTextActive: {
    color: COLORS.accent,
    fontWeight: '700',
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
    minHeight: 48,
  },
  remoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  remoteLabel: {
    flex: 1,
  },
  remoteTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  remoteHint: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 3,
  },
  fieldLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginTop: 12,
    marginBottom: 6,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  statusTextWrap: {
    flex: 1,
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
    marginBottom: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 14,
    alignItems: 'center',
  },
  statValue: {
    color: COLORS.accent,
    fontSize: 22,
    fontWeight: '700',
  },
  statLabel: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 2,
  },
  lastBlockLine: {
    color: COLORS.muted,
    fontSize: 12,
    marginBottom: 12,
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
  excludedMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 8,
  },
  excludedCount: {
    color: COLORS.muted,
    fontSize: 12,
  },
  clearLink: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: '600',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
  },
  loadingText: {
    color: COLORS.muted,
    fontSize: 13,
  },
  emptyText: {
    color: COLORS.muted,
    fontSize: 13,
    paddingVertical: 14,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(58,72,90,0.45)',
    gap: 12,
  },
  appRowChecked: {
    backgroundColor: 'rgba(18,53,35,0.45)',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6,11,16,0.55)',
  },
  checkboxOn: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  checkmark: {
    color: COLORS.onAccent,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 18,
  },
  appInfo: {
    flex: 1,
  },
  appLabel: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  appPkg: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 2,
  },
  hint: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 12,
  },
  showMore: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  showMoreText: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  version: {
    color: COLORS.pageMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 26,
  },
  body: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 10,
  },
  pinError: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  pinPad: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(3,6,10,0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#101820',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 10,
  },
  footer: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
  },
  message: {
    color: COLORS.pageWarning,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 18,
    textAlign: 'center',
  },
  logModalRoot: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: (StatusBar.currentHeight || 24) + 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  logHeaderTitle: {
    flex: 1,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  logCloseText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  logHealth: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  logHealthText: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 17,
    marginBottom: 8,
  },
  logLoader: {
    marginTop: 30,
  },
  logList: {
    padding: 12,
  },
  logEmpty: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 20,
    padding: 16,
    textAlign: 'center',
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(58,72,90,0.35)',
  },
  logTime: {
    color: '#64748B',
    fontSize: 10,
    width: 74,
  },
  logType: {
    fontSize: 11,
    fontWeight: '700',
    width: 130,
  },
  logBody: {
    flex: 1,
  },
  logPkg: {
    color: COLORS.muted,
    fontSize: 11,
  },
  logText: {
    color: COLORS.text,
    fontSize: 12,
  },
  logFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  logFooterButton: {
    flex: 1,
  },
});
