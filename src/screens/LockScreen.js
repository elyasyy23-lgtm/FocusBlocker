import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import PinPad from '../components/PinPad';
import { COLORS, textAlign } from '../theme';
import { formatNumber } from '../i18n';

/**
 * Full-screen gate shown every time the app comes back to the foreground while
 * a Partner PIN is set (v1.3.1, auto-submit since v1.3.2).
 *
 * The gate is deliberately minimal: no Settings, no Help, no keyword list —
 * only the PIN pad. There is no "Unlock" button: every keystroke is checked
 * against the stored hash, so the app opens the instant the correct PIN is
 * complete. A wrong PIN only reports itself once typing pauses (tapping the
 * next digit must not flash an error), and the field clears so the next
 * attempt starts clean.
 *
 * The PIN never leaves the device: it is hashed in the native module and
 * compared there.
 *
 * v1.3.3 — lockout timer: three wrong PINs disable the whole keypad for 30
 * seconds and the screen shows a live countdown. The counter lives in a
 * module-level object, not in state, because this gate is unmounted and
 * remounted every time the app goes to the background — without that, sending
 * the app to the background would hand out free retries. A full process kill
 * still resets it; Android offers no tamper-proof timer to a normal app without
 * shared storage, and this is a self-control tool, not a security product.
 */
const PIN_MIN_LENGTH = 4;
const PIN_MAX_LENGTH = 8;
const WRONG_PIN_DELAY_MS = 700;
/** v1.3.3: three wrong PINs → MAX_ATTEMPTS, then LOCKOUT_MS of dead keypad. */
const MAX_ATTEMPTS = 3;
const LOCKOUT_MS = 30 * 1000;

const guardState = { failures: 0, lockedUntil: 0 };

function secondsUntil(until) {
  return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}

export default function LockScreen({ t, lang, busy = false, onSubmit }) {
  const align = textAlign(lang);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(() => secondsUntil(guardState.lockedUntil));
  const errorTimer = useRef(null);
  const inFlight = useRef(false);
  const locked = secondsLeft > 0;

  useEffect(
    () => () => {
      if (errorTimer.current) clearTimeout(errorTimer.current);
    },
    []
  );

  // The countdown: one timer while the lockout runs, cleared the moment it ends.
  // Finishing it clears the wrong-attempt counter so the next three tries start
  // from zero.
  useEffect(() => {
    if (!locked) return undefined;
    let timer = null;
    const tick = () => {
      const left = secondsUntil(guardState.lockedUntil);
      setSecondsLeft(left);
      if (left <= 0) {
        guardState.failures = 0;
        guardState.lockedUntil = 0;
        setError(null);
        if (timer) clearInterval(timer);
        timer = null;
      }
    };
    tick();
    timer = setInterval(tick, 500);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [locked]);

  /**
   * One completed wrong entry (not one keystroke — a 6-digit PIN would otherwise
   * burn three attempts while the user is still typing it). The third failure in
   * a row starts the 30-second lockout and resets the counter, so the user gets
   * a fresh three tries when the countdown ends.
   */
  const registerFailure = () => {
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = null;
    setPin('');
    const next = guardState.failures + 1;
    if (next >= MAX_ATTEMPTS) {
      guardState.failures = 0;
      guardState.lockedUntil = Date.now() + LOCKOUT_MS;
      setSecondsLeft(secondsUntil(guardState.lockedUntil));
      setError(null);
      return;
    }
    guardState.failures = next;
    setError(t('Wrong PIN. Try again.'));
  };

  const showWrongPin = registerFailure;

  const attempt = async (value) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setChecking(true);
    try {
      const ok = await onSubmit(value);
      if (ok) {
        if (errorTimer.current) clearTimeout(errorTimer.current);
        errorTimer.current = null;
        guardState.failures = 0;
        guardState.lockedUntil = 0;
        return;
      }
      if (value.length >= PIN_MAX_LENGTH) {
        showWrongPin();
        return;
      }
      // Give the next digit time to arrive before complaining.
      if (errorTimer.current) clearTimeout(errorTimer.current);
      errorTimer.current = setTimeout(showWrongPin, WRONG_PIN_DELAY_MS);
    } finally {
      inFlight.current = false;
      setChecking(false);
    }
  };

  const change = (next) => {
    if (locked) return;
    setError(null);
    if (errorTimer.current) {
      clearTimeout(errorTimer.current);
      errorTimer.current = null;
    }
    setPin(next);
    if (next.length >= PIN_MIN_LENGTH) attempt(next);
  };

  return (
    <View style={styles.root}>
      <View style={styles.badge}>
        <Text style={styles.badgeIcon}>🔒</Text>
      </View>

      <Text style={[styles.title, { textAlign: align }]}>{t('Tavakkol is locked')}</Text>
      <Text style={[styles.subtitle, { textAlign: align }]}>
        {t('Enter the Partner PIN to continue.')}
      </Text>

      <View style={styles.pad}>
        <PinPad
          value={pin}
          onChange={change}
          onComplete={() => {}}
          disabled={busy || checking || locked}
          showOk={false}
        />
      </View>

      {busy || checking ? (
        <View style={styles.busyRow}>
          <ActivityIndicator color={COLORS.pageAccent} size="small" />
        </View>
      ) : null}

      {locked ? (
        <View style={styles.lockout}>
          <Text style={[styles.lockoutText, { textAlign: align }]}>
            {t('Try again in {{seconds}}s…', { seconds: formatNumber(secondsLeft, lang) })}
          </Text>
          <Text style={[styles.lockoutReason, { textAlign: align }]}>
            {t('Too many wrong attempts.')}
          </Text>
        </View>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <Text style={[styles.hint, { textAlign: align }]}>
          {t('Ask your partner for the PIN.')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    backgroundColor: 'transparent',
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  badgeIcon: {
    fontSize: 26,
  },
  title: {
    color: COLORS.pageText,
    fontSize: 22,
    fontWeight: '700',
    alignSelf: 'stretch',
  },
  subtitle: {
    color: COLORS.pageMuted,
    fontSize: 14,
    marginTop: 6,
    marginBottom: 20,
    alignSelf: 'stretch',
    lineHeight: 20,
  },
  pad: {
    marginTop: 4,
  },
  busyRow: {
    marginTop: 8,
    height: 24,
    justifyContent: 'center',
  },
  error: {
    color: COLORS.pageError,
    fontSize: 14,
    marginTop: 8,
    fontWeight: '600',
  },
  hint: {
    color: COLORS.pageMuted,
    fontSize: 12,
    marginTop: 8,
  },
  lockout: {
    alignItems: 'center',
    marginTop: 6,
  },
  lockoutText: {
    color: COLORS.pageError,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  lockoutReason: {
    color: COLORS.pageMuted,
    fontSize: 12,
    marginTop: 4,
  },
});
