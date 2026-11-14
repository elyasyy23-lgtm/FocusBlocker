import React from 'react';
import {
  ImageBackground,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ActionButton, Chip, GiftNote, Section } from '../components/ui';
import DebugLogSection from '../components/DebugLogSection';
import { COLORS, textAlign } from '../theme';
import { VERSION_LABEL } from '../buildInfo';

const BACKGROUND = require('../../assets/background.jpg');

/**
 * Home screen (v1.4.5) — the clean, everyday face of Tavakkol.
 *
 * It shows ONLY what the user needs at a glance:
 *   - the two switches (Protection + Delay Mode),
 *   - the blocked keyword list and the blocked domain list,
 *   - the debug log at the very bottom (v1.4.7 — it was in Settings before).
 *
 * Everything else advanced (accessibility service, device admin, keep-alive,
 * stats, PIN, remote control, excluded apps) lives in Settings, which is reached
 * from the drawer — there is no gear in the header any more (v1.4.7). While
 * Protection is ON the two editors are locked (read-only) and Settings is closed
 * entirely — that is the v1.4.5 rule.
 */
export default function HomeScreen({
  t,
  lang,
  isAvailable,
  config,
  keywordsText,
  onChangeKeywords,
  domainsText,
  onChangeDomains,
  keywordsPreview,
  domainsPreview,
  keywordsSaved,
  domainsSaved,
  saving,
  savingDomains,
  toggling,
  message,
  blockingReady,
  readOnly,
  onSaveKeywords,
  onSaveDomains,
  onToggleBlocking,
  onToggleDelayMode,
  onOpenDrawer,
  onMessage,
}) {
  const align = textAlign(lang);
  const isRtl = lang === 'fa';

  return (
    <ImageBackground source={BACKGROUND} style={styles.root} resizeMode="cover">
      <View style={styles.overlay} />
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.pageBackground} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={[styles.brandRow, isRtl && styles.brandRowRtl]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Menu')}
            onPress={onOpenDrawer}
            style={({ pressed }) => [styles.hamburger, pressed && styles.pressed]}>
            <Text style={styles.hamburgerIcon}>☰</Text>
          </Pressable>
          <View style={styles.brandText}>
            <Text style={[styles.brand, { textAlign: align }]}>{t('Tavakkol')}</Text>
            <Text style={[styles.brandSub, { textAlign: align }]}>{t('Personal guard')}</Text>
          </View>
        </View>

        <Text style={[styles.tagline, { textAlign: align }]}>
          {t(
            'A guard for your own phone. It watches text as it changes on screen — a blocked keyword or domain in a search bar, address bar or chat closes the app immediately.'
          )}
        </Text>

        <GiftNote
          lang={lang}
          text={t('This app is completely free. Please remember us in your prayers.')}
        />

        {!isAvailable ? (
          <View style={styles.warningBox}>
            <Text style={[styles.warningTitle, { textAlign: align }]}>
              {t('Native build required')}
            </Text>
            <Text style={[styles.warningText, { textAlign: align }]}>
              {t(
                'Expo Go cannot run accessibility services. Build the APK (eas build -p android --profile preview) and install it — every control below works there.'
              )}
            </Text>
          </View>
        ) : null}

        <View style={styles.heroCard}>
          <Text style={[styles.heroLabel, { textAlign: align }]}>{t('Protection')}</Text>
          <Text
            style={[
              styles.heroState,
              blockingReady ? styles.heroOn : styles.heroOff,
              { textAlign: align },
            ]}>
            {blockingReady ? t('Active') : t('Not active yet')}
          </Text>
          <Text style={[styles.heroHint, { textAlign: align }]}>
            {config.enabled
              ? t('{{keywords}} keyword(s) + {{domains}} domain(s) watched', {
                  keywords: config.keywords.length,
                  domains: config.domains.length,
                })
              : t('Blocker paused')}
            {' · '}
            {t('{{count}} block(s) so far', { count: config.blockCount })}
          </Text>
          <View style={[styles.switchGrid, isRtl && styles.switchGridRtl]}>
            <View style={styles.switchCell}>
              <Text style={[styles.switchTitle, { textAlign: align }]}>{t('Protection')}</Text>
              <Text style={[styles.switchHint, { textAlign: align }]}>
                {config.accessibilityEnabled
                  ? t('Accessibility service is running')
                  : t('Service is off — enable it in Settings')}
              </Text>
              <View style={styles.switchControl}>
                <Switch
                  value={config.enabled}
                  onValueChange={onToggleBlocking}
                  disabled={toggling || !isAvailable}
                  trackColor={{ false: COLORS.border, true: COLORS.accentSoft }}
                  thumbColor={config.enabled ? COLORS.accent : '#5A6779'}
                />
              </View>
            </View>

            <View style={styles.switchCell}>
              <Text style={[styles.switchTitle, { textAlign: align }]}>{t('Delay Mode')}</Text>
              <Text style={[styles.switchHint, { textAlign: align }]}>
                {config.delayMode
                  ? t('On — Protection can only be turned off by typing the full text')
                  : t('Off — Protection turns off with one tap')}
              </Text>
              <View style={styles.switchControl}>
                <Switch
                  value={config.delayMode}
                  onValueChange={onToggleDelayMode}
                  disabled={!isAvailable}
                  trackColor={{ false: COLORS.border, true: COLORS.accentSoft }}
                  thumbColor={config.delayMode ? COLORS.accent : '#5A6779'}
                />
              </View>
            </View>
          </View>
          {config.adultLock ? (
            <Text style={[styles.heroHint, styles.adultOn, { textAlign: align }]}>
              {t(
                'Adult content lock is on — {{keywords}} built-in keywords and {{domains}} websites are blocked too',
                {
                  keywords: config.adultKeywordCount || 0,
                  domains: config.adultDomainCount || 0,
                }
              )}
            </Text>
          ) : null}
        </View>

        {readOnly ? (
          <View style={styles.lockedBox}>
            <Text style={[styles.lockedText, { textAlign: align }]}>
              {t('Protection is on — turn it off to edit the lists and open Settings.')}
            </Text>
          </View>
        ) : null}

        <Section
          lang={lang}
          title={t('{{n}}. {{title}}', { n: 1, title: t('Blocked keywords') })}
          subtitle={t(
            'Any text that changes on screen is checked — search bars, the browser address bar and chat messages (Telegram, Rubika). Separate keywords with a comma. Matching is whole-word only, so a short word never fires inside a longer one.'
          )}>
          <TextInput
            value={keywordsText}
            onChangeText={onChangeKeywords}
            editable={!readOnly}
            placeholder="sex, porn, casino"
            placeholderTextColor="#5A6779"
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            style={[styles.input, readOnly && styles.inputLocked, { textAlign: align }]}
          />
          <View style={styles.chipRow}>
            {keywordsPreview.length === 0 ? (
              <Text style={styles.emptyHint}>
                {t('No keywords yet — nothing will be blocked.')}
              </Text>
            ) : (
              keywordsPreview.map((keyword) => (
                <Chip key={keyword} label={keyword} lang={lang} />
              ))
            )}
          </View>
          <ActionButton
            label={t('Save block list')}
            onPress={onSaveKeywords}
            busy={saving}
            saved={keywordsSaved}
            disabled={!isAvailable || readOnly}
          />
        </Section>

        <Section
          lang={lang}
          title={t('{{n}}. {{title}}', { n: 2, title: t('Blocked domains') })}
          subtitle={t(
            'The guard reads the address bar of Chrome and other browsers. http://, https://, www. and paths are removed automatically — just type the domain.'
          )}>
          <TextInput
            value={domainsText}
            onChangeText={onChangeDomains}
            editable={!readOnly}
            placeholder="facebook.com, instagram.com"
            placeholderTextColor="#5A6779"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            multiline
            style={[styles.input, readOnly && styles.inputLocked, { textAlign: align }]}
          />
          <View style={styles.chipRow}>
            {domainsPreview.length === 0 ? (
              <Text style={styles.emptyHint}>
                {t('No domains yet — the browser stays open.')}
              </Text>
            ) : (
              domainsPreview.map((domain) => (
                <Chip key={domain} label={domain} danger lang={lang} />
              ))
            )}
          </View>
          <ActionButton
            label={t('Save domain list')}
            onPress={onSaveDomains}
            busy={savingDomains}
            saved={domainsSaved}
            disabled={!isAvailable || readOnly}
          />
        </Section>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        {/* v1.4.7: the debug log moved here from Settings — visible, but at the
            very bottom so it never gets in the way of the everyday screen. */}
        <DebugLogSection
          t={t}
          lang={lang}
          isAvailable={isAvailable}
          onMessage={onMessage}
          number={3}
        />

        <Text style={[styles.footer, { textAlign: align }]}>
          {t(
            'Works fully offline. Any text that changes on screen is checked — search bars, address bars and chat messages. While the guard is running it keeps a small persistent notification: if that notification disappears, the guard was stopped. The watchdog, the 15-minute alarm, the 15-minute job and the boot receiver restart it on their own — and if the guard stays down for more than three minutes you get an alert instead of silently losing protection.'
          )}
        </Text>
        <Text style={styles.versionText}>{VERSION_LABEL}</Text>
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
    paddingTop: (StatusBar.currentHeight || 24) + 20,
    paddingBottom: 48,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandRowRtl: {
    flexDirection: 'row-reverse',
  },
  hamburger: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  hamburgerIcon: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 26,
  },
  brandText: {
    flex: 1,
    paddingHorizontal: 12,
  },
  brand: {
    color: COLORS.pageText,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  brandSub: {
    color: COLORS.pageAccent,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  pressed: {
    opacity: 0.75,
  },
  tagline: {
    color: COLORS.pageMuted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
    marginBottom: 18,
  },
  warningBox: {
    backgroundColor: 'rgba(58,44,8,0.92)',
    borderColor: '#6B5110',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  warningTitle: {
    color: COLORS.warning,
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 4,
  },
  warningText: {
    color: '#EAD9A6',
    fontSize: 13,
    lineHeight: 19,
  },
  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
  },
  heroLabel: {
    color: COLORS.muted,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroState: {
    fontSize: 26,
    fontWeight: '700',
    marginTop: 6,
  },
  heroOn: {
    color: COLORS.accent,
  },
  heroOff: {
    color: COLORS.text,
  },
  adultOn: {
    color: COLORS.pageAccent,
    fontWeight: '600',
  },

  heroHint: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 6,
  },
  switchGrid: {
    flexDirection: 'row',
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 14,
  },
  switchGridRtl: {
    flexDirection: 'row-reverse',
  },
  switchCell: {
    flex: 1,
  },
  switchControl: {
    flexDirection: 'row',
    marginTop: 10,
  },
  switchTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  switchHint: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 3,
  },
  lockedBox: {
    marginTop: 16,
    backgroundColor: 'rgba(58,44,8,0.9)',
    borderColor: '#6B5110',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  lockedText: {
    color: '#EAD9A6',
    fontSize: 13,
    lineHeight: 19,
  },
  input: {
    color: COLORS.text,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 56,
    fontSize: 15,
  },
  inputLocked: {
    opacity: 0.6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  emptyHint: {
    color: COLORS.muted,
    fontSize: 12,
  },
  message: {
    color: COLORS.pageWarning,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 20,
    textAlign: 'center',
  },
  footer: {
    color: COLORS.pageMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 28,
  },
  versionText: {
    color: '#475569',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 14,
  },
});
