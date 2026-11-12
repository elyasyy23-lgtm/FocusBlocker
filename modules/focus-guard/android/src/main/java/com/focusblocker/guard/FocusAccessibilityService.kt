package com.focusblocker.guard

import android.accessibilityservice.AccessibilityService
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
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
 * 1. Keyword guard — text that CHANGES on screen is compared with the block
 *    list: input fields (EditText / AutoCompleteTextView, e.g. the Google or
 *    Chrome search bar) and, since v1.1.2, any other view whose text just
 *    changed (TYPE_VIEW_TEXT_CHANGED), which is what catches the Google search
 *    widget and chat messages in Telegram/Rubika. A hit presses BACK
 *    immediately, which closes the keyboard and drops the search/chat.
 * 2. Domain guard — inside a browser (or any window that exposes an address bar,
 *    which also covers Chrome Custom Tabs) the URL is read from the address-bar
 *    node and compared with the blocked-domain list. A hit presses BACK
 *    immediately; if the site is still on screen after that, BACK again and then
 *    HOME so the browser really closes.
 *
 * Since v1.1.4 the keep-alive is a separate START_STICKY watchdog service
 * (GuardWatchdogService) that owns the persistent notification: this service is
 * only ever started by the system, so nothing brought it back after a kill.
 * The watchdog can be restarted by Android itself, by a 15-minute alarm, by a
 * persisted job or by the boot receiver — and starting it brings this process
 * back up, which is what makes the system rebind the guard. The old behaviour
 * (this service promoting itself to the foreground) stays as a fallback for the
 * case where the watchdog start is refused.
 */
class FocusAccessibilityService : AccessibilityService() {

  companion object {
    private const val TAG = "FocusBlocker"
    private const val BLOCK_COOLDOWN_MS = 900L
    private const val SCAN_INTERVAL_MS = 350L
    private const val MAX_DEPTH = 40
    private const val MAX_NODES = 600
    /** Strict lock (v1.3.1): how often the system pages are re-inspected. */
    private const val STRICT_SCAN_MS = 500L
    private const val STRICT_MAX_NODES = 220
    private const val STRICT_MAX_DEPTH = 14

    /** Apps that host Android Settings (AOSP + the usual OEM skins). */
    private val SETTINGS_PACKAGES = setOf(
      "com.android.settings",
      "com.android.settings.intelligence",
      "com.miui.securitycenter",
      "com.samsung.android.settings",
      "com.oplus.settings",
      "com.coloros.settings",
      "com.vivo.settings"
    )

    /** Text that identifies the "Device admin apps" page. */
    private val ADMIN_PAGE_TOKENS = arrayOf(
      "device admin",
      "device administrator",
      "مدیر دستگاه",
      "مدیران دستگاه",
      "برنامه‌های مدیر دستگاه"
    )

    /** Text that identifies OUR app on a Settings page. */
    private val OUR_PAGE_TOKENS = arrayOf("tavakkol", "توکل", "com.focusblocker.app")

    /** Text that only the "force stop / uninstall" page shows. */
    private val DANGER_TOKENS = arrayOf(
      "force stop",
      "uninstall",
      "توقف اجباری",
      "حذف برنامه"
    )

    private const val RECHECK_DELAY_MS = 800L
    private const val MAX_RECHECKS = 3

    private const val REASON_KEYWORD = "keyword"
    private const val REASON_DOMAIN = "domain"

    private const val NOTIFICATION_ID = 44
    private const val NOTIFICATION_CHANNEL = "focus_guard_status"

    /**
     * How long the watchdog gets to post its notification before this service
     * falls back to promoting itself (the v1.1.2 behaviour). startForegroundService
     * is asynchronous, so the check has to wait one tick.
     */
    private const val WATCHDOG_ATTACH_DELAY_MS = 1200L

    /**
     * Our own application id (app.json -> expo.android.package). Kept as a
     * constant *and* compared with Context.packageName, so the setup screen is
     * ignored even if the event/root reports the package in a different casing
     * or the id changes between a dev build and a release build.
     */
    private const val APP_PACKAGE_NAME = "com.focusblocker.app"

    private val WHITESPACE = Regex("\\s+")

    /** Zero-width non-joiner / joiner as they appear inside Persian words. */
    private const val ZWNJ = '\u200C'
    private const val ZWJ = '\u200D'

    /**
     * Character classes that count as "inside a word" for the whole-word rule
     * (v1.2.0). Letters and digits are word characters; punctuation, spaces and
     * emoji are boundaries. `\p{L}` covers Persian/Arabic letters too.
     */
    private const val WORD_CHAR = "[\\p{L}\\p{N}]"

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

    /**
     * True while the foreground-service notification is actually up. Set the
     * moment startForeground() succeeds and cleared on teardown, so the JS
     * health check can tell "service bound" from "foreground state also held".
     */
    @Volatile
    var isForegroundActive: Boolean = false
      private set

    @Volatile
    private var runningService: FocusAccessibilityService? = null

    /** Called from the JS module after the user edits the keyword/domain lists. */
    fun reload() {
      runningService?.refreshConfig()
    }
  }

