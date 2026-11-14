package com.focusblocker.guard

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
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
  private const val KEY_PIN_HASH = "partner_pin_hash"
  private const val KEY_PIN_SALT = "partner_pin_salt"
  private const val KEY_UNLOCK_UNTIL = "strict_unlock_until"
  // v1.4.0 remote deactivation (partner SMS). OFF by default: the receiver
  // returns before it even looks at the message.
  private const val KEY_REMOTE_ENABLED = "remote_enabled"
  private const val KEY_REMOTE_NUMBER = "remote_number"
  private const val KEY_REMOTE_CODE = "remote_code"
  private const val KEY_REMOTE_SINCE = "remote_since"
  private const val KEY_REMOTE_LAST_HASH = "remote_last_hash"
  private const val KEY_REMOTE_LAST_AT = "remote_last_at"
  private const val KEY_REMOTE_COUNT = "remote_count"
  // v1.4.2: Delay Mode (typing a long challenge before Protection may be
  // switched off) and the background-music mute preference. Both live here so
  // they survive a process kill and stay in one place with the rest of the
  // guard state.
  private const val KEY_DELAY_MODE = "delay_mode"
  private const val KEY_MUSIC_MUTED = "music_muted"
  // v1.4.9: the built-in "Strict Adult Content Lock" switch. It only ADDS the
  // AdultFilter list to the guard — the user's own keyword/domain lists stay
  // untouched. Turning it OFF is refused while Protection is on (module gate).
  private const val KEY_ADULT_LOCK = "adult_lock"
  // v1.4.6: an app UPDATE must reset Protection OFF (so nobody can bypass the
  // guard by installing a new build). `KEY_VERSION_CODE` is the last versionCode
  // this device ran; `KEY_RESET_ON_UPDATE_PENDING` tells the JS layer to explain
  // the reset to the user exactly once.
  private const val KEY_VERSION_CODE = "last_version_code"
  private const val KEY_RESET_ON_UPDATE_PENDING = "reset_on_update_pending"
  /**
   * v1.3.1: how long a correct Partner PIN keeps the SYSTEM pages (device admin,
   * app info) unguarded. Long enough for the partner to walk to Settings and
   * deactivate the admin, short enough that a forgotten phone re-arms itself.
   * The app itself re-locks long before this — see the JS session flag.
   */
  private const val STRICT_UNLOCK_MS = 15 * 60 * 1000L
  private const val PIN_MIN_LENGTH = 4
  private const val PIN_MAX_LENGTH = 8

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
  /**
   * v1.4.11: the app is Persian-first — a FRESH install starts in Persian
   * (owner decision). The stored value always wins, so switching to English in
   * Settings sticks across restarts.
   */
  fun language(context: Context): String =
    prefs(context).getString(KEY_LANGUAGE, "fa") ?: "fa"

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

  // ---------------------------------------------------------------------
  // Strict lock (v1.3.1): partner PIN + one-way lock.
  //
  // The PIN is never stored in clear text — only a random salt and
  // SHA-256(salt + pin). A correct PIN opens a short window
  // (STRICT_UNLOCK_MS) during which the accessibility guard stops kicking the
  // user out of the system device-admin / app-info pages, so the partner can
  // actually manage the phone. The app UI itself re-locks every time it comes
  // back from the background; only the PIN clears it.
  // ---------------------------------------------------------------------

  fun isValidPin(pin: String): Boolean =
    pin.length in PIN_MIN_LENGTH..PIN_MAX_LENGTH && pin.all { it.isDigit() }

  fun hasPin(context: Context): Boolean =
    !prefs(context).getString(KEY_PIN_HASH, null).isNullOrEmpty()

  /** Stores salt + hash, wipes any open window, and arms the lock immediately. */
  fun setPin(context: Context, pin: String) {
    val salt = randomHex(16)
    prefs(context).edit()
      .putString(KEY_PIN_SALT, salt)
      .putString(KEY_PIN_HASH, sha256(salt + pin))
      .putLong(KEY_UNLOCK_UNTIL, 0L)
      .apply()
  }

  /** True when the PIN matches; a correct PIN also opens the guard window. */
  fun verifyPin(context: Context, pin: String): Boolean {
    val preferences = prefs(context)
    val salt = preferences.getString(KEY_PIN_SALT, null) ?: return false
    val stored = preferences.getString(KEY_PIN_HASH, null) ?: return false
    if (!constantTimeEquals(stored, sha256(salt + pin))) return false
    preferences.edit()
      .putLong(KEY_UNLOCK_UNTIL, System.currentTimeMillis() + STRICT_UNLOCK_MS)
      .apply()
    return true
  }

  fun clearPin(context: Context) {
    prefs(context).edit()
      .remove(KEY_PIN_HASH)
      .remove(KEY_PIN_SALT)
      .putLong(KEY_UNLOCK_UNTIL, 0L)
      .apply()
  }

  fun unlockUntil(context: Context): Long = prefs(context).getLong(KEY_UNLOCK_UNTIL, 0L)

  /**
   * The one question the guard asks before kicking anyone out of Settings:
   * is Protection ON, is a PIN set, and has the unlock window run out?
   */
  fun strictLocked(context: Context): Boolean =
    isEnabled(context) && hasPin(context) && System.currentTimeMillis() >= unlockUntil(context)

  /** Closes the guard window without touching the PIN (Protection turned OFF). */
  fun clearUnlockWindow(context: Context) {
    prefs(context).edit().putLong(KEY_UNLOCK_UNTIL, 0L).apply()
  }

  private fun randomHex(bytes: Int): String {
    val buffer = ByteArray(bytes)
    java.security.SecureRandom().nextBytes(buffer)
    val builder = StringBuilder(bytes * 2)
    for (byte in buffer) builder.append(String.format("%02x", byte))
    return builder.toString()
  }

  private fun sha256(value: String): String {
    val digest = java.security.MessageDigest.getInstance("SHA-256")
    val bytes = digest.digest(value.toByteArray(Charsets.UTF_8))
    val builder = StringBuilder(bytes.size * 2)
    for (byte in bytes) builder.append(String.format("%02x", byte))
    return builder.toString()
  }

  private fun constantTimeEquals(left: String, right: String): Boolean {
    if (left.length != right.length) return false
    var diff = 0
    for (index in left.indices) {
      diff = diff or (left[index].code xor right[index].code)
    }
    return diff == 0
  }

  // ---------------------------------------------------------------------
  // Remote deactivation via SMS (v1.4.0)
  //
  // The partner's phone can turn Protection off with one SMS. The receiver
  // itself lives in RemoteSmsReceiver; it works while React Native is dead,
  // so all of the state has to sit here in SharedPreferences.
  //
  // `remote_since` is written every time the toggle is switched ON. A message
  // with a timestamp at or before that moment is never acted on, which is what
  // makes the feature "new SMS only" — switching it on cannot re-run an old
  // message that is still in an inbox backup or re-delivered by the system.
  // ---------------------------------------------------------------------

  fun remoteEnabled(context: Context): Boolean =
    prefs(context).getBoolean(KEY_REMOTE_ENABLED, false)

  fun setRemoteEnabled(context: Context, enabled: Boolean) {
    val editor = prefs(context).edit().putBoolean(KEY_REMOTE_ENABLED, enabled)
    if (enabled) {
      // A fresh window starts now and the previous dedupe hash is dropped, so
      // exactly one already-handled message can never block a new one.
      editor.putLong(KEY_REMOTE_SINCE, System.currentTimeMillis())
      editor.putString(KEY_REMOTE_LAST_HASH, "")
    } else {
      editor.putLong(KEY_REMOTE_SINCE, 0L)
    }
    editor.apply()
  }

  fun remoteNumber(context: Context): String =
    prefs(context).getString(KEY_REMOTE_NUMBER, "") ?: ""

  fun setRemoteNumber(context: Context, number: String) {
    prefs(context).edit().putString(KEY_REMOTE_NUMBER, number.trim()).apply()
  }

  fun remoteCode(context: Context): String =
    prefs(context).getString(KEY_REMOTE_CODE, "") ?: ""

  fun setRemoteCode(context: Context, code: String) {
    prefs(context).edit().putString(KEY_REMOTE_CODE, code.trim()).apply()
  }

  fun remoteSince(context: Context): Long = prefs(context).getLong(KEY_REMOTE_SINCE, 0L)

  fun remoteLastHash(context: Context): String =
    prefs(context).getString(KEY_REMOTE_LAST_HASH, "") ?: ""

  fun remoteLastAt(context: Context): Long = prefs(context).getLong(KEY_REMOTE_LAST_AT, 0L)

  fun remoteCount(context: Context): Int = prefs(context).getInt(KEY_REMOTE_COUNT, 0)

  /**
   * One-time processing latch: remembers the last accepted message and bumps
   * the counter. Callers must check [remoteLastHash] first — this is the write
   * side only, so a re-delivered broadcast short-circuits before it gets here.
   */
  fun recordRemoteDeactivation(context: Context, hash: String) {
    val preferences = prefs(context)
    preferences.edit()
      .putString(KEY_REMOTE_LAST_HASH, hash)
      .putLong(KEY_REMOTE_LAST_AT, System.currentTimeMillis())
      .putInt(KEY_REMOTE_COUNT, preferences.getInt(KEY_REMOTE_COUNT, 0) + 1)
      .apply()
  }

  /** ASCII digits only — "+98 912-345 6789" becomes "989123456789". */
  fun normalizeDigits(raw: String): String {
    val builder = StringBuilder(raw.length)
    raw.forEach { character ->
      builder.append(foldDigit(character))
    }
    return builder.toString().filter { it.isDigit() }
  }

  /** Persian (۰-۹) and Arabic-Indic (٠-٩) digits folded to ASCII. */
  fun foldDigits(raw: String): String {
    val builder = StringBuilder(raw.length)
    raw.forEach { character -> builder.append(foldDigit(character)) }
    return builder.toString()
  }

  private fun foldDigit(character: Char): Char = when (character) {
    in '\u06F0'..'\u06F9' -> '0' + (character - '\u06F0') // ۰-۹
    in '\u0660'..'\u0669' -> '0' + (character - '\u0660') // ٠-٩
    else -> character
  }

  fun setEnabled(context: Context, enabled: Boolean) {
    prefs(context).edit().putBoolean(KEY_ENABLED, enabled).apply()
  }

  // ---------------------------------------------------------------------
  // v1.4.6: reset Protection on app update. v1.4.7: Delay Mode resets too.
  //
  // Installing a new build must NOT be a way to slip past the guard, so every
  // update forces Protection OFF and the user turns it back on by hand. Delay
  // Mode is switched off in the same write: after an update both switches are
  // OFF, so the fresh build starts from the plain one-tap state (the user
  // re-enables whichever extra protection they want). The reset is applied in
  // three places (all idempotent):
  //   1. the MY_PACKAGE_REPLACED broadcast in GuardWakeupReceiver (the canonical
  //      "this app was just updated" signal — fires even if the app was closed),
  //   2. `maybeResetOnUpdate` on the accessibility service connect and on every
  //      app launch, which catches the broadcast being missed by comparing the
  //      stored versionCode with the one the device is actually running,
  //   3. a JS `consumeUpdateReset` flag so the UI can tell the user what happened.
  // A fresh INSTALL has no stored versionCode, so it is recorded without a reset
  // (there is nothing to bypass on a brand-new install).
  // ---------------------------------------------------------------------

  @Suppress("DEPRECATION")
  private fun currentVersionCode(context: Context): Long {
    val info = context.packageManager.getPackageInfo(context.packageName, 0)
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      info.longVersionCode
    } else {
      info.versionCode.toLong()
    }
  }

  private fun recordVersionCode(context: Context) {
    prefs(context).edit().putLong(KEY_VERSION_CODE, currentVersionCode(context)).apply()
  }

  /**
   * v1.4.9 — the ONE write that ends the guard: Protection OFF + Delay Mode OFF
   * in a single edit. Bypasses the Delay-Mode refusal on purpose, because the
   * only callers are the partner SMS kill switch and the app-update reset — both
   * are admin actions, not a user tapping a switch.
   */
  fun deactivateGuard(context: Context) {
    prefs(context).edit()
      .putBoolean(KEY_ENABLED, false)
      .putBoolean(KEY_DELAY_MODE, false)
      .apply()
    clearUnlockWindow(context)
  }

  /**
   * Forces Protection OFF, Delay Mode OFF and raises the one-shot
   * "app updated" notice.
   */
  fun resetProtectionForUpdate(context: Context) {
    deactivateGuard(context)
    prefs(context).edit().putBoolean(KEY_RESET_ON_UPDATE_PENDING, true).apply()
    recordVersionCode(context)
    logEvent(
      context,
      "protection_reset_on_update",
      text = "app updated to version code ${currentVersionCode(context)} — Protection and Delay Mode turned OFF"
    )
  }

  /**
   * Belt-and-braces fallback for a missed MY_PACKAGE_REPLACED: if the device is
   * running a different versionCode than the one we last stored, an update
   * happened. Returns true when a reset was performed.
   */
  fun maybeResetOnUpdate(context: Context): Boolean {
    val current = currentVersionCode(context)
    val stored = prefs(context).getLong(KEY_VERSION_CODE, -1L)
    if (stored == -1L) {
      // First launch of a build that knows about this feature: remember it, no reset.
      recordVersionCode(context)
      return false
    }
    if (stored != current) {
      resetProtectionForUpdate(context)
      return true
    }
    return false
  }

  /** Reads AND clears the "an update turned Protection off" flag (shown once). */
  fun consumeUpdateReset(context: Context): Boolean {
    val preferences = prefs(context)
    val pending = preferences.getBoolean(KEY_RESET_ON_UPDATE_PENDING, false)
    if (pending) {
      preferences.edit().putBoolean(KEY_RESET_ON_UPDATE_PENDING, false).apply()
    }
    return pending
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
  // Delay Mode + music preference (v1.4.2). Delay Mode is only ever CONSULTED
  // by the JS layer before it calls setEnabled(false) — the service itself
  // never waits on anything, so a blocked keyword still closes an app
  // instantly.
  // ---------------------------------------------------------------------

  fun delayMode(context: Context): Boolean = prefs(context).getBoolean(KEY_DELAY_MODE, false)

  fun setDelayMode(context: Context, enabled: Boolean) {
    prefs(context).edit().putBoolean(KEY_DELAY_MODE, enabled).apply()
  }

  /**
   * v1.4.9: Strict Adult Content Lock. Read by the accessibility service on
   * every config refresh; the OFF direction is refused by the module while
   * Protection is on (the store itself stays a dumb setter so the update reset
   * and the SMS kill switch are never blocked).
   */
  fun adultLock(context: Context): Boolean = prefs(context).getBoolean(KEY_ADULT_LOCK, false)

  fun setAdultLock(context: Context, enabled: Boolean) {
    prefs(context).edit().putBoolean(KEY_ADULT_LOCK, enabled).apply()
  }

  fun musicMuted(context: Context): Boolean = prefs(context).getBoolean(KEY_MUSIC_MUTED, false)

  fun setMusicMuted(context: Context, muted: Boolean) {
    prefs(context).edit().putBoolean(KEY_MUSIC_MUTED, muted).apply()
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
