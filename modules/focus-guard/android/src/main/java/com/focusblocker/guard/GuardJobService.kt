package com.focusblocker.guard

import android.app.job.JobParameters
import android.app.job.JobService

/**
 * v1.1.4 keep-alive, layer 3: the persisted 15-minute JobScheduler job.
 *
 * It exists as an independent second door next to the AlarmManager alarm:
 * OEM power managers that throttle alarms do not always throttle jobs (and the
 * other way round), and a persisted job is re-created by the system after a
 * reboot without any of our code running. Keep it short — it only starts the
 * watchdog and re-arms the alarm, the guard itself does the rest.
 */
class GuardJobService : JobService() {

  override fun onStartJob(params: JobParameters?): Boolean {
    GuardScheduler.maybeLogWakeup(this, "job_tick", "periodic job (15 min)")
    GuardScheduler.scheduleAlarm(this)
    GuardWatchdogService.start(this, "periodic_job")
    // No async work: the job is done as soon as the watchdog is requested.
    return false
  }

  override fun onStopJob(params: JobParameters?): Boolean = true
}
