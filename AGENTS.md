This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Project: Tavakkol (state as of 2026-11-13, v1.3.3)

Android-only self-control app, English UI, Expo SDK 58 / RN 0.88.1 / React 19.3.
v1.1.2 died again ~a day after install (never verified on-device); v1.1.3 adds an
in-app DEBUG LOG so the next death shows its cause.

- `App.js` — the entire UI. Talks to the native module through `modules/focus-guard/index.js`
  (never import `requireNativeModule` in a screen; the wrapper no-ops in Expo Go).
  Save buttons (v1.3.2, owner request) are GREEN when the editor text equals the stored
  list (`keywordsSaved` / `domainsSaved`, derived from `config.*.join(', ')` — stateless,
  survives restart) and turn WHITE the moment the text changes, so white always means
  "unsaved edits". `ActionButton`'s `saved` prop is three-state (undefined = plain primary,
  false = pending white, true = saved green). Requests `POST_NOTIFICATIONS` once on mount (Android 13+).
- `modules/focus-guard/` — local Expo module, autolinked, no package.json:
  - `FocusAccessibilityService.kt` — the guard. TWO rules, both from SharedPreferences:
    (1) keyword = text that CHANGES on screen: checked first on `event.source`
    (input fields for every event type; ANY view for `TYPE_VIEW_TEXT_CHANGED` since v1.1.2 —
    that is what catches the Google search widget, Chrome omnibox and Telegram/Rubika
    bubbles; `event.text` fallback when source is null), then in a throttled (350
    ms/package) input-field/address-bar BFS of `rootInActiveWindow` (depth 40 / 600 nodes);
    (2) domain = URL read from an address-bar node (viewId hints
    url_bar/omnibox/address_bar/location_bar) or, for known browser packages, any explicit
    `://` URL; host suffix match against the domain list. On a hit: 900 ms cooldown,
    counter++, Toast, ONE immediate `GLOBAL_ACTION_BACK`, then a recheck every 800 ms that
    presses BACK again (max 3) and finally HOME if the page/field is still blocked.
    v1.1.2 keep-alive: `startForegroundGuard()` runs in `onServiceConnected` (channel +
    ongoing `IMPORTANCE_LOW` notification, `FOREGROUND_SERVICE_TYPE_SPECIAL_USE` on API
    34+, plain 2-arg `startForeground` below) and `stopForeground` in `stopInternal` —
    the app process is what Android killed ~30 min after backgrounding (the v1.1.1
    "sudden stop" root cause); the notification doubles as a live alive/dead diagnostic.
    Own-app exclusion: `isOwnPackage()` checks the EVENT package, the edited NODE's
    package, the tree ROOT package and the service's own `packageName` against
    `APP_PACKAGE_NAME = "com.focusblocker.app"`; `triggerBlock()` refuses own packages;
    every keyword hit is additionally gated by `ownWindowActive()` (walks `windows`,
    root-window fallback) because the IME (Gboard suggestions) fires text events with the
    KEYBOARD's package while our setup screen is the active window — without that gate the
    v1.1.2 global matcher would re-introduce the v1.1.0 self-block bug through the
    keyboard. `isOwnPackage` itself was verified correct during the v1.1.2 investigation —
    it skips ONLY our app, it was never the cause of the stop.
  - `FocusGuardModule.kt` — JS API: `getConfig` (JSON string: keywords, domains, enabled,
    blockCount, lastBlockPackage/Reason/At, accessibilityEnabled, deviceAdminActive),
    `setKeywords`, `setDomains`, `setEnabled`, `isAccessibilityEnabled`,
    `openAccessibilitySettings`, `isDeviceAdminActive`, `requestDeviceAdmin`, `lockScreen`,
    `resetBlockCount`, `getDebugLogs` (JSON array oldest-first), `clearDebugLogs`,
    `getServiceHealth` (accessibilityEnabled, serviceRunning, foregroundActive,
    batteryOptimizationIgnored, sdkInt), `requestIgnoreBatteryOptimizations` (system
    "Unrestricted" dialog). Every setter calls `FocusAccessibilityService.reload()`.
  - `FocusGuardStore.kt` — SharedPreferences (`focus_blocker_prefs`) so the service works with
    the RN runtime dead. Domains are normalized to bare hosts (scheme/www./path/port stripped,
    must contain a dot).
  - `FocusDeviceAdminReceiver.kt` + `res/xml/device_admin.xml` (`<force-lock />`) —
    an ACTIVE admin is what blocks uninstall; the policy only grants `lockNow()`.
  - `android/src/main/AndroidManifest.xml` — service (now with
    `android:foregroundServiceType="specialUse"` + `PROPERTY_SPECIAL_USE_FGS_SUBTYPE`
    property) + device-admin receiver + `GuardWatchdogService` (same specialUse property),
    `GuardWakeupReceiver` and `GuardJobService` (`BIND_JOB_SERVICE`, exported=false) — merged
    into the app by Gradle. Declares `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_SPECIAL_USE`,
    `POST_NOTIFICATIONS`, `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`, `RECEIVE_BOOT_COMPLETED`.
  - v1.1.4 keep-alive (owner-reported: FGS DOWN, guard unbound, log just stops = hard SIGKILL;
    device is **Redmi 2201117SG / HyperOS V816 / Android 13**, i.e. MIUI powerkeeper). The v1.1.2
    design was inverted — an AccessibilityService only ever starts from the system, so nothing
    restarted it after a kill. Now:
    - `GuardWatchdogService.kt` — a NORMAL `START_STICKY` service (layer 1) that owns the single
      persistent notification (`focus_guard_status`, id 42), writes a heartbeat every 30 s
      (`watchdog_heartbeat` in prefs), re-arms alarm+job in `onStartCommand`, logs
      watchdog_started / watchdog_task_removed / watchdog_destroyed / fgs_started / fgs_failed.
      Every 60 s it checks `FocusAccessibilityService.isRunning`: after 2 min → `guard_missing`,
      after 3 min → a HIGH-importance "FocusBlocker guard is off" notification (channel
      `focus_guard_alert`, id 43) that clears itself on `guard_recovered`. `start()` tries
      startForegroundService → startService (a receiver woken by an alarm is on the temp
      allowlist), and a startForeground() failure after a startForegroundService request calls
      stopSelf() to dodge the 5 s system crash.
    - `GuardScheduler.kt` — layer 2: inexact repeating `AlarmManager` every 15 min PLUS a
      one-shot `setAndAllowWhileIdle` arm re-armed on every tick (Doze-proof; neither needs
      SCHEDULE_EXACT_ALARM); layer 3: persisted 15-min `JobScheduler` job. Both re-armed
      from boot / package-replace / watchdog start / job run / app open, because reboots and
      force-stops wipe them. `maybeLogWakeup()` writes watchdog_wakeup / job_tick ONLY when the
      heartbeat is ≥5 min stale — routine ticks must never flush the 100-entry log.
    - `GuardWakeupReceiver.kt` — layer 4: manifest receiver for `com.focusblocker.guard.WAKEUP`
      (alarm), `BOOT_COMPLETED`, `QUICKBOOT_POWERON`, `MY_PACKAGE_REPLACED`, `exported="false"`.
    - `GuardJobService.kt` — the JobService behind layer 3.
    - `FocusAccessibilityService` no longer goes foreground first: `onServiceConnected` arms
      everything, starts the watchdog, and 1.2 s later `ensureForeground()` falls back to the old
      self-`startForeground()` (own id 44, logged as `fgs_fallback`) only if the watchdog is not
      foreground — so a refused background start degrades to exactly the working v1.1.2 behavior.
      `stopForeground(STOP_FOREGROUND_REMOVE)` only ever touches its own id.
    - Module: `ensureKeepAlive` (arms all three, called on every app launch — also the recovery
      path after a force-stop) and `openAutostartSettings` (vendor autostart Activity chain:
      MIUI/HyperOS, Huawei, ColorOS/Realme, vivo, Samsung, ASUS → fallback app-details page;
      returns `{opened:'autostart'|'app_details'}`). `getServiceHealth` now also returns
      watchdogRunning, watchdogForeground, heartbeatAgeMs (-1 = never), manufacturer, brand,
      autostartAvailable, and `foregroundActive` is the OR of watchdog + accessibility fallback.
    - App.js: new section "5. Keep-alive" (watchdog Up/Down pill + heartbeat age, "Start keep-alive
      now", "Open Autostart settings (Xiaomi)", the one-time MIUI steps) and the old Debug Log
      section renumbered to 6 with the watchdog added to its health line. Debug Log UI + native
      logging untouched by owner request.
    - There is NO API for Autostart/battery-saver — those stay user actions (deep link + text).
      Still no wake-lock (keeps CPU awake, does not stop process kills).
  - v1.1.3 debug log: `FocusGuardStore` keeps the last 100 events as JSON in the SAME
    SharedPreferences (`debug_log`, synchronized read-modify-write, corrupted JSON
    self-heals, text capped 160 chars) — survives process kills, which is the failure
    under investigation. The service logs service_connected/unbound/destroyed/interrupted,
    fgs_started / **fgs_failed** (a refused `startForeground()` was silent before — prime
    suspect for the overnight death), keyword_detected (pkg + matched text — only AFTER
    the `ownWindowActive` gate, else our own setup screen floods the buffer),
    domain_detected, block_triggered, block_recheck_back/home/clear, scan_failed.
    `isForegroundActive` companion flag (same private-setter pattern as `isRunning`)
    feeds `getServiceHealth`. NO wake-lock: it keeps the CPU awake but does not stop
    process kills — the fix path is the battery-optimization exemption dialog.
    App.js "5. Debug Log" section: live health line (service/FGS/battery) + Show Logs
    modal (FlatList, newest first, colored types, Refresh/Clear/Close, battery-fix
    button). Health refetches on every app foreground.
- v1.2.0 (owner request — rebrand + settings): display name is **Tavakkol**; package names
  (`com.focusblocker.app` / `com.focusblocker.guard`) and the remote are UNCHANGED, so it
  upgrades over a v1.1.x install. New JS layout (the file named in the code below is still
  the real one):
  - `App.js` — screen only: i18n via `t()`, `ImageBackground` (`assets/background.jpg`) + a
    dark overlay, gear icon → Settings, one-time seeding of `DEFAULT_KEYWORDS`
    (`src/defaults.js` = sex/porn/casino) guarded by `defaultsSeeded`, prayer `GiftNote`,
    excluded-app handlers.
  - `src/theme.js` (COLORS, overlay, per-node `direction`/`textAlign` — RTL without an
    I18nManager restart), `src/i18n.js` (English string IS the key, `createTranslator`,
    `format('{{name}}')`, full Persian dictionary), `src/defaults.js`, `src/buildInfo.js`
    (1.2.0 / code 7), `src/components/ui.js` (Section/StatusPill/ActionButton/Chip/GiftNote),
    `src/screens/SettingsScreen.js` (language en/fa, excluded-apps picker with search —
    launcher apps only — share, Rubika contact, about).
  - Language + excluded apps persist in the SAME native prefs (`excluded_apps`,
    `defaults_seeded`, `language`) so the service and the JS agree.
- v1.2.0 keyword matching (bug: "gi" fired inside "payam-resan"): the service now compiles a
  whole-word regex per keyword — `compileKeywordPatterns()` / `buildWordPattern()` /
  `matchesKeyword()`, boundaries `(?<![\p{L}\p{N}])…(?![\p{L}\p{N}])`,
  plus `normalizeForMatch()` (Arabic yeh/kaf/heh folded to Persian, ZWNJ variants unified,
  diacritics stripped) so a Persian phrase with a space or half-space still matches. Keywords
  containing spaces match as a phrase.
- v1.2.0 per-app exclusion: `FocusGuardStore` keeps the excluded package list;
  `FocusAccessibilityService` returns early (`isExcludedPackage`) for events/windows of those
  packages, so a done/du'a app can be whitelisted. Module adds `getInstalledApps` (queries
  LAUNCHER activities only, sorted with a Persian-aware Collator, own package filtered),
  `getExcludedApps`, `setExcludedApps`, `getLanguage`, `setLanguage`, `openUrl`. The module
  manifest carries a `<queries><intent> MAIN/LAUNCHER` entry — without it Android 11+ returns
  only our own package.
