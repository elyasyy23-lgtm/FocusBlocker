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
 * The actual guard. It lives in Kotlin (not in JS) on purpose: an accessibility
 * service is bound by the Android system and keeps running while the app is in the
 * background, while a React Native JS timer is throttled or killed with the app.
 *
 * Two jobs, both driven by SharedPreferences so React Native never has to be alive:
 *
 * 1. Keyword guard — only text inside input fields (EditText / AutoCompleteTextView,
 *    e.g. the Google or Chrome search bar) is compared with the block list. A hit
 *    presses BACK immediately, which closes the keyboard and drops the search.
 * 2. Domain guard — inside a browser (or any window that exposes an address bar,
 *    which also covers Chrome Custom Tabs) the URL is read from the address-bar
 *    node and compared with the blocked-domain list. A hit presses BACK
 *    immediately; if the site is still on screen after that, BACK again and then
 *    HOME so the browser really closes.
 */
class FocusAccessibilityService : AccessibilityService() {

  companion object {
    private const val TAG = "FocusBlocker"
    private const val BLOCK_COOLDOWN_MS = 900L
    private const val SCAN_INTERVAL_MS = 350L
    private const val MAX_DEPTH = 40
    private const val MAX_NODES = 600
    private const val RECHECK_DELAY_MS = 800L
    private const val MAX_RECHECKS = 3

    private const val REASON_KEYWORD = "keyword"
    private const val REASON_DOMAIN = "domain"

    private val WHITESPACE = Regex("\\s+")

    /** Host inside any text the address bar exposes ("https://www.facebook.com/"). */
    private val HOST_PATTERN = Regex(
      "(?i)\\b((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,24})(?::\\d{2,5})?"
    )

    /** Resource-id fragments used by browser address bars. */
    private val URL_BAR_HINTS = arrayOf(
      "url_bar",
      "urlbar",
      "omnibox",
      "address_bar",
      "addressbar",
      "location_bar",
      "locationbar",
      "edit_url"
    )

    private val TEXT_FIELD_CLASSES = setOf(
      "android.widget.EditText",
      "android.widget.AutoCompleteTextView",
      "android.widget.MultiAutoCompleteTextView",
      "android.widget.SearchView",
      "androidx.appcompat.widget.SearchView",
      "androidx.appcompat.widget.AppCompatEditText"
    )

    private val BROWSER_PACKAGES = setOf(
      "com.android.chrome",
      "com.chrome.beta",
      "com.chrome.dev",
      "com.chrome.canary",
      "org.chromium.chrome",
      "com.android.browser",
      "org.mozilla.firefox",
      "org.mozilla.firefox_beta",
      "org.mozilla.focus",
      "com.microsoft.emmx",
      "com.brave.browser",
      "com.sec.android.app.sbrowser",
      "com.opera.browser",
      "com.opera.mini.native",
      "com.duckduckgo.mobile.android",
      "com.ecosia.android",
      "com.vivaldi.browser",
      "com.kiwibrowser.browser",
      "com.yandex.browser"
    )

    @Volatile
    var isRunning: Boolean = false
      private set

    @Volatile
    private var runningService: FocusAccessibilityService? = null

    /** Called from the JS module after the user edits the keyword/domain lists. */
    fun reload() {
      runningService?.refreshConfig()
    }
  }

  /** One matched rule: what matched (reason) and the value that triggered it. */
  private class Hit(val reason: String, val detail: String)

  private val handler = Handler(Looper.getMainLooper())
  private var keywords: List<String> = emptyList()
  private var domains: List<String> = emptyList()
  private var enabled = true
  private var lastBlockAt = 0L
  private var lastScanAt = 0L
  private var lastScanPackage: String? = null

