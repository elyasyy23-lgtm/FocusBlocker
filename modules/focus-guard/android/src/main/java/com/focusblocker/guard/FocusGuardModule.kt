package com.focusblocker.guard

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject

/**
 * JS bridge: `FocusGuard` native module.
 *
 * All state lives in SharedPreferences (see FocusGuardStore) so the accessibility
 * service keeps working with the same config even when React Native is not running.
 */
class FocusGuardModule : Module() {

  private fun requireContext(): Context =
    appContext.reactContext ?: throw IllegalStateException("React context is not available")

  override fun definition() = ModuleDefinition {
    Name("FocusGuard")

    AsyncFunction("getConfig") {
      val ctx = requireContext()
      val config = JSONObject()
      config.put("keywords", JSONArray(FocusGuardStore.keywords(ctx)))
      config.put("domains", JSONArray(FocusGuardStore.domains(ctx)))
      config.put("enabled", FocusGuardStore.isEnabled(ctx))
      config.put("blockCount", FocusGuardStore.blockCount(ctx))
      config.put("lastBlockPackage", FocusGuardStore.lastBlockPackage(ctx) ?: JSONObject.NULL)
      config.put("lastBlockReason", FocusGuardStore.lastBlockReason(ctx) ?: JSONObject.NULL)
      config.put("lastBlockAt", FocusGuardStore.lastBlockAt(ctx).toDouble())
      config.put("accessibilityEnabled", isAccessibilityEnabled(ctx))
      config.put("deviceAdminActive", isDeviceAdminActive(ctx))
      config.toString()
    }

    AsyncFunction("setKeywords") { keywords: List<String> ->
      val ctx = requireContext()
      FocusGuardStore.setKeywords(ctx, keywords)
      FocusAccessibilityService.reload()
      true
    }

    AsyncFunction("setDomains") { domains: List<String> ->
      val ctx = requireContext()
      FocusGuardStore.setDomains(ctx, domains)
      FocusAccessibilityService.reload()
      true
    }

    AsyncFunction("setEnabled") { enabled: Boolean ->
      val ctx = requireContext()
      FocusGuardStore.setEnabled(ctx, enabled)
      FocusAccessibilityService.reload()
      true
    }

    AsyncFunction("isAccessibilityEnabled") {
      isAccessibilityEnabled(requireContext())
    }

    AsyncFunction("openAccessibilitySettings") {
      val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      requireContext().startActivity(intent)
      true
    }

    AsyncFunction("isDeviceAdminActive") {
      isDeviceAdminActive(requireContext())
    }

    AsyncFunction("requestDeviceAdmin") {
      val ctx = requireContext()
      if (!isDeviceAdminActive(ctx)) {
        val activity = appContext.currentActivity
          ?: throw IllegalStateException("Open FocusBlocker in the foreground first")
        val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN)
        intent.putExtra(
          DevicePolicyManager.EXTRA_DEVICE_ADMIN,
          ComponentName(ctx, FocusDeviceAdminReceiver::class.java)
        )
        intent.putExtra(
          DevicePolicyManager.EXTRA_ADD_EXPLANATION,
          "While this is active, Android will not uninstall FocusBlocker. Deactivate it in " +
            "Settings > Security > Device admin apps when you really want to remove the app."
        )
        activity.startActivity(intent)
      }
      true
    }

    AsyncFunction("lockScreen") {
      val ctx = requireContext()
      if (!isDeviceAdminActive(ctx)) {
        throw IllegalStateException("Activate device admin first")
      }
      val manager = ctx.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
      manager.lockNow()
      true
    }

    AsyncFunction("resetBlockCount") {
      FocusGuardStore.resetBlockCount(requireContext())
      true
    }

    // -------------------------------------------------------------------
    // Debug log (v1.1.3): the last 100 events recorded by the accessibility
    // service, written to SharedPreferences so they survive process kills.
    // -------------------------------------------------------------------

    AsyncFunction("getDebugLogs") {
      FocusGuardStore.debugLog(requireContext())
    }

    AsyncFunction("clearDebugLogs") {
      FocusGuardStore.clearDebugLog(requireContext())
      true
    }

    /**
     * Live service health: whether the accessibility service is bound, whether
     * the foreground notification is actually up, and whether Android is still
     * allowed to battery-optimize (i.e. potentially kill) the process.
     */
    AsyncFunction("getServiceHealth") {
      val ctx = requireContext()
      val health = JSONObject()
      health.put("accessibilityEnabled", isAccessibilityEnabled(ctx))
      health.put("serviceRunning", FocusAccessibilityService.isRunning)
      health.put("foregroundActive", FocusAccessibilityService.isForegroundActive)
      health.put("batteryOptimizationIgnored", isBatteryOptimizationIgnored(ctx))
      health.put("sdkInt", Build.VERSION.SDK_INT)
      health.toString()
    }

    /**
     * Opens the system dialog that excludes FocusBlocker from battery
     * optimization ("Unrestricted") — the standard fix for OEM battery managers
     * that kill foreground services after a day.
     */
    AsyncFunction("requestIgnoreBatteryOptimizations") {
      val ctx = requireContext()
      if (isBatteryOptimizationIgnored(ctx)) return@AsyncFunction true
      val activity = appContext.currentActivity
        ?: throw IllegalStateException("Open FocusBlocker in the foreground first")
      val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
      intent.data = Uri.parse("package:${ctx.packageName}")
      activity.startActivity(intent)
      true
    }
  }

  private fun adminComponent(ctx: Context): ComponentName =
    ComponentName(ctx, FocusDeviceAdminReceiver::class.java)

  private fun isDeviceAdminActive(ctx: Context): Boolean {
    val manager = ctx.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
    return manager.isAdminActive(adminComponent(ctx))
  }

  private fun isAccessibilityEnabled(ctx: Context): Boolean {
    if (FocusAccessibilityService.isRunning) return true
    val expected = ComponentName(ctx, FocusAccessibilityService::class.java)
    val flat = Settings.Secure.getString(
      ctx.contentResolver,
      Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
    ) ?: return false
    return flat.split(':')
      .mapNotNull { ComponentName.unflattenFromString(it) }
      .any { it == expected }
  }

  private fun isBatteryOptimizationIgnored(ctx: Context): Boolean {
    val manager = ctx.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return false
    return manager.isIgnoringBatteryOptimizations(ctx.packageName)
  }
}