- v1.2.0 localization: toast / watchdog notification channels / device-admin explanation are
  language-aware (native `text(key)` helper in `FocusGuardStore`); `res/values/strings.xml` +
  `res/values-fa/strings.xml` hold the service label and admin description.
- v1.2.0 verification additions: `node scripts/check-i18n.js` (fails when a `t('…')` key has no
  Persian entry — 135 strings, all covered) and `scripts/set-background.js <img>` (jimp-compact
  crop to 1080x1920 → `assets/background.jpg`; the shipped file is a generated placeholder
  because `/storage/emulated/0/Download` is not readable from Termux).
- v1.2.0 SHIPPED 2026-11-12: commit `e1d94d4` → main + tag `v1.2.0`; CI runs 43253253110 (main)
  and 43253259589 (tag → Release) both SUCCESS; release live, APK 30.9 MB at
  https://github.com/elyasyy23-lgtm/FocusBlocker/releases/download/v1.2.0/FocusBlocker-release.apk
  (logo/display name Tavakkol; the ASSET filename still says FocusBlocker because the workflow
  names the artifact — harmless, rename in the workflow if it ever matters).
  Owner's background photo is `assets/background.jpg` (337x471 source, cover-scaled — soft on a
  big screen; swap with `node scripts/set-background.js <img>` and re-tag).
  Lesson: Termux cannot compile Kotlin, so the FIRST CI run is the real compiler — the first
  push failed on `compareBy(collator) { it.second }` (type inference: 4 errors). Fixed by an
  explicit `Comparator<Pair<String,String>> { … }`. Keep sorts explicit.
