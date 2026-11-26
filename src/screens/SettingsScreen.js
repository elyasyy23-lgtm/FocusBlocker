import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { COLORS, RADIUS, SHADOW_CARD, SHADOW_SOFT, SPACE, textAlign } from '../theme';
import { LANGUAGES, formatNumber } from '../i18n';
import { VERSION_LABEL } from '../buildInfo';
import { formatClock, formatHeartbeat } from '../utils/debugLog';

const BACKGROUND = require('../../assets/background.jpg');

/**
 * Settings screen (v1.4.5) — everything advanced, reached from the drawer.
 *
 * v1.4.5 moved the whole "system" half of the app here (accessibility service,
 * device admin, keep-alive, stats) so the Home screen shows only the two
 * switches and the two lists. v1.4.7 moved the debug log back to the bottom of
 * the Home screen (owner request) and removed the header gear — this screen is
 * reached from the drawer only. It is CLOSED entirely while Protection is ON —
 * App.js never routes here in that state and the drawer row reports the reason.
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
  // v1.4.16: live guard state (polled in App.js) — the service-status pill must
  // show the REAL bound state, not the system toggle that survives a kill.
  serviceRunning,
  accessibilityEnabled,
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

  // v1.4.5: keep-alive health. The debug log itself moved to the Home screen
  // in v1.4.7 (owner request) — this screen only reads the health line.
  const [health, setHealth] = useState(null);
  const [keepAliveBusy, setKeepAliveBusy] = useState(false);
  /** v1.4.15: the device-admin screen is ROM-specific, so it is shown as text. */
  const [adminModal, setAdminModal] = useState(false);

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

  // v1.4.5: health rides along on mount so the keep-alive section shows live
  // state (the debug log on Home reads it separately).
  // v1.4.19: it is POLLED now — the Autostart card shows a live foreground-service
  // pill plus the boot-test result, so a one-shot read would go stale on screen.
  // v1.4.20: every 3 s, and the native side answers from the system's own service
  // list, so a service the OS killed flips the pill to red within one poll.
  useEffect(() => {
    let alive = true;
    const read = () => {
      FocusGuard.getServiceHealth()
        .then((value) => {
          if (alive) setHealth(value);
        })
        .catch(() => {});
    };
    read();
    const timer = setInterval(read, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
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

  /**
   * v1.4.13 (owner bug: on HyperOS the button did nothing, silently):
   * native now logs every intent it tries plus the activity each one resolves
   * to, and returns { opened, target, active }. Every outcome shows a message —
   * including the manual path when no Settings screen answers — so a tap can
   * never end in silence again.
   */
  // v1.4.15 (owner decision): no intent at all — the path is shown as text.
  const openDeviceAdminGuide = () => {
    setAdminModal(true);
    if (FocusGuard.deviceAdminHintState) {
      Promise.resolve(FocusGuard.deviceAdminHintState()).catch(() => {});
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

  /*
    v1.4.19 boot test (owner request). Android gives no API to READ an OEM
    autostart switch, so instead of guessing we MEASURE: the native receiver
    stamps `bootBroadcastAt` every time the system actually delivers a boot
    broadcast to Tavakkol, and `bootAt` is when the device booted (derived from
    elapsedRealtime). Same boot session → the ROM started us by itself; an older
    stamp → it did not. Nothing is invented, and "never seen a boot" is shown as
    its own honest state.

    The window is deliberately generous: MIUI can deliver the boot broadcast
    minutes late, and a clock correction after boot shifts `bootAt` slightly.
    10 minutes back still cleanly separates "this boot" from "a previous boot",
    60 minutes forward absorbs a late/backdated system clock.
  */
  const BOOT_EARLY_MS = 10 * 60 * 1000;
  const BOOT_LATE_MS = 60 * 60 * 1000;
  const bootBroadcastAt = Number(health && health.bootBroadcastAt) || 0;
  const bootAt = Number(health && health.bootAt) || 0;
  const bootChecked = bootBroadcastAt > 0;
  const autoStarted =
    bootChecked &&
    bootBroadcastAt >= bootAt - BOOT_EARLY_MS &&
    bootBroadcastAt <= bootAt + BOOT_LATE_MS;
  const bootLine = !bootChecked
    ? t('Not checked yet — the result appears after the next restart.')
    : autoStarted
      ? t('The system started Tavakkol automatically after the last restart ✓ {{time}}', {
          time: formatNumber(formatClock(bootBroadcastAt), lang),
        })
      : t('✗ — turn Autostart on');

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
              {/*
                v1.4.16: green "Running" only while the guard is really bound.
                `accessibilityEnabled` (the system toggle) stays on after MIUI
                stops the process, which is why the old pill showed Enabled/green
                on a dead guard.
              */}
              <Text style={[styles.statusHint, { textAlign: align }]}>
                {serviceRunning
                  ? t('Settings → Accessibility → Installed apps')
                  : accessibilityEnabled
                    ? t(
                        'Enabled in the system, but the guard is not running — the system may have stopped it.'
                      )
                    : t('Service is off — enable it in Settings')}
              </Text>
            </View>
            <StatusPill
              active={Boolean(serviceRunning)}
              labels={[t('Running'), t('Stopped')]}
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
            'While device admin is active, Android refuses to uninstall Tavakkol. Open the path below to switch it off whenever you want the app gone.'
          )}
          lang={lang}>
          <View style={styles.statusRow}>
            <View style={styles.statusTextWrap}>
              <Text style={[styles.statusTitle, { textAlign: align }]}>{t('Device admin')}</Text>
              <Text style={[styles.statusHint, { textAlign: align }]}>
                {t('Blocks uninstall only — no screen lock')}
              </Text>
            </View>
            <StatusPill
              active={cfg.deviceAdminActive}
              labels={[t('Active'), t('Inactive')]}
            />
          </View>
          <ActionButton
            label={t('Device admin settings')}
            variant="secondary"
            onPress={openDeviceAdminGuide}
            disabled={!isAvailable}
          />
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
        </Section>

        {/*
          v1.4.18/v1.4.19 (owner request): the Autostart block is a COMPLETELY
          SEPARATE card — a sibling of the Keep-alive section, never nested in it,
          with its own border/background. v1.4.19 dropped the hand-set reminder
          switch and shows two MEASURED things instead: a live pill for the real
          foreground service, and a boot-test line proving whether the system
          started Tavakkol by itself after the last restart. The vendor button
          and the setup text stay. The Keep-alive section above is untouched.
        */}
        <View style={styles.cardBox}>
          <View style={[styles.statusRow, isRtl && styles.headerRtl]}>
            <View style={styles.statusTextWrap}>
              <Text style={[styles.statusTitle, { textAlign: align }]}>
                {t('Autostart ({{manufacturer}})', {
                  manufacturer: health && health.manufacturer ? health.manufacturer : 'Xiaomi',
                })}
              </Text>
              <Text style={[styles.statusHint, { textAlign: align }]}>
                {t('The background service that keeps the guard alive')}
              </Text>
            </View>
            <StatusPill
              active={Boolean(health && health.foregroundActive)}
              labels={[t('Running'), t('Stopped')]}
            />
          </View>
          <Text
            style={[
              styles.bootLine,
              { textAlign: align },
              autoStarted ? styles.bootLineOk : bootChecked ? styles.bootLineBad : null,
            ]}>
            {bootLine}
          </Text>
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
          <Text style={[styles.statusHint, { textAlign: align }]}>
            {t(
              'One-time setup on Redmi / POCO / Xiaomi: 1) Autostart → Tavakkol ON, 2) Battery saver → No restrictions, 3) in Recents, pull Tavakkol down to lock it. Without Autostart even a foreground service gets killed within hours.'
            )}
          </Text>
        </View>

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
        visible={adminModal}
        transparent
        animationType="fade"
        onRequestClose={() => setAdminModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={[styles.modalTitle, { textAlign: align }]}>
              {t('Device admin settings')}
            </Text>
            <Text style={[styles.body, { textAlign: align }]}>
              {t(
                'To manage device admin access, go to your phone settings and follow this path:'
              )}
            </Text>
            <Text style={[styles.adminPath, { textAlign: align }]}>
              {t('Settings ← Privacy ← Special permissions ← Device admin apps ← Tavakkol')}
            </Text>
            <ActionButton label={t('Close')} onPress={() => setAdminModal(false)} />
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
  adminPath: {
    color: COLORS.accent,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 24,
    marginTop: SPACE.xs,
    marginBottom: SPACE.xs,
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
    paddingHorizontal: SPACE.lg,
    paddingTop: (StatusBar.currentHeight || 24) + SPACE.md,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACE.xs,
  },
  headerRtl: {
    flexDirection: 'row-reverse',
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW_SOFT,
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
    gap: SPACE.sm,
  },
  langOption: {
    flex: 1,
    minHeight: 46,
    borderRadius: RADIUS.md,
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
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    fontSize: 15,
    minHeight: 48,
  },
  remoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    marginBottom: SPACE.xs,
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
    marginTop: SPACE.xs,
  },
  fieldLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginTop: SPACE.sm,
    marginBottom: SPACE.xs,
  },
  // v1.4.17: a bordered card identical to the Service Status card (which is the
  // Section body) — same background, border, radius and padding. Used by the
  // Autostart block so the two look like a matched pair.
  cardBox: {
    marginTop: SPACE.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACE.md,
    ...SHADOW_CARD,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACE.sm,
    marginBottom: SPACE.sm,
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
    marginTop: SPACE.xs,
  },
  // v1.4.19: the boot-test result line inside the Autostart card. Green when the
  // system really started Tavakkol after the last restart, red when it did not,
  // muted while there is nothing to report yet.
  bootLine: {
    color: COLORS.muted,
    fontSize: 12.5,
    lineHeight: 19,
    fontWeight: '600',
    marginBottom: SPACE.sm,
  },
  bootLineOk: {
    color: COLORS.accent,
  },
  bootLineBad: {
    color: COLORS.danger,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACE.sm,
    marginBottom: SPACE.sm,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACE.md,
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
    marginBottom: SPACE.sm,
  },
  excludedMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACE.sm,
    marginBottom: SPACE.xs,
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
    gap: SPACE.sm,
    paddingVertical: SPACE.md,
  },
  loadingText: {
    color: COLORS.muted,
    fontSize: 13,
  },
  emptyText: {
    color: COLORS.muted,
    fontSize: 13,
    paddingVertical: SPACE.md,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(58,72,90,0.45)',
    gap: SPACE.sm,
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
    marginTop: SPACE.sm,
  },
  showMore: {
    alignSelf: 'center',
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.sm,
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
    marginTop: SPACE.xl,
  },
  body: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: SPACE.sm,
  },
  pinError: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '600',
    marginTop: SPACE.xs,
  },
  pinPad: {
    alignItems: 'center',
    marginTop: SPACE.sm,
    marginBottom: SPACE.xs,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(3,6,10,0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACE.xl,
  },
  modalCard: {
    width: '100%',
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACE.lg,
    ...SHADOW_CARD,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: '700',
    marginBottom: SPACE.sm,
  },
  footer: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'center',
    marginTop: SPACE.xs,
  },
  message: {
    color: COLORS.pageWarning,
    fontSize: 13,
    lineHeight: 19,
    marginTop: SPACE.lg,
    textAlign: 'center',
  },
});
