import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as FocusGuard from '../../modules/focus-guard';
import { ActionButton } from './ui';
import { COLORS, textAlign } from '../theme';
import { DONATION_NETWORK, DONATION_WALLET, DONATION_ZARINPAL_URL } from '../defaults';

/**
 * Support Us sheet (v1.4.5, two-option layout since v1.4.8).
 *
 * A drawer action, not a Settings section. It shows BOTH routes at once instead
 * of asking the supporter to pick a region first:
 *   1. inside Iran  → the ZarinPal payment page (owner's link),
 *   2. outside Iran → the USDT (TRC20) address with a Copy button.
 *
 * Both destinations come from `src/defaults.js`. An empty / placeholder value
 * shows an honest "not set yet" line instead of opening somewhere the owner
 * never approved.
 */

/**
 * The owner's ZarinPal link starts as `https://zarinp.al/yourlink`. While it
 * still contains the placeholder word, tapping the button must NOT open a dead
 * page — it explains that the link is not set yet. Replace the constant in
 * `src/defaults.js` and the button goes live with no code change here.
 */
function zarinpalLinkReady() {
  if (!DONATION_ZARINPAL_URL) return false;
  return !/yourlink/i.test(DONATION_ZARINPAL_URL);
}

export default function DonateSheet({ visible, onClose, t, lang, onMessage }) {
  const align = textAlign(lang);
  const [copied, setCopied] = useState(false);

  // A fresh sheet never shows "Copied" from a previous visit.
  useEffect(() => {
    if (!visible) setCopied(false);
  }, [visible]);

  const close = useCallback(() => {
    setCopied(false);
    onClose();
  }, [onClose]);

  const openZarinpal = useCallback(async () => {
    if (!zarinpalLinkReady()) {
      onMessage(t('The domestic payment link is not set yet.'));
      return;
    }
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
    if (!DONATION_WALLET) {
      onMessage(t('The donation wallet address is not set yet.'));
      return;
    }
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
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}>
            <Text style={[styles.title, { textAlign: align }]}>{t('Support Us')}</Text>
            <Text style={[styles.body, { textAlign: align }]}>
              {t(
                'Thank you for supporting Tavakkol with your donation. Every contribution, however small, keeps us going.'
              )}
            </Text>

            {/* ---------------------------------------------- inside Iran */}
            <View style={styles.option}>
              <View style={[styles.optionHead, lang === 'fa' && styles.optionHeadRtl]}>
                <Text style={styles.optionGlyph}>🏦</Text>
                <Text style={[styles.optionTitle, { textAlign: align }]}>
                  {t('Support from inside Iran')}
                </Text>
              </View>
              <Text style={[styles.optionSub, { textAlign: align }]}>
                {t('Secure payment with ZarinPal.')}
              </Text>
              <ActionButton label={t('Open the payment page')} onPress={openZarinpal} />
            </View>

            {/* ----------------------------------------- outside Iran */}
            <View style={styles.option}>
              <View style={[styles.optionHead, lang === 'fa' && styles.optionHeadRtl]}>
                <Text style={styles.optionGlyph}>🪙</Text>
                <Text style={[styles.optionTitle, { textAlign: align }]}>
                  {t('Support from outside Iran')}
                </Text>
              </View>
              <Text style={[styles.optionSub, { textAlign: align }]}>
                {t('Send USDT on the TRC20 network.')}
              </Text>

              {DONATION_WALLET ? (
                <>
                  <Text style={[styles.network, { textAlign: align }]}>{DONATION_NETWORK}</Text>
                  <Text selectable style={[styles.wallet, { textAlign: align }]}>
                    {DONATION_WALLET}
                  </Text>
                  <ActionButton
                    label={copied ? t('Copied') : t('Copy wallet address')}
                    onPress={copyWallet}
                    saved={copied}
                    variant="secondary"
                  />
                </>
              ) : (
                <Text style={[styles.body, { textAlign: align }]}>
                  {t('The donation wallet address is not set yet.')}
                </Text>
              )}
            </View>
          </ScrollView>

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
    maxHeight: '88%',
    backgroundColor: '#101820',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
  },
  scrollContent: {
    paddingBottom: 4,
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
  option: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceAlt,
    padding: 14,
    marginTop: 12,
  },
  optionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  optionHeadRtl: {
    flexDirection: 'row-reverse',
  },
  optionGlyph: {
    fontSize: 18,
  },
  optionTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  optionSub: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 20,
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
    backgroundColor: 'rgba(12,18,24,0.9)',
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