- v1.3.0 (2026-11-12): Help screen + Support Us (Donate). Owner narrowed the release scope to
  these two — the strict-lock list (auto-strict on Protection, partner PIN, app-info-page kick,
  bypass alert) is NOT implemented and belongs to the next version.
  - `src/screens/HelpScreen.js` — scrollable; `STEPS` array of {title, body} i18n keys rendered as
    numbered cards, then the Support paragraph and the GiftNote. Owner's wording is verbatim
    ("Strict Lock & Partner PIN" is described even though the feature does not exist yet — keep
    that in mind before telling users it works).
  - Settings gains a "Help" section (`onOpenHelp`) and a "Support Us" section: Donate → Modal
    sheet (`expo-clipboard` for Copy), plus the existing Share/Contact actions.
  - `src/defaults.js`: `DONATION_WALLET` (EMPTY until the owner pastes their address — the sheet
    then says "not set yet" rather than showing a fake address) + `DONATION_NETWORK`.
  - Routing: `screen` is now 'main' | 'settings' | 'help'; a `BackHandler` effect sends hardware
    Back Help → Settings → main (previously Back exited the app from Settings).
  - Main header: "?" button next to the gear (`styles.headerActions`, `gap: 10`).
  - `expo-clipboard ~58.0.4` added (autolinks; no config plugin needed) — `npm ci` in CI needs the
    updated package-lock.json, so always install with `npx expo install <pkg>`.
  - `scripts/check-i18n.js` now also scans HelpScreen.js (150 strings / 166 entries).
