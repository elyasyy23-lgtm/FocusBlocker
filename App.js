import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
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
import * as FocusGuard from './modules/focus-guard';

const COLORS = {
  background: '#0B0F14',
  surface: '#151C24',
  surfaceAlt: '#1D2733',
  border: '#28323F',
  text: '#F2F6FA',
  muted: '#8C9AAB',
  accent: '#4ADE80',
  accentSoft: '#123523',
  danger: '#F87171',
  warning: '#FBBF24',
};

function Section({ title, subtitle, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function StatusPill({ active, labels }) {
  return (
    <View style={[styles.pill, active ? styles.pillOn : styles.pillOff]}>
      <View style={[styles.dot, active ? styles.dotOn : styles.dotOff]} />
      <Text style={[styles.pillText, active ? styles.pillTextOn : styles.pillTextOff]}>
        {active ? labels[0] : labels[1]}
      </Text>
    </View>
  );
}

function ActionButton({ label, onPress, variant = 'primary', disabled = false, busy = false, saved = false }) {
  const isSecondary = variant === 'secondary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        isSecondary ? styles.buttonSecondary : saved ? styles.buttonSaved : styles.buttonPrimary,
        (disabled || busy) && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}>
      {busy ? (
        <ActivityIndicator color={isSecondary ? COLORS.text : '#04130A'} size="small" />
      ) : (
        <Text
          style={[
            styles.buttonText,
            isSecondary
              ? styles.buttonTextSecondary
              : saved
              ? styles.buttonTextSaved
              : styles.buttonTextPrimary,
          ]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
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

function formatLogTime(t) {
  if (!t) return '--:--:--';
  const date = new Date(t);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}:${pad(date.getSeconds())}`;
}

function shortPackage(pkg) {
  const parts = String(pkg || '').split('.');
  return parts.slice(-2).join('.');
}

/** "42s ago" / "never" — how long the keep-alive watchdog has been silent. */
function formatHeartbeat(ageMs) {
  if (ageMs === null || ageMs === undefined || ageMs < 0) return 'never';
  const seconds = Math.round(ageMs / 1000);
  if (seconds < 90) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}min ago`;
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
  const keywordsDirtyRef = useRef(false);
  const domainsDirtyRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const next = await FocusGuard.getConfig();
      setConfig(next);
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
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

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
          ? 'Block list cleared — nothing is blocked right now.'
          : `Saved ${keywords.length} keyword${keywords.length === 1 ? '' : 's'}.`
      );
    } catch (error) {
      setMessage(error.message || 'Saving the block list failed.');
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
          ? 'Domain list cleared — no website is blocked.'
          : `Saved ${domains.length} domain${domains.length === 1 ? '' : 's'}.`
      );
    } catch (error) {
      setMessage(error.message || 'Saving the domain list failed.');
    } finally {
      setSavingDomains(false);
    }
  };

  const toggleBlocking = async (value) => {
    setToggling(true);
    setMessage(null);
    try {
      await FocusGuard.setEnabled(value);
      await refresh();
    } catch (error) {
      setMessage(error.message || 'Could not change the blocker state.');
    } finally {
      setToggling(false);
    }
  };

  const openAccessibility = async () => {
    try {
      await FocusGuard.openAccessibilitySettings();
      setMessage('Find “FocusBlocker guard (keywords + domains)” in the list and switch it on.');
    } catch (error) {
      setMessage(error.message || 'Could not open Accessibility settings.');
    }
  };

  const enableDeviceAdmin = async () => {
    try {
      await FocusGuard.requestDeviceAdmin();
      setMessage('Confirm the system dialog to keep FocusBlocker installed.');
      setTimeout(refresh, 1200);
    } catch (error) {
      setMessage(error.message || 'Could not open the device admin dialog.');
    }
  };

  const runPanicLock = async () => {
    try {
      await FocusGuard.lockScreen();
    } catch (error) {
      setMessage(error.message || 'Locking the screen failed.');
    }
  };

  const clearCounter = async () => {
    try {
      await FocusGuard.resetBlockCount();
      await refresh();
      setMessage('Block counter reset.');
    } catch (error) {
      setMessage(error.message || 'Could not reset the counter.');
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
      setMessage(error.message || 'Could not read the debug log.');
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
      setMessage(error.message || 'Could not clear the log.');
    } finally {
      setClearingLogs(false);
    }
  };

  const fixBattery = async () => {
    try {
      await FocusGuard.requestIgnoreBatteryOptimizations();
      setMessage('Confirm the system dialog so Android stops killing the guard.');
      setTimeout(loadLogs, 1500);
    } catch (error) {
      setMessage(error.message || 'Could not open the battery dialog.');
    }
  };

  const startKeepAlive = async () => {
    setKeepAliveBusy(true);
    try {
      await FocusGuard.ensureKeepAlive();
      await refresh();
      setMessage(
        'Keep-alive armed: watchdog started, 15-minute alarm and persisted job scheduled.'
      );
    } catch (error) {
      setMessage(error.message || 'Could not start the keep-alive.');
    } finally {
      setKeepAliveBusy(false);
    }
  };

  const openAutostart = async () => {
    try {
      const result = await FocusGuard.openAutostartSettings();
      setMessage(
        result.opened === 'autostart'
          ? 'Switch Autostart ON for FocusBlocker on this screen, then come back.'
          : 'Find “Autostart” (or “Battery usage / Allow background activity”) on this screen and allow FocusBlocker.'
      );
    } catch (error) {
      setMessage(error.message || 'Could not open the autostart screen.');
    }
  };

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

  // A save button stays white while the editor text is exactly what is stored,
  // and turns green again the moment the text changes.
  const keywordsSaved = !loading && keywordsText === config.keywords.join(', ');
  const domainsSaved = !loading && domainsText === config.domains.join(', ');

  const blockingReady =
    config.accessibilityEnabled && config.enabled && (config.keywords.length > 0 || config.domains.length > 0);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Text style={styles.brand}>FocusBlocker</Text>
        <Text style={styles.tagline}>
          A guard for your own phone. It watches text as it changes on screen — a blocked
          keyword or domain in a search bar, address bar or chat closes the app immediately.
        </Text>

        {!FocusGuard.isAvailable ? (
          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>Native build required</Text>
            <Text style={styles.warningText}>
              Expo Go cannot run accessibility services. Build the APK (eas build -p android
              --profile preview) and install it — every control below works there.
            </Text>
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator color={COLORS.accent} style={styles.loader} />
        ) : (
          <>
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>Protection</Text>
              <Text style={[styles.heroState, blockingReady ? styles.heroOn : styles.heroOff]}>
                {blockingReady ? 'Active' : 'Not active yet'}
              </Text>
              <Text style={styles.heroHint}>
                {config.enabled
                  ? `${config.keywords.length} keyword${config.keywords.length === 1 ? '' : 's'} + ${config.domains.length} domain${config.domains.length === 1 ? '' : 's'} watched`
                  : 'Blocker paused'}
                {' · '}
                {config.blockCount} block{config.blockCount === 1 ? '' : 's'} so far
              </Text>
              <View style={styles.switchRow}>
                <View style={styles.switchLabel}>
                  <Text style={styles.switchTitle}>Protection</Text>
                  <Text style={styles.switchHint}>
                    {config.accessibilityEnabled
                      ? 'Accessibility service is running'
                      : 'Service is off — enable it below'}
                  </Text>
                </View>
                <Switch
                  value={config.enabled}
                  onValueChange={toggleBlocking}
                  disabled={toggling || !FocusGuard.isAvailable}
                  trackColor={{ false: COLORS.border, true: COLORS.accentSoft }}
                  thumbColor={config.enabled ? COLORS.accent : '#5A6779'}
                />
              </View>
            </View>

            <Section
              title="1. Blocked keywords"
              subtitle="Any text that changes on screen is checked — search bars, the browser address bar and chat messages (Telegram, Rubika). Separate keywords with a comma — matching is case-insensitive and also matches inside longer text.">
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
                style={styles.input}
              />
              <View style={styles.chipRow}>
                {keywordsPreview.length === 0 ? (
                  <Text style={styles.emptyHint}>No keywords yet — nothing will be blocked.</Text>
                ) : (
                  keywordsPreview.map((keyword) => (
                    <View key={keyword} style={styles.chip}>
                      <Text style={styles.chipText}>{keyword}</Text>
                    </View>
                  ))
                )}
              </View>
              <ActionButton
                label="Save block list"
                onPress={saveKeywords}
                busy={saving}
                saved={keywordsSaved}
                disabled={!FocusGuard.isAvailable}
              />
            </Section>

            <Section
              title="2. Blocked domains"
              subtitle="The guard reads the address bar of Chrome and other browsers. http://, https://, www. and paths are removed automatically — just type the domain.">
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
                style={styles.input}
              />
              <View style={styles.chipRow}>
                {domainsPreview.length === 0 ? (
                  <Text style={styles.emptyHint}>No domains yet — the browser stays open.</Text>
                ) : (
                  domainsPreview.map((domain) => (
                    <View key={domain} style={[styles.chip, styles.chipDanger]}>
                      <Text style={[styles.chipText, styles.chipTextDanger]}>{domain}</Text>
                    </View>
                  ))
                )}
              </View>
              <ActionButton
                label="Save domain list"
                onPress={saveDomains}
                busy={savingDomains}
                saved={domainsSaved}
                disabled={!FocusGuard.isAvailable}
              />
            </Section>

            <Section
              title="3. Accessibility service"
              subtitle="This is what lets the app read the screen and press Back. Android shows a warning — that warning is normal for any accessibility app.">
              <View style={styles.statusRow}>
                <View style={styles.statusTextWrap}>
                  <Text style={styles.statusTitle}>Service status</Text>
                  <Text style={styles.statusHint}>
                    Settings → Accessibility → Installed apps
                  </Text>
                </View>
                <StatusPill
                  active={config.accessibilityEnabled}
                  labels={['Enabled', 'Disabled']}
                />
              </View>
              <ActionButton
                label="Open Accessibility settings"
                variant="secondary"
                onPress={openAccessibility}
                disabled={!FocusGuard.isAvailable}
              />
            </Section>

            <Section
              title="4. Device admin (anti-uninstall)"
              subtitle="While device admin is active, Android refuses to uninstall FocusBlocker. Deactivate it in Settings → Security → Device admin apps if you ever want the app gone.">
              <View style={styles.statusRow}>
                <View style={styles.statusTextWrap}>
                  <Text style={styles.statusTitle}>Device admin</Text>
                  <Text style={styles.statusHint}>Uses the force-lock policy</Text>
                </View>
                <StatusPill
                  active={config.deviceAdminActive}
                  labels={['Active', 'Inactive']}
                />
              </View>
              {config.deviceAdminActive ? (
                <ActionButton label="Panic lock screen" variant="secondary" onPress={runPanicLock} />
              ) : (
                <ActionButton
                  label="Activate device admin"
                  variant="secondary"
                  onPress={enableDeviceAdmin}
                  disabled={!FocusGuard.isAvailable}
                />
              )}
            </Section>

            <Section title="Stats" subtitle="Stored on this device only — nothing is uploaded.">
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{config.blockCount}</Text>
                  <Text style={styles.statLabel}>Blocks</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{config.keywords.length}</Text>
                  <Text style={styles.statLabel}>Keywords</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{config.domains.length}</Text>
                  <Text style={styles.statLabel}>Domains</Text>
                </View>
              </View>
              <Text style={styles.lastBlockLine}>
                Last block:{' '}
                {config.lastBlockPackage
                  ? `${config.lastBlockPackage.split('.').pop()}${
                      config.lastBlockReason ? ` (${config.lastBlockReason})` : ''
                    }`
                  : 'nothing yet'}
              </Text>
              <ActionButton label="Reset counter" variant="secondary" onPress={clearCounter} />
            </Section>

            <Section
              title="5. Keep-alive"
              subtitle="Android — and MIUI/HyperOS especially — kills background apps. Three independent restarters bring the guard back by themselves: a restartable foreground watchdog, a 15-minute alarm and a 15-minute job, plus a boot receiver.">
              <View style={styles.statusRow}>
                <View style={styles.statusTextWrap}>
                  <Text style={styles.statusTitle}>Watchdog service</Text>
                  <Text style={styles.statusHint}>
                    {health
                      ? `heartbeat ${formatHeartbeat(health.heartbeatAgeMs)}${
                          health.manufacturer ? ` · ${health.manufacturer}` : ''
                        }`
                      : 'checking…'}
                  </Text>
                </View>
                <StatusPill
                  active={Boolean(health && health.watchdogRunning)}
                  labels={['Up', 'Down']}
                />
              </View>
              <ActionButton
                label="Start keep-alive now"
                variant="secondary"
                onPress={startKeepAlive}
                busy={keepAliveBusy}
                disabled={!FocusGuard.isAvailable}
              />
              <ActionButton
                label={
                  health && health.manufacturer
                    ? `Open Autostart settings (${health.manufacturer})`
                    : 'Open Autostart settings'
                }
                variant="secondary"
                onPress={openAutostart}
                disabled={!FocusGuard.isAvailable}
              />
              <Text style={styles.keepAliveHint}>
                One-time setup on Redmi / POCO / Xiaomi: 1) Autostart → FocusBlocker ON, 2) Battery
                saver → No restrictions, 3) in Recents, pull FocusBlocker down to lock it. Without
                Autostart even a foreground service gets killed within hours.
              </Text>
            </Section>

            <Section
              title="6. Debug Log"
              subtitle="Everything the background guard does — service starts and stops, foreground-service state, watchdog wake-ups, keyword/domain hits and blocks — recorded on this device, never uploaded. Survives crashes and restarts.">
              {health ? (
                <Text
                  style={[
                    styles.healthLine,
                    health.serviceRunning && health.foregroundActive
                      ? styles.healthOk
                      : styles.healthWarn,
                  ]}>
                  Service {health.serviceRunning ? 'running' : 'NOT running'} ·{' '}
                  {health.foregroundActive ? 'foreground notification active' : 'NO foreground notification'}{' '}
                  · watchdog {health.watchdogRunning ? 'up' : 'DOWN'} (
                  {formatHeartbeat(health.heartbeatAgeMs)}) ·{' '}
                  {health.batteryOptimizationIgnored
                    ? 'battery unrestricted'
                    : 'battery RESTRICTED — Android may kill the guard'}
                </Text>
              ) : null}
              <ActionButton
                label="Show Logs"
                variant="secondary"
                onPress={openLogs}
                disabled={!FocusGuard.isAvailable}
              />
            </Section>

            {message ? <Text style={styles.message}>{message}</Text> : null}

            <Text style={styles.footer}>
              Works fully offline. Any text that changes on screen is checked — search bars,
              address bars and chat messages. While the guard is running it keeps a small
              persistent notification: if that notification disappears, the guard was stopped.
              The watchdog, the 15-minute alarm, the 15-minute job and the boot receiver restart it
              on their own — and if the guard stays down for more than three minutes you get an
              alert instead of silently losing protection.
            </Text>
          </>
        )}
      </ScrollView>

      <Modal visible={logsOpen} animationType="slide" onRequestClose={closeLogs}>
        <View style={styles.logModalRoot}>
          <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
          <View style={styles.logHeader}>
            <View style={styles.logHeaderTitle}>
              <Text style={styles.logTitle}>Debug Log</Text>
              <Text style={styles.logSubtitle}>Last 100 events · newest first</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close debug log"
              onPress={closeLogs}
              style={({ pressed }) => [styles.logClose, pressed && styles.buttonPressed]}>
              <Text style={styles.logCloseText}>Close</Text>
            </Pressable>
          </View>

          {health ? (
            <View style={styles.logHealth}>
              <Text style={styles.logHealthText}>
                Accessibility: {health.accessibilityEnabled ? 'enabled' : 'DISABLED'} · Guard bound:{' '}
                {health.serviceRunning ? 'yes' : 'no'} · Foreground service:{' '}
                {health.foregroundActive ? 'running' : 'DOWN'} · Watchdog:{' '}
                {health.watchdogRunning ? 'up' : 'DOWN'} (
                {formatHeartbeat(health.heartbeatAgeMs)}) · Battery optimization:{' '}
                {health.batteryOptimizationIgnored ? 'off (safe)' : 'on (kill risk)'}
              </Text>
              {!health.batteryOptimizationIgnored ? (
                <ActionButton
                  label="Exclude from battery optimization"
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
                  No events recorded yet. The log fills as soon as the guard runs — tap Refresh
                  after using the phone, or Clear to start over.
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
              <ActionButton label="Refresh" variant="secondary" onPress={loadLogs} busy={logsLoading} />
            </View>
            <View style={styles.logFooterButton}>
              <ActionButton label="Clear log" variant="secondary" onPress={clearLogs} busy={clearingLogs} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: (StatusBar.currentHeight || 24) + 20,
    paddingBottom: 48,
  },
  brand: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  tagline: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 20,
  },
  warningBox: {
    backgroundColor: '#3A2C08',
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
  switchLabel: {
    flex: 1,
    paddingRight: 12,
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
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '700',
  },
  sectionSubtitle: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  sectionBody: {
    marginTop: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  input: {
    color: COLORS.text,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    minHeight: 56,
    fontSize: 15,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  chip: {
    backgroundColor: COLORS.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  chipDanger: {
    backgroundColor: '#33222A',
  },
  chipTextDanger: {
    color: COLORS.danger,
  },
  lastBlockLine: {
    color: COLORS.muted,
    fontSize: 12,
    marginBottom: 12,
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
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillOn: {
    backgroundColor: COLORS.accentSoft,
  },
  pillOff: {
    backgroundColor: '#33222A',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  dotOn: {
    backgroundColor: COLORS.accent,
  },
  dotOff: {
    backgroundColor: COLORS.danger,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pillTextOn: {
    color: COLORS.accent,
  },
  pillTextOff: {
    color: COLORS.danger,
  },
  button: {
    marginTop: 4,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonPrimary: {
    backgroundColor: COLORS.accent,
  },
  buttonSaved: {
    backgroundColor: '#FFFFFF',
  },
  buttonSecondary: {
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    opacity: 0.75,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  buttonTextPrimary: {
    color: '#04130A',
  },
  buttonTextSaved: {
    color: '#14532D',
  },
  buttonTextSecondary: {
    color: COLORS.text,
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
  message: {
    color: COLORS.warning,
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
    marginTop: 4,
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
  footer: {
    color: '#5A6779',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 28,
    textAlign: 'center',
  },
});
