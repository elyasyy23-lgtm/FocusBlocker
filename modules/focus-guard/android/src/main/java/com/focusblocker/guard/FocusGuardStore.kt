package com.focusblocker.guard

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

/**
 * Small SharedPreferences wrapper shared by the JS module, the accessibility
 * service and the device admin receiver. The accessibility service reads the
 * config from native storage, so it keeps blocking even when React Native is
 * not running.
 */
internal object FocusGuardStore {
  private const val PREFS_NAME = "focus_blocker_prefs"
  private const val KEY_KEYWORDS = "keywords"
  private const val KEY_DOMAINS = "blocked_domains"
  private const val KEY_EXCLUDED_APPS = "excluded_apps"
  private const val KEY_DEFAULTS_SEEDED = "defaults_seeded"
  private const val KEY_LANGUAGE = "language"
  private const val KEY_ENABLED = "enabled"
  private const val KEY_BLOCK_COUNT = "block_count"
  private const val KEY_LAST_BLOCK_PACKAGE = "last_block_package"
  private const val KEY_LAST_BLOCK_AT = "last_block_at"
  private const val KEY_LAST_BLOCK_REASON = "last_block_reason"
  private const val KEY_DEBUG_LOG = "debug_log"
  private const val KEY_HEARTBEAT = "watchdog_heartbeat"
  private const val DEBUG_LOG_LIMIT = 100
  private const val DEBUG_TEXT_LIMIT = 160

  /** Serializes every debug-log read/modify/write across service + RN threads. */
  private val debugLogLock = Any()

  private val SCHEME = Regex("^[a-z][a-z0-9+.-]*://")
  private val PATH_TAIL = Regex("[/?#].*$")
  private val PORT_TAIL = Regex(":\\d+$")

  private fun prefs(context: Context): SharedPreferences =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  fun keywords(context: Context): List<String> {
    val raw = prefs(context).getString(KEY_KEYWORDS, "[]") ?: "[]"
    val array = try {
      JSONArray(raw)
    } catch (error: Exception) {
      JSONArray()
    }
    val result = LinkedHashSet<String>()
    for (index in 0 until array.length()) {
      val value = array.optString(index, "").trim().lowercase()
      if (value.isNotEmpty()) result.add(value)
    }
    return result.toList()
  }

  fun setKeywords(context: Context, keywords: List<String>) {
    val unique = LinkedHashSet<String>()
    keywords.forEach { keyword ->
      val value = keyword.trim().lowercase()
      if (value.isNotEmpty()) unique.add(value)
    }
    val array = JSONArray()
    unique.forEach { array.put(it) }
    prefs(context).edit()
      .putString(KEY_KEYWORDS, array.toString())
      // Saving the list always counts as "the user has their own list", so the
      // starter keywords are never written again after a deliberate clear.
      .putBoolean(KEY_DEFAULTS_SEEDED, true)
      .apply()
  }

  /** True once the keyword list was written at least once on this install. */
  fun defaultsSeeded(context: Context): Boolean =
    prefs(context).getBoolean(KEY_DEFAULTS_SEEDED, false)

  // ---------------------------------------------------------------------
  // Excluded apps (v1.2.0): package names whose text is NEVER inspected.
  // Every entry is a full package name, so a chat app can be exempted while
  // the browser and every search bar stay guarded.
  // ---------------------------------------------------------------------

  fun excludedApps(context: Context): List<String> {
    val raw = prefs(context).getString(KEY_EXCLUDED_APPS, "[]") ?: "[]"
    val array = try {
      JSONArray(raw)
    } catch (error: Exception) {
      JSONArray()
    }
    val result = LinkedHashSet<String>()
    for (index in 0 until array.length()) {
      val value = array.optString(index, "").trim()
      if (value.isNotEmpty()) result.add(value)
    }
    return result.toList()
  }

  fun setExcludedApps(context: Context, packages: List<String>) {
    val unique = LinkedHashSet<String>()
    packages.forEach { pkg ->
      val value = pkg.trim()
      if (value.isNotEmpty()) unique.add(value)
    }
    val array = JSONArray()
    unique.forEach { array.put(it) }
    prefs(context).edit().putString(KEY_EXCLUDED_APPS, array.toString()).apply()
  }

  fun isExcluded(context: Context, packageName: String?): Boolean {
    if (packageName.isNullOrEmpty()) return false
    return excludedApps(context).any { it == packageName }
  }

  // ---------------------------------------------------------------------
  // UI language (v1.2.0): the JS side owns the choice, the service reads it so
  // the notification and the "blocked" toast follow the same language.
  // ---------------------------------------------------------------------

  /** "en" or "fa" — Persian unless the user picked otherwise. */
  fun language(context: Context): String =
    prefs(context).getString(KEY_LANGUAGE, "en") ?: "en"

  fun setLanguage(context: Context, language: String) {
    val value = if (language.lowercase().startsWith("fa")) "fa" else "en"
    prefs(context).edit().putString(KEY_LANGUAGE, value).apply()
  }

  /** Picks the string for the current UI language. */
  fun text(context: Context, english: String, persian: String): String =
    if (language(context) == "fa") persian else english

  /**
   * Domains are stored as bare hosts: "https://www.facebook.com/feed" becomes
   * "facebook.com", so the service only has to compare host suffixes.
   */
  fun domains(context: Context): List<String> {
    val raw = prefs(context).getString(KEY_DOMAINS, "[]") ?: "[]"
    val array = try {
      JSONArray(raw)
    } catch (error: Exception) {
      JSONArray()
    }
    val result = LinkedHashSet<String>()
    for (index in 0 until array.length()) {
      val value = normalizeDomain(array.optString(index, ""))
      if (value.isNotEmpty()) result.add(value)
    }
    return result.toList()
  }

