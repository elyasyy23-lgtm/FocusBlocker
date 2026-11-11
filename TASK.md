# TASK — FocusBlocker v1.1.4 (keep-alive that survives the kill)

GOAL: the guard died again in v1.1.3. Owner's own debug log proved it: Accessibility still
ENABLED, guard NOT bound, Foreground service DOWN, and the log simply STOPS at 09:24:45 with no
service_unbound/service_destroyed → a hard SIGKILL of the whole app process (device =
Redmi 2201117SG, HyperOS V816, Android 13 → MIUI powerkeeper). The v1.1.2/v1.1.3 design was
inverted: an AccessibilityService is only ever started by the system, so nothing brought it
back. Owner asked for the best keep-alive (AlarmManager / WorkManager / BOOT receiver) and
explicitly: do NOT remove the Debug Log UI or the native logging.

## v1.1.4 keep-alive (four independent restarters, all system-registered)

- [x] `GuardWatchdogService.kt` — layer 1: normal `START_STICKY` foreground service, owns the
      single persistent notification (channel `focus_guard_status`, id 42), heartbeat every 30 s
      (`watchdog_heartbeat`), re-arms alarm+job on every `onStartCommand`, `onTaskRemoved` keeps
      the guard up when the app is swiped from Recents. Every 60 s checks
      `FocusAccessibilityService.isRunning`: 2 min → log `guard_missing`, 3 min → HIGH-importance
      "FocusBlocker guard is off" notification (channel `focus_guard_alert`, id 43), cleared by
      `guard_recovered`. `start()` ladder: startForegroundService → startService (receiver temp
      allowlist) → log `watchdog_failed`; a failed startForeground() after a foreground request
      calls `stopSelf()` (avoids the 5 s system crash).
- [x] `GuardScheduler.kt` — layer 2 inexact repeating `AlarmManager` every 15 min + a one-shot
      `setAndAllowWhileIdle` arm re-armed on every tick (fires during Doze; no exact-alarm
      permission needed) + layer 3 persisted 15-min `JobScheduler` job; both re-armed from boot,
      package-replace, watchdog start, job run and app open. `maybeLogWakeup()` logs only when the
      heartbeat is ≥5 min stale (routine ticks must not flush the 100-entry buffer).
- [x] `GuardWakeupReceiver.kt` — layer 4: `WAKEUP` (alarm), `BOOT_COMPLETED`, `QUICKBOOT_POWERON`,
      `MY_PACKAGE_REPLACED`, `exported="false"`; re-arms first, then starts the watchdog.
- [x] `GuardJobService.kt` — the JobService behind layer 3.
- [x] `FocusAccessibilityService`: `onServiceConnected` arms everything + starts the watchdog,
      then `ensureForeground()` (1.2 s later) falls back to the v1.1.2 self-`startForeground()`
      (own id 44, `fgs_fallback`) only if the watchdog is not foreground.
- [x] `FocusGuardStore`: `setHeartbeat` / `lastHeartbeat` on top of the untouched debug log.
- [x] Manifest: watchdog service (`specialUse` + subtype property), wakeup receiver, job service
      (`BIND_JOB_SERVICE`), `RECEIVE_BOOT_COMPLETED`.
- [x] Module: `ensureKeepAlive`, `openAutostartSettings` (MIUI/HyperOS, Huawei, ColorOS/Realme,
      vivo, Samsung, ASUS chain → app-details fallback), `getServiceHealth` extended
      (watchdogRunning, watchdogForeground, heartbeatAgeMs, manufacturer, brand,
      autostartAvailable; foregroundActive = watchdog OR accessibility fallback).
- [x] `index.js`: `ensureKeepAlive`, `openAutostartSettings`, extended `EMPTY_HEALTH`.
- [x] App.js: new "5. Keep-alive" section (watchdog pill + heartbeat age, Start keep-alive now,
      Open Autostart settings (Xiaomi), one-time MIUI steps), Debug Log renumbered to "6" and its
      UI/logging left intact, watchdog added to both health lines, footer updated,
      `ensureKeepAlive()` on every launch.
- [x] app.json 1.1.4 / versionCode 6; README Keep-alive section + first-run step 6 + limits.
- [x] Verify: `npm run verify` green (~600-615 modules; bundle contains "Start keep-alive now",
      "Open Autostart settings", ensureKeepAlive), autolinking resolves focus-guard,
      `npm run prebuild:android` OK (android/ deleted after), both manifests parse.
      `npx expo-doctor` is broken in this environment (its npx bundle misses @expo/env under
      Node 26) — tooling, not the project.
- [ ] Owner: commit + push main + tag v1.1.4 → CI assembles the APK, Release on the tag.
- [ ] On-device proof to ask for after install:
      (a) Keep-alive section shows Watchdog **Up** + heartbeat < 90 s;
      (b) leave the phone locked ~1 h → notification still there, heartbeat fresh;
      (c) if it ever dies: the log shows `watchdog_wakeup … without heartbeat (process was
      killed)` — that line is the proof the chain works (before v1.1.4 the log just stopped);
      (d) no friendly fire: typing a keyword in FocusBlocker's own setup screen is never blocked.

NOW: SHIPPED. Commit 02fd95c → main + tag v1.1.4 (2026-11-11). Tag CI run 43014568217 SUCCESS,
Release live: https://github.com/elyasyy23-lgtm/FocusBlocker/releases/download/v1.1.4/FocusBlocker-release.apk
(30.9 MB). Next: owner installs it and verifies Keep-alive (Watchdog Up, heartbeat <90 s), survival
after ~1 h locked, the `watchdog_wakeup … without heartbeat` log line after a real kill, and the
three MIUI toggles (Autostart ON, No restrictions, Recents lock).

## Decisions (2026-11-11, v1.1.4)

- No WorkManager: it pulls androidx.work into a module that has no androidx deps, and
  framework-only `JobScheduler.setPeriodic(15 min).setPersisted(true)` gives the same guarantee.
- The single persistent notification belongs to the watchdog, not the accessibility service —
  whoever survives must own it. The accessibility service keeps its own notification id (44) so
  its `stopForeground(STOP_FOREGROUND_REMOVE)` can never remove the watchdog's.
- `START_STICKY` + alarm + persisted job + boot receiver = four doors; each one is guarded by
  try/catch and logs its own failure, so no single failure is silent.
- MIUI Autostart / battery-saver cannot be set by code (no API). Deep link + explicit steps +
  the 3-minute "guard is off" notification are the honest answer; the UI never pretends
  otherwise.
- Still no wake-lock: it keeps the CPU awake, it does not stop process kills (v1.1.3 decision).

## Earlier state (kept for context)

- v1.1.2 `3b1b155` (FGS + global text detection), v1.1.3 `93c31a5` (in-app debug log,
  battery-optimization dialog, `getServiceHealth`). Both shipped with a GitHub Release.
- Build: GitHub Actions `.github/workflows/android-release.yml` (push → artifact APK;
  `v*` tag → GitHub Release), debug-keystore signed, arm64-v8a + armeabi-v7a.
