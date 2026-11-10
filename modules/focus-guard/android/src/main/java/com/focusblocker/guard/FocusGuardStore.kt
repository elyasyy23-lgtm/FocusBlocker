package com.focusblocker.guard

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray

/**
 * Small SharedPreferences wrapper shared by the JS module, the accessibility
 * service and the device admin receiver. The accessibility service reads the
 * config from native storage, so it keeps blocking even when React Native is
 * not running.
 */
internal object FocusGuardStore {
  private const val PREFS_NAME = "focus_blocker_prefs"
  private const val KEY_KEYWORDS = "keywords"
  private const val KEY_ENABLED = "enabled"
  private const val KEY_BLOCK_COUNT = "block_count"
  private const val KEY_LAST_BLOCK_PACKAGE = "last_block_package"
  private const val KEY_LAST_BLOCK_AT = "last_block_at"

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
    prefs(context).edit().putString(KEY_KEYWORDS, array.toString()).apply()
  }

  fun isEnabled(context: Context): Boolean = prefs(context).getBoolean(KEY_ENABLED, true)

  fun setEnabled(context: Context, enabled: Boolean) {
    prefs(context).edit().putBoolean(KEY_ENABLED, enabled).apply()
  }

  fun blockCount(context: Context): Int = prefs(context).getInt(KEY_BLOCK_COUNT, 0)

  fun lastBlockPackage(context: Context): String? =
    prefs(context).getString(KEY_LAST_BLOCK_PACKAGE, null)

  fun lastBlockAt(context: Context): Long = prefs(context).getLong(KEY_LAST_BLOCK_AT, 0L)

  fun recordBlock(context: Context, packageName: String) {
    val preferences = prefs(context)
    preferences.edit()
      .putInt(KEY_BLOCK_COUNT, preferences.getInt(KEY_BLOCK_COUNT, 0) + 1)
      .putString(KEY_LAST_BLOCK_PACKAGE, packageName)
      .putLong(KEY_LAST_BLOCK_AT, System.currentTimeMillis())
      .apply()
  }

  fun resetBlockCount(context: Context) {
    prefs(context).edit()
      .putInt(KEY_BLOCK_COUNT, 0)
      .remove(KEY_LAST_BLOCK_PACKAGE)
      .remove(KEY_LAST_BLOCK_AT)
      .apply()
  }
}