  /** One matched rule: what matched (reason), the value that triggered it and the on-screen text. */
  private class Hit(val reason: String, val detail: String, val text: String)

  private val handler = Handler(Looper.getMainLooper())
  private var keywords: List<String> = emptyList()
  private var domains: List<String> = emptyList()
  private var excludedPackages: Set<String> = emptySet()

  /**
   * v1.2.0: one compiled pattern per keyword (both ZWNJ spellings), built in
   * [refreshConfig] so no regular expression is compiled on an accessibility
   * event — that callback must stay in the sub-millisecond range.
   */
  private var keywordPatterns: List<Regex> = emptyList()

  private var enabled = true
  private var lastBlockAt = 0L
  private var lastScanAt = 0L
  private var lastScanPackage: String? = null

  /** Strict-lock guard throttle: one tree scan per STRICT_SCAN_MS at most. */
  private var lastStrictScanAt = 0L

  override fun onServiceConnected() {
    super.onServiceConnected()
    runningService = this
    isRunning = true
    refreshConfig()
    FocusGuardStore.logEvent(
      this, "service_connected",
      text = "guard bound by the system: ${keywords.size} keyword(s), ${domains.size} domain(s)"
    )
    // v1.1.4: arm every resurrection path the moment the guard is up — the
    // alarm, the persisted job and the sticky watchdog. If this process gets
    // killed later, one of them brings it back.
    GuardScheduler.scheduleAll(this)
    GuardWatchdogService.start(this, "accessibility_connected")
    handler.postDelayed({ ensureForeground() }, WATCHDOG_ATTACH_DELAY_MS)
    Log.i(TAG, "service connected: ${keywords.size} keyword(s), ${domains.size} domain(s)")
  }

  override fun onUnbind(intent: Intent?): Boolean {
    // The system (or the user) unbound us — this is what happens when the
    // accessibility toggle is switched OFF. Recorded because "stopped
    // working" may mean exactly this happened overnight.
    FocusGuardStore.logEvent(
      this, "service_unbound",
      text = "system/user unbound the service (accessibility toggle turned off?)"
    )
    stopInternal()
    return super.onUnbind(intent)
  }

  override fun onDestroy() {
    FocusGuardStore.logEvent(
      this, "service_destroyed",
      text = "service object destroyed (process about to die or toggle off)"
    )
    stopInternal()
    super.onDestroy()
  }

  override fun onInterrupt() {
    // Nothing to interrupt: every event is handled synchronously. Logged
    // anyway because it is rare and interesting when it does happen.
    FocusGuardStore.logEvent(this, "service_interrupted", text = "system requested interrupt")
  }

  private fun stopInternal() {
    isRunning = false
    isForegroundActive = false
    runningService = null
    handler.removeCallbacksAndMessages(null)
    try {
      stopForeground(Service.STOP_FOREGROUND_REMOVE)
    } catch (error: Throwable) {
      // The service was not in the foreground — ignore.
    }
  }

