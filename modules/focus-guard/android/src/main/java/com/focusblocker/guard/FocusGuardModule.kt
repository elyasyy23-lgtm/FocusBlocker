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
      health.put(
        "foregroundActive",
        FocusAccessibilityService.isForegroundActive || GuardWatchdogService.isForeground
      )
      health.put("watchdogRunning", GuardWatchdogService.isRunning)
      health.put("watchdogForeground", GuardWatchdogService.isForeground)
      val heartbeat = FocusGuardStore.lastHeartbeat(ctx)
      health.put(
        "heartbeatAgeMs",
        if (heartbeat <= 0L) -1.0 else (System.currentTimeMillis() - heartbeat).toDouble()
      )
      health.put("batteryOptimizationIgnored", isBatteryOptimizationIgnored(ctx))
      health.put("sdkInt", Build.VERSION.SDK_INT)
      health.put("manufacturer", Build.MANUFACTURER ?: "")
      health.put("brand", Build.BRAND ?: "")
      health.put("autostartAvailable", firstAutostartComponent(ctx) != null)
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

    // -------------------------------------------------------------------
    // Keep-alive (v1.1.4)
    // -------------------------------------------------------------------

    /**
     * Arms every resurrection path right now: the START_STICKY watchdog, the
     * 15-minute alarm and the persisted job. Called when the app opens, so a
     * force-stop user recovery ("open the app once") re-arms everything too.
     */
    AsyncFunction("ensureKeepAlive") {
      val ctx = requireContext()
      GuardScheduler.scheduleAll(ctx)
      GuardWatchdogService.start(ctx, "app_opened")
      true
    }

    /**
     * Opens the OEM's own "keep this app running" screen. On MIUI/HyperOS
     * (Redmi, POCO, Xiaomi) that is Autostart — without it the powerkeeper
     * kills the app within hours no matter what a foreground service does, and
     * there is no API to switch it on. Every known vendor component is tried in
     * order and the app-details page is the fallback.
     */
    AsyncFunction("openAutostartSettings") {
      val ctx = requireContext()
      val activity = appContext.currentActivity
        ?: throw IllegalStateException("Open FocusBlocker in the foreground first")
      val result = JSONObject()
      // Try-and-see instead of resolve-then-launch: vendor security apps are
      // sometimes hidden from resolveActivity() even with <queries> in the
      // manifest, but an EXPLICIT intent to a component that exists still
      // launches. First one that does not throw wins, so the list order matters.
      var opened = "app_details"
      for ((pkg, cls) in AUTOSTART_COMPONENTS) {
        try {
          val intent = Intent()
          intent.component = ComponentName(pkg, cls)
          intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          activity.startActivity(intent)
          opened = "autostart"
          break
        } catch (error: Throwable) {
          // Not this ROM / not this build — try the next known screen.
        }
      }
      if (opened == "app_details") {
        val intent = Intent(
          Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
          Uri.parse("package:${ctx.packageName}")
        )
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        activity.startActivity(intent)
      }
      result.put("opened", opened)
      result.put("manufacturer", Build.MANUFACTURER ?: "")
      FocusGuardStore.logEvent(ctx, "autostart_opened", text = opened)
      result.toString()
    }
  }

  /**
   * Vendor "autostart / startup manager" screens, most specific first. All of
   * them are internal Activities with no public contract, so each one is
   * resolved before use and the whole list is best-effort by design.
   */
  private val AUTOSTART_COMPONENTS = listOf(
    // MIUI / HyperOS (Redmi, POCO, Xiaomi)
    "com.miui.securitycenter" to "com.miui.permcenter.autostart.AutoStartManagementActivity",
    "com.miui.securitycenter" to "com.miui.permcenter.autostart.AutoStartDetailManagementActivity",
    // Huawei / Honor
    "com.huawei.systemmanager" to "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity",
    "com.huawei.systemmanager" to "com.huawei.systemmanager.optimize.process.ProtectActivity",
    // OPPO / Realme / OnePlus (ColorOS)
    "com.coloros.safecenter" to "com.coloros.safecenter.permission.startup.StartupAppListActivity",
    "com.coloros.safecenter" to "com.coloros.safecenter.startupapp.StartupAppListActivity",
    "com.oppo.safe" to "com.oppo.safe.permission.startup.StartupAppListActivity",
    // vivo / iQOO
    "com.vivo.permissionmanager" to "com.vivo.permissionmanager.activity.BgStartUpManagerActivity",
    "com.iqoo.secure" to "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity",
    // Samsung
    "com.samsung.android.lool" to "com.samsung.android.sm.ui.battery.BatteryActivity",
    // ASUS
    "com.asus.mobilemanager" to "com.asus.mobilemanager.autostart.AutoStartActivity"
  )

  /** First installed autostart activity, or null when this ROM has none. */
  private fun firstAutostartComponent(ctx: Context): ComponentName? {
    val manager = ctx.packageManager
    for ((pkg, cls) in AUTOSTART_COMPONENTS) {
      val component = ComponentName(pkg, cls)
      val resolvable = try {
        manager.resolveActivity(Intent().setComponent(component), 0) != null
      } catch (error: Throwable) {
        false
      }
      if (resolvable) return component
    }
    return null
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