- Decisions (2026-11-10): `expo-pilot` is NOT used as the engine — its listeners run in JS and die
  with the backgrounded RN runtime. `react-native-device-admin` does not exist on npm (404).
  v1.1.0's "page body text deliberately ignored" was SUPERSEDED in v1.1.2 by owner request:
  keywords match any on-screen text CHANGE (chat apps included); the throttled tree walk
  still matches only input fields + address bars, so static page body text stays ignored.
  Known edge accepted: a text-change hit from a non-active split-screen app still presses
  BACK once.
- Verification (`npm run verify` = `expo export --platform android --no-bytecode`): ~600-615
  modules (Metro counts vary), plus
  `npx expo-modules-autolinking resolve -p android --json | grep focus-guard`,
  `npm run prebuild:android`, manifest XML parse (python ElementTree — no xmllint on Termux).
  `npx expo-doctor` is currently BROKEN in this environment (its npx bundle misses `@expo/env`
  under Node 26 and @expo/env symlinking does not fix it) — that is tooling, not the project.
  Termux cannot compile Kotlin — a green bundle is the local ceiling; Gradle compiles in
  GitHub Actions CI.
- `android/` and `dist/` are generated; deleted after verification. Do not hand-edit them.
- Build: **GitHub Actions** `.github/workflows/android-release.yml` — push to `main` produces
  `FocusBlocker-release-apk`; a `v*` tag also publishes a GitHub Release. It runs
  `npm ci` → `expo prebuild --platform android --clean --no-install` → `./gradlew
  assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a` on Node 22 / JDK 21, and the
  Expo template signs release with the debug keystore (installable).
  EAS alternative: `eas build -p android --profile preview`. Never ship the default `.aab`.
