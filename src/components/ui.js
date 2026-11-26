import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  COLORS,
  RADIUS,
  SHADOW_BUTTON,
  SHADOW_CARD,
  SHADOW_SOFT,
  SPACE,
  textAlign,
} from '../theme';

/**
 * Shared presentation pieces for the main and the settings screen (v1.2.0).
 * They only receive already-translated strings — no i18n logic in here.
 */

export function Section({ title, subtitle, children, lang = 'en' }) {
  const align = textAlign(lang);
  const rtl = lang === 'fa';
  return (
    <View style={styles.section}>
      <View style={[styles.sectionHead, rtl && styles.sectionHeadRtl]}>
        <View style={styles.sectionRule} />
        <Text style={[styles.sectionTitle, { textAlign: align }]}>{title}</Text>
      </View>
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

/**
 * Main action button.
 *
 * `saved` (v1.3.2) is three-state on purpose:
 *   undefined — a normal primary button (accent),
 *   false     — there are unsaved edits: white, so it stands out as "tap me",
 *   true      — the value is stored: green, and it stays green until the editor
 *               text changes again (the caller derives that from the stored list).
 */
export function ActionButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  busy = false,
  saved,
}) {
  const isSecondary = variant === 'secondary';
  const isSaved = saved === true;
  const isPending = saved === false;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        isSecondary
          ? styles.buttonSecondary
          : isSaved
          ? styles.buttonSaved
          : isPending
          ? styles.buttonPending
          : styles.buttonPrimary,
        (disabled || busy) && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}>
      {busy ? (
        <ActivityIndicator
          color={isSecondary ? COLORS.text : isSaved ? COLORS.successText : COLORS.onAccent}
          size="small"
        />
      ) : (
        <Text
          style={[
            styles.buttonText,
            isSecondary
              ? styles.buttonTextSecondary
              : isSaved
              ? styles.buttonTextSaved
              : isPending
              ? styles.buttonTextPending
              : styles.buttonTextPrimary,
          ]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/**
 * Small rounded tag used for the keyword/domain previews.
 * Pass onRemove + removeLabel for removable tags; the component has no i18n logic.
 */
export function Chip({ label, danger = false, lang = 'en', onRemove, removeLabel }) {
  return (
    <View
      style={[
        styles.chip,
        danger && styles.chipDanger,
        lang === 'fa' && styles.chipRtl,
        onRemove && styles.chipRemovable,
      ]}>
      <Text
        style={[
          styles.chipText,
          danger && styles.chipTextDanger,
          onRemove && styles.chipTextRemovable,
          { textAlign: textAlign(lang) },
        ]}>
        {label}
      </Text>
      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={removeLabel || label}
          hitSlop={10}
          onPress={onRemove}
          style={({ pressed }) => [styles.chipRemove, pressed && styles.chipRemovePressed]}>
          <Text
            importantForAccessibility="no"
            style={[styles.chipRemoveText, danger && styles.chipRemoveTextDanger]}>
            ×
          </Text>
        </Pressable>
      ) : null}
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
    marginTop: SPACE.xl,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionHeadRtl: {
    flexDirection: 'row-reverse',
  },
  /** Short accent bar that anchors every section title. */
  sectionRule: {
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: COLORS.pageAccent,
  },
  sectionTitle: {
    flexShrink: 1,
    color: COLORS.pageText,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    color: COLORS.pageMuted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: SPACE.xs,
  },
  sectionBody: {
    marginTop: SPACE.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACE.lg,
    ...SHADOW_CARD,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    paddingHorizontal: SPACE.sm,
    paddingVertical: 5,
  },
  pillOn: {
    backgroundColor: COLORS.accentGlow,
    borderColor: 'rgba(74,222,128,0.34)',
  },
  pillOff: {
    backgroundColor: COLORS.dangerGlow,
    borderColor: 'rgba(248,113,113,0.32)',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: RADIUS.pill,
    marginRight: SPACE.xs,
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
    marginTop: SPACE.xs,
    minHeight: 50,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACE.lg,
  },
  buttonPrimary: {
    backgroundColor: COLORS.accent,
    ...SHADOW_BUTTON,
  },
  /** Stored — green until the editor text changes again. */
  buttonSaved: {
    backgroundColor: COLORS.success,
    ...SHADOW_SOFT,
  },
  /** Edited but not saved yet — white, the owner's requested "needs saving" look. */
  buttonPending: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW_SOFT,
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
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  buttonTextPrimary: {
    color: COLORS.onAccent,
  },
  buttonTextSaved: {
    color: COLORS.successText,
  },
  buttonTextPending: {
    color: '#0B1420',
  },
  buttonTextSecondary: {
    color: COLORS.text,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
    maxWidth: '100%',
    backgroundColor: COLORS.accentSoft,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.22)',
    paddingHorizontal: SPACE.sm,
    paddingVertical: 5,
  },
  chipRtl: {
    flexDirection: 'row-reverse',
  },
  chipRemovable: {
    paddingHorizontal: 8,
  },
  chipText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextRemovable: {
    flexShrink: 1,
  },
  chipDanger: {
    backgroundColor: COLORS.dangerGlow,
    borderColor: 'rgba(248,113,113,0.26)',
  },
  chipTextDanger: {
    color: COLORS.danger,
  },
  chipRemove: {
    width: 24,
    height: 24,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRemovePressed: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  chipRemoveText: {
    color: COLORS.accent,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center',
  },
  chipRemoveTextDanger: {
    color: COLORS.danger,
  },
  gift: {
    backgroundColor: 'rgba(18,53,35,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.30)',
    borderRadius: RADIUS.lg,
    padding: SPACE.md,
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: SPACE.lg,
    ...SHADOW_SOFT,
  },
  giftRule: {
    width: 3,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.accent,
    marginRight: SPACE.sm,
  },
  giftText: {
    flex: 1,
    color: '#DCF3E4',
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
  },
});
