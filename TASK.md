# TASK — FocusBlocker v1.1.2 (sudden-stop fix + global text detection)

GOAL: fix "blocking stopped working after ~30 min" (OS kills the guard process) and ship
v1.1.2 with global keyword detection, an anti-kill foreground service and white save-state
buttons.

- [x] Diagnose: service code is sound; root cause = the app process (which hosts the
      accessibility service) is a killable background process — no foreground service, no
      persistent notification. isOwnPackage (v1.1.1) verified CORRECT — it only skips
      com.focusblocker.app, so it is NOT the cause of the stop.
- [x] FocusAccessibilityService: startForegroundGuard() in onServiceConnected (channel +
      ongoing notification, FOREGROUND_SERVICE_TYPE_SPECIAL_USE on API 34+), stopForeground
      in stopInternal/onUnbind.
- [x] Global keyword matching: TYPE_VIEW_TEXT_CHANGED matched in ANY view (Google widget,
      Chrome omnibox, Telegram/Rubika bubbles), plus event.text fallback when source is
      null. Guarded by new ownWindowActive() so the app never blocks itself — including
      IME/suggestion-strip events fired while our setup screen is active.
- [x] Module manifest: FOREGROUND_SERVICE, FOREGROUND_SERVICE_SPECIAL_USE,
      POST_NOTIFICATIONS permissions; foregroundServiceType="specialUse" + subtype
      property on the service.
- [x] App.js: request POST_NOTIFICATIONS (Android 13+), save buttons turn white while the
      editor text equals the stored list and go green again on any text change, honest
      copy updates (global text watching, notification diagnostic).
- [x] app.json: version 1.1.2, versionCode 4.
- [x] Verify: npm run verify (offline bundle gate) + module manifest XML parse.
- [ ] User: git commit/push + tag v1.1.2 → CI builds APK, Release published on the tag.

NOW: all code changes done and verified — waiting on the user's git push/tag to build
v1.1.2 (Kotlin compiles in CI; Termux cannot compile Kotlin).

Decisions (2026-11-10, owner):
- v1.1.0 "page body text deliberately ignored" is SUPERSEDED: keywords now match any
  on-screen text CHANGE (chat apps included), per explicit owner request.
- Split-screen edge: a text-change hit from a non-active split-screen app still presses
  BACK once (same class of behavior as the v1.1.1 tree walk; accepted).
- The persistent notification doubles as a live diagnostic: notification gone = guard
  dead, re-enable in Accessibility settings.