- Not yet installed on a device: first-run steps are in README.md (accessibility toggle,
  Android 13+ "Restricted setting" workaround, device admin, removal steps).

### Strict lock + Partner PIN (v1.3.1)

- Store: `FocusGuardStore.kt` → `partner_pin_salt`, `partner_pin_hash` =
  `sha256(salt + pin)`, `strict_unlock_until`. 4-8 digits (`isValidPin`). A correct
  `verifyPin` opens a 15-minute `STRICT_UNLOCK_MS` window and nothing else; the PIN is never
  stored in clear and never leaves the device.
- `strictLocked(ctx) = isEnabled && hasPin && now >= unlockUntil` — the ONE predicate shared by
  the guard and `getConfig`/`getStrictState` (`pinSet`, `strictLocked`/`locked`,
  `unlockMinutesLeft`). `setEnabled(false)` closes the window.
- Guard: `guardStrictSettings(event)` is the FIRST thing `onAccessibilityEvent` does. Only for
  Settings packages (`SETTINGS_PACKAGES`: AOSP, MIUI/HyperOS, Samsung, OPPO/ColorOS, vivo),
  throttled 500 ms, `collectScreenText` BFS (220 nodes / depth 14). Fires BACK + toast when the
  page looks like `ADMIN_PAGE_TOKENS` (device admin) or `OUR_PAGE_TOKENS` + `DANGER_TOKENS`
  (our app-info page with force stop/uninstall). Logs `strict_guard`.
  **v1.3.2 (owner decision)**: the gate is `FocusGuardStore.isEnabled(this)` — Protection ON —
  NOT `strictLocked`; the PIN is only for opening the app. Detection now tries the Settings
  ACTIVITY name first (`rememberSettingsActivity()` records the class name of every
  TYPE_WINDOW_STATE_CHANGED from a Settings package; `ADMIN_ACTIVITY_TOKENS` = deviceadmin /
  device_admin, matching `Settings$DeviceAdminSettingsActivity` / `...DeviceAdminAddActivity`
  on AOSP and OEM skins) and presses Back instantly with no tree walk; the page-text scan stays
  as the throttled fallback. `pressBackOutOfAdminPage()` presses Back again if the page
  survives (MAX_ADMIN_BACKS = 3 inside a 6 s window) and then `GLOBAL_ACTION_HOME`, so the
  page cannot be opened at all. The toast is PIN-aware (`guardLockedMessage()`): with a PIN it
  says "برنامه توکل قفل است — رمز همراه را در برنامه وارد کنید.", without one it says
  "محافظت توکل روشن است — ابتدا محافظت را در برنامه خاموش کنید.".
