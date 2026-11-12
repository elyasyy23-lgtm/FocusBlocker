import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import PinPad from '../components/PinPad';
import { COLORS, textAlign } from '../theme';

/**
 * Full-screen gate shown every time the app comes back to the foreground while
 * a Partner PIN is set (v1.3.1).
 *
 * The gate is deliberately minimal: no Settings, no Help, no keyword list —
 * only the PIN field. The PIN never leaves the device: it is hashed in the
 * native module and compared there.
 */
export default function LockScreen({ t, lang, busy = false, error = null, onSubmit }) {
  const align = textAlign(lang);
  const [pin, setPin] = useState('');
  const [localError, setLocalError] = useState(null);

  const submit = async () => {
    if (pin.length < 4 || busy) return;
    setLocalError(null);
    const ok = await onSubmit(pin);
    if (!ok) {
      setLocalError(t('Wrong PIN. Try again.'));
      setPin('');
    }
  };

  const shownError = error || localError;

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
          onChange={(next) => {
            setLocalError(null);
            setPin(next);
          }}
          onComplete={submit}
          disabled={busy}
          okLabel={t('Unlock')}
        />
      </View>

      {busy ? (
        <View style={styles.busyRow}>
          <ActivityIndicator color={COLORS.accent} size="small" />
        </View>
      ) : null}

      {shownError ? (
        <Text style={styles.error}>{shownError}</Text>
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
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '700',
    alignSelf: 'stretch',
  },
  subtitle: {
    color: COLORS.muted,
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
    color: COLORS.danger,
    fontSize: 14,
    marginTop: 8,
    fontWeight: '600',
  },
  hint: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 8,
  },
});