  private fun refreshConfig() {
    keywords = FocusGuardStore.keywords(this)
    domains = FocusGuardStore.domains(this)
    excludedPackages = FocusGuardStore.excludedApps(this).toSet()
    enabled = FocusGuardStore.isEnabled(this)
    keywordPatterns = compileKeywordPatterns(keywords)
  }

  /**
   * v1.2.0 whole-word matcher.
   *
   * Until v1.1.4 a keyword was matched with `text.contains(keyword)`, so a short
   * word matched inside a longer one — the owner's example: "گی" firing inside
   * "پیام‌رسان". Now every keyword becomes a pattern with word boundaries on
   * both sides, so only a whole word (or an exact multi-word phrase) matches.
   *
   * Persian needs two extra steps before the boundary check is meaningful:
   *  - the Arabic forms of yeh/kaf/heh (ي ك ة) and the Persian ones (ی ک ه) must
   *    compare equal, because two keyboards type the same word differently;
   *  - ZWNJ (نیم‌فاصله) is invisible: "پیام‌رسان" and "پیامرسان" are the same
   *    word for the user. Both are matched (one variant keeps the ZWNJ as a
   *    space, one glues the parts together) so a phrase typed either way hits.
   */
  private fun compileKeywordPatterns(list: List<String>): List<Regex> {
    if (list.isEmpty()) return emptyList()
    val patterns = LinkedHashSet<Regex>()
    for (keyword in list) {
      // Text and keyword are normalized the same way, in both ZWNJ spellings.
      for (zwnjAsSpace in booleanArrayOf(false, true)) {
        val normalized = normalizeForMatch(keyword, zwnjAsSpace)
        if (normalized.isEmpty()) continue
        buildWordPattern(normalized)?.let { patterns.add(it) }
      }
    }
    return patterns.toList()
  }

  /** "سایت شرط بندی" → (?<![\p{L}\p{N}])سایت\s+شرط\s+بندی(?![\p{L}\p{N}]) */
  private fun buildWordPattern(normalizedPhrase: String): Regex? {
    val words = normalizedPhrase.split(' ').filter { it.isNotEmpty() }
    if (words.isEmpty()) return null
    val body = words.joinToString("\\s+") { java.util.regex.Pattern.quote(it) }
    return try {
      Regex("(?<!$WORD_CHAR)$body(?!$WORD_CHAR)")
    } catch (error: Throwable) {
      // A keyword that cannot be expressed as a pattern must never crash the
      // guard — it is simply skipped (and the log says so at connect time).
      Log.w(TAG, "keyword pattern failed: ${error.message}")
      null
    }
  }

  /**
   * Folds the spelling differences that make two identical words look different:
   * Arabic yeh/kaf/heh → Persian, diacritics + tatweel dropped, ZWNJ optionally
   * turned into a space, lower-cased for Latin keywords, whitespace collapsed.
   */
  private fun normalizeForMatch(raw: String, zwnjAsSpace: Boolean): String {
    val out = StringBuilder(raw.length)
    for (ch in raw) {
      when {
        ch == ZWNJ || ch == ZWJ -> if (zwnjAsSpace) out.append(' ')
        // Directional marks and Arabic diacritics/tatweel are invisible.
        ch == '\u200E' || ch == '\u200F' || ch == '\u061C' -> Unit
        ch.code in 0x064B..0x065F || ch.code == 0x0670 || ch.code == 0x0640 -> Unit
        ch == 'ي' || ch == 'ى' -> out.append('ی')
        ch == 'ك' -> out.append('ک')
        ch == 'ة' || ch == 'ۀ' -> out.append('ه')
        ch.isWhitespace() -> out.append(' ')
        else -> out.append(ch.lowercaseChar())
      }
    }
    return out.toString().replace(WHITESPACE, " ").trim()
  }

