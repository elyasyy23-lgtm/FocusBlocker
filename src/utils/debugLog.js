/**
 * Formatting helpers for the in-app debug log (v1.4.7).
 *
 * Pulled out of SettingsScreen so both the Home screen (which now owns the
 * debug log) and the Settings keep-alive section can share the same rendering
 * rules. Pure functions — no React, no native calls.
 */
import { COLORS } from '../theme';

export const LOG_TYPE_COLORS = {
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

export function logTypeColor(type) {
  return LOG_TYPE_COLORS[type] || COLORS.muted;
}

export function formatLogTime(value) {
  if (!value) return '--:--:--';
  const date = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}:${pad(date.getSeconds())}`;
}

export function shortPackage(pkg) {
  const parts = String(pkg || '').split('.');
  return parts.slice(-2).join('.');
}

/** "42s ago" / "12min ago" / "never" — how long the watchdog has been silent. */
export function formatHeartbeat(ageMs, t) {
  if (ageMs === null || ageMs === undefined || ageMs < 0) return t('never');
  const seconds = Math.round(ageMs / 1000);
  if (seconds < 90) return t('{{seconds}}s ago', { seconds });
  return t('{{minutes}}min ago', { minutes: Math.round(seconds / 60) });
}