  override fun onServiceConnected() {
    super.onServiceConnected()
    runningService = this
    isRunning = true
    refreshConfig()
    Log.i(TAG, "service connected: ${keywords.size} keyword(s), ${domains.size} domain(s)")
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
    domains = FocusGuardStore.domains(this)
    enabled = FocusGuardStore.isEnabled(this)
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent) {
    if (!enabled || (keywords.isEmpty() && domains.isEmpty())) return
    val packageName = event.packageName?.toString() ?: return
    // Never block our own setup screen.
    if (packageName == this.packageName) return
    if (!isRelevantEvent(event.eventType)) return

    val now = System.currentTimeMillis()
    if (now - lastBlockAt < BLOCK_COOLDOWN_MS) return

    // 1. Fastest targeted path: the node that just changed is a text field, so
    //    only that field is checked (this is what fires while the user types).
    if (keywords.isNotEmpty()) {
      val source = safeSource(event)
      if (source != null) {
        try {
          if (isTextField(source) && matchesKeyword(source.text)) {
            triggerBlock(packageName, REASON_KEYWORD, "input field")
            return
          }
        } finally {
          recycleQuietly(source)
        }
      }
    }

    // 2. Tree walk for everything the event does not carry: input fields that did
    //    not emit the event, and the browser address bar. Throttled per app.
    if (packageName == lastScanPackage && now - lastScanAt < SCAN_INTERVAL_MS) return
    lastScanPackage = packageName
    lastScanAt = now

    val root = activeRoot() ?: return
    try {
      val hit = inspectTree(root, packageName)
      if (hit != null) triggerBlock(packageName, hit.reason, hit.detail)
    } catch (error: Throwable) {
      Log.w(TAG, "scan failed: ${error.message}")
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

  /**
   * Walks the live tree once and collects only the two things the guard cares
   * about: text inside input fields, and the URL shown in an address bar.
   * Page body text is deliberately ignored.
   */
  private fun inspectTree(root: AccessibilityNodeInfo, packageName: String): Hit? {
    val urlTexts = ArrayList<String>()
    val inputTexts = ArrayList<CharSequence>()
    var hasUrlBar = false
    val isBrowser = packageName in BROWSER_PACKAGES

    val queue = ArrayDeque<Pair<AccessibilityNodeInfo, Int>>()
    queue.addLast(root to 0)
    var visited = 0

    while (queue.isNotEmpty() && visited < MAX_NODES) {
      val entry = queue.removeFirst()
      val node = entry.first
      val depth = entry.second
      visited += 1

      val viewId = node.viewIdResourceName ?: ""
      if (isUrlBar(viewId)) {
        hasUrlBar = true
        node.text?.let { urlTexts.add(it.toString()) }
        node.contentDescription?.let { urlTexts.add(it.toString()) }
      } else if (isTextField(node)) {
        node.text?.let { inputTexts.add(it) }
        node.contentDescription?.let { inputTexts.add(it) }
      } else if (isBrowser) {
        // Fallback for browsers whose toolbar is hidden or unnamed: an explicit
        // URL string anywhere in the window is still a URL.
        node.text?.toString()?.let { text ->
          if (text.contains("://") || text.startsWith("www.", ignoreCase = true)) {
            urlTexts.add(text)
          }
        }
      }

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

    // Domains win over keywords: a blocked site is blocked whatever its text is.
    if (domains.isNotEmpty() && (hasUrlBar || isBrowser)) {
      val host = blockedHostIn(urlTexts)
      if (host != null) return Hit(REASON_DOMAIN, host)
    }

    if (keywords.isNotEmpty()) {
      for (text in inputTexts) {
        if (matchesKeyword(text)) return Hit(REASON_KEYWORD, "input field")
      }
    }

    return null
  }

  private fun isUrlBar(viewId: String): Boolean {
    if (viewId.isEmpty()) return false
    val lower = viewId.lowercase()
    return URL_BAR_HINTS.any { lower.contains(it) }
  }

  private fun isTextField(node: AccessibilityNodeInfo): Boolean {
    if (node.isEditable) return true
    val className = node.className?.toString() ?: return false
    return TEXT_FIELD_CLASSES.contains(className)
  }

  private fun matchesKeyword(raw: CharSequence?): Boolean {
    if (raw.isNullOrEmpty()) return false
    val text = raw.toString().lowercase().replace(WHITESPACE, " ").trim()
    if (text.isEmpty()) return false
    for (keyword in keywords) {
      if (text.contains(keyword)) return true
    }
    return false
  }

  private fun blockedHostIn(values: List<String>): String? {
    for (raw in values) {
      val match = HOST_PATTERN.find(raw) ?: continue
      val host = FocusGuardStore.normalizeDomain(match.groupValues[1])
      if (host.isEmpty()) continue
      for (domain in domains) {
        if (host == domain || host.endsWith(".$domain")) return host
      }
    }
    return null
  }

  private fun triggerBlock(packageName: String, reason: String, detail: String) {
    val now = System.currentTimeMillis()
    if (now - lastBlockAt < BLOCK_COOLDOWN_MS) return
    lastBlockAt = now
    FocusGuardStore.recordBlock(this, packageName, reason)
    Log.i(TAG, "blocked $packageName ($reason: $detail)")

    val toast = if (reason == REASON_DOMAIN) {
      "FocusBlocker: blocked $detail"
    } else {
      "FocusBlocker: blocked keyword"
    }
    Toast.makeText(this, toast, Toast.LENGTH_SHORT).show()

    // Immediate response, exactly as configured: one BACK closes the keyboard
    // (keyword) or leaves the page (domain).
    performGlobalAction(GLOBAL_ACTION_BACK)
    scheduleRecheck(packageName, 1)
  }

  /**
   * BACK once is often not enough: browsers keep the same tab, keyboards reopen.
   * Re-inspect shortly after and keep pressing BACK (up to MAX_RECHECKS) before
   * falling back to HOME, which always leaves the app.
   */
  private fun scheduleRecheck(packageName: String, attempt: Int) {
    handler.postDelayed({
      if (!enabled) return@postDelayed
      if (currentPackage() != packageName) return@postDelayed
      val root = activeRoot() ?: return@postDelayed
      val stillBlocked = try {
        inspectTree(root, packageName) != null
      } catch (error: Throwable) {
        false
      } finally {
        recycleQuietly(root)
      }
      if (!stillBlocked) return@postDelayed

      if (attempt >= MAX_RECHECKS) {
        performGlobalAction(GLOBAL_ACTION_HOME)
      } else {
        performGlobalAction(GLOBAL_ACTION_BACK)
        scheduleRecheck(packageName, attempt + 1)
      }
    }, RECHECK_DELAY_MS)
  }

  private fun safeSource(event: AccessibilityEvent): AccessibilityNodeInfo? = try {
    event.source
  } catch (error: Throwable) {
    null
  }

  private fun activeRoot(): AccessibilityNodeInfo? = try {
    rootInActiveWindow
  } catch (error: Throwable) {
    null
  }

  private fun currentPackage(): String? {
    val root = activeRoot() ?: return null
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