- UI: `src/components/PinPad.js` (dots + keypad, no TextInput — no IME/autocorrect) and
  `src/screens/LockScreen.js`. `App.js` gates above every screen when locked, re-locks in the
  AppState background branch, and shows a boot loader until the config loads (no content flash).
  v1.3.2 LockScreen (owner request): title "برنامه توکل قفل است", **no Unlock button** — every
  keystroke is verified, so a correct PIN opens the app the instant it is complete (a wrong
  PIN only reports itself after 700 ms of no typing, then clears the field; at the 8-digit cap
  it reports immediately). `onSubmit` returns a boolean, `PinPad` is called with
  `showOk={false}`.
  v1.3.3 lockout: `MAX_ATTEMPTS = 3` wrong PINs → the whole keypad is disabled for
  `LOCKOUT_MS = 30_000` with a live countdown (`Try again in {{seconds}}s…`, Persian digits via
  `formatNumber(value, lang)` from src/i18n.js). The counter lives in a MODULE-LEVEL
  `guardState {failures, lockedUntil}` — the gate is unmounted whenever the app backgrounds, so
  component state would hand out free retries. One failure is counted per COMPLETED wrong entry
  (the 700 ms pause or the 8-digit cap), never per keystroke, otherwise a 6-digit PIN would burn
  three attempts while being typed. Success and the end of the countdown both reset it.
  Honest limit: process memory only — a force-stop or reboot clears the lockout.
  SCOPE (owner decision 2026-11-12): the PIN guards ONLY entering the app — the Protection
  switch needs no PIN, Settings needs no PIN. The PIN is set/changed/removed in Settings'
  "Partner PIN" section (`src/screens/SettingsScreen.js`).
- Honest limits (keep them in the UI/docs): a Settings entry can be left but not removed; the
  Device Admin toggle cannot be force-locked by a normal app (device-owner/MDM only); clearing
  app data erases the PIN.

### v1.3.2 (2026-11-13, owner request list — all applied)

