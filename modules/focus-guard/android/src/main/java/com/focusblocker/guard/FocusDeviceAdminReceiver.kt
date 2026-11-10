package com.focusblocker.guard

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Device administrator receiver.
 *
 * Android will not uninstall an app that has an active device admin, so simply
 * activating this receiver is what makes removal hard. The force-lock policy in
 * res/xml/device_admin.xml additionally lets the app lock the screen instantly.
 */
class FocusDeviceAdminReceiver : DeviceAdminReceiver() {
  override fun onEnabled(context: Context, intent: Intent) {
    super.onEnabled(context, intent)
    Log.i("FocusBlocker", "device admin enabled")
  }

  override fun onDisabled(context: Context, intent: Intent) {
    super.onDisabled(context, intent)
    Log.i("FocusBlocker", "device admin disabled")
  }

  override fun onDisableRequested(context: Context, intent: Intent): CharSequence =
    "FocusBlocker will stop protecting this device, and it can be uninstalled again."
}
