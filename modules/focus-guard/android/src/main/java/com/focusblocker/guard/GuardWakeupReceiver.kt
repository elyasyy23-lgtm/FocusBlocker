package com.focusblocker.guard

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * v1.1.4 keep-alive, layer 2a: the manifest-declared door that the SYSTEM can
 * knock on while the app is dead.
 *
 * It is declared in the module manifest, so it exists after a reboot even if
 * the FocusBlocker process has not been started once — that is exactly how the
 * guard comes back after the phone reboots, after an app update, or after an
 * OEM power manager killed everything. Every entry point does the same three
 * cheap things: re-arm the alarms/job, record a wake-up line in the debug log
 * when the process was actually dead, and start the watchdog.
 */
class GuardWakeupReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context, intent: Intent?) {
    val action = intent?.action ?: GuardScheduler.ACTION_WAKEUP
    val source = when (action) {
      Intent.ACTION_BOOT_COMPLETED -> "device boot"
      Intent.ACTION_MY_PACKAGE_REPLACED -> "app updated"
      "android.intent.action.QUICKBOOT_POWERON" -> "quick boot"
      "com.htc.intent.action.QUICKBOOT_POWERON" -> "quick boot"
      GuardScheduler.ACTION_WAKEUP -> "alarm tick"
      else -> action
    }
    // Re-arm first: a reboot wipes alarms, and a force-stop wipes the job.
    GuardScheduler.scheduleAll(context)
    GuardScheduler.maybeLogWakeup(context, "watchdog_wakeup", source)
    GuardWatchdogService.start(context, source)
  }
}
