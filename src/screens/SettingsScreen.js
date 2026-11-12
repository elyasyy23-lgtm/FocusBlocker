import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as FocusGuard from '../../modules/focus-guard';
import { ActionButton, Section } from '../components/ui';
import { COLORS, textAlign } from '../theme';
import { LANGUAGES } from '../i18n';
import { VERSION_LABEL } from '../buildInfo';
import { DEVELOPER_RUBIKA_SCHEME, DEVELOPER_RUBIKA_URL } from '../defaults';

const BACKGROUND = require('../../assets/background.jpg');

/**
 * Settings screen (v1.2.0) — opened with the gear on the main screen.
 *
 * Three jobs, all of them in this file:
 *  1. language switch (English / Persian) — the choice lives in native prefs so
 *     the accessibility service and the notifications follow it too;
 *  2. Excluded Apps — every launchable app with a checkbox; a checked app is
 *     never inspected by the guard (the package list is passed to Kotlin);
 *  3. the support block: Share App, Contact Developer and the owner's message.
 */
export default function SettingsScreen({
  t,
  lang,
  onBack,
  onChangeLanguage,
  excluded,
  onToggleExcluded,
  onClearExcluded,
  isAvailable,
  onMessage,
  message,
}) {
  const align = textAlign(lang);
  const [apps, setApps] = useState([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [query, setQuery] = useState('');
  const [busyPkg, setBusyPkg] = useState(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await FocusGuard.getInstalledApps();
      if (!alive) return;
      setApps(list);
      setLoadingApps(false);
      if (isAvailable && list.length === 0) {
        onMessage(t('Could not load the app list.'));
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAvailable]);

  const excludedSet = useMemo(() => new Set(excluded), [excluded]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return apps;
    return apps.filter(
      (app) =>
        app.label.toLowerCase().includes(needle) || app.pkg.toLowerCase().includes(needle)
    );
  }, [apps, query]);

  const toggleApp = useCallback(
    async (pkg) => {
      if (busyPkg) return;
      setBusyPkg(pkg);
      try {
        await onToggleExcluded(pkg);
      } finally {
        setBusyPkg(null);
      }
    },
    [busyPkg, onToggleExcluded]
  );

  const shareApp = useCallback(async () => {
    setSharing(true);
    try {
      await Share.share({
        message: `${t(
          'Tavakkol — a free guard for your phone. Blocked words and sites close themselves while you type.'
        )}\n\n${t('Tavakkol')} v${VERSION_LABEL}\nhttps://github.com/elyasyy23-lgtm/FocusBlocker/releases/latest`,
      });
    } catch (error) {
      onMessage(t('Could not open the share sheet.'));
    } finally {
      setSharing(false);
    }
  }, [onMessage, t]);

  const contactDeveloper = useCallback(async () => {
    // Rubika's own scheme first, then the plain web link (works even without
    // the app installed, because rubika.ir answers in a browser).
    const opened = (await FocusGuard.openUrl(DEVELOPER_RUBIKA_SCHEME)) ||
      (await FocusGuard.openUrl(DEVELOPER_RUBIKA_URL));
    if (!opened) {
      try {
        await Linking.openURL(DEVELOPER_RUBIKA_URL);
      } catch (error) {
        onMessage(t('Could not open the link.'));
      }
    }
  }, [onMessage, t]);

  return (
    <ImageBackground source={BACKGROUND} style={styles.root} resizeMode="cover">
      <View style={styles.overlay} />
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={[styles.header, lang === 'fa' && styles.headerRtl]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Back')}
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <Text style={styles.backIcon}>{lang === 'fa' ? '›' : '‹'}</Text>
          </Pressable>
          <View style={styles.headerText}>
            <Text style={[styles.title, { textAlign: align }]}>{t('Settings')}</Text>
            <Text style={[styles.subtitle, { textAlign: align }]}>{t('Tavakkol')}</Text>
          </View>
        </View>

        <Section
          title={t('Language')}
          subtitle={t('Choose the language of the app.')}
          lang={lang}>
          <View style={styles.langRow}>
            {LANGUAGES.map((option) => {
              const active = option.code === lang;
              return (
                <Pressable
                  key={option.code}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => onChangeLanguage(option.code)}
                  style={({ pressed }) => [
                    styles.langOption,
                    active && styles.langOptionActive,
                    pressed && styles.pressed,
                  ]}>
                  <Text
                    style={[
                      styles.langText,
                      active && styles.langTextActive,
                      { textAlign: 'center' },
                    ]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section
          title={t('Excluded Apps')}
          subtitle={t('Checked apps are never inspected — no keyword or domain block inside them.')}
          lang={lang}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('Search apps')}
            placeholderTextColor="#5A6779"
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, { textAlign: align }]}
          />

          <View style={[styles.excludedMeta, lang === 'fa' && styles.headerRtl]}>
            <Text style={styles.excludedCount}>
              {t('{{count}} selected', { count: excluded.length })}
            </Text>
            {excluded.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={onClearExcluded}
                style={({ pressed }) => [pressed && styles.pressed]}>
                <Text style={styles.clearLink}>{t('Clear selection')}</Text>
              </Pressable>
            ) : null}
          </View>

          {loadingApps ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={COLORS.accent} size="small" />
              <Text style={styles.loadingText}>{t('Loading apps…')}</Text>
            </View>
          ) : filtered.length === 0 ? (
            <Text style={styles.emptyText}>{t('No app matches this search.')}</Text>
          ) : (
            filtered.map((app) => {
              const checked = excludedSet.has(app.pkg);
              const busy = busyPkg === app.pkg;
              return (
                <Pressable
                  key={app.pkg}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  accessibilityLabel={app.label}
                  onPress={() => toggleApp(app.pkg)}
                  style={({ pressed }) => [
                    styles.appRow,
                    checked && styles.appRowChecked,
                    lang === 'fa' && styles.headerRtl,
                    pressed && styles.pressed,
                  ]}>
                  <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                    {busy ? (
                      <ActivityIndicator color={COLORS.onAccent} size="small" />
                    ) : checked ? (
                      <Text style={styles.checkmark}>✓</Text>
                    ) : null}
                  </View>
                  <View style={styles.appInfo}>
                    <Text style={[styles.appLabel, { textAlign: align }]} numberOfLines={1}>
                      {app.label}
                    </Text>
                    <Text style={[styles.appPkg, { textAlign: align }]} numberOfLines={1}>
                      {app.pkg}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          )}

          <Text style={[styles.hint, { textAlign: align }]}>
            {t('Excluded apps are saved instantly.')}
          </Text>
        </Section>

        <Section title={t('Support')} lang={lang}>
          <ActionButton label={t('Share App')} onPress={shareApp} busy={sharing} />
          <ActionButton
            label={t('Contact Developer')}
            variant="secondary"
            onPress={contactDeveloper}
          />
          <Text style={[styles.supportNote, { textAlign: align }]}>
            {t('If you encounter any problems, please contact the developer.')}
          </Text>
        </Section>

        <Text style={styles.version}>{t('Version {{version}}', { version: VERSION_LABEL })}</Text>
        <Text style={styles.footer}>{t('Tavakkol')}</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
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
    marginBottom: 4,
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
  langRow: {
    flexDirection: 'row',
    gap: 10,
  },
  langOption: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  langOptionActive: {
    backgroundColor: COLORS.accentSoft,
    borderColor: COLORS.accent,
  },
  langText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  langTextActive: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  input: {
    color: COLORS.text,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 48,
  },
  excludedMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 8,
  },
  excludedCount: {
    color: COLORS.muted,
    fontSize: 12,
  },
  clearLink: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: '600',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
  },
  loadingText: {
    color: COLORS.muted,
    fontSize: 13,
  },
  emptyText: {
    color: COLORS.muted,
    fontSize: 13,
    paddingVertical: 14,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(58,72,90,0.45)',
    gap: 12,
  },
  appRowChecked: {
    backgroundColor: 'rgba(18,53,35,0.45)',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6,11,16,0.55)',
  },
  checkboxOn: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  checkmark: {
    color: COLORS.onAccent,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 18,
  },
  appInfo: {
    flex: 1,
  },
  appLabel: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  appPkg: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 2,
  },
  hint: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 12,
  },
  supportNote: {
    color: COLORS.warning,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 14,
  },
  version: {
    color: COLORS.muted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 26,
  },
  footer: {
    color: '#5A6779',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
  },
  message: {
    color: COLORS.warning,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 18,
    textAlign: 'center',
  },
});
