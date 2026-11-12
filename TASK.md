# TASK — Tavakkol v1.3.1 (strict lock + Partner PIN)

GOAL: make the guard genuinely strict. With a Partner PIN saved, the app itself is gated on
every foreground (PIN keypad), and the accessibility service kicks the user out of the system
"Device admin apps" page and of Tavakkol's own app-info page (force-stop / uninstall) unless a
correct PIN was entered in the last 15 min. Owner decision (2026-11-12, final): the PIN is
ONLY for entering the app — Settings and the Protection switch are never PIN-gated.
v1.3.0 (Help + Donate) rides along in the same release — it was built but never pushed.

## v1.3.1 steps

- [x] `FocusGuardStore.kt` — PIN_MIN/MAX (4-8), `partner_pin_hash` + `partner_pin_salt`
      (SHA-256 of salt+pin, `SecureRandom` 16-byte salt), `strict_unlock_until`,
      `isValidPin` / `hasPin` / `setPin` / `verifyPin` (constant-time compare, opens the
      15-min window) / `clearPin` / `unlockUntil` / `strictLocked` / `clearUnlockWindow`.
- [x] `FocusGuardModule.kt` — `setPartnerPin` (rejects invalid), `verifyPartnerPin`,
      `clearPartnerPin` (needs the current PIN), `getStrictState` → `{pinSet, locked,
      unlockMinutesLeft}`; `getConfig` now carries pinSet / strictLocked / unlockMinutesLeft;
      `setEnabled(false)` closes the window.
- [x] `FocusAccessibilityService.kt` — `guardStrictSettings(event)` runs FIRST in
      `onAccessibilityEvent`, throttled to one scan / 500 ms, only for Settings packages
      (AOSP + MIUI/HyperOS/Samsung/OPPO/ColorOS/vivo): reads the page text and presses BACK on
      the device-admin page, or on our own app-info page when "force stop"/"uninstall" is
      visible. Logs `strict_guard`. `collectScreenText` = breadth-first text collector
      (220 nodes / depth 14).
- [x] `modules/focus-guard/index.js` — `setPartnerPin`, `verifyPartnerPin`, `clearPartnerPin`,
      `getStrictState` + the three new config fields in `EMPTY_CONFIG`.
- [x] `src/components/PinPad.js` — dots + numeric keypad (no TextInput: no IME, no autocorrect),
      OK/backspace, 4-8 digits, used by both the gate and the dialog.
- [x] `src/screens/LockScreen.js` — full-screen gate (lock badge, localized title, keypad,
      wrong-PIN error, "ask your partner" hint).
- [x] `App.js` — boot loader while the config loads (no content flash), gate above every screen
      when `pinSet && enabled && !sessionUnlocked`, re-lock on background, `unlockApp` via
      `verifyPartnerPin`. The Protection switch is a plain switch (no PIN, no dialog).
- [x] `src/screens/SettingsScreen.js` — "Partner PIN" section: Set / Change / Remove
      (enter → repeat; change and remove ask for the current PIN first), using the same PinPad.
      This is the only place the PIN is managed, and it never blocks the screen.
- [x] i18n: 179 UI strings / 201 translations (`node scripts/check-i18n.js`).
- [x] Version: app.json 1.3.1 / versionCode 9, buildInfo 1.3.1 (9), package.json 1.3.1.
- [x] Verify: `npm run verify` green (1.1 MB android bundle), prebuild OK (versionName 1.3.1 /
      versionCode 9), module manifest intact, `expo-clipboard` in the lockfile.
- [ ] CI: push main + tag v1.3.1 → both runs green, Release published.
- [ ] Owner: paste the real donation wallet into `src/defaults.js` (`DONATION_WALLET`).
- [ ] Owner on-device: Settings → set a PIN → app locks on next open; wrong PIN refused;
      Settings and the Protection switch open/toggle with no PIN; Settings → Device admin apps
      and Tavakkol's app-info page kicked back while locked; correct PIN opens a 15-minute window.

HONEST LIMITS (documented, not hidden): an accessibility service can only leave a Settings
page, never remove the entry; a normal app cannot force-lock the Device Admin toggle (only a
device-owner/MDM build can); clearing app data (Settings → Storage → Clear data) erases the
PIN, which no non-root app can prevent.

NOW: code + verify done → waiting for "push koro" (main + tag v1.3.1).

---

# TASK — Tavakkol v1.3.0 (Help screen + Support Us / Donate)

GOAL: owner's final scope for v1.3.0 = **Help screen** (scrollable, localized) + **Support Us
(Donate)** section in Settings. The earlier strict-lock list (auto-strict on Protection,
partner PIN, app-info kick, bypass alert) is NOT part of this release — owner narrowed the
scope to Help + Donate ("I ONLY need you to add the Help Screen and the Support Us section").

## v1.3.0 steps

- [x] `src/screens/HelpScreen.js` — scrollable, 5 numbered step cards + Support paragraph +
      the "free app, remember us in your prayers" note. Owner's wording kept verbatim
      (step titles/bodies are i18n keys).
