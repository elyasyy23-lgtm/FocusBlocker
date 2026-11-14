import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { COLORS, textAlign } from '../theme';
import { VERSION_LABEL } from '../buildInfo';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PANEL_WIDTH = Math.min(320, Math.round(SCREEN_WIDTH * 0.82));
const CLOSE_THRESHOLD = PANEL_WIDTH * 0.3;

/**
 * Side drawer (v1.4.5, Modal-based since v1.4.7) — one hamburger opens everything.
 *
 * Built on React Native's own `Animated` + `PanResponder`: no navigation
 * library, no reanimated, nothing that needs a fresh native build to compile.
 * It slides from the left in English and from the right in Persian (the same
 * side as the hamburger), over a dimming backdrop. Tap the backdrop, swipe the
 * panel back, or pick an item to close it.
 *
 * v1.4.7: rendered inside a transparent `Modal`. The previous sibling-View
 * overlay could lose the tap on some Android devices, so the hamburger looked
 * dead; a Modal always sits in its own window above the screen.
 *
 * Settings is CLOSED while Protection is ON: its row shows a lock and tapping
 * it reports the reason (`onBlockedSettings`) instead of navigating.
 */
export default function Drawer({
  open,
  onClose,
  t,
  lang,
  currentScreen,
  settingsLocked,
  onNavigate,
  onBlockedSettings,
  onShare,
  onContact,
  onSupport,
}) {
  const isRtl = lang === 'fa';
  const align = textAlign(lang);

  // v1.4.7: the drawer lives inside a native Modal. The v1.4.5 overlay was a
  // sibling View with zIndex, and on some Android builds the backdrop/scroll
  // ancestor kept the touch, so tapping ☰ appeared to do nothing. A Modal is
  // its own window: always on top, always receives taps — and the hardware
  // Back button closes it through onRequestClose.
  const [mounted, setMounted] = useState(false);

  // Closed position: off-screen to the side the panel lives on.
  const closedX = isRtl ? PANEL_WIDTH : -PANEL_WIDTH;
  const translateX = useRef(new Animated.Value(closedX)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  // PanResponder is created once, so it reads live values through refs.
  const rtlRef = useRef(isRtl);
  const closeRef = useRef(onClose);
  rtlRef.current = isRtl;
  closeRef.current = onClose;

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useEffect(() => {
    if (!mounted) return undefined;
    const animation = Animated.parallel([
      Animated.timing(translateX, {
        toValue: open ? 0 : closedX,
        duration: open ? 220 : 180,
        useNativeDriver: true,
      }),
      Animated.timing(backdrop, {
        toValue: open ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]);
    animation.start(({ finished }) => {
      // Keep the Modal mounted until the slide-out finishes, then drop it.
      if (finished && !open) setMounted(false);
    });
    return () => animation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, closedX, mounted]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => {
        if (rtlRef.current) {
          if (g.dx > 0) translateX.setValue(g.dx);
        } else if (g.dx < 0) {
          translateX.setValue(g.dx);
        }
      },
      onPanResponderRelease: (_, g) => {
        const wantsClose = rtlRef.current ? g.dx > CLOSE_THRESHOLD : g.dx < -CLOSE_THRESHOLD;
        if (wantsClose) {
          closeRef.current();
        } else {
          Animated.timing(translateX, {
            toValue: 0,
            duration: 160,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const routes = [
    { name: 'main', label: t('Home'), glyph: '⌂' },
    { name: 'settings', label: t('Settings'), glyph: '⚙', locked: settingsLocked },
    { name: 'help', label: t('Help'), glyph: '?' },
  ];

  const actions = [
    { key: 'share', label: t('Share App'), glyph: '↗', onPress: onShare },
    { key: 'contact', label: t('Contact Developer'), glyph: '✉', onPress: onContact },
    { key: 'support', label: t('Support Us'), glyph: '♥', onPress: onSupport },
  ];

  const renderRow = ({ key, label, glyph, locked, active, onPress }) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(active), disabled: Boolean(locked) }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        isRtl && styles.rowRtl,
        active && styles.rowActive,
        pressed && styles.pressed,
      ]}>
      <View style={[styles.glyph, active && styles.glyphActive]}>
        <Text
          style={[
            styles.glyphText,
            active && styles.glyphTextActive,
            locked && styles.glyphTextLocked,
          ]}>
          {locked ? '🔒' : glyph}
        </Text>
      </View>
      <Text
        style={[
          styles.rowLabel,
          { textAlign: align },
          active && styles.rowLabelActive,
          locked && styles.rowLabelLocked,
        ]}>
        {label}
      </Text>
    </Pressable>
  );

  const pickRoute = (route) => {
    onClose();
    if (route.locked) {
      if (onBlockedSettings) onBlockedSettings();
      return;
    }
    onNavigate(route.name);
  };

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View style={styles.host}>
        <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Close')}
            style={StyleSheet.absoluteFill}
            onPress={onClose}
          />
        </Animated.View>

        <Animated.View
          {...pan.panHandlers}
          style={[
            styles.panel,
            isRtl ? styles.panelRight : styles.panelLeft,
            { transform: [{ translateX }] },
          ]}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={[styles.brandRow, isRtl && styles.rowRtl]}>
              <View style={styles.brandMark}>
                <Text style={styles.brandMarkText}>T</Text>
              </View>
              <View style={styles.brandText}>
                <Text style={[styles.brand, { textAlign: align }]}>{t('Tavakkol')}</Text>
                <Text style={[styles.brandSub, { textAlign: align }]}>{t('Personal guard')}</Text>
              </View>
            </View>

            <View style={styles.group}>
              {routes.map((route) =>
                renderRow({
                  key: route.name,
                  label: route.label,
                  glyph: route.glyph,
                  locked: route.locked,
                  active: currentScreen === route.name,
                  onPress: () => pickRoute(route),
                })
              )}
            </View>

            <View style={styles.divider} />

            <View style={styles.group}>
              {actions.map((action) =>
                renderRow({
                  key: action.key,
                  label: action.label,
                  glyph: action.glyph,
                  active: false,
                  onPress: () => {
                    onClose();
                    if (action.onPress) action.onPress();
                  },
                })
              )}
            </View>

            <Text style={[styles.version, { textAlign: align }]}>{VERSION_LABEL}</Text>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3,6,10,0.62)',
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: PANEL_WIDTH,
    backgroundColor: '#0C1218',
    borderColor: COLORS.border,
  },
  panelLeft: {
    left: 0,
    borderRightWidth: 1,
  },
  panelRight: {
    right: 0,
    borderLeftWidth: 1,
  },
  content: {
    paddingTop: 56,
    paddingBottom: 32,
    paddingHorizontal: 16,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginBottom: 22,
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  brandMark: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  brandMarkText: {
    color: COLORS.accent,
    fontSize: 22,
    fontWeight: '800',
  },
  brandText: {
    flex: 1,
    paddingHorizontal: 12,
  },
  brand: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '700',
  },
  brandSub: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  group: {
    gap: 6,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 14,
    marginHorizontal: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    gap: 12,
  },
  rowActive: {
    backgroundColor: COLORS.accentSoft,
  },
  glyph: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  glyphActive: {
    backgroundColor: 'rgba(18,53,35,0.95)',
    borderColor: COLORS.accent,
  },
  glyphText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  glyphTextActive: {
    color: COLORS.accent,
  },
  glyphTextLocked: {
    fontSize: 13,
  },
  rowLabel: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  rowLabelActive: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  rowLabelLocked: {
    color: COLORS.muted,
  },
  pressed: {
    opacity: 0.7,
  },
  version: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 26,
    paddingHorizontal: 6,
  },
});