  fun setDomains(context: Context, domains: List<String>) {
    val unique = LinkedHashSet<String>()
    domains.forEach { domain ->
      val value = normalizeDomain(domain)
      if (value.isNotEmpty()) unique.add(value)
    }
    val array = JSONArray()
    unique.forEach { array.put(it) }
    prefs(context).edit().putString(KEY_DOMAINS, array.toString()).apply()
  }

  fun normalizeDomain(raw: String): String {
    var value = raw.trim().lowercase()
    if (value.isEmpty()) return ""
    value = value.replace(SCHEME, "")
    value = value.replace(PATH_TAIL, "")
    value = value.replace(PORT_TAIL, "")
    value = value.trimEnd('.')
    while (value.startsWith("www.")) value = value.removePrefix("www.")
    // A bare domain needs at least one dot ("facebook.com"), otherwise typing
    // "localhost" would match everything and the browser would always close.
    if (!value.contains('.')) return ""
    return value
  }

  fun isEnabled(context: Context): Boolean = prefs(context).getBoolean(KEY_ENABLED, true)

  fun setEnabled(context: Context, enabled: Boolean) {
    prefs(context).edit().putBoolean(KEY_ENABLED, enabled).apply()
  }

  fun blockCount(context: Context): Int = prefs(context).getInt(KEY_BLOCK_COUNT, 0)

  fun lastBlockPackage(context: Context): String? =
    prefs(context).getString(KEY_LAST_BLOCK_PACKAGE, null)

  fun lastBlockAt(context: Context): Long = prefs(context).getLong(KEY_LAST_BLOCK_AT, 0L)

  fun lastBlockReason(context: Context): String? =
    prefs(context).getString(KEY_LAST_BLOCK_REASON, null)

  fun recordBlock(context: Context, packageName: String, reason: String) {
    val preferences = prefs(context)
    preferences.edit()
      .putInt(KEY_BLOCK_COUNT, preferences.getInt(KEY_BLOCK_COUNT, 0) + 1)
      .putString(KEY_LAST_BLOCK_PACKAGE, packageName)
      .putString(KEY_LAST_BLOCK_REASON, reason)
      .putLong(KEY_LAST_BLOCK_AT, System.currentTimeMillis())
      .apply()
  }

  fun resetBlockCount(context: Context) {
    prefs(context).edit()
      .putInt(KEY_BLOCK_COUNT, 0)
      .remove(KEY_LAST_BLOCK_PACKAGE)
      .remove(KEY_LAST_BLOCK_REASON)
      .remove(KEY_LAST_BLOCK_AT)
      .apply()
  }

  // ---------------------------------------------------------------------
  // Watchdog heartbeat (v1.1.4): written by GuardWatchdogService every 30 s.
  // The value survives a process kill (SharedPreferences), so the app can read
  // "how long has the keep-alive been silent" and the wake-up paths can prove
  // whether they actually resurrected a dead process.
  // ---------------------------------------------------------------------

  fun setHeartbeat(context: Context, at: Long) {
    prefs(context).edit().putLong(KEY_HEARTBEAT, at).apply()
  }

  /** Last watchdog heartbeat, or 0 when the watchdog never ran on this install. */
  fun lastHeartbeat(context: Context): Long = prefs(context).getLong(KEY_HEARTBEAT, 0L)

  // ---------------------------------------------------------------------
  // Debug log (v1.1.3): the last DEBUG_LOG_LIMIT guard events, kept in
  // the same SharedPreferences file so they SURVIVE the process being
  // killed and restarted — which is exactly the failure under
  // investigation. Written by the accessibility service (main thread),
  // read by React Native; the lock serializes read-modify-write cycles.
  // ---------------------------------------------------------------------

  /**
   * Appends one event to the ring buffer and drops the oldest entries
   * beyond [DEBUG_LOG_LIMIT]. [text] is truncated hard so one long chat
   * message cannot bloat the prefs file.
   */
  fun logEvent(context: Context, type: String, packageName: String? = null, text: String? = null) {
    val entry = JSONObject()
    entry.put("t", System.currentTimeMillis())
    entry.put("type", type)
    entry.put("pkg", packageName ?: JSONObject.NULL)
    entry.put("text", (text ?: "").take(DEBUG_TEXT_LIMIT))
    synchronized(debugLogLock) {
      val array = readLogLocked(context)
      array.put(entry)
      // Keep only the newest entries; the JSON is stored oldest-first so the
      // JS viewer can simply reverse it for "newest on top".
      while (array.length() > DEBUG_LOG_LIMIT) {
        array.remove(0)
      }
      prefs(context).edit().putString(KEY_DEBUG_LOG, array.toString()).apply()
    }
  }

  /** Raw debug log as a JSON array string (oldest first), never null. */
  fun debugLog(context: Context): String = synchronized(debugLogLock) {
    readLogLocked(context).toString()
  }

  fun clearDebugLog(context: Context) {
    synchronized(debugLogLock) {
      prefs(context).edit().putString(KEY_DEBUG_LOG, JSONArray().toString()).apply()
    }
  }

  private fun readLogLocked(context: Context): JSONArray {
    val raw = prefs(context).getString(KEY_DEBUG_LOG, "[]") ?: "[]"
    return try {
      JSONArray(raw)
    } catch (error: Exception) {
      // Corrupted by an interrupted write — start over rather than crash the guard.
      JSONArray()
    }
  }
}