- [x] Settings → new "Help" section ("How to use Tavakkol" button) + "Support Us" section
      (donate text, Donate button, Share App, Contact Developer).
- [x] Donate sheet (Modal): network label, wallet address (selectable), Copy button
      (`expo-clipboard` ~58.0.4 added + autolinked), Close. Empty wallet → honest
      "address is not set yet" message instead of a fake address.
- [x] `src/defaults.js`: `DONATION_WALLET` (owner must paste their address) + `DONATION_NETWORK`.
- [x] Main screen: "?" help button next to the gear; hardware Back returns Help → Settings → main.
- [x] i18n: all new strings translated (fa) — `node scripts/check-i18n.js` = 150 UI strings,
      166 dictionary entries. Gate now also scans HelpScreen.js.
- [x] Version: app.json 1.3.0 / versionCode 8, buildInfo 1.3.0 (8), package.json 1.3.0.
- [x] Verify: `npm run verify` green (622 modules), prebuild OK (label Tavakkol, queries intact),
      `expo-clipboard` autolinked.
- [ ] Owner: paste the real donation wallet address into `src/defaults.js` before shipping.
- [ ] Owner: install + check Help screen (en/fa), Donate sheet, Back navigation.

NOTE (honesty): help step 4 describes the Partner PIN / strict lock, which is NOT implemented
yet — the text is the owner's copy for the coming v1.3.1 strict-lock work.

NOW: done and folded into the v1.3.1 push (same working tree).

---

# TASK — Tavakkol v1.2.0 (rebrand + settings, i18n, excluded apps, whole-word matching)

GOAL: rebrand FocusBlocker to **Tavakkol** and ship the owner's v1.2.0 feature set:
a real Settings screen (language en/fa, excluded apps, share, contact), full English/Persian
i18n, per-app exclusion, word-boundary keyword matching (fixes the "gi" keyword firing
inside "payam-resan"), the prayer text, a background image, and default keywords seeded once.
Locales: Persian strings are written in Persian script in the app itself (the chat stays
English). Debug Log UI + native logging stay untouched (owner rule from v1.1.4).

## v1.2.0 steps

- [x] `src/theme.js` — COLORS, overlay, direction/textAlign helpers (per-node RTL, no restart).
- [x] `src/i18n.js` — English string IS the key; `createTranslator`, `format` ({{name}}),
      full fa dictionary; `scripts/check-i18n.js` fails the build gate on a missing key.
- [x] `src/defaults.js` — DEFAULT_KEYWORDS = sex, porn, casino; APP_SHARE_URL; Rubika dev id.
- [x] `src/buildInfo.js` — VERSION 1.2.0 / VERSION_CODE 7 / VERSION_LABEL.
- [x] `src/components/ui.js` — Section / StatusPill / ActionButton / Chip / GiftNote.
- [x] `src/screens/SettingsScreen.js` — language toggle, excluded-apps picker (search,
      launcher apps only), share app, contact developer (Rubika), about footer.
- [x] `App.js` — i18n everywhere, background ImageBackground + dark overlay, gear → Settings,
      one-time keyword seeding via `defaultsSeeded`, prayer GiftNote, excluded-app handlers,
      Settings receives the shared `message`.
- [x] Native: `FocusGuardStore` (excluded_apps, defaults_seeded, language + text helpers);
      `FocusAccessibilityService` (whole-word + Persian normalization — Arabic yeh/kaf/heh
      folding, ZWNJ, diacritics; excluded-package skip; localized toast/notification);
      `FocusGuardModule` (getInstalledApps / getExcludedApps / setExcludedApps / getLanguage /
      setLanguage / openUrl); watchdog + device-admin texts localized; `values-fa/strings.xml`;
      manifest `<queries>` MAIN/LAUNCHER so the picker can see apps on Android 11+.
- [x] `app.json` name Tavakkol, version 1.2.0, versionCode 7; `package.json` 1.2.0.
- [x] `assets/background.jpg` — generated placeholder (drop the owner's photo in with
      `node scripts/set-background.js <image>` → crops to 1080x1920).
- [x] Verify: `npm run verify` (622 modules, background asset bundled),
      `node scripts/check-i18n.js` (135 strings, all translated), prebuild + manifest merge.
- [x] SHIPPED 2026-11-12: commit `e1d94d4`, tag `v1.2.0`, CI green (main 43253253110, tag
      43253259589) → https://github.com/elyasyy23-lgtm/FocusBlocker/releases/download/v1.2.0/FocusBlocker-release.apk
- [ ] Owner: install the v1.2.0 release APK, check Persian RTL, the excluded-apps picker,
      and that "payam-resan" no longer trips the "gi" keyword.
- [x] Owner's photo is in place (337x471 source — soft when stretched; swap for a bigger one later).

NOW: v1.2.0 shipped and released. Waiting on owner's on-device check.

---

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
