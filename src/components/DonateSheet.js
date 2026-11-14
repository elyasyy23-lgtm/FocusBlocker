import React, { useCallback, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as FocusGuard from '../../modules/focus-guard';
import { ActionButton } from './ui';
import { COLORS, textAlign } from '../theme';
import { DONATION_NETWORK, DONATION_WALLET, DONATION_ZARINPAL_URL } from '../defaults';

/**
 * Support Us sheet (v1.4.5) — a drawer action, not a Settings section.
 *
 * Two routes: inside Iran (ZarinPal) and outside Iran (crypto wallet). Both
 * destinations come from `src/defaults.js`; an empty value shows an honest
 * "not set yet" line rather than a placeholder address.
 */
export default function DonateSheet({ visible, mode, onClose, t, lang, onMessage }) {
  const align = textAlign(lang);
  const [copied, setCopied] = useState(false);

  const close = useCallback(() => {
    setCopied(false);
    onClose();
  }, [onClose]);

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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={[styles.title, { textAlign: align }]}>
            {mode === 'iran' ? t('Support from inside Iran') : t('Support from outside Iran')}
          </Text>
          <Text style={[styles.body, { textAlign: align }]}>
            {t(
              'Thank you for supporting Tavakkol with your donation. Every contribution, however small, keeps us going.'
            )}
          </Text>

          {mode === 'iran' ? (
            DONATION_ZARINPAL_URL ? (
              <ActionButton label={t('Open the payment page')} onPress={openZarinpal} />
            ) : (
              <Text style={[styles.body, { textAlign: align }]}>
                {t('The domestic payment link is not set yet.')}
              </Text>
            )
          ) : DONATION_WALLET ? (
            <>
              <Text style={[styles.network, { textAlign: align }]}>{DONATION_NETWORK}</Text>
              <Text selectable style={[styles.wallet, { textAlign: align }]}>
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

          <Pressable
            accessibilityRole="button"
            onPress={close}
            style={({ pressed }) => [styles.closeRow, pressed && styles.pressed]}>
            <Text style={styles.closeText}>{t('Close')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(3,6,10,0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  card: {
    width: '100%',
    backgroundColor: '#101820',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
  },
  title: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 10,
  },
  body: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 10,
  },
  network: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  wallet: {
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
  closeRow: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  closeText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
});
