import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as FocusGuard from '../../modules/focus-guard';
import { ActionButton, Section } from './ui';
import { COLORS, textAlign } from '../theme';
import { formatHeartbeat, formatLogTime, logTypeColor, shortPackage } from '../utils/debugLog';

/**
 * Debug Log (v1.4.7) — moved here from Settings by owner request.
 *
 * It lives at the very bottom of the Home screen: the health line and the
 * "Show Logs" button are one tap away, but they never push the switches or the
 * block lists down. The full log opens in its own full-screen modal so a long
 * list never fights the Home scroll view.
 */
export default function DebugLogSection({ t, lang, isAvailable, onMessage, number = 3 }) {
  const align = textAlign(lang);
  const [health, setHealth] = useState(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [clearingLogs, setClearingLogs] = useState(false);

  const refreshHealth = useCallback(() => {
    FocusGuard.getServiceHealth()
      .then(setHealth)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshHealth();
  }, [refreshHealth]);

  // The guard state changes while the app is in the background — re-read it
  // whenever the user comes back so the health line is never stale.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshHealth();
    });
    return () => subscription.remove();
  }, [refreshHealth]);

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

  return (
    <Section
      title={t('{{n}}. {{title}}', { n: number, title: t('Debug Log') })}
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
              <ActionButton
                label={t('Refresh')}
                variant="secondary"
                onPress={loadLogs}
                busy={logsLoading}
              />
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
    </Section>
  );
}

const styles = StyleSheet.create({
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
  pressed: {
    opacity: 0.75,
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
