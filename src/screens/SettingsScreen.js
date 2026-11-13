import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Linking,
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as FocusGuard from '../../modules/focus-guard';
import { ActionButton, Section } from '../components/ui';
import PinPad from '../components/PinPad';
import { COLORS, textAlign } from '../theme';
import { LANGUAGES } from '../i18n';
import { VERSION_LABEL } from '../buildInfo';
import {
  DEVELOPER_RUBIKA_SCHEME,
  DEVELOPER_RUBIKA_URL,
  DONATION_NETWORK,
  DONATION_WALLET,
  DONATION_ZARINPAL_URL,
} from '../defaults';

const BACKGROUND = require('../../assets/background.jpg');

/**
 * Settings screen (v1.2.0) — opened with the gear on the main screen.
 *
 * Jobs, all in this file:
 *  1. language switch (English / Persian) — the choice lives in native prefs so
 *     the accessibility service and the notifications follow it too;
 *  2. Excluded Apps — every launchable app with a checkbox; a checked app is
 *     never inspected by the guard (the package list is passed to Kotlin);
 *  3. Partner PIN — the app-lock PIN, set/changed/removed here;
 *  4. Remote Control (v1.4.0) — a partner phone can turn Protection off with one
 *     SMS (native receiver `RemoteSmsReceiver`, config in SharedPreferences);
 *  5. About Tavakkol (v1.4.0) — the Share App button moved here from "More";
 *  6. the support block: the owner's message, ZarinPal and the crypto wallet.
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
  onOpenHelp,
  onMessage,
  message,
}) {
  const align = textAlign(lang);
  const [apps, setApps] = useState([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [query, setQuery] = useState('');
  const [busyPkg, setBusyPkg] = useState(null);
  const [sharing, setSharing] = useState(false);
  // v1.3.2: only the first three apps are listed until "Show more" is tapped.
  const [showAllApps, setShowAllApps] = useState(false);
  // v1.3.2: two donation routes — 'iran' (ZarinPal) and 'crypto' (wallet).
  const [donateMode, setDonateMode] = useState(null);
  const [copied, setCopied] = useState(false);
  // v1.3.1: the Partner PIN is set/removed here — the Protection switch and
  // this screen never ask for it, only the app lock does.
  const [pinSet, setPinSet] = useState(false);
  const [pinDialog, setPinDialog] = useState({
    mode: null, // 'set' | 'change' | 'remove'
    step: 'new',
    value: '',
    first: '',
    error: null,
    busy: false,
  });
  // v1.4.0: remote deactivation via SMS. `remote` is what the native receiver
  // actually holds (SharedPreferences), the two text fields are the draft.
  const [remote, setRemote] = useState({
    enabled: false,
    number: '',
    code: '',
    lastAt: 0,
    count: 0,
  });
  const [remoteNumber, setRemoteNumber] = useState('');
  const [remoteCode, setRemoteCode] = useState('');
  const [remoteBusy, setRemoteBusy] = useState(false);
  // Optimistic: no Android permission dialog exists outside Android, and the
  // toggle simply refuses to turn on when the grant is missing.
  const [smsGranted, setSmsGranted] = useState(true);

  useEffect(() => {
    let alive = true;
    FocusGuard.getStrictState()
      .then((state) => {
        if (alive) setPinSet(Boolean(state.pinSet));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const state = await FocusGuard.getRemoteState();
      if (!alive) return;
      setRemote(state);
      setRemoteNumber(state.number);
      setRemoteCode(state.code);
      if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.check('android.permission.RECEIVE_SMS');
          if (alive) setSmsGranted(Boolean(granted));
        } catch (error) {
          // A failed check is not a denial — let the toggle ask for the grant.
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

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

  // Three rows by default (owner request); a search always shows every match so
  // the filter stays useful, and "Show more" reveals the whole list.
  const searching = query.trim().length > 0;
  const visibleApps = showAllApps || searching ? filtered : filtered.slice(0, 3);
  const hiddenCount = filtered.length - visibleApps.length;

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

  // -------------------------------------------------------------------
  // Partner PIN (v1.3.1) — set, change or remove the app-lock PIN.
  // -------------------------------------------------------------------

  const closePinDialog = () =>
    setPinDialog({ mode: null, step: 'new', value: '', first: '', error: null, busy: false });

  const openPinDialog = (mode) => {
    if (!isAvailable) {
      onMessage(t('Native build required'));
      return;
    }
    setPinDialog({
      mode,
      step: mode === 'set' ? 'new' : 'current',
      value: '',
      first: '',
      error: null,
      busy: false,
    });
  };

  const savePin = async (pin) => {
    setPinDialog((prev) => ({ ...prev, busy: true, error: null }));
    try {
      await FocusGuard.setPartnerPin(pin);
      setPinSet(true);
      closePinDialog();
      onMessage(t('Partner PIN saved. The app now asks for it when it opens.'));
    } catch (error) {
      setPinDialog((prev) => ({
        ...prev,
        busy: false,
        error: error.message || t('Could not save the PIN.'),
      }));
    }
  };

  const submitPinDialog = async () => {
    const { mode, step, value, first } = pinDialog;
    if (value.length < 4 || pinDialog.busy) return;

    if (mode === 'set') {
      if (step === 'new') {
        setPinDialog((prev) => ({ ...prev, step: 'confirm', value: '', first: value, error: null }));
        return;
      }
      if (value !== first) {
        setPinDialog({
          mode: 'set',
          step: 'new',
          value: '',
          first: '',
          error: t('PINs do not match. Start again.'),
          busy: false,
        });
        return;
      }
      await savePin(value);
      return;
    }

    if (mode === 'change') {
      if (step === 'current') {
        setPinDialog((prev) => ({ ...prev, busy: true, error: null }));
        try {
          const ok = await FocusGuard.verifyPartnerPin(value);
          if (!ok) {
            setPinDialog((prev) => ({
              ...prev,
              busy: false,
              value: '',
              error: t('Wrong PIN. Try again.'),
            }));
            return;
          }
          setPinDialog({ mode, step: 'new', value: '', first: '', error: null, busy: false });
        } catch (error) {
          setPinDialog((prev) => ({
            ...prev,
            busy: false,
            error: error.message || t('Wrong PIN. Try again.'),
          }));
        }
        return;
      }
      if (step === 'new') {
        setPinDialog((prev) => ({ ...prev, step: 'confirm', value: '', first: value, error: null }));
        return;
      }
      if (value !== first) {
        setPinDialog({
          mode: 'change',
          step: 'new',
          value: '',
          first: '',
          error: t('PINs do not match. Start again.'),
          busy: false,
        });
        return;
      }
      await savePin(value);
      return;
    }

    if (mode === 'remove') {
      setPinDialog((prev) => ({ ...prev, busy: true, error: null }));
      try {
        const ok = await FocusGuard.clearPartnerPin(value);
        if (!ok) {
          setPinDialog((prev) => ({
            ...prev,
            busy: false,
            value: '',
            error: t('Wrong PIN. Try again.'),
          }));
          return;
        }
        setPinSet(false);
        closePinDialog();
        onMessage(t('PIN removed. The app no longer asks for it.'));
      } catch (error) {
        setPinDialog((prev) => ({
          ...prev,
          busy: false,
          error: error.message || t('Could not save the PIN.'),
        }));
      }
    }
  };

  const pinDialogCopy = () => {
    const { mode, step } = pinDialog;
    if (mode === 'remove') {
      return {
        title: t('Remove Partner PIN'),
        body: t('Enter the current PIN to remove the app lock.'),
        ok: t('Remove'),
      };
    }
    if (step === 'current') {
      return {
        title: t('Enter the current PIN'),
        body: t('The current PIN is needed to choose a new one.'),
        ok: t('Continue'),
      };
    }
    if (step === 'confirm') {
      return {
        title: t('Repeat the PIN'),
        body: t('Enter the same PIN again.'),
        ok: t('Save'),
      };
    }
    return {
      title: pinSet ? t('Choose a new PIN') : t('Set the Partner PIN'),
      body: t('4 to 8 digits. This PIN is asked for when the app opens.'),
      ok: t('Continue'),
    };
  };

  // -------------------------------------------------------------------
  // Remote deactivation via SMS (v1.4.0)
  // -------------------------------------------------------------------

  const requestSmsPermission = useCallback(async () => {
    if (Platform.OS !== 'android') return true;
    try {
      const result = await PermissionsAndroid.request('android.permission.RECEIVE_SMS');
      const granted = result === PermissionsAndroid.RESULTS.GRANTED;
      setSmsGranted(granted);
      if (!granted) onMessage(t('SMS permission is required for remote deactivation.'));
      return granted;
    } catch (error) {
      onMessage(t('SMS permission is required for remote deactivation.'));
      return false;
    }
  }, [onMessage, t]);

  // One path for both the switch and the save button: the native side stores
  // number + code and flips the flag; switching ON also opens a fresh listening
  // window, so only SMS that arrive afterwards are ever acted on.
  const applyRemote = useCallback(
    async (enabled) => {
      if (!isAvailable) {
        onMessage(t('Native build required'));
        return;
      }
      if (enabled && !(await requestSmsPermission())) return;
      setRemoteBusy(true);
      try {
        await FocusGuard.setRemoteDeactivation({
          enabled,
          number: remoteNumber,
          code: remoteCode,
        });
        const state = await FocusGuard.getRemoteState();
        setRemote(state);
        setRemoteNumber(state.number);
        setRemoteCode(state.code);
        onMessage(
          enabled
            ? t('Remote deactivation is on. A partner SMS turns Protection off.')
            : t('Remote settings saved. Remote deactivation is off.')
        );
      } catch (error) {
        onMessage(error.message || t('Could not save the remote settings.'));
      } finally {
        setRemoteBusy(false);
      }
    },
    [isAvailable, onMessage, remoteCode, remoteNumber, requestSmsPermission, t]
  );

  const remoteDirty = remoteNumber.trim() !== remote.number || remoteCode.trim() !== remote.code;

  const openDonate = useCallback((mode) => {
    setCopied(false);
    setDonateMode(mode);
  }, []);

  const closeDonate = useCallback(() => setDonateMode(null), []);

  const openZarinpal = useCallback(async () => {
    if (!DONATION_ZARINPAL_URL) return;
    const opened = await FocusGuard.openUrl(DONATION_ZARINPAL_URL);
    if (!opened) {
      try {
        await Linking.openURL(DONATION_ZARINPAL_URL);
      } catch (error) {
        onMessage(t('Could not open the link.'));
      }
    }
  }, [onMessage, t]);

  const copyWallet = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(DONATION_WALLET);
      setCopied(true);
    } catch (error) {
      onMessage(t('Could not copy the wallet address.'));
    }
  }, [onMessage, t]);

  return (
    <ImageBackground source={BACKGROUND} style={styles.root} resizeMode="cover">
      <View style={styles.overlay} />
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.pageBackground} />
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
          title={t('About Tavakkol')}
          subtitle={t('A free, ad-free guard for your own phone.')}
          lang={lang}>
          <Text style={[styles.body, { textAlign: align }]}>
            {t('Version {{version}}', { version: VERSION_LABEL })}
          </Text>
          <ActionButton
            label={t('Share App')}
            onPress={shareApp}
            busy={sharing}
          />
        </Section>

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
            visibleApps.map((app) => {
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

          {hiddenCount > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowAllApps(true)}
              style={({ pressed }) => [styles.showMore, pressed && styles.pressed]}>
              <Text style={styles.showMoreText}>
                {t('Show more ({{count}})', { count: hiddenCount })}
              </Text>
            </Pressable>
          ) : null}
          {showAllApps && !searching && filtered.length > 3 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowAllApps(false)}
              style={({ pressed }) => [styles.showMore, pressed && styles.pressed]}>
              <Text style={styles.showMoreText}>{t('Show less')}</Text>
            </Pressable>
          ) : null}

          <Text style={[styles.hint, { textAlign: align }]}>
            {t('Excluded apps are saved instantly.')}
          </Text>
        </Section>

        <Section
          title={t('Partner PIN')}
          subtitle={t(
            'The app asks for this PIN when it opens — never inside the app. While Protection is on, the Device-admin page is kept closed too.'
          )}
          lang={lang}>
          <Text style={[styles.body, { textAlign: align }]}>
            {pinSet
              ? t('The app lock is on.')
              : t('No PIN yet — the app opens without asking.')}
          </Text>
          <ActionButton
            label={pinSet ? t('Change PIN') : t('Set Partner PIN')}
            onPress={() => openPinDialog(pinSet ? 'change' : 'set')}
          />
          {pinSet ? (
            <ActionButton
              label={t('Remove PIN')}
              variant="secondary"
              onPress={() => openPinDialog('remove')}
            />
          ) : null}
        </Section>

        <Section
          title={t('Remote Control')}
          subtitle={t(
            'A trusted phone can turn Protection off with one SMS. The message is used only once, and messages that arrived before the switch was turned on are ignored.'
          )}
          lang={lang}>
          <View style={[styles.remoteRow, lang === 'fa' && styles.headerRtl]}>
            <View style={styles.remoteLabel}>
              <Text style={[styles.remoteTitle, { textAlign: align }]}>
                {t('Enable Remote Deactivation')}
              </Text>
              <Text style={[styles.remoteHint, { textAlign: align }]}>
                {remote.enabled
                  ? t('On — waiting for the partner SMS')
                  : t('Off — incoming SMS are ignored')}
              </Text>
            </View>
            <Switch
              value={remote.enabled}
              onValueChange={(next) => applyRemote(next)}
              disabled={remoteBusy || !isAvailable}
              trackColor={{ false: COLORS.border, true: COLORS.accentSoft }}
              thumbColor={remote.enabled ? COLORS.accent : '#5A6779'}
            />
          </View>

          <Text style={[styles.fieldLabel, { textAlign: align }]}>{t('Partner Phone Number')}</Text>
          <TextInput
            value={remoteNumber}
            onChangeText={setRemoteNumber}
            placeholder="09xxxxxxxxx"
            placeholderTextColor="#5A6779"
            keyboardType="phone-pad"
            autoCorrect={false}
            style={[styles.input, { textAlign: align }]}
          />

          <Text style={[styles.fieldLabel, { textAlign: align }]}>{t('Secret Command')}</Text>
          <TextInput
            value={remoteCode}
            onChangeText={setRemoteCode}
            placeholder={t('For example: TURN OFF')}
            placeholderTextColor="#5A6779"
            autoCapitalize="characters"
            autoCorrect={false}
            style={[styles.input, { textAlign: align }]}
          />

          <ActionButton
            label={t('Save remote settings')}
            onPress={() => applyRemote(remote.enabled)}
            busy={remoteBusy}
            saved={remoteDirty ? false : true}
            disabled={!isAvailable}
          />

          <Text style={[styles.hint, { textAlign: align }]}>
            {smsGranted
              ? t('SMS permission granted.')
              : t('SMS permission is not granted yet — the switch stays off.')}
          </Text>
          {!smsGranted ? (
            <ActionButton
              label={t('Allow SMS access')}
              variant="secondary"
              onPress={requestSmsPermission}
            />
          ) : null}
          <Text style={[styles.hint, { textAlign: align }]}>
            {t('The partner SMS contains the secret command and turns Protection off by itself.')}
          </Text>
          {remote.lastAt > 0 ? (
            <Text style={[styles.hint, { textAlign: align }]}>
              {t('Remote stops so far: {{count}} · last at {{time}}', {
                count: remote.count,
                time: new Date(remote.lastAt).toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-GB'),
              })}
            </Text>
          ) : null}
        </Section>

        <Section
          title={t('Help')}
          subtitle={t('Five short steps — from the first keyword to the partner PIN.')}
          lang={lang}>
          <ActionButton label={t('How to use Tavakkol')} onPress={onOpenHelp} />
        </Section>

        <Section title={t('Support Us')} lang={lang}>
          <Text style={[styles.supportText, { textAlign: align }]}>
            {t(
              'Tavakkol is completely free and has no ads. If you are happy with this app, you can share in this good deed.'
            )}
          </Text>
          <ActionButton
            label={t('Support from inside Iran')}
            onPress={() => openDonate('iran')}
          />
          <ActionButton
            label={t('Support from outside Iran')}
            variant="secondary"
            onPress={() => openDonate('crypto')}
          />
        </Section>

        <Section title={t('More')} lang={lang}>
          <Text style={[styles.body, { textAlign: align }]}>
            {t('If you encounter any problems, please contact the developer.')}
          </Text>
          <ActionButton
            label={t('Contact Developer')}
            variant="secondary"
            onPress={contactDeveloper}
          />
        </Section>

        <Text style={styles.version}>{t('Version {{version}}', { version: VERSION_LABEL })}</Text>
        <Text style={styles.footer}>{t('Tavakkol')}</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </ScrollView>

      <Modal
        visible={donateMode !== null}
        transparent
        animationType="fade"
        onRequestClose={closeDonate}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={[styles.modalTitle, { textAlign: align }]}>
              {donateMode === 'iran' ? t('Support from inside Iran') : t('Support from outside Iran')}
            </Text>
            <Text style={[styles.body, { textAlign: align }]}>
              {t(
              'Thank you for supporting Tavakkol with your donation. Every contribution, however small, keeps us going.'
            )}
            </Text>

            {donateMode === 'iran' ? (
              DONATION_ZARINPAL_URL ? (
                <ActionButton label={t('Open the payment page')} onPress={openZarinpal} />
              ) : (
                <Text style={[styles.body, { textAlign: align }]}>
                  {t('The domestic payment link is not set yet.')}
                </Text>
              )
            ) : DONATION_WALLET ? (
              <>
                <Text style={[styles.walletNetwork, { textAlign: align }]}>
                  {DONATION_NETWORK}
                </Text>
                <Text selectable style={[styles.walletAddress, { textAlign: align }]}>
                  {DONATION_WALLET}
                </Text>
                <ActionButton
                  label={copied ? t('Copied') : t('Copy wallet address')}
                  onPress={copyWallet}
                  saved={copied}
                />
              </>
            ) : (
              <Text style={[styles.body, { textAlign: align }]}>
                {t('The donation wallet address is not set yet.')}
              </Text>
            )}

            <ActionButton label={t('Close')} variant="secondary" onPress={closeDonate} />
          </View>
        </View>
      </Modal>

      <Modal
        visible={pinDialog.mode !== null}
        transparent
        animationType="fade"
        onRequestClose={closePinDialog}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={[styles.modalTitle, { textAlign: align }]}>
              {pinDialogCopy().title}
            </Text>
            <Text style={[styles.body, { textAlign: align }]}>{pinDialogCopy().body}</Text>

            {pinDialog.error ? (
              <Text style={[styles.pinError, { textAlign: align }]}>{pinDialog.error}</Text>
            ) : null}

            <View style={styles.pinPad}>
              <PinPad
                value={pinDialog.value}
                onChange={(next) =>
                  setPinDialog((prev) => ({ ...prev, value: next, error: null }))
                }
                onComplete={submitPinDialog}
                disabled={pinDialog.busy}
                okLabel={pinDialogCopy().ok}
              />
            </View>

            <ActionButton
              label={t('Cancel')}
              variant="secondary"
              onPress={closePinDialog}
              disabled={pinDialog.busy}
            />
          </View>
        </View>
      </Modal>
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
  remoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  remoteLabel: {
    flex: 1,
  },
  remoteTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  remoteHint: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 3,
  },
  fieldLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginTop: 12,
    marginBottom: 6,
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
  supportText: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 10,
  },
  showMore: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  showMoreText: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  version: {
    color: COLORS.pageMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 26,
  },
  body: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 10,
  },
  pinError: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  pinPad: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(3,6,10,0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#101820',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 10,
  },
  walletNetwork: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  walletAddress: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 21,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 10,
  },
  footer: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
  },
  message: {
    color: COLORS.pageWarning,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 18,
    textAlign: 'center',
  },
});