  /**
   * v1.1.4: makes sure SOME foreground service holds this process. The watchdog
   * is preferred because it is the one Android restarts by itself; this service
   * is only a fallback for OEM builds that refuse a background
   * startForegroundService. Either way the process is never left as a plain
   * killable background process — which is what silently stopped the guard.
   */
  private fun ensureForeground() {
    if (GuardWatchdogService.isForeground) return
    if (isForegroundActive) return
    FocusGuardStore.logEvent(
      this, "fgs_fallback",
      text = "watchdog not foreground — accessibility service holds it instead"
    )
    startForegroundGuard()
  }

  /**
   * v1.1.2 fallback path: promotes the bound accessibility service into the
   * foreground state with its own notification. Kept for OEMs where the
   * watchdog cannot start from the background. If this call fails too the guard
   * keeps working, it just loses the notification.
   */
  private fun startForegroundGuard() {
    try {
      val manager = getSystemService(NotificationManager::class.java)
      if (Build.VERSION.SDK_INT >= 26) {
        val channel = NotificationChannel(
          NOTIFICATION_CHANNEL,
          FocusGuardStore.text(this, "Guard status", "وضعیت محافظ"),
          NotificationManager.IMPORTANCE_LOW
        )
        channel.description = FocusGuardStore.text(
          this,
          "Shown while the Tavakkol guard is running.",
          "تا زمانی که محافظ توکل روشن است نمایش داده می‌شود."
        )
        channel.setShowBadge(false)
        manager?.createNotificationChannel(channel)
      }
      val launchIntent = packageManager?.getLaunchIntentForPackage(packageName)
      val contentIntent = launchIntent?.let {
        PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_IMMUTABLE)
      }
      val builder = if (Build.VERSION.SDK_INT >= 26) {
        Notification.Builder(this, NOTIFICATION_CHANNEL)
      } else {
        @Suppress("DEPRECATION") Notification.Builder(this)
      }
      val notification = builder
        .setContentTitle(
          FocusGuardStore.text(this, "Tavakkol is active", "توکل فعال است")
        )
        .setContentText(
          FocusGuardStore.text(
            this,
            "Keyword and domain guard is watching this screen.",
            "محافظ کلمه‌ها و سایت‌ها این صفحه را زیر نظر دارد."
          )
        )
        .setSmallIcon(android.R.drawable.ic_lock_lock)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setContentIntent(contentIntent)
        .build()
      if (Build.VERSION.SDK_INT >= 34) {
        startForeground(
          NOTIFICATION_ID,
          notification,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
        )
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
      isForegroundActive = true
      FocusGuardStore.logEvent(
        this, "fgs_started",
        text = "foreground state + persistent notification active (accessibility fallback)"
      )
      Log.i(TAG, "foreground guard started")
    } catch (error: Throwable) {
      // If startForeground() is refused (e.g. ForegroundServiceStartNotAllowedException)
      // the guard keeps working but the process stays killable background —
      // which is the exact scenario the debug log now has to reveal.
      FocusGuardStore.logEvent(
        this, "fgs_failed",
        text = "startForeground() refused: ${error.javaClass.simpleName}: ${error.message}"
      )
      Log.w(TAG, "foreground guard failed: ${error.message}")
    }
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent) {
    // v1.3.1 strict lock: runs even with an empty keyword list, and before the
    // enabled check, because it protects the APP ITSELF, not the browsing.
    if (guardStrictSettings(event)) return

    if (!enabled || (keywords.isEmpty() && domains.isEmpty())) return

    val eventPackage = event.packageName?.toString() ?: return
    // Rule 1: ignore our own app completely — the keyword/domain TextInputs on
    // the setup screen contain the block lists, so inspecting them would block
    // FocusBlocker exactly while the user edits the lists.
    if (isOwnPackage(eventPackage)) return
    // Rule 2 (v1.2.0): apps the user excluded in Settings are never inspected —
    // no keyword hit, no tree walk, no block. The exclusion list lives in
    // SharedPreferences, so it holds while React Native is dead.
    if (isExcludedPackage(eventPackage)) return
    if (!isRelevantEvent(event.eventType)) return

    val now = System.currentTimeMillis()
    if (now - lastBlockAt < BLOCK_COOLDOWN_MS) return

    // 1. Fastest targeted path: the node that just changed. Since v1.1.2 a
    //    TYPE_VIEW_TEXT_CHANGED is matched in ANY view — that is what catches
    //    the Google search widget, the Chrome omnibox and Telegram/Rubika
    //    message bubbles. Every other event type keeps the v1.1.1 behavior and
    //    matches only input fields.
    if (keywords.isNotEmpty()) {
      val isTextChange = event.eventType == AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED
      val source = safeSource(event)
      if (source != null) {
        try {
          val sourceText = source.text?.toString()
          if (!isOwnPackage(source.packageName?.toString()) && matchesKeyword(sourceText)) {
            val isField = isTextField(source)
            if (isField || isTextChange) {
              // The IME (Gboard suggestions) fires text events while OUR setup
              // screen is the active window — never block inside our own app.
              if (!ownWindowActive()) {
                FocusGuardStore.logEvent(
                  this, "keyword_detected", eventPackage,
                  "“${sourceText ?: ""}” via ${if (isField) "input field" else "text change"}"
                )
                triggerBlock(
                  eventPackage,
                  REASON_KEYWORD,
                  if (isField) "input field" else "text change"
                )
                return
              }
            }
          }
        } finally {
          recycleQuietly(source)
        }
      } else if (isTextChange && matchesKeyword(eventText(event))) {
        // No source node on this event: the event still carries the changed text.
        if (!ownWindowActive()) {
          FocusGuardStore.logEvent(
            this, "keyword_detected", eventPackage, "“${eventText(event) ?: ""}” via event text"
          )
          triggerBlock(eventPackage, REASON_KEYWORD, "text change")
          return
        }
      }
    }

    // The window that is actually on screen decides what is inspected. Events
    // from the keyboard, the launcher or System UI can arrive while OUR window
    // is the active one — checking the root package is what makes "ignore our
    // own app" airtight.
    val root = activeRoot() ?: return
    val windowPackage = try {
      root.packageName?.toString()
    } catch (error: Throwable) {
      null
    } ?: eventPackage
    if (isOwnPackage(windowPackage)) {
      recycleQuietly(root)
      return
    }
    if (isExcludedPackage(windowPackage)) {
      recycleQuietly(root)
      return
    }

    // 2. Tree walk for everything the event does not carry: input fields that did
    //    not emit the event, and the browser address bar. Throttled per app.
    if (windowPackage == lastScanPackage && now - lastScanAt < SCAN_INTERVAL_MS) {
      recycleQuietly(root)
      return
    }
    lastScanPackage = windowPackage
    lastScanAt = now

    try {
      val hit = inspectTree(root, windowPackage)
      if (hit != null) {
        if (hit.reason == REASON_KEYWORD) {
          FocusGuardStore.logEvent(
            this, "keyword_detected", windowPackage, "“${hit.text}” via ${hit.detail}"
          )
        } else {
          FocusGuardStore.logEvent(
            this, "domain_detected", windowPackage, "blocked host: ${hit.detail}"
          )
        }
        triggerBlock(windowPackage, hit.reason, hit.detail)
      }
    } catch (error: Throwable) {
      FocusGuardStore.logEvent(
        this, "scan_failed", windowPackage,
        "tree scan failed: ${error.javaClass.simpleName}: ${error.message}"
      )
      Log.w(TAG, "scan failed: ${error.message}")
    } finally {
      recycleQuietly(root)
    }
  }

