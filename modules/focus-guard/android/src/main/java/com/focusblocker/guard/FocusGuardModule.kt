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

  /**
   * The single writer for the Protection flag (v1.4.3). `setEnabled` refuses the
   * OFF direction while Delay Mode is on; `setEnabledAfterDelayChallenge` is the
   * only caller allowed to force it off.
   */
  private fun applyEnabled(context: Context, enabled: Boolean) {
    FocusGuardStore.setEnabled(context, enabled)
    // Switching Protection OFF ends the strict lock — guards stop instantly.
    if (!enabled) FocusGuardStore.clearUnlockWindow(context)
    FocusAccessibilityService.reload()
  }

  /** Minutes left on the partner's unlock window, 0 when it is closed. */
  private fun unlockMinutesLeft(context: Context): Int {
    val left = FocusGuardStore.unlockUntil(context) - System.currentTimeMillis()
    if (left <= 0L) return 0
    return Math.ceil(left / 60000.0).toInt()
  }

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
      config.put("excludedApps", JSONArray(FocusGuardStore.excludedApps(ctx)))
      config.put("language", FocusGuardStore.language(ctx))
      config.put("defaultsSeeded", FocusGuardStore.defaultsSeeded(ctx))
      config.put("pinSet", FocusGuardStore.hasPin(ctx))
      config.put("strictLocked", FocusGuardStore.strictLocked(ctx))
      config.put("unlockMinutesLeft", unlockMinutesLeft(ctx))
      config.put("remoteEnabled", FocusGuardStore.remoteEnabled(ctx))
      config.put("remoteLastAt", FocusGuardStore.remoteLastAt(ctx).toDouble())
      config.put("remoteCount", FocusGuardStore.remoteCount(ctx))
      config.put("delayMode", FocusGuardStore.delayMode(ctx))
      config.put("adultLock", FocusGuardStore.adultLock(ctx))
      config.put("adultKeywordCount", AdultFilter.KEYWORDS.size)
      config.put("adultDomainCount", AdultFilter.DOMAINS.size)
      config.put("musicMuted", FocusGuardStore.musicMuted(ctx))
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

    /**
     * v1.4.3: the native layer is the SOURCE OF TRUTH for Delay Mode. Even if the
     * JS gate is skipped or its React state is stale, Protection can never be
     * switched off here while Delay Mode is on — the write is refused. The only
     * way through is `setEnabledAfterDelayChallenge`, which the UI calls after
     * the challenge text has been typed and verified.
     */
    AsyncFunction("setEnabled") { enabled: Boolean ->
      val ctx = requireContext()
      if (!enabled && FocusGuardStore.delayMode(ctx)) {
        throw IllegalStateException(
          "Delay Mode is on — type the challenge text to turn Protection off."
        )
      }
      applyEnabled(ctx, enabled)
      true
    }

    /** The post-challenge path — the challenge was typed, so the write is allowed. */
    AsyncFunction("setEnabledAfterDelayChallenge") {
      applyEnabled(requireContext(), false)
      true
    }

    // -------------------------------------------------------------------
    // Strict lock (v1.3.1) — partner PIN that cannot be removed from the UI.
    // -------------------------------------------------------------------

    AsyncFunction("setPartnerPin") { pin: String ->
      val ctx = requireContext()
      if (!FocusGuardStore.isValidPin(pin)) {
        throw IllegalArgumentException("The PIN must be 4 to 8 digits")
      }
      FocusGuardStore.setPin(ctx, pin)
      true
    }

    AsyncFunction("verifyPartnerPin") { pin: String ->
      val ctx = requireContext()
      FocusGuardStore.verifyPin(ctx, pin)
    }

    AsyncFunction("clearPartnerPin") { pin: String ->
      val ctx = requireContext()
      if (!FocusGuardStore.verifyPin(ctx, pin)) {
        false
      } else {
        FocusGuardStore.clearPin(ctx)
        true
      }
    }

    AsyncFunction("getStrictState") {
      val ctx = requireContext()
      JSONObject()
        .put("pinSet", FocusGuardStore.hasPin(ctx))
        .put("locked", FocusGuardStore.strictLocked(ctx))
        .put("unlockMinutesLeft", unlockMinutesLeft(ctx))
        .toString()
    }

    // -------------------------------------------------------------------
    // Remote deactivation via SMS (v1.4.0)
    // -------------------------------------------------------------------

    AsyncFunction("getRemoteState") {
      val ctx = requireContext()
      JSONObject()
        .put("enabled", FocusGuardStore.remoteEnabled(ctx))
        .put("number", FocusGuardStore.remoteNumber(ctx))
        .put("code", FocusGuardStore.remoteCode(ctx))
        .put("lastAt", FocusGuardStore.remoteLastAt(ctx).toDouble())
        .put("count", FocusGuardStore.remoteCount(ctx))
        .toString()
    }

    /**
     * Stores the partner number + code and switches the feature on or off.
     * Switching ON starts a fresh window (`remote_since` = now) — messages that
     * arrived earlier are never acted on, which is the "new SMS only" contract.
     * Only a 10+ digit number and a 4+ character code are accepted, because an
     * empty pair would let any message through — but that check runs ONLY when
     * turning the feature on: switching it off must always be possible, even
     * when the fields were never filled (a lock-in on your own kill switch is
     * the worst possible bug in this feature).
     */
    AsyncFunction("setRemoteDeactivation") { enabled: Boolean, number: String, code: String ->
      val ctx = requireContext()
      val digits = FocusGuardStore.normalizeDigits(number)
      val trimmedCode = code.trim()
      if (enabled) {
        if (digits.length < 10) {
          throw IllegalArgumentException("Enter the partner phone number with at least 10 digits")
        }
        if (trimmedCode.length < 4) {
          throw IllegalArgumentException("The unlock code must be at least 4 characters")
        }
      }
      if (number.isNotBlank()) {
        FocusGuardStore.setRemoteNumber(ctx, number.replace(Regex("[^0-9+]"), ""))
      }
      if (trimmedCode.isNotEmpty()) {
        FocusGuardStore.setRemoteCode(ctx, trimmedCode)
      }
      FocusGuardStore.setRemoteEnabled(ctx, enabled)
      FocusGuardStore.logEvent(
        ctx,
        if (enabled) "remote_enabled" else "remote_disabled",
        text = "partner number ends with ${digits.takeLast(4)}, code length ${trimmedCode.length}"
      )
      true
    }

    // -------------------------------------------------------------------
    // Excluded apps + language (v1.2.0)
    // -------------------------------------------------------------------

    /**
     * Every launchable app on the phone, as JSON: `[{ pkg, label }]` sorted by
     * label. Only apps with a launcher entry are listed — that is what a user
     * recognises, and it keeps the answer at ~100 entries instead of ~400
     * system packages. Our own package is filtered out (it is always ignored).
     *
     * Android 11+ package visibility: the launcher <intent> entry in the module
     * manifest is what makes this query return anything at all.
     */
    AsyncFunction("getInstalledApps") {
      val ctx = requireContext()
      val manager = ctx.packageManager
      val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
      val resolved = try {
        manager.queryIntentActivities(intent, 0)
      } catch (error: Throwable) {
        emptyList()
      }
      val seen = HashMap<String, String>()
      for (info in resolved) {
        val pkg = info.activityInfo?.packageName ?: continue
        if (pkg == ctx.packageName) continue
        if (seen.containsKey(pkg)) continue
        val label = try {
          info.loadLabel(manager).toString()
        } catch (error: Throwable) {
          pkg
        }
        seen[pkg] = label.trim().ifEmpty { pkg }
      }
      val collator = java.text.Collator.getInstance()
      val byLabel = Comparator<Pair<String, String>> { left, right ->
        val order = collator.compare(left.second, right.second)
        if (order != 0) order else left.first.compareTo(right.first)
      }
      val entries = seen.entries
        .map { (pkg, label) -> pkg to label }
        .sortedWith(byLabel)
      val array = JSONArray()
      for ((pkg, label) in entries) {
        array.put(JSONObject().put("pkg", pkg).put("label", label))
      }
      array.toString()
    }

    AsyncFunction("getExcludedApps") {
      JSONArray(FocusGuardStore.excludedApps(requireContext())).toString()
    }

    AsyncFunction("setExcludedApps") { packages: List<String> ->
      val ctx = requireContext()
      FocusGuardStore.setExcludedApps(ctx, packages)
      FocusAccessibilityService.reload()
      true
    }

    AsyncFunction("getLanguage") {
      FocusGuardStore.language(requireContext())
    }

    /**
     * v1.4.2: Delay Mode toggle. Persisted natively so it survives a kill.
     * v1.4.5: the OFF direction is refused while Delay Mode is on — turning the
     * challenge OFF must cost the same as turning Protection off. The only way
     * through is `setDelayModeAfterDelayChallenge` (used after the text matches).
     */
    AsyncFunction("setDelayMode") { enabled: Boolean ->
      val ctx = requireContext()
      if (!enabled && FocusGuardStore.delayMode(ctx)) {
        throw IllegalStateException(
          "Delay Mode is on — type the challenge text to turn Delay Mode off."
        )
      }
      FocusGuardStore.setDelayMode(ctx, enabled)
      true
    }

    /** v1.4.5: the post-challenge path — the challenge was typed, so OFF is allowed. */
    AsyncFunction("setDelayModeAfterDelayChallenge") {
      FocusGuardStore.setDelayMode(requireContext(), false)
      true
    }

    /**
     * Strict Adult Content Lock (v1.4.9, hardened v1.4.11).
     * v1.4.11: while Protection is ON the switch is frozen in BOTH directions —
     * the owner wants it decided before the guard goes on. Enforced natively so
     * a stale React state can never flip it behind the guard's back.
     */
    AsyncFunction("setAdultLock") { enabled: Boolean ->
      val ctx = requireContext()
      if (FocusGuardStore.isEnabled(ctx)) {
        throw IllegalStateException(
          "Protection is on — turn Protection off before changing the adult lock."
        )
      }
      FocusGuardStore.setAdultLock(ctx, enabled)
      FocusAccessibilityService.reload()
      true
    }

    /**
     * v1.4.12 (owner fix): opens the device-admin UI and never ends in silence.
     * No single action is handled by every ROM, so the candidates are tried in
     * order until one launches:
     *   1. the AOSP "Device admin apps" list — the literal is required, there is
     *      no `Settings.ACTION_*` constant for it (the v1.4.11 CI break);
     *   2. OUR admin component — DevicePolicyManager shows the activation dialog
     *      when inactive and the admin details with "Deactivate" when active;
     *      this is the one route every ROM implements;
     *   3. the Security page;
     *   4. the Settings home page.
     * Returns which step opened: 'admin' | 'component' | 'security' | 'settings'
     * ('none' when even the Settings home page refuses to launch).
     */
    AsyncFunction("openDeviceAdminSettings") {
      val ctx = requireContext()
      val candidates = listOf(
        "admin" to Intent("android.settings.DEVICE_ADMIN_SETTINGS"),
        "component" to Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).apply {
          putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent(ctx))
          putExtra(
            DevicePolicyManager.EXTRA_ADD_EXPLANATION,
            FocusGuardStore.text(
              ctx,
              "While this is active, Android will not uninstall Tavakkol. Deactivate it in " +
                "Settings > Security > Device admin apps when you really want to remove the app.",
              "تا وقتی این گزینه فعال است، اندروید اجازهٔ حذف توکل را نمی‌دهد. برای حذف، آن را در " +
                "تنظیمات > امنیت > برنامه‌های مدیر دستگاه غیرفعال کنید."
            )
          )
        },
        "security" to Intent(Settings.ACTION_SECURITY_SETTINGS),
        "settings" to Intent(Settings.ACTION_SETTINGS)
      )

      for ((label, intent) in candidates) {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
          ctx.startActivity(intent)
          return@AsyncFunction label
        } catch (error: Exception) {
          // ROM without that screen (ActivityNotFoundException) — try the next.
        }
      }
      "none"
    }

    /** v1.4.2: background-music mute preference (read by the JS player). */
    AsyncFunction("setMusicMuted") { muted: Boolean ->
      val ctx = requireContext()
      FocusGuardStore.setMusicMuted(ctx, muted)
      true
    }

    AsyncFunction("setLanguage") { language: String ->
      val ctx = requireContext()
      FocusGuardStore.setLanguage(ctx, language)
      true
    }

    /**
     * Opens any URL from the app (Share / Contact Developer). Custom schemes
     * like `rubika://` are tried first; without a matching app the call returns
     * false instead of throwing, so JS can fall back to the https link.
     */
    AsyncFunction("openUrl") { url: String ->
      val ctx = requireContext()
      try {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        ctx.startActivity(intent)
        true
      } catch (error: Throwable) {
        false
      }
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
        ?: throw IllegalStateException("Open Tavakkol in the foreground first")
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
      // v1.4.6: every launch re-checks for an update that flipped Protection OFF
      // (fallback for a missed MY_PACKAGE_REPLACED broadcast).
      if (FocusGuardStore.maybeResetOnUpdate(ctx)) {
        FocusAccessibilityService.reload()
      }
      GuardScheduler.scheduleAll(ctx)
      GuardWatchdogService.start(ctx, "app_opened")
      true
    }

    /**
     * v1.4.6: true exactly once after an app update turned Protection off — the
     * UI uses it to explain the reset to the user.
     */
    AsyncFunction("consumeUpdateReset") {
      FocusGuardStore.consumeUpdateReset(requireContext())
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
        ?: throw IllegalStateException("Open Tavakkol in the foreground first")
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
