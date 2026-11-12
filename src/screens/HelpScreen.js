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
import { ActionButton, GiftNote, Section } from '../components/ui';
import { COLORS, textAlign } from '../theme';

const BACKGROUND = require('../../assets/background.jpg');

/**
 * Help screen (v1.3.0) — the five setup steps written in plain words, plus the
 * support note. English strings are the i18n keys (see src/i18n.js); the
 * numbers and the description are rendered separately so each step reads as a
 * card instead of a wall of text. Wording is the owner's copy — keep it exact.
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
    title: 'Strict Lock & Partner PIN',
    body:
      'Open Settings and set a Partner PIN. Give this PIN to your spouse or a trusted friend. ' +
      'The app will ask for it every time it opens; Settings and the Protection switch never ask for it.',
  },
  {
    title: 'Excluded Apps',
    body: 'Go to Settings to select apps (like Telegram or SMS) that should NOT be blocked.',
  },
];

export default function HelpScreen({ t, lang, onBack, onOpenSettings }) {
  const align = textAlign(lang);
  const isRtl = lang === 'fa';

  return (
    <ImageBackground source={BACKGROUND} style={styles.root} resizeMode="cover">
      <View style={styles.overlay} />
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.header, isRtl && styles.headerRtl]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Back')}
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <Text style={styles.backIcon}>{isRtl ? '›' : '‹'}</Text>
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

        <Section title={t('Support')} lang={lang}>
          <Text style={[styles.body, { textAlign: align }]}>
            {t(
              "If you wish to support the development of this app, you can use the 'Donate' button in Settings."
            )}
          </Text>
          <Text style={[styles.body, { textAlign: align }]}>
            {t('International supporters can use the Crypto Wallet option. Thank you!')}
          </Text>
          <ActionButton
            label={t('Open Settings')}
            variant="secondary"
            onPress={onOpenSettings}
          />
        </Section>

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
    color: COLORS.text,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.75,
  },
  intro: {
    color: COLORS.muted,
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
  noteWrap: {
    marginTop: 24,
  },
  version: {
    color: '#5A6779',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
});
