package com.focusblocker.guard

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Telephony
import android.util.Log
import java.security.MessageDigest

/**
 * Remote deactivation via SMS (v1.4.0).
 *
 * The partner's phone turns Protection off with one message: sender must be
 * the configured number and the body must contain the configured code. Until
 * the toggle is switched on in Settings, every incoming SMS is ignored before
 * it is even parsed (the flag is read first — this is the "ignore when OFF"
 * contract).
 *
 * One-time processing:
 *  * messages with a timestamp at or before `remote_since` are dropped, so
 *    switching the toggle on can never re-run a message from the past;
 *  * an accepted message is stored as a SHA-256 fingerprint and any
 *    re-delivery of the same PDU (same sender + body + timestamp) is ignored.
 *
 * The receiver is registered in the module manifest with
 * `android.provider.Telephony.SMS_RECEIVED`; it runs in the app process, so it
 * also works while React Native is not running.
 */
class RemoteSmsReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

    // OFF is a hard stop: no parsing, no logging, nothing stored.
    if (!FocusGuardStore.remoteEnabled(context)) return

    val partnerNumber = FocusGuardStore.normalizeDigits(FocusGuardStore.remoteNumber(context))
    val code = FocusGuardStore.remoteCode(context)
    if (partnerNumber.isEmpty() || code.isEmpty()) {
      FocusGuardStore.logEvent(
        context, "remote_config_missing",
        text = "remote deactivation is on but the partner number or the code is empty"
      )
      return
    }

    val parts = try {
      Telephony.Sms.Intents.getMessagesFromIntent(intent)
    } catch (error: Throwable) {
      Log.w(TAG, "SMS payload could not be read: ${error.message}")
      FocusGuardStore.logEvent(context, "remote_sms_unreadable", text = error.message)
      return
    }
    if (parts.isNullOrEmpty()) return

    // Multipart SMS arrive as several PDUs — the code may be split across them.
    val sender = parts.firstNotNullOfOrNull { it.originatingAddress } ?: ""
    val body = parts.joinToString(separator = "") { it.messageBody ?: "" }
    val stamp = parts.mapNotNull { it.timestampMillis }.maxOrNull() ?: 0L
    val since = FocusGuardStore.remoteSince(context)

    if (since > 0L && stamp in 1L..since) {
      // Delivered before the toggle was switched on — never act on it.
      FocusGuardStore.logEvent(
        context, "remote_sms_ignored",
        text = "old message ($stamp <= $since) — only new SMS are processed"
      )
      return
    }

    if (!sameNumber(sender, partnerNumber)) {
      FocusGuardStore.logEvent(
        context, "remote_sms_ignored",
        text = "sender does not match the partner number (…${last4(sender)})"
      )
      return
    }

    if (!body.containsFold(code)) {
      FocusGuardStore.logEvent(
        context, "remote_sms_ignored",
        text = "partner SMS without the unlock code (…${last4(sender)})"
      )
      return
    }

    val fingerprint = fingerprint(sender, body, stamp)
    if (fingerprint == FocusGuardStore.remoteLastHash(context)) {
      // Same message delivered twice — the latch eats it exactly once.
      FocusGuardStore.logEvent(
        context, "remote_sms_ignored",
        text = "already processed message (…${last4(sender)})"
      )
      return
    }

    FocusGuardStore.recordRemoteDeactivation(context, fingerprint)

    // v1.4.9 — the partner's message must end the WHOLE guard, not just the
    // Protection switch. Until v1.4.8 only Protection was written, so Delay Mode
    // stayed ON (and therefore "locked" behind the typed challenge) after a
    // remote deactivation. Both flags are now cleared in one store write.
    val protectionWasOn = FocusGuardStore.isEnabled(context)
    val delayWasOn = FocusGuardStore.delayMode(context)

    if (!protectionWasOn && !delayWasOn) {
      FocusGuardStore.logEvent(
        context, "remote_already_off",
        text = "partner SMS accepted but Protection and Delay Mode were already off (…${last4(sender)})"
      )
      return
    }

    FocusGuardStore.deactivateGuard(context)
    FocusAccessibilityService.reload()
    FocusGuardStore.logEvent(
      context, "remote_deactivated",
      text = "partner SMS turned OFF " +
        listOfNotNull(
          "Protection".takeIf { protectionWasOn },
          "Delay Mode".takeIf { delayWasOn }
        ).joinToString(" + ") +
        " (…${last4(sender)})"
    )
    postDeactivatedNotification(context)
  }

  /** Last 10 digits decide — "+98 912…" and "0912…" are the same phone. */
  private fun sameNumber(incoming: String, stored: String): Boolean {
    val left = FocusGuardStore.normalizeDigits(incoming)
    val right = FocusGuardStore.normalizeDigits(stored)
    if (left.isEmpty() || right.isEmpty()) return false
    if (left.length < 10 || right.length < 10) return left == right
    return left.takeLast(10) == right.takeLast(10)
  }

  /** Case-insensitive contains with Persian/Arabic digits folded to ASCII. */
  private fun String.containsFold(code: String): Boolean =
    FocusGuardStore.foldDigits(this.trim())
      .contains(FocusGuardStore.foldDigits(code.trim()), ignoreCase = true)

  private fun last4(sender: String): String {
    val digits = FocusGuardStore.normalizeDigits(sender)
    return if (digits.length <= 4) digits else digits.takeLast(4)
  }

  private fun fingerprint(sender: String, body: String, stamp: Long): String {
    val digest = MessageDigest.getInstance("SHA-256")
    val bytes = digest.digest("$sender|$body|$stamp".toByteArray(Charsets.UTF_8))
    val builder = StringBuilder(bytes.size * 2)
    for (byte in bytes) builder.append(String.format("%02x", byte))
    return builder.toString()
  }

  /**
   * The partner needs proof that it worked — a silent switch-off looks like a
   * broken app. Same alert channel as the "guard is off" notification.
   */
  private fun postDeactivatedNotification(context: Context) {
    try {
      val manager = context.getSystemService(NotificationManager::class.java) ?: return
      if (Build.VERSION.SDK_INT >= 26) {
        val channel = NotificationChannel(
          CHANNEL_ALERT,
          FocusGuardStore.text(context, "Guard is off", "محافظ خاموش است"),
          NotificationManager.IMPORTANCE_HIGH
        )
        channel.description = FocusGuardStore.text(
          context,
          "Warns you when the Tavakkol guard stopped running.",
          "اگر محافظ توکل متوقف شود به شما هشدار می‌دهد."
        )
        manager.createNotificationChannel(channel)
      }
      val launchIntent = context.packageManager?.getLaunchIntentForPackage(context.packageName)
      val contentIntent = launchIntent?.let {
        PendingIntent.getActivity(
          context, 2, it,
          PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
      }
      val builder = if (Build.VERSION.SDK_INT >= 26) {
        Notification.Builder(context, CHANNEL_ALERT)
      } else {
        @Suppress("DEPRECATION") Notification.Builder(context)
      }
      val notification = builder
        .setContentTitle(
          FocusGuardStore.text(
            context,
            "Tavakkol — Protection is off",
            "توکل — محافظت خاموش شد"
          )
        )
        .setContentText(
          FocusGuardStore.text(
            context,
            "The partner SMS turned Protection and Delay Mode off. Open Tavakkol to turn them back on.",
            "پیامک همراه، محافظت و حالت تأخیر را خاموش کرد. برای روشن کردن دوباره، توکل را باز کنید."
          )
        )
        .setSmallIcon(android.R.drawable.ic_lock_lock)
        .setAutoCancel(true)
        .setContentIntent(contentIntent)
        .build()
      manager.notify(ALERT_ID, notification)
    } catch (error: Throwable) {
      Log.w(TAG, "remote notification failed: ${error.message}")
    }
  }

  private companion object {
    private const val TAG = "FocusBlocker"
    private const val CHANNEL_ALERT = "focus_guard_alert"
    private const val ALERT_ID = 43
  }
}
