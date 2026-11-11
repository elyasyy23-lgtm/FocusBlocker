package com.focusblocker.guard

import android.app.AlarmManager
import android.app.PendingIntent
import android.app.job.JobInfo
import android.app.job.JobScheduler
import android.content.ComponentName
import android.content.Context
import android.content.Intent

/**
 * v1.1.4 keep-alive, layers 2 and 3: the two independent wake-up paths that
 * bring the app PROCESS back after Android (or an OEM power manager) killed it.
 *
 * Both are registered with the SYSTEM, not with the app — they survive the app
 * process dying, which is the whole point:
 *
 *   * AlarmManager — inexact repeating, every 15 minutes. Inexact on purpose:
 *     an exact alarm needs the SCHEDULE_EXACT_ALARM permission and precision
 *     buys nothing here (we want "eventually restarted", not "restarted at
 *     09:15:00 sharp"). Alarms are dropped by a reboot or a force-stop, so the
 *     watchdog and the boot receiver re-arm them every time they run.
 *   * JobScheduler — one persisted periodic job, also 15 minutes (the platform
 *     minimum). Persisted jobs are re-created by the system after a reboot and
 *     for OEMs that throttle alarms differently than jobs, this is the second
 *     door in.
 *
 * Neither path ever needs the app to be open, and both are re-armed from
 * several places (boot, package replace, watchdog start, job run, app open),
 * so losing any single one of them cannot leave the guard dead.
 */
internal object GuardScheduler {
  const val ACTION_WAKEUP = "com.focusblocker.guard.WAKEUP"

  private const val REQUEST_ALARM = 7101
  private const val REQUEST_IDLE_ALARM = 7102
  private const val JOB_ID = 7103
  private const val INTERVAL_MS = 15 * 60 * 1000L

  /**
   * A wake-up is only worth a log line when it is a RESURRECTION. On a healthy
   * process the alarm ticks 96 times a day and would flush the 100-entry debug
   * buffer, hiding the events that matter.
   */
  private const val SILENCE_THRESHOLD_MS = 5 * 60 * 1000L

  fun scheduleAll(context: Context) {
    scheduleAlarm(context)
    scheduleIdleAlarm(context)
    scheduleJob(context)
  }

  fun scheduleAlarm(context: Context) {
    try {
      val manager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
      val intent = Intent(context, GuardWakeupReceiver::class.java).setAction(ACTION_WAKEUP)
      val pending = PendingIntent.getBroadcast(
        context,
        REQUEST_ALARM,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
      manager.setInexactRepeating(
        AlarmManager.RTC_WAKEUP,
        System.currentTimeMillis() + INTERVAL_MS,
        INTERVAL_MS,
        pending
      )
    } catch (error: Throwable) {
      FocusGuardStore.logEvent(
        context, "alarm_failed",
        text = "${error.javaClass.simpleName}: ${error.message}"
      )
    }
  }

  /**
   * Doze safety net: a repeating INEXACT alarm can be deferred for hours while
   * the phone is idle, which is exactly the overnight case this fix exists for.
   * `setAndAllowWhileIdle` is allowed to fire during Doze (and unlike the exact
   * variants it needs no SCHEDULE_EXACT_ALARM permission). It is one-shot, so
   * every tick — and every watchdog start — re-arms the next one.
   */
  fun scheduleIdleAlarm(context: Context) {
    try {
      val manager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
      val intent = Intent(context, GuardWakeupReceiver::class.java).setAction(ACTION_WAKEUP)
      val pending = PendingIntent.getBroadcast(
        context,
        REQUEST_IDLE_ALARM,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
      manager.setAndAllowWhileIdle(
        AlarmManager.RTC_WAKEUP,
        System.currentTimeMillis() + INTERVAL_MS,
        pending
      )
    } catch (error: Throwable) {
      FocusGuardStore.logEvent(
        context, "alarm_failed",
        text = "idle alarm: ${error.javaClass.simpleName}: ${error.message}"
      )
    }
  }

  fun scheduleJob(context: Context) {
    try {
      val scheduler = context.getSystemService(Context.JOB_SCHEDULER_SERVICE) as? JobScheduler
        ?: return
      // Already scheduled (and possibly already survived a reboot): keep it.
      if (scheduler.getPendingJob(JOB_ID) != null) return
      val component = ComponentName(context, GuardJobService::class.java)
      val job = JobInfo.Builder(JOB_ID, component)
        .setPeriodic(INTERVAL_MS)
        .setPersisted(true)
        .build()
      scheduler.schedule(job)
    } catch (error: Throwable) {
      FocusGuardStore.logEvent(
        context, "job_failed",
        text = "${error.javaClass.simpleName}: ${error.message}"
      )
    }
  }

  /**
   * Logs a wake-up only when the heartbeat is stale, i.e. the process really was
   * dead and this broadcast brought it back. That single line is the proof the
   * keep-alive chain works, without drowning the log in routine ticks.
   */
  fun maybeLogWakeup(context: Context, type: String, source: String) {
    val last = FocusGuardStore.lastHeartbeat(context)
    val age = if (last <= 0L) -1L else System.currentTimeMillis() - last
    if (age < 0L) {
      FocusGuardStore.logEvent(context, type, text = "$source — first wake-up, no heartbeat yet")
      return
    }
    if (age >= SILENCE_THRESHOLD_MS) {
      FocusGuardStore.logEvent(
        context, type,
        text = "$source after ${age / 1000}s without heartbeat (process was killed)"
      )
    }
  }
}
