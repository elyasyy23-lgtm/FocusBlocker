import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../theme';

/**
 * Numeric keypad + PIN dots (v1.3.1).
 *
 * A custom keypad is used instead of a TextInput on purpose: no keyboard slides
 * over the layout, no IME suggestions, no autocorrect — and the same component
 * serves the lock screen and the "set a Partner PIN" dialog.
 */
const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['del', '0', 'ok'],
];

export default function PinPad({
  value,
  onChange,
  onComplete,
  maxLength = 8,
  disabled = false,
  okLabel = 'OK',
  showOk = true,
  align = 'left',
}) {
  const canDelete = value.length > 0;
  const canSubmit = value.length >= 4;

  const press = (key) => {
    if (disabled) return;
    if (key === 'del') {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === 'ok') {
      if (canSubmit && onComplete) onComplete();
      return;
    }
    if (value.length >= maxLength) return;
    const next = value + key;
    onChange(next);
  };

  const slots = Math.max(4, value.length);

  return (
    <View style={styles.wrap}>
      <View style={styles.dots}>
        {Array.from({ length: slots }).map((_, index) => (
          <View
            key={index}
            style={[styles.dot, index < value.length ? styles.dotOn : styles.dotOff]}
          />
        ))}
      </View>

      {KEYS.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((key) => {
            const isOk = key === 'ok';
            const isDelete = key === 'del';
            if (isOk && !showOk) {
              return <View key={key} style={styles.key} />;
            }
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={isDelete ? 'Delete' : isOk ? okLabel : key}
                disabled={disabled || (isOk && !canSubmit) || (isDelete && !canDelete)}
                onPress={() => press(key)}
                style={({ pressed }) => [
                  styles.keyBtn,
                  isOk && styles.keyOk,
                  (disabled || (isOk && !canSubmit) || (isDelete && !canDelete)) && styles.keyDisabled,
                  pressed && styles.keyPressed,
                ]}>
                {isDelete ? (
                  <Text style={styles.keyDelete}>⌫</Text>
                ) : isOk ? (
                  <Text style={styles.keyOkText}>{okLabel}</Text>
                ) : (
                  <Text style={styles.keyText}>{key}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 18,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dotOn: {
    backgroundColor: COLORS.accent,
  },
  dotOff: {
    backgroundColor: 'rgba(120,140,160,0.35)',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 10,
  },
  key: {
    width: 72,
    height: 56,
  },
  keyBtn: {
    width: 72,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  keyOk: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  keyDisabled: {
    opacity: 0.4,
  },
  keyPressed: {
    opacity: 0.7,
  },
  keyText: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '600',
  },
  keyDelete: {
    color: COLORS.text,
    fontSize: 20,
  },
  keyOkText: {
    color: COLORS.onAccent,
    fontSize: 14,
    fontWeight: '700',
  },
});
