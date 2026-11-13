import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import PinPad from '../components/PinPad';
import { COLORS, textAlign } from '../theme';

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
 */
const PIN_MIN_LENGTH = 4;
const PIN_MAX_LENGTH = 8;
const WRONG_PIN_DELAY_MS = 700;

export default function LockScreen({ t, lang, busy = false, onSubmit }) {
  const align = textAlign(lang);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);
  const errorTimer = useRef(null);
  const inFlight = useRef(false);

  useEffect(
    () => () => {
      if (errorTimer.current) clearTimeout(errorTimer.current);
    },
    []
  );

  const showWrongPin = () => {
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = null;
    setError(t('Wrong PIN. Try again.'));
    setPin('');
  };

  const attempt = async (value) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setChecking(true);
    try {
      const ok = await onSubmit(value);
      if (ok) {
        if (errorTimer.current) clearTimeout(errorTimer.current);
        errorTimer.current = null;
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
          disabled={busy || checking}
          showOk={false}
        />
      </View>

      {busy || checking ? (
        <View style={styles.busyRow}>
          <ActivityIndicator color={COLORS.pageAccent} size="small" />
        </View>
      ) : null}

      {error ? (
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
});