  /**
   * True when [candidate] is this application (the setup screen). Both the
   * runtime package name and the build-time application id are compared, plus
   * the accessibility component's own package, so no variant slips through.
   */
  private fun isOwnPackage(candidate: String?): Boolean {
    if (candidate.isNullOrEmpty()) return false
    if (candidate == APP_PACKAGE_NAME) return true
    if (candidate == packageName) return true
    return candidate == "com.focusblocker.guard"
  }

  /** True when the user added this package to the Excluded Apps list (v1.2.0). */
  private fun isExcludedPackage(candidate: String?): Boolean {
    if (candidate.isNullOrEmpty()) return false
    return excludedPackages.contains(candidate)
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
    // An excluded app is invisible to the guard, whatever the tree says.
    if (isExcludedPackage(packageName)) return null
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
        node.text?.let {
          // An address bar is also an input field: a blocked keyword typed into
          // the omnibox must be caught by the keyword rule too.
          urlTexts.add(it.toString())
          inputTexts.add(it)
        }
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
      if (host != null) return Hit(REASON_DOMAIN, host, host)
    }

    if (keywords.isNotEmpty()) {
      for (text in inputTexts) {
        if (matchesKeyword(text)) return Hit(REASON_KEYWORD, "input field", text.toString())
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
    if (raw.isNullOrEmpty() || keywordPatterns.isEmpty()) return false
    val source = raw.toString()
    if (source.isEmpty()) return false
    // Both ZWNJ spellings of the same on-screen text, so a keyword typed with a
    // نیم‌فاصله still matches text that has none (and the other way round).
    val glued = normalizeForMatch(source, zwnjAsSpace = false)
    val spaced = normalizeForMatch(source, zwnjAsSpace = true)
    for (pattern in keywordPatterns) {
      if (pattern.containsMatchIn(glued) || pattern.containsMatchIn(spaced)) return true
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

  /**
   * Strict lock (v1.3.1): while Protection is ON and a Partner PIN is set, the
   * two ways OUT of the app are closed:
   *
   *  - Settings → Device admin apps (the standard place to deactivate the admin
   *    that blocks uninstall), and
   *  - App info → Force stop / Uninstall.
   *
   * Both are plain Settings screens, so the guard reads their text and presses
   * BACK before the user can reach the button. A correct PIN opens a 15-minute
   * window (see FocusGuardStore.verifyPin) during which this stays quiet, so the
   * partner can still manage the phone.
   *
   * Honest limit: an accessibility service cannot REMOVE the Settings entry, it
   * can only kick the user out of the page — that is what this does.
   */
  private fun guardStrictSettings(event: AccessibilityEvent): Boolean {
    val pkg = try {
      event.packageName?.toString()
    } catch (error: Throwable) {
      null
    } ?: return false
    if (pkg !in SETTINGS_PACKAGES) return false
    if (!FocusGuardStore.strictLocked(this)) return false

    val now = System.currentTimeMillis()
    if (now - lastStrictScanAt < STRICT_SCAN_MS) return false
    lastStrictScanAt = now

    val root = activeRoot() ?: return false
    try {
      val screen = collectScreenText(root).lowercase()
      if (screen.isEmpty()) return false

      val adminPage = ADMIN_PAGE_TOKENS.any { screen.contains(it) }
      val ourPage = OUR_PAGE_TOKENS.any { screen.contains(it) }
      val dangerous = DANGER_TOKENS.any { screen.contains(it) }
      if (!adminPage && !(ourPage && dangerous)) return false

      val detail = if (adminPage) "device admin page" else "app info page"
      FocusGuardStore.logEvent(this, "strict_guard", pkg, detail)
      Toast.makeText(
        this,
        FocusGuardStore.text(
          this,
          "Tavakkol is locked — enter the Partner PIN in the app.",
          "توکل قفل است — رمز همراه را در برنامه وارد کنید."
        ),
        Toast.LENGTH_SHORT
      ).show()
      performGlobalAction(GLOBAL_ACTION_BACK)
      return true
    } catch (error: Throwable) {
      FocusGuardStore.logEvent(
        this, "scan_failed", pkg,
        "strict scan failed: ${error.javaClass.simpleName}: ${error.message}"
      )
      return false
    } finally {
      recycleQuietly(root)
    }
  }

  /**
   * Every visible label under [root], joined with spaces. Used only by the
   * strict-lock guard, which needs the page's wording ("Force stop", "Device
   * admin apps"), never the URL/input logic of [inspectTree].
   */
  private fun collectScreenText(root: AccessibilityNodeInfo): String {
    val builder = StringBuilder()
    val queue = ArrayDeque<Pair<AccessibilityNodeInfo, Int>>()
    queue.addLast(root to 0)
    var visited = 0

    while (queue.isNotEmpty() && visited < STRICT_MAX_NODES) {
      val (node, depth) = queue.removeFirst()
      visited += 1
      node.text?.toString()?.let { if (it.isNotBlank()) builder.append(it).append(' ') }
      node.contentDescription?.toString()?.let {
        if (it.isNotBlank()) builder.append(it).append(' ')
      }
      if (depth >= STRICT_MAX_DEPTH) continue
      for (index in 0 until node.childCount) {
        val child = try {
          node.getChild(index)
        } catch (error: Throwable) {
          null
        } ?: continue
        queue.addLast(child to depth + 1)
      }
    }
    return builder.toString()
  }

  private fun triggerBlock(packageName: String, reason: String, detail: String) {
    // Absolute safety net: never press BACK on our own setup screen.
    if (isOwnPackage(packageName)) return
    val now = System.currentTimeMillis()
    if (now - lastBlockAt < BLOCK_COOLDOWN_MS) return
    lastBlockAt = now
    FocusGuardStore.recordBlock(this, packageName, reason)
    FocusGuardStore.logEvent(
      this, "block_triggered", packageName, "action: BACK pressed ($reason: $detail)"
    )
    Log.i(TAG, "blocked $packageName ($reason: $detail)")

    val toast = if (reason == REASON_DOMAIN) {
      FocusGuardStore.text(this, "Tavakkol: blocked $detail", "توکل: $detail مسدود شد")
    } else {
      FocusGuardStore.text(this, "Tavakkol: blocked keyword", "توکل: کلمهٔ مسدودکننده پیدا شد")
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
      val foreground = currentPackage() ?: return@postDelayed
      if (isOwnPackage(foreground)) return@postDelayed
      if (foreground != packageName) {
        FocusGuardStore.logEvent(
          this, "block_recheck_clear", packageName,
          "recheck $attempt: app already left the screen"
        )
        return@postDelayed
      }
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
        FocusGuardStore.logEvent(
          this, "block_recheck_home", packageName,
          "recheck $attempt: still blocked — pressing HOME"
        )
        performGlobalAction(GLOBAL_ACTION_HOME)
      } else {
        FocusGuardStore.logEvent(
          this, "block_recheck_back", packageName,
          "recheck $attempt: still blocked — pressing BACK again"
        )
        performGlobalAction(GLOBAL_ACTION_BACK)
        scheduleRecheck(packageName, attempt + 1)
      }
    }, RECHECK_DELAY_MS)
  }

  /**
   * True when OUR window is the active one on screen — the airtight version of
   * "ignore our own app". The IME (Gboard suggestion strip) fires text-changed
   * events whose package is the keyboard's, not ours, exactly while the user
   * edits the block lists in FocusBlocker; matching those would block our own
   * setup screen. So every keyword hit is checked against the live window list
   * before anything is pressed. [windows] is authoritative; the root of the
   * active window is only the fallback.
   */
  private fun ownWindowActive(): Boolean {
    try {
      for (window in windows) {
        if (!window.isActive) continue
        val root = try {
          window.root
        } catch (error: Throwable) {
          null
        } ?: continue
        val windowPackage = try {
          root.packageName?.toString()
        } finally {
          recycleQuietly(root)
        }
        if (isOwnPackage(windowPackage)) return true
      }
    } catch (error: Throwable) {
      // Fall through to the root-window check below.
    }
    val root = activeRoot() ?: return false
    return try {
      isOwnPackage(root.packageName?.toString())
    } finally {
      recycleQuietly(root)
    }
  }

  /** Joined text carried by the event itself, used when [AccessibilityEvent.getSource] is null. */
  private fun eventText(event: AccessibilityEvent): String? {
    val parts = event.text ?: return null
    if (parts.isEmpty()) return null
    return parts.joinToString(" ")
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
