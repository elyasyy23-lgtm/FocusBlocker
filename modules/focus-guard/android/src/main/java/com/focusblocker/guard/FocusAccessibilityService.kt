package com.focusblocker.guard

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.Toast

/**
 * The actual keyword blocker.
 *
 * It lives in Kotlin (not in JS) on purpose: an accessibility service is bound by
 * the Android system and keeps running while the app is in the background, while a
 * React Native JS timer is throttled or killed together with the app process.
 *
 * Flow: every relevant accessibility event -> cheap check on the event text ->
 * throttled deep walk of the live view tree -> on a hit press BACK (up to three
 * times) and finally HOME, so the user is thrown out of the app instead of just
 * one screen.
 */
class FocusAccessibilityService : AccessibilityService() {

  companion object {
    private const val TAG = "FocusBlocker"
    private const val BLOCK_COOLDOWN_MS = 900L
    private const val DEEP_SCAN_INTERVAL_MS = 350L
    private const val MAX_DEPTH = 40
    private const val MAX_NODES = 600
    private const val ESCAPE_STEP_MS = 400L
    private const val MAX_BACK_PRESSES = 3
    private val WHITESPACE = Regex("\\s+")

    @Volatile
    var isRunning: Boolean = false
      private set

    @Volatile
    private var runningService: FocusAccessibilityService? = null

    /** Called from the JS module after the user edits the block list. */
    fun reload() {
      runningService?.refreshConfig()
    }
  }

  private val handler = Handler(Looper.getMainLooper())
  private var keywords: List<String> = emptyList()
  private var enabled = true
  private var lastBlockAt = 0L
  private var lastDeepScanAt = 0L
  private var lastDeepScanPackage: String? = null

  override fun onServiceConnected() {
    super.onServiceConnected()
    runningService = this
    isRunning = true
    refreshConfig()
    Log.i(TAG, "accessibility service connected, ${keywords.size} keyword(s)")
  }

  override fun onUnbind(intent: Intent?): Boolean {
    stopInternal()
    return super.onUnbind(intent)
  }

  override fun onDestroy() {
    stopInternal()
    super.onDestroy()
  }

  override fun onInterrupt() {
    // Nothing to interrupt: every event is handled synchronously.
  }

  private fun stopInternal() {
    isRunning = false
    runningService = null
    handler.removeCallbacksAndMessages(null)
  }

  private fun refreshConfig() {
    keywords = FocusGuardStore.keywords(this)
    enabled = FocusGuardStore.isEnabled(this)
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent) {
    if (!enabled || keywords.isEmpty()) return
    val packageName = event.packageName?.toString() ?: return
    // Never block our own setup screen.
    if (packageName == this.packageName) return
    if (!isRelevantEvent(event.eventType)) return

    // Fast path: the event already carries the text that changed.
    if (matchesAny(event.text) || matchesText(event.contentDescription)) {
      block(packageName, "event text")
      return
    }

    if (System.currentTimeMillis() - lastBlockAt < BLOCK_COOLDOWN_MS) return

    // Slow path: walk the whole visible tree, throttled per app so scrolling
    // lists do not burn the CPU.
    val now = System.currentTimeMillis()
    if (packageName == lastDeepScanPackage && now - lastDeepScanAt < DEEP_SCAN_INTERVAL_MS) return
    lastDeepScanPackage = packageName
    lastDeepScanAt = now

    val root = try {
      rootInActiveWindow
    } catch (error: Throwable) {
      null
    } ?: return

    try {
      if (treeMatches(root)) block(packageName, "tree scan")
    } catch (error: Throwable) {
      Log.w(TAG, "tree scan failed: ${error.message}")
    } finally {
      recycleQuietly(root)
    }
  }

  private fun isRelevantEvent(eventType: Int): Boolean = when (eventType) {
    AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED,
    AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED,
    AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED,
    AccessibilityEvent.TYPE_VIEW_TEXT_SELECTION_CHANGED,
    AccessibilityEvent.TYPE_VIEW_SCROLLED,
    AccessibilityEvent.TYPE_VIEW_FOCUSED -> true
    else -> false
  }

  private fun matchesAny(values: List<CharSequence>?): Boolean {
    if (values.isNullOrEmpty()) return false
    for (value in values) {
      if (matchesText(value)) return true
    }
    return false
  }

  private fun matchesText(raw: CharSequence?): Boolean {
    if (raw.isNullOrEmpty()) return false
    val text = raw.toString().lowercase().replace(WHITESPACE, " ").trim()
    if (text.isEmpty()) return false
    for (keyword in keywords) {
      if (text.contains(keyword)) return true
    }
    return false
  }

  private fun treeMatches(root: AccessibilityNodeInfo): Boolean {
    val queue = ArrayDeque<Pair<AccessibilityNodeInfo, Int>>()
    queue.addLast(root to 0)
    var visited = 0
    while (queue.isNotEmpty() && visited < MAX_NODES) {
      val entry = queue.removeFirst()
      val node = entry.first
      val depth = entry.second
      visited += 1
      if (matchesText(node.text) || matchesText(node.contentDescription)) return true
      if (depth >= MAX_DEPTH) continue
      for (index in 0 until node.childCount) {
        val child = try {
          node.getChild(index)
        } catch (error: Throwable) {
          null
        } ?: continue
        queue.addLast(child to depth + 1)
      }
    }
    return false
  }

  private fun block(packageName: String, source: String) {
    val now = System.currentTimeMillis()
    if (now - lastBlockAt < BLOCK_COOLDOWN_MS) return
    lastBlockAt = now
    FocusGuardStore.recordBlock(this, packageName)
    Log.i(TAG, "blocked $packageName ($source)")
    Toast.makeText(this, "FocusBlocker: blocked", Toast.LENGTH_SHORT).show()
    escape(packageName, 0)
  }

  /**
   * Presses BACK until the app is gone; a stubborn app (video player, WebView)
   * gets a HOME press as the last resort.
   */
  private fun escape(packageName: String, attempt: Int) {
    performGlobalAction(GLOBAL_ACTION_BACK)
    val nextDelay = ESCAPE_STEP_MS
    if (attempt + 1 >= MAX_BACK_PRESSES) {
      handler.postDelayed({
        if (currentPackage() == packageName) performGlobalAction(GLOBAL_ACTION_HOME)
      }, nextDelay)
      return
    }
    handler.postDelayed({
      if (currentPackage() == packageName) escape(packageName, attempt + 1)
    }, nextDelay)
  }

  private fun currentPackage(): String? {
    val root = try {
      rootInActiveWindow
    } catch (error: Throwable) {
      null
    } ?: return null
    return try {
      root.packageName?.toString()
    } finally {
      recycleQuietly(root)
    }
  }

  private fun recycleQuietly(node: AccessibilityNodeInfo) {
    try {
      @Suppress("DEPRECATION")
      node.recycle()
    } catch (error: Throwable) {
      // Already recycled by the framework on API 33+; safe to ignore.
    }
  }
}
