import React from 'react';
import {
  ImageBackground,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GiftNote } from '../components/ui';
import { COLORS, textAlign } from '../theme';

const BACKGROUND = require('../../assets/background.jpg');

/**
 * Help screen (v1.3.0) — the setup steps written in plain words, plus the
 * prayer note. English strings are the i18n keys (see src/i18n.js); the
 * numbers and the description are rendered separately so each step reads as a
 * card instead of a wall of text. Wording is the owner's copy — keep it exact.
 *
 * v1.4.0: the "Support" block at the bottom is GONE (owner request) — support
 * lives only in Settings now, so this screen teaches and nothing else.
 * v1.4.7: the steps now cover the real feature set — Delay Mode, Remote
 * Control via SMS, Excluded Apps and the Settings lock while Protection is on —
 * and a download/update note (turn the VPN on) sits at the very bottom.
 */
const STEPS = [
  {
    title: 'Set Keywords & Domains',
    body:
      'Add the words and websites you want to block in the main screen and tap Save.',
  },
  {
    title: 'Enable Accessibility',
    body: "Tap 'Open Accessibility Settings' and turn on the 'Tavakkol guard' service.",
  },
  {
    title: 'Activate Device Admin',
    body:
      "Tap 'Activate Device Admin'. This prevents the app from being uninstalled easily.",
  },
  {
    title: 'Delay Mode',
    body:
      'Turn on Delay Mode next to Protection on the main screen. From then on, turning Protection off — or turning Delay Mode itself off — needs typing a long protective text word by word. Paste is blocked and closing the window changes nothing, so a sudden impulse cannot disable the guard with one tap.',
  },
  {
    title: 'Remote Control via SMS',
    body:
      'Open Settings → Remote Control, turn on Enable Remote Deactivation, enter a trusted phone number and a secret command (for example: TURN OFF), then save and allow SMS access. The partner phone sends one SMS containing the command and Protection turns off by itself. Each message is used only once, and SMS that arrived before you turned the switch on are ignored.',
  },
  {
    title: 'Excluded Apps',
    body:
      'Open Settings → Excluded Apps and tick the apps that must never be blocked (for example Telegram or your SMS app). Checked apps are not inspected at all, so no keyword and no domain is blocked inside them.',
  },
  {
    title: 'Settings Lock & Partner PIN',
    body:
      'While Protection is on, Settings stays closed: the drawer explains why and the lists on the main screen are read-only. Set a Partner PIN in Settings and give it to your spouse or a trusted friend — the app asks for it only when it opens, never inside the app.',
  },
];

export default function HelpScreen({ t, lang, onOpenDrawer }) {
  const align = textAlign(lang);
  const isRtl = lang === 'fa';

  return (
    <ImageBackground source={BACKGROUND} style={styles.root} resizeMode="cover">
      <View style={styles.overlay} />
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.pageBackground} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.header, isRtl && styles.headerRtl]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Menu')}
            onPress={onOpenDrawer}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <Text style={styles.backIcon}>☰</Text>
          </Pressable>
          <View style={styles.headerText}>
            <Text style={[styles.title, { textAlign: align }]}>{t('Help')}</Text>
            <Text style={[styles.subtitle, { textAlign: align }]}>{t('How to use Tavakkol')}</Text>
          </View>
        </View>

        <Text style={[styles.intro, { textAlign: align }]}>
          {t('Welcome to Tavakkol. Here is how to protect yourself:')}
        </Text>

        {STEPS.map((step, index) => (
          <View key={step.title} style={styles.step}>
            <View style={[styles.stepHeader, isRtl && styles.headerRtl]}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <Text style={[styles.stepTitle, { textAlign: align }, isRtl && styles.stepTitleRtl]}>
                {t(step.title)}
              </Text>
            </View>
            <Text style={[styles.stepBody, { textAlign: align }]}>{t(step.body)}</Text>
          </View>
        ))}

        {/* v1.4.7: download/update note — the owner asked for this wording in
            both languages, because an update can look "broken" when it is the
            network that is filtered. */}
        <View style={styles.vpnNote}>
          <Text style={[styles.vpnTitle, { textAlign: align }]}>
            {t('Download or update problem?')}
          </Text>
          <Text style={[styles.vpnText, { textAlign: align }]}>
            {t('If you encounter issues downloading or updating the app, please turn on your VPN.')}
          </Text>
        </View>

        <View style={styles.noteWrap}>
          <GiftNote lang={lang} text={t('This app is completely free. Please remember us in your prayers.')} />
        </View>

        <Text style={styles.version}>{t('Tavakkol')}</Text>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlay,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: (StatusBar.currentHeight || 24) + 14,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerRtl: {
    flexDirection: 'row-reverse',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backIcon: {
    color: COLORS.text,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
  },
  headerText: {
    flex: 1,
    paddingHorizontal: 12,
  },
  title: {
    color: COLORS.pageText,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: COLORS.pageMuted,
    fontSize: 13,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.75,
  },
  intro: {
    color: COLORS.pageMuted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
    marginBottom: 4,
  },
  step: {
    marginTop: 14,
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  stepNumberText: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  stepTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  stepTitleRtl: {
    marginRight: 8,
  },
  stepBody: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  body: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 10,
  },
  vpnNote: {
    marginTop: 20,
    backgroundColor: 'rgba(58,44,8,0.92)',
    borderColor: '#6B5110',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  vpnTitle: {
    color: COLORS.warning,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  vpnText: {
    color: '#EAD9A6',
    fontSize: 13,
    lineHeight: 20,
  },
  noteWrap: {
    marginTop: 24,
  },
  version: {
    color: COLORS.pageMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
});
