import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS, textAlign } from '../theme';

/**
 * Shared presentation pieces for the main and the settings screen (v1.2.0).
 * They only receive already-translated strings — no i18n logic in here.
 */

export function Section({ title, subtitle, children, lang = 'en' }) {
  const align = textAlign(lang);
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { textAlign: align }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.sectionSubtitle, { textAlign: align }]}>{subtitle}</Text>
      ) : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

export function StatusPill({ active, labels }) {
  return (
    <View style={[styles.pill, active ? styles.pillOn : styles.pillOff]}>
      <View style={[styles.dot, active ? styles.dotOn : styles.dotOff]} />
      <Text style={[styles.pillText, active ? styles.pillTextOn : styles.pillTextOff]}>
        {active ? labels[0] : labels[1]}
      </Text>
    </View>
  );
}

export function ActionButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  busy = false,
  saved = false,
}) {
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
        <ActivityIndicator color={isSecondary ? COLORS.text : COLORS.onAccent} size="small" />
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

/** Small rounded tag used for the keyword/domain previews. */
export function Chip({ label, danger = false, lang = 'en' }) {
  return (
    <View style={[styles.chip, danger && styles.chipDanger]}>
      <Text
        style={[styles.chipText, danger && styles.chipTextDanger, { textAlign: textAlign(lang) }]}>
        {label}
      </Text>
    </View>
  );
}

/**
 * The highlighted note that carries the owner's message ("this app is free…").
 * Deliberately warm and quiet: one accent line, no shouting.
 */
export function GiftNote({ text, lang = 'en' }) {
  return (
    <View style={styles.gift}>
      <View style={styles.giftRule} />
      <Text style={[styles.giftText, { textAlign: textAlign(lang) }]}>{text}</Text>
    </View>
  );
}

export const uiStyles = StyleSheet.create({
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  muted: {
    color: COLORS.muted,
  },
});

const styles = StyleSheet.create({
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
    backgroundColor: 'rgba(51,34,42,0.92)',
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
    textAlign: 'center',
  },
  buttonTextPrimary: {
    color: COLORS.onAccent,
  },
  buttonTextSaved: {
    color: '#14532D',
  },
  buttonTextSecondary: {
    color: COLORS.text,
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
    backgroundColor: 'rgba(51,34,42,0.92)',
  },
  chipTextDanger: {
    color: COLORS.danger,
  },
  gift: {
    backgroundColor: 'rgba(18,53,35,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.35)',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 18,
  },
  giftRule: {
    width: 3,
    borderRadius: 3,
    backgroundColor: COLORS.accent,
    marginRight: 12,
  },
  giftText: {
    flex: 1,
    color: '#DCF3E4',
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
  },
});
