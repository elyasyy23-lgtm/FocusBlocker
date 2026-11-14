package com.focusblocker.guard

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Device administrator receiver.
 *
 * Android will not uninstall an app that has an active device admin, so simply
 * activating this receiver is what makes removal hard. No additional policies
 * are requested (v1.4.12 removed the force-lock policy) — the activation dialog
 * therefore only talks about uninstalling, not about locking the screen.
 */
class FocusDeviceAdminReceiver : DeviceAdminReceiver() {
  override fun onEnabled(context: Context, intent: Intent) {
    super.onEnabled(context, intent)
    Log.i("Tavakkol", "device admin enabled")
  }

  override fun onDisabled(context: Context, intent: Intent) {
    super.onDisabled(context, intent)
    Log.i("Tavakkol", "device admin disabled")
  }

  override fun onDisableRequested(context: Context, intent: Intent): CharSequence =
    FocusGuardStore.text(
      context,
      "Tavakkol will stop protecting this device, and it can be uninstalled again.",
      "توکل دیگر از این دستگاه محافظت نمی‌کند و برنامه دوباره قابل حذف می‌شود."
    )
}
