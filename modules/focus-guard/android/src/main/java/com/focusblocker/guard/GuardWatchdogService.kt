package com.focusblocker.guard

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log

/**
 * v1.1.4 keep-alive, layer 1 of 3.
 *
 * The v1.1.2/v1.1.3 design was inverted: the ACCESSIBILITY service promoted
 * itself into the foreground. That raises the process priority, but an
 * AccessibilityService is only ever started by the system — nothing restarts
 * it after a kill, so one SIGKILL (Redmi/HyperOS powerkeeper does exactly
 * that) took the whole guard down for good, and the notification went with it.
 *
 * This service is the opposite: it is a NORMAL started service, so
 *   * START_STICKY makes Android restart it by itself after a kill, and
 *   * it can be started on demand from an alarm, a boot broadcast or a job.
 * It owns the single persistent notification, keeps a 30 s heartbeat in
 * SharedPreferences (so the app can prove whether it is alive) and checks
 * every minute whether the accessibility guard is bound again. Starting it
 * brings the app PROCESS back up, which is what lets the system rebind the
 * accessibility service into that process.
 *
 * It never blocks anything itself — the guard still does the blocking.
 */
class GuardWatchdogService : Service() {

  companion object {
    private const val TAG = "FocusBlocker"
    private const val EXTRA_REASON = "reason"

    private const val NOTIFICATION_ID = 42
    private const val ALERT_ID = 43
    private const val CHANNEL_STATUS = "focus_guard_status"
    private const val CHANNEL_ALERT = "focus_guard_alert"

    private const val HEARTBEAT_INTERVAL_MS = 30_000L
    private const val GUARD_CHECK_INTERVAL_MS = 60_000L

    /** Checks (1/min) before "guard missing" is written to the debug log. */
    private const val LOG_MISSING_AFTER = 2

    /** Checks (1/min) before the user gets a visible "guard is off" alert. */
    private const val ALERT_MISSING_AFTER = 3

    @Volatile
    var isRunning: Boolean = false
      private set

    @Volatile
    var isForeground: Boolean = false
      private set

    /**
     * True when the current start went through startForegroundService(), i.e.
     * Android REQUIRES a startForeground() within 5 s or it kills the app.
     * Only then is a failed startForeground() fatal (stopSelf).
     */
    @Volatile
    private var requiresForeground = false

    /**
     * Starts (or tickles) the watchdog. Tries the foreground start first and
     * falls back to a plain background start: a broadcast receiver woken by an
     * alarm is on the temporary allowlist, so startService() is accepted even
     * on Android 12+, and a started service can still bring the process up
     * (which is what makes the system rebind the accessibility service).
     */
    fun start(context: Context, reason: String) {
      val intent = Intent(context, GuardWatchdogService::class.java)
      intent.putExtra(EXTRA_REASON, reason)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        requiresForeground = true
        try {
          context.startForegroundService(intent)
          return
        } catch (error: Throwable) {
          requiresForeground = false
          FocusGuardStore.logEvent(
            context, "watchdog_failed",
            text = "foreground start refused ($reason): ${error.javaClass.simpleName}"
          )
        }
      }
      try {
        context.startService(intent)
      } catch (error: Throwable) {
        FocusGuardStore.logEvent(
          context, "watchdog_failed",
          text = "background start refused ($reason): ${error.javaClass.simpleName}"
        )
      }
    }
  }

  private val handler = Handler(Looper.getMainLooper())
  private var missingChecks = 0
  private var alertShown = false

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    isRunning = true
    postStatusNotification()
    FocusGuardStore.setHeartbeat(this, System.currentTimeMillis())
    FocusGuardStore.logEvent(
      this, "watchdog_started",
      text = "keep-alive service started (START_STICKY, restartable)"
    )
    handler.postDelayed(heartbeatTick, HEARTBEAT_INTERVAL_MS)
    handler.postDelayed(guardCheckTick, GUARD_CHECK_INTERVAL_MS)
    Log.i(TAG, "watchdog started")
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    // A START_STICKY restart arrives with a null intent and a dead notification:
    // re-post it (that is the whole point of being sticky). A plain tick on an
    // already-foreground service must NOT re-log, or the 15-minute wake-ups
    // would flush the 100-entry debug buffer.
    if (!isForeground) postStatusNotification() else requiresForeground = false
    // Alarms and persisted jobs are wiped by reboots and force-stops, so every
    // time the watchdog comes up it re-arms both resurrection paths.
    GuardScheduler.scheduleAll(this)
    return START_STICKY
  }

  /**
   * Swiping FocusBlocker out of the recent-apps list must not stop the guard —
   * the default for a started service on MIUI is exactly that.
   */
  override fun onTaskRemoved(rootIntent: Intent?) {
    FocusGuardStore.logEvent(
      this, "watchdog_task_removed",
      text = "app swiped from recents — guard stays up"
    )
    super.onTaskRemoved(rootIntent)
  }

  override fun onDestroy() {
    isRunning = false
    isForeground = false
    handler.removeCallbacksAndMessages(null)
    FocusGuardStore.logEvent(this, "watchdog_destroyed", text = "keep-alive service destroyed")
    super.onDestroy()
  }

  // -------------------------------------------------------------------
  // Foreground notification (the same single one the user knows from
  // v1.1.2/v1.1.3 — it is the live "guard is alive" signal).
  // -------------------------------------------------------------------

  private fun postStatusNotification() {
    try {
      val notification = buildStatusNotification()
      if (Build.VERSION.SDK_INT >= 34) {
        startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
      isForeground = true
      requiresForeground = false
      FocusGuardStore.logEvent(
        this, "fgs_started",
        text = "foreground state + persistent notification active (watchdog)"
      )
      Log.i(TAG, "watchdog foreground active")
    } catch (error: Throwable) {
      isForeground = false
      FocusGuardStore.logEvent(
        this, "fgs_failed",
        text = "watchdog startForeground() refused: ${error.javaClass.simpleName}: ${error.message}"
      )
      Log.w(TAG, "watchdog foreground failed: ${error.message}")
      if (requiresForeground) {
        // Started with startForegroundService() and now cannot go foreground:
        // stopping ourselves is the only way to avoid the 5 s system crash.
        requiresForeground = false
        stopSelf()
      }
    }
  }

  private fun buildStatusNotification(): Notification {
    val manager = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= 26) {
      val channel = NotificationChannel(
        CHANNEL_STATUS,
        FocusGuardStore.text(this, "Guard status", "وضعیت محافظ"),
        NotificationManager.IMPORTANCE_LOW
      )
      channel.description = FocusGuardStore.text(
        this,
        "Shown while the Tavakkol guard is running.",
        "تا زمانی که محافظ توکل روشن است نمایش داده می‌شود."
      )
      channel.setShowBadge(false)
      manager?.createNotificationChannel(channel)
    }
    val launchIntent = packageManager?.getLaunchIntentForPackage(packageName)
    val contentIntent = launchIntent?.let {
      PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_IMMUTABLE)
    }
    val builder = if (Build.VERSION.SDK_INT >= 26) {
      Notification.Builder(this, CHANNEL_STATUS)
    } else {
      @Suppress("DEPRECATION") Notification.Builder(this)
    }
    return builder
      .setContentTitle(FocusGuardStore.text(this, "Tavakkol is active", "توکل فعال است"))
      .setContentText(
        FocusGuardStore.text(
          this,
          "Keyword and domain guard is watching this screen.",
          "محافظ کلمه‌ها و سایت‌ها این صفحه را زیر نظر دارد."
        )
      )
      .setSmallIcon(android.R.drawable.ic_lock_lock)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setContentIntent(contentIntent)
      .build()
  }

  // -------------------------------------------------------------------
  // Heartbeat + guard supervision
  // -------------------------------------------------------------------

  private val heartbeatTick = Runnable { beat() }

  private fun beat() {
    FocusGuardStore.setHeartbeat(this, System.currentTimeMillis())
    handler.postDelayed(heartbeatTick, HEARTBEAT_INTERVAL_MS)
  }

  private val guardCheckTick = Runnable { checkGuard() }

  /**
   * The watchdog is alive but the accessibility service is not bound: two very
   * different situations.
   *   * toggle still ON  → the system is rebinding right now, usually back
   *                       within seconds. Say nothing for the first minute.
   *   * toggle OFF      → only the user can fix it, so after three minutes a
   *                       visible notification appears instead of a silent
   *                       dead guard.
   */
  private fun checkGuard() {
    val guardBound = FocusAccessibilityService.isRunning
    if (guardBound) {
      if (missingChecks > 0) {
        FocusGuardStore.logEvent(
          this, "guard_recovered",
          text = "accessibility guard is bound again after ${missingChecks}min missing"
        )
        missingChecks = 0
      }
      if (alertShown) {
        alertShown = false
        try {
          getSystemService(NotificationManager::class.java)?.cancel(ALERT_ID)
        } catch (error: Throwable) {
          // Notification was already gone.
        }
      }
    } else {
      missingChecks += 1
      if (missingChecks == LOG_MISSING_AFTER) {
        FocusGuardStore.logEvent(
          this, "guard_missing",
          text = "watchdog alive but the accessibility guard is not bound"
        )
      }
      if (missingChecks >= ALERT_MISSING_AFTER && !alertShown) {
        alertShown = true
        postGuardMissingAlert()
      }
    }
    handler.postDelayed(guardCheckTick, GUARD_CHECK_INTERVAL_MS)
  }

  private fun postGuardMissingAlert() {
    try {
      val manager = getSystemService(NotificationManager::class.java) ?: return
      if (Build.VERSION.SDK_INT >= 26) {
        val channel = NotificationChannel(
          CHANNEL_ALERT,
          FocusGuardStore.text(this, "Guard is off", "محافظ خاموش است"),
          NotificationManager.IMPORTANCE_HIGH
        )
        channel.description = FocusGuardStore.text(
          this,
          "Warns you when the Tavakkol guard stopped running.",
          "اگر محافظ توکل متوقف شود به شما هشدار می‌دهد."
        )
        manager.createNotificationChannel(channel)
      }
      val launchIntent = packageManager?.getLaunchIntentForPackage(packageName)
      val contentIntent = launchIntent?.let {
        PendingIntent.getActivity(
          this, 1, it,
          PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
      }
      val builder = if (Build.VERSION.SDK_INT >= 26) {
        Notification.Builder(this, CHANNEL_ALERT)
      } else {
        @Suppress("DEPRECATION") Notification.Builder(this)
      }
      val notification = builder
        .setContentTitle(
          FocusGuardStore.text(this, "Tavakkol guard is off", "محافظ توکل خاموش شده است")
        )
        .setContentText(
          FocusGuardStore.text(
            this,
            "The guard is not running. Tap to open Tavakkol and switch it back on.",
            "محافظ اجرا نمی‌شود. برای روشن کردن دوباره روی این پیام بزنید."
          )
        )
        .setSmallIcon(android.R.drawable.stat_notify_error)
        .setAutoCancel(true)
        .setContentIntent(contentIntent)
        .build()
      manager.notify(ALERT_ID, notification)
      FocusGuardStore.logEvent(
        this, "guard_alert",
        text = "user notified: guard is not bound for ${missingChecks}min"
      )
    } catch (error: Throwable) {
      FocusGuardStore.logEvent(
        this, "guard_alert_failed",
        text = "${error.javaClass.simpleName}: ${error.message}"
      )
    }
  }
}