- **Name/icon**: Persian app name is **توکل** (`locales/fa.json` → Expo `locales` writes
  `values-b+fa/strings.xml`), English stays Tavakkol. Icon comes from the owner's photo
  (`scripts/make-icon.js` → `assets/icon.png` 1024², `android-icon-foreground.png` inset +
  rounded, `android-icon-background.png` #0B0F14); `android-icon-monochrome.png` deleted and
  the `monochromeImage` key removed from app.json.
- **Light page theme** (the owner's background photo is bright, avg luminance 177): `src/theme.js`
  gained a second color set — `pageBackground #EEF3F8`, `pageText #0F172A`, `pageMuted #334155`,
  `pageAccent #15803D`, `pageWarning #9A3412`, `pageError #B91C1C` — used for text that sits
  directly on the photo (screen titles, hints, messages, version footer) in App.js,
  SettingsScreen.js and HelpScreen.js, with `StatusBar barStyle="dark-content"` on those
  screens. Cards stay dark translucent with light text.
- **Excluded apps**: only the first 3 rows are listed; `Show more ({{count}})` / `Show less`
  (`showAllApps` state) reveals the rest — a search always shows every match, so the filter
  stays useful. `ActionButton` save buttons are green-when-saved / white-when-edited (above).
- **Support Us** rewritten: owner's exact Persian description
  («برنامه توکل کاملاً رایگان است و تبلیغ ندارد…»), then two buttons —
  "Support from inside Iran" (ZarinPal) and "Support from outside Iran" (crypto). The donate
  sheet is mode-aware (`donateMode` = 'iran' | 'crypto'); `DONATION_ZARINPAL_URL` in
  `src/defaults.js` is EMPTY until the owner pastes the link (sheet then says the link is not
  set yet — never a placeholder destination). Share App + Contact Developer moved OUT of
  Support into a new "More" section.
  v1.3.3: the sheet body is the owner's new wording («از اینکه با حمایت خود، به ادامه توسعه
  برنامه توکل کمک می‌کنید سپاسگزاریم…»), the wallet is filled
  (`TANP1ibS4DsF2C1p1rBGAZ5MrGZyS5sUmU`, checksum-verified TRC20), and Contact Developer opens
  Rubika **@yasmajyd** (`DEVELOPER_RUBIKA_ID` drives both the scheme and the https URL).
- **Device-admin guard** — see the Strict-lock section above (Protection-ON gate, activity-name
  detection, repeated Back → Home, PIN-aware toast).
- Verify: `node scripts/check-i18n.js` = 183 UI strings / 210 translations; `npm run verify`
  green (631 modules, 1.1 MB android bundle); `npm run prebuild:android` OK →
  `versionName 1.3.2` / `versionCode 10`, `app_name` = Tavakkol (fa: توکل).
- Pending owner: paste the ZarinPal link + the crypto wallet address into `src/defaults.js`;
  install the release and check the icon, the light text on the photo, the 3-app list +
  Show more, both donation sheets, the auto-submit lock screen, and the Device-admin page
  being kicked while Protection is on.

### Testing (2026-11-10)

- **Expo Go cannot test this app.** `requireNativeModule('FocusGuard')` fails there (no custom
  native code in the Go client), the module no-ops, buttons disable, and the accessibility
  service/device admin entries never exist in Android Settings. Expo Go only proves the UI layout.
- A **development build** is required: `expo-dev-client` is installed (`~58.0.18`) and the
  `development` profile in `eas.json` already sets `developmentClient: true` + `buildType: apk`.
- EAS is logged in on this machine as `elyasyass`; the project IS linked
  (`extra.eas.projectId` in app.json: 3ed68ab7-3693-4ba0-81d1-57aae9912a70).
  EAS uploads **committed** git state; uncommitted edits are not in the build unless the worktree
  is committed first (or `EAS_NO_VCS=1` is set). Primary build path is GitHub Actions (below);
  EAS is the fallback.
- Dev server: `npx expo start --dev-client --localhost` (Metro runs on the phone; the dev build
  reaches it at `http://127.0.0.1:8081`). Dev bundle verified: 742 modules, 4.1 MB, contains
  `FocusGuard`. `--tunnel` only needed when Metro runs on a different machine (this phone has
  mobile data only, so LAN mode never works).
- Termux noise on start: `An unknown error occurred while installing React Native DevTools —
  Cannot read properties of undefined (reading 'arm64')` — harmless, Metro serves normally.
- JS/UI changes hot-reload in the dev build; native changes (Kotlin, manifest, new module) need a
  new dev build. `app.json`'s `scheme` is set to `focusblocker` for dev-client deep links.
- Git: remote `https://github.com/elyasyy23-lgtm/FocusBlocker.git`, default branch `main`
  (local work started on `master` and was pushed to `main`). PAT for `elyasyy23-lgtm` lives in
  `~/.git-credentials`.

### v1.4.0 (2026-11-13) — remote deactivation via SMS · Help cleanup · Share App → About

- **Remote deactivation (new)**: a partner phone turns Protection off with one SMS.
  - `FocusGuardStore.kt` keys: `remote_enabled` (default **false**), `remote_number`,
    `remote_code`, `remote_since`, `remote_last_hash`, `remote_last_at`, `remote_count`;
    helpers `normalizeDigits` (digits only) + `foldDigits` (Persian/Arabic digits → ASCII).
    `setRemoteEnabled` stamps `remote_since = now` on ON and drops the old hash; on OFF it
    clears `remote_since`.
  - `RemoteSmsReceiver.kt` (new) — SMS_RECEIVED receiver. Order of gates: OFF → return
    immediately (nothing parsed/stored); config empty → log `remote_config_missing`;
    `timestampMillis <= remote_since` → `remote_sms_ignored` (this is the "old SMS on boot are
    never processed" rule); sender last-10-digits match; code match = case-insensitive
    `contains` after digit folding; SHA-256(sender|body|stamp) dedupe latch → each message
    exactly once. Match → `setEnabled(false)` + `clearUnlockWindow()` + `reload()` +
    `remote_deactivated` log + HIGH-importance notification (channel `focus_guard_alert`, id 43).
  - Module manifest: `RECEIVE_SMS` permission + `<receiver … android:exported="true"
    android:permission="android.permission.BROADCAST_SMS">` with the SMS_RECEIVED filter.
  - `FocusGuardModule.kt`: `getRemoteState` (JSON) + `setRemoteDeactivation(enabled, number,
    code)` — validates 10+ digits / 4+ chars **only when enabling**, so the kill switch can
    always be turned off even with empty fields. `getConfig` also returns remoteEnabled /
    remoteLastAt / remoteCount.
  - `modules/focus-guard/index.js`: `EMPTY_REMOTE`, `getRemoteState()`, `setRemoteDeactivation()`.
  - `SettingsScreen.js` «کنترل از راه دور»: `Switch` (native prefs are the truth), partner number
    (`phone-pad`), secret command, Save button (green when stored / white when edited — same
    three-state `saved` contract as the keyword lists), live RECEIVE_SMS permission row +
    "Allow SMS access", last-trigger line. The toggle requests the permission itself and
    refuses to turn on when denied.
- Help screen: the "Support" section is GONE (`onOpenSettings` prop removed from
  HelpScreen + App.js); the prayer `GiftNote` stays.
- Share App moved from "More" to a new «دربارهٔ توکل» / About Tavakkol section at the TOP of
  Settings (primary button); Contact Developer stays alone in "More".
- Version 1.4.0 / versionCode 12 (app.json, package.json, package-lock root, buildInfo).
- Verify: `node scripts/check-i18n.js` = 202 UI strings / 233 translations; `npm run verify`
  green (631 modules, 1.1 MB bundle, contains `getRemoteState`/`setRemoteDeactivation`);
  `npm run prebuild:android` OK → versionName 1.4.0 / versionCode 12; module manifest parses
  (RECEIVE_SMS + receiver). Termux still cannot compile Kotlin — the first CI run is the
  compiler.
- v1.4.0 SHIPPED 2026-11-13: commit `020afbe` → main + tag `v1.4.0`; CI 43454906903 (main)
  SUCCESS (Gradle compiled the new `RemoteSmsReceiver.kt`; Termux cannot compile Kotlin),
  tag run 43454928951 builds the Release `Tavakkol-release.apk`.

### v1.4.1 + GitHub Pages download site (2026-11-13)

- `index.html` in the repo ROOT = the public Persian RTL download page, served by GitHub Pages
  (branch `main`, folder `/`). `assets/web-icon.png` = 320px copy of the icon for the page
  (the 1024px `assets/icon.png` is 780 KB — do not use it in HTML). `.nojekyll` present.
- Page: cream + deep-green palette, Vazirmatn (Google Fonts, Tahoma fallback), split hero with
  the real icon, bento features, 3 install steps, Android 13 "restricted setting" note,
  Rubika @yasmajyd + releases footer. Download button points at the CURRENT release APK
  (`…/releases/download/v1.4.1/Tavakkol-release.apk`) — bump that URL with every release, or
  switch it to `…/releases/latest/download/Tavakkol-release.apk` to stop doing that.
- Pages was enabled via API: `POST /repos/{owner}/{repo}/pages` with
  `{"source":{"branch":"main","path":"/"}}` → https://elyasyy23-lgtm.github.io/FocusBlocker/
  (https_enforced, build status checked via `/pages/builds/latest`).
- **Share App now shares the Pages URL**: `APP_SHARE_URL` in `src/defaults.js`
  (`https://elyasyy23-lgtm.github.io/FocusBlocker/`) — it was declared but unused before;
  `SettingsScreen.shareApp` imports it now (no more hardcoded GitHub link).
- Version 1.4.1 / versionCode 13. Push `3b260fa` + `c9bdea0` → main, tag `v1.4.1`; CI
  43464356419 (main) and 43464381806 (tag) both SUCCESS, Release
  `Tavakkol-release.apk` 31 MB live. Verified: `npm run verify` green, bundle contains the new
  URL, live page returns 200 with the v1.4.1 link, icon asset 200.
