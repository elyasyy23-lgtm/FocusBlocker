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

### v1.4.2: Delay Mode + background music (2026-11-13)

- **Delay Mode** (`delay_mode` in SharedPreferences): second switch in the main hero next to
  Protection (`styles.switchGrid` — two cells, RTL row-reverse). Turning Protection OFF while it
  is ON opens a full-screen challenge modal (`styles.delayRoot`): the user must type the long
  challenge text exactly. Paste is blocked twice — `contextMenuHidden` kills the paste menu, and
  `handleDelayChange` rejects any single change that adds >10 chars. Cancel / wrong answer /
  modal close never calls `setEnabled`, so Protection stays ON. Compare is whitespace-insensitive
  (`normalizeChallenge`). `toggleBlocking` = gate, `applyEnabled` = the raw write.
- The challenge lives in `App.js` as `DELAY_CHALLENGE` (English string = i18n key, Persian in
  `src/i18n.js`), so both languages are typed in their own script.
- **Background music** (`SRC assets/background_music.mp3`, 3.2 MB, from the owner's `ssss.mp3`):
  `expo-audio` (expo-av no longer exists in SDK 58 — `expo-audio` is its replacement) +
  `useAudioPlayer` in App.js, `loop = true`, `volume = 0.3`, plays only while AppState is
  `active` and `config.musicMuted` is false. Mute switch in Settings → «موسیقی پس‌زمینه»
  (`music_muted` pref). `app.json` blocks `RECORD_AUDIO` and
  `FOREGROUND_SERVICE_MEDIA_PLAYBACK` (expo-audio injects them; we never record or play in the
  background — the merged manifest shows `tools:node="remove"`).
- Native additions: `FocusGuardStore.delayMode/setDelayMode` + `musicMuted/setMusicMuted`,
  module `getConfig` fields `delayMode`/`musicMuted`, `AsyncFunction("setDelayMode")` /
  `AsyncFunction("setMusicMuted")`, bridge `setDelayMode` / `setMusicMuted`.
- `index.html` download button now uses `…/releases/latest/download/Tavakkol-release.apk` — no
  URL bump per release any more; page version labels say ۱.۴.۲.
- Version 1.4.2 / versionCode 14. Verify: `check-i18n` 220 UI strings / 252 translations,
  `npm run verify` green (642 modules, music asset listed), `npm run prebuild:android` OK
  (versionName 1.4.2 / versionCode 14), `android/` + `dist/` wiped. Kotlin still compiles only
  in CI.

### v1.4.2: in-app update checker (2026-11-13)

- `version.json` sits in the repo root next to `index.html`, so Pages serves it at
  https://elyasyy23-lgtm.github.io/FocusBlocker/version.json —
  `{"latestVersion": "...", "downloadUrl": "..."}`. **To announce a release, edit only
  `latestVersion`** (the download URL is the stable `releases/latest/...` link).
- App.js checks it ONCE per launch (`updateCheckedRef`, 8 s AbortController timeout, fetch with
  `?t=Date.now()` cache-buster + no-cache headers). Every failure is silent — offline must never
  produce an error screen.
- Comparison: `parseVersion` + `isNewerVersion` (dot-separated numeric, missing parts = 0, any
  non-numeric version → never an update). Self-tested: 1.4.10 > 1.4.9, 1.4 == 1.4.0, "abc" → no.
- Only an `https://` `downloadUrl` is accepted (the manifest cannot hand the browser an
  http/intent URL).
- Prompt = transparent centred card modal (`styles.updateBackdrop/updateCard`), Persian text from
  the owner: «نسخه جدید برنامه آماده است! …» with buttons «دانلود بهروزرسانی» / «بعداً».
  Download tries `FocusGuard.openUrl` first (native, handles custom schemes) then `Linking.openURL`.
- i18n now 225 UI strings / 257 translations; bundle green (contains the version.json URL).

### v1.4.3: Delay Mode gate hardened (2026-11-14)

Owner bug: with Delay Mode ON, one tap still turned Protection off — the challenge
modal never appeared. The v1.4.2 gate read `config.delayMode` from React state, so
any staleness let the OFF write through. Fix = NATIVE is the source of truth:

- `FocusGuardModule.kt`: `setEnabled(false)` REFUSES while `delayMode` is on
  (throws `IllegalStateException("Delay Mode is on — type the challenge text to
  turn Protection off.")`); `setEnabledAfterDelayChallenge` is the ONLY OFF writer;
  both go through a shared private `applyEnabled(ctx, enabled)` (set + clearUnlock
  Window + reload). The SMS remote receiver still calls `FocusGuardStore.setEnabled`
  directly — the partner kill switch is unaffected.
- `modules/focus-guard/index.js`: `disableProtectionAfterChallenge()` bridge.
- `App.js`: `toggleBlocking` is `async` and reads the LIVE `delayMode` from
  `FocusGuard.getConfig()` at tap time (falls back to the cached value on a native
  hiccup) before opening the modal; `applyEnabled(value, { afterChallenge })` calls
  the bypass when the challenge passed; if the native write is refused the catch
  auto-opens the modal instead of showing a silent error. `confirmDelayOff` →
  `applyEnabled(false, { afterChallenge: true })`.
- Version 1.4.3 / versionCode 15 (app.json, package.json, package-lock, buildInfo),
  `version.json` latestVersion 1.4.3, `index.html` labels ۱.۴.۳.
- Verified: check-i18n 225/257 OK; `npm run verify` 642 modules (compiled gate
  confirmed in the plain-JS bundle); prebuild versionName 1.4.3 / versionCode 15;
  `android/` + `dist/` wiped. Kotlin still compiles only in CI.
- Lesson: any "gate" that protects a state change MUST read the authoritative value
  fresh (or enforce natively) — never trust a React render's copy of it.

### v1.4.5 — custom drawer · Settings lock · symmetric Delay Mode (2026-11-14)

Owner's list: (1) a drawer nav (hamburger ☰, RTL): Home / Settings / Help + Share App /
Contact Developer / Support Us; (2) while Protection is ON, Settings is COMPLETELY
inaccessible (gear/drawer shows «برای ورود به تنظیمات، ابتدا محافظت را خاموش کنید.») and the
Home lists are read-only — only turning Protection OFF grants access; (3) turning Delay Mode
OFF must ALSO cost the typed challenge; (4) the SMS kill switch bypasses the challenge.

- **NO react-navigation.** The drawer is a hand-built `src/components/Drawer.js` on RN
  `Animated` + `PanResponder` — ZERO new native deps (no native rebuild) and full RTL control
  (slides from the LEFT in EN, the RIGHT in FA; backdrop tap + swipe-to-close; the Settings row
  shows 🔒 and calls `onBlockedSettings` while locked). The navigation packages
  (@react-navigation/drawer, -native, react-native-gesture-handler, -reanimated, -worklets,
  -safe-area-context, -screens) were UNINSTALLED (37 pkgs) and `index.js` reverted to plain
  `registerRootComponent(App)`. `src/components/AppDrawerContent.js` deleted.
- **New JS layout**: `src/screens/HomeScreen.js` (title + the two switches + keyword/domain
  lists; read-only when Protection is ON) and `src/screens/SettingsScreen.js` (☰ header + ALL
  advanced sections: accessibility, device admin, keep-alive, debug log, stats, partner PIN,
  remote control, excluded apps, language, music). `HelpScreen.js` takes `onOpenDrawer`.
  `src/components/DonateSheet.js` = the Support Us modal as a global drawer action.
- **`App.js` is now a state hub**: `screen` = 'main' | 'settings' | 'help'; renders
  Home/Settings/Help + `Drawer` + `DonateSheet` + the delay modal + the update modal. Hardware
  Back closes the drawer first, then returns Home; if Protection turns ON while Settings is
  open the app bounces to Home. `settingsLocked` and `readOnly` both derive from `config.enabled`.
- **Symmetric Delay Mode (native truth)**: `FocusGuardModule.kt` — `setDelayMode(false)` now
  REFUSES while delayMode is on (throws), `setDelayModeAfterDelayChallenge` is the only OFF
  writer (bridge `disableDelayModeAfterDelayChallenge`). Mirrors the v1.4.3 Protection gate
  (`setEnabled` refuses OFF while delayMode on; `setEnabledAfterDelayChallenge`). Both switches
  read the LIVE native flag at tap time before opening the modal. SMS bypass preserved
  (`RemoteSmsReceiver.kt` calls `FocusGuardStore.setEnabled` directly).
- **i18n**: 9 new keys (Menu, Home, the settings-lock message, the Delay-Mode-off challenge
  text, etc.) and `scripts/check-i18n.js` now ALSO scans `HomeScreen.js`, `Drawer.js`,
  `DonateSheet.js` (224 UI strings / 266 translations).
- Version 1.4.5 / versionCode 16 (app.json, package.json, package-lock, buildInfo);
  `version.json` latestVersion 1.4.5; `index.html` labels ۱.۴.۵.
- Verified: check-i18n OK; `npm run verify` green (645 modules; bundle contains
  `disableDelayModeAfterDelayChallenge` and the lock string); `npm run prebuild:android` →
  versionName 1.4.5 / versionCode 16, app_name Tavakkol (fa توکل); module manifest parses
  (RECEIVE_SMS + receiver + keep-alive services); `android/` + `dist/` wiped. Kotlin compiles
  only in CI. SHIPPED 2026-11-14: commit `f4daa21` → main + tag v1.4.5, CI runs 43560395378 +
  43560405437 both SUCCESS, Release `Tavakkol v1.4.5` (35.3 MB) live.

### v1.4.6 — reset Protection on update · Settings gear lock (2026-11-14)

Owner's list: (1) installing a new build must turn Protection OFF automatically — the user turns
it back on by hand (an update must never be a way to slip past the guard); (2) the drawer (☰)
still opens while Protection is ON, but the **Settings gear (⚙️)** is locked with a message and
the keyword/domain boxes stay read-only.

- **Protection reset on update — three idempotent paths**:
  1. `GuardWakeupReceiver.kt` — on `ACTION_MY_PACKAGE_REPLACED` (the canonical "app was updated"
     broadcast, delivered even when the app was closed) → `FocusGuardStore.resetProtectionForUpdate`
     + `FocusAccessibilityService.reload()`.
  2. `FocusGuardStore.maybeResetOnUpdate(context)` — compares the stored `last_version_code`
     against the device's real versionCode; called in `FocusAccessibilityService.onServiceConnected`
     (before `refreshConfig`, so `enabled` reads the reset) AND in `FocusGuardModule.ensureKeepAlive`
     (every app launch). Catches a missed broadcast.
  3. A one-shot `reset_on_update_pending` flag → JS `FocusGuard.consumeUpdateReset()` (bridge in
     `modules/focus-guard/index.js`, native `AsyncFunction("consumeUpdateReset")`) → `App.js` shows
     a localized notice once, after the first config load (so the language is known).
- Store helpers (all in `FocusGuardStore.kt`): `currentVersionCode` (`longVersionCode` on API 28+,
  `versionCode` below, `@Suppress("DEPRECATION")`), `recordVersionCode`, `resetProtectionForUpdate`
  (setEnabled false + clearUnlockWindow + raise flag + record version + `protection_reset_on_update`
  log), `maybeResetOnUpdate`, `consumeUpdateReset`. Keys: `last_version_code`,
  `reset_on_update_pending`.
- **A fresh INSTALL has no stored versionCode → recorded, no reset** (nothing to bypass on a
  brand-new install). The update reset writes the store DIRECTLY (bypasses the Delay-Mode gate) —
  an update is an admin action, same rule as the SMS kill switch.
- **Settings gear**: `HomeScreen.js` header now has a ⚙️ button beside the ☰ (dimmed + a 🔒 badge
  while `settingsLocked`); tapping calls `onOpenSettings` → `navigate('settings')`, which already
  shows «برای ورود به تنظیمات، ابتدا محافظت را خاموش کنید.» when Protection is ON. The drawer's
  Settings row behaves the same. `settingsLocked`/`readOnly` both derive from `config.enabled`.
- i18n: 1 new key (the update-reset notice) → 225 UI strings / 267 translations.
- Version 1.4.6 / versionCode 17 (app.json, package.json, package-lock, buildInfo);
  `version.json` latestVersion 1.4.6; `index.html` labels ۱.۴.۶.
- Verified: check-i18n OK; `npm run verify` green (645 modules; bundle contains
  `consumeUpdateReset`, the update-reset string and the ⚙️/🔒 glyphs); `npm run prebuild:android` →
  versionName 1.4.6 / versionCode 17; module manifest parses; `android/` + `dist/` wiped. Kotlin
  compiles only in CI. NOT pushed — owner runs the push/tag.

## v1.4.7 — drawer in a Modal · Settings via drawer · update resets BOTH switches · debug log on Home · Help rewrite (2026-11-14)

- **Drawer is custom, not react-navigation** (`src/components/Drawer.js`: Animated + PanResponder).
  v1.4.5 rendered it as a sibling View with zIndex; on some Android builds the backdrop/scroll
  ancestor swallowed the touch so ☰ looked dead. It now renders inside a transparent RN `Modal`
  (`mounted` state keeps it alive through the slide-out, `onRequestClose` = hardware Back).
  Panel side follows the language: LTR → left, fa/RTL → right (`closedX = ±PANEL_WIDTH`).
- **Settings is reached only through the drawer** — the ⚙️ gear was removed from the Home header.
  While Protection is ON the drawer row is still gated («... ابتدا محافظت را خاموش کنید»).
- **Update reset now clears Delay Mode too**: `FocusGuardStore.resetProtectionForUpdate` writes
  `KEY_ENABLED=false` + `KEY_DELAY_MODE=false` straight to prefs (bypasses the native Delay-Mode
  refusal on purpose — an update is an admin action). `App.js`'s notice text says both switches
  were turned off.
- **Debug log lives on Home**: new `src/components/DebugLogSection.js` (Section + full-screen log
  Modal: health line, Show Logs, battery fix, Refresh/Clear) at the very bottom of the Home
  ScrollView, plus `src/utils/debugLog.js` with the shared helpers (`logTypeColor`,
  `formatLogTime`, `shortPackage`, `formatHeartbeat`). `SettingsScreen.js` no longer has the log
  section, its Modal, `FlatList`, or the log/health styles — it only uses `formatHeartbeat`.
- **Help rewrite**: 7 numbered steps (added Delay Mode, SMS remote control, excluded apps,
  Settings lock & Partner PIN) + a VPN note block (`vpnNote`/`vpnTitle`/`vpnText`).
- i18n: 224 UI strings / 275 translations; `scripts/check-i18n.js` now scans
  `DebugLogSection.js`.
- Version 1.4.7 / versionCode 18 (app.json, package.json, package-lock, buildInfo);
  `version.json` latestVersion 1.4.7; `index.html` labels ۱.۴.۷.
- Verified: `npm run verify` green (647 modules); `npm run prebuild:android` → versionName 1.4.7 /
  versionCode 18 / app_name Tavakkol; `android/` + `dist/` wiped. Kotlin compiles only in CI.
- SHIPPED 2026-11-14: commit `932b526` → main + tag `v1.4.7`; CI runs 43567184620 (main) +
  43567187479 (tag) both SUCCESS → Release `Tavakkol v1.4.7`, `Tavakkol-release.apk` 35.3 MB live
  at https://github.com/elyasyy23-lgtm/FocusBlocker/releases/download/v1.4.7/Tavakkol-release.apk
  (`releases/latest/...` 200). Pending owner on-device check.

## v1.4.8 — Support Us sheet shows BOTH donation routes at once (2026-11-14)

- `src/components/DonateSheet.js` no longer takes a `mode`: one sheet, two bordered option cards —
  🏦 «حمایت از حامیان داخل ایران» (ZarinPal payment page) and 🪙 «حمایت از حامیان خارج از کشور»
  (USDT TRC20 address + Copy). Owner's thank-you paragraph stays at the top; Close row is pinned
  under an inner `ScrollView` (card `maxHeight: 88%`) so both cards fit short screens.
- `App.js`: `donateMode` → `donateOpen` boolean; `openDonate()` no argument; the drawer action is
  `onSupport={openDonate}` (the old `openDonate('iran')` made the crypto route unreachable).
- `src/defaults.js`: `DONATION_ZARINPAL_URL = 'https://zarinp.al/yourlink'` (agreed placeholder) and
  `DonateSheet.zarinpalLinkReady()` refuses to open a URL containing `yourlink` → the button stays
  visible and shows «لینک پرداخت داخلی هنوز تنظیم نشده است» (never send money to an unapproved
  destination). Replace the constant with the real `https://zarinp.al/<id>` to go live.
- Wallet `TANP1ibS4DsF2C1p1rBGAZ5MrGZyS5sUmU` / `USDT (TRC20)` unchanged; Copy = expo-clipboard,
  button flips to green «کپی شد», state resets when the sheet closes.
- i18n: 2 new keys → 226 UI strings / 277 entries.
- Version 1.4.8 / versionCode 19 (app.json, package.json, package-lock, buildInfo);
  `version.json` 1.4.8; `index.html` ۱.۴.۸.
- Verified: `npm run verify` green (bundle has the placeholder link, wallet and new strings);
  `npm run prebuild:android` → 1.4.8 (19); `android/` + `dist/` wiped.
- SHIPPED 2026-11-14: commit `845c4de` → main + tag `v1.4.8`; CI 43570283627 (main) +
  43570293175 (tag) both SUCCESS → Release `Tavakkol v1.4.8`, `Tavakkol-release.apk` 35.3 MB live at
  https://github.com/elyasyy23-lgtm/FocusBlocker/releases/download/v1.4.8/Tavakkol-release.apk
  (`releases/latest/...` 200). ZarinPal route still shows «لینک پرداخت ... تنظیم نشده» until the
  owner pastes the real link in `src/defaults.js`.

## v1.4.9 — strict adult content lock + partner SMS clears both switches (2026-11-14)

- New third blocking option: Settings → «قفل کامل محتوای بزرگسالان». Native gate lives in
  `FocusGuardModule.setAdultLock`: turning it OFF is REFUSED while `FocusGuardStore.isEnabled` is
  true (throws), ON is always allowed. The list itself is `AdultFilter.kt` (keywords + bare-host
  domains) and is merged at match time inside `FocusAccessibilityService.refreshConfig()` —
  `keywords`/`domains` prefs are never rewritten, so switching the lock off leaves no residue.
  Hits log as `adult_detected` with `REASON_ADULT`, toast «محتوای بزرگسالان مسدود شد».
- `FocusGuardStore.deactivateGuard(ctx)` (new) = Protection OFF + Delay Mode OFF in ONE edit; it is
  now the shared body of both the partner-SMS kill switch (`RemoteSmsReceiver`) and
  `resetProtectionForUpdate`. Bug it fixes: v1.4.8's SMS cleared only `KEY_ENABLED`, so Delay Mode
  stayed ON after a remote deactivation.
- `getConfig` now returns `adultLock`, `adultKeywordCount`, `adultDomainCount`;
  `modules/focus-guard/index.js` exposes `setAdultLock(bool)`.
- Home shows one accent line when the lock is on (built-in counts). i18n 238 strings / 289 entries.
- Version 1.4.9 / versionCode 20; `version.json` 1.4.9; `index.html` ۱.۴.۹.
- Verified: check-i18n OK, `npm run verify` 647 modules (Metro \u-escapes Persian — grep the
  escaped form), prebuild 1.4.9 (20), Kotlin compiled only by CI (Termux cannot build Kotlin),
  `android/` + `dist/` wiped.
- SHIPPED 2026-11-14: commit `14dcc7e` → main + tag `v1.4.9`; CI 43578559240 (main) +
  43578567196 (tag) both SUCCESS → Release `Tavakkol v1.4.9` live, `Tavakkol-release.apk`
  37,023,751 bytes (`releases/latest/...` 302 → v1.4.9). Pending owner on-device check.

## v1.4.11 — device admin button · adult lock on Home · Persian-first (2026-11-14)

- Settings → «مدیر دستگاه»: the button is now «تنظیمات مدیر» (`Device admin settings`) and calls the
  new native `openDeviceAdminSettings` → `Settings.ACTION_DEVICE_ADMIN_SETTINGS` (fallback
  `ACTION_SECURITY_SETTINGS`). The old in-app "Activate device admin" button is gone; the panic-lock
  button and the status pill are untouched.
- The adult lock MOVED from Settings to the Home switch grid (third cell beside Delay Mode) and
  `FocusGuardModule.setAdultLock` now refuses BOTH directions while `FocusGuardStore.isEnabled`
  (v1.4.9 refused only OFF). The Home switch is `disabled={…|| config.enabled}` too.
- Persian-first: `FocusGuardStore.language()` default is now `"fa"` (stored value wins),
  `EMPTY_CONFIG.language = 'fa'`, `App.js` initial `lang` state `'fa'`.
- i18n 234 strings / 294 translations. Version 1.4.11 / versionCode 21; `version.json` 1.4.11;
  `index.html` ۱.۴.۱۱. Verified: check-i18n OK, `npm run verify` green, prebuild 1.4.11 (21).
- GOTCHA (cost two CI runs): `Settings.ACTION_DEVICE_ADMIN_SETTINGS` does NOT exist — the
  device-admin list is launched with the literal `Intent("android.settings.DEVICE_ADMIN_SETTINGS")`
  (fallback `Settings.ACTION_SECURITY_SETTINGS`).
- SHIPPED 2026-11-14: commits `4ded987` + fix `27d1638` → main + tag `v1.4.11` (tag moved after the
  Kotlin failure); CI 43594355253 (main) + 43594360920 (tag) both SUCCESS → Release
  `Tavakkol v1.4.11`, `Tavakkol-release.apk` 37,024,127 bytes (`releases/latest/...` 302).
  Pending owner on-device check.

## Site (index.html → GitHub Pages) — v1.4.11 (2026-11-14)

- `index.html` on `main` IS the live page (`elyasyy23-lgtm.github.io/FocusBlocker`).
- Real download badge: vanilla JS fetches
  `https://api.github.com/repos/elyasyy23-lgtm/FocusBlocker/releases/latest`, finds the asset
  named exactly `Tavakkol-release.apk`, reads `download_count`, counts up with
  `requestAnimationFrame` and shows it as «📥 ۱۲ بار دانلود شده» (Persian digits via
  `toLocaleString('fa-IR')`). The badge starts `hidden` and only appears after a successful
  fetch — a rate limit (60/h unauthenticated) or an offline visitor never sees a fake 0.
- "کاربر آنلاین" pill is an owner-approved PLACEHOLDER: the number drifts locally every 4.2 s,
  no API, not analytics. Do not present it as real data anywhere.
- The API asset name is the only contract: if the CI release ever renames the APK, update `ASSET`
  in the inline script or the badge silently stays hidden (by design).

## v1.4.12 — adult lock own card · device-admin fixes (2026-11-14, SHIPPED)

- Home layout: the adult lock is NO LONGER the third cell of `switchGrid`. It has its own
  `adultCard` directly below the Protection card and above the «کلمات مسدود» section: row with
  title + state hint + `Switch`, and the built-in-counts line INSIDE the same card. Frozen while
  Protection is ON (`disabled` in JS, native `setAdultLock` refuses both directions).
- Device admin: the `<force-lock />` policy is GONE from `res/xml/device_admin.xml` (uninstall
  blocking needs no policy and the dialog no longer warns about locking the screen). The
  «Panic lock screen» button and the native `lockScreen` / `requestDeviceAdmin` functions were
  deleted with it.
- `openDeviceAdminSettings` is now a ladder that returns the step that opened:
  `android.settings.DEVICE_ADMIN_SETTINGS` → `DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN` for our
  own component (activation dialog / admin details — the ROM-independent route) →
  `ACTION_SECURITY_SETTINGS` → `ACTION_SETTINGS` → `'none'`. Settings shows a matching hint.
- i18n 234 / 291 (3 added, 6 dead keys removed). Version 1.4.12 / code 22.
- Verified: check-i18n, `npm run verify` (1.2 MB bundle), prebuild 1.4.12 (22), XML parse.
  Kotlin compiles only in CI.
- SHIPPED 2026-11-14: commit `fe87d45` → main + tag `v1.4.12`; CI 43598941927 (main) +
  43598946401 (tag) both SUCCESS → Release `Tavakkol v1.4.12`, `Tavakkol-release.apk`
  37,023,319 bytes (`releases/latest/...` 302 → v1.4.12). Pending owner on-device check: the
  adult card standing alone under the Protection card (counts inside it, frozen while Protection
  ON) and the «تنظیمات مدیر» button always opening a real screen.

## Site SEO (2026-11-14, shipped `3b19dda`)

- `index.html` head now carries the Persian search copy (owner's verbatim text): `<title>` =
  «توکل | برنامه رایگان برای رهایی از محتوای بزرگسالان و ترک پورن», the matching
  `<meta name="description">`, `<meta name="keywords">` (Google ignores it — kept for Bing/others),
  `<meta name="robots" content="index, follow">`, `<link rel="canonical">`, full OG/Twitter tags
  with absolute `og:image`, and a JSON-LD `SoftwareApplication` block (free offer + `downloadUrl`).
- `sitemap.xml` (single URL, `lastmod`, weekly) and `robots.txt` (allow-all + `Sitemap:` line) sit
  in the repo root, so Pages serves them at `/sitemap.xml` and `/robots.txt`. Update `lastmod`
  when the page changes in a meaningful way.
- Ranking reality: keywords meta does nothing on Google; the title/description/JSON-LD + the on-page
  Persian text are what can rank, and `*.github.io` subdomains are weak — a custom domain is the
  real upgrade if search traffic matters.

### Search Console verification (pending, owner action)

- The owner is registering the site in Google Search Console (URL-prefix property
  `https://elyasyy23-lgtm.github.io/FocusBlocker/`). If Google hands over an HTML verification
  file (`googleXXXXXXXXXXXX.html`), drop it in the repo ROOT exactly as named (Pages serves `/`),
  commit, push `main`, wait ~1 min, then confirm `https://elyasyy23-lgtm.github.io/FocusBlocker/
  googleXXXXXXXXXXXX.html` returns 200 before tapping "Verify". Alternative if a file is awkward:
  the HTML tag method (`<meta name="google-site-verification" ...>`) in `index.html` head — both
  are permanent, do not delete afterwards.
- Sitemap to submit after verification: `https://elyasyy23-lgtm.github.io/FocusBlocker/sitemap.xml`.
- 2026-11-14: verification file LIVE — `google316c466330b5d665.html` in the repo root, content
  exactly `google-site-verification: google316c466330b5d665.html`, commit `3cbecef`, public URL
  returns 200 (`text/html`, 54 B) at
  https://elyasyy23-lgtm.github.io/FocusBlocker/google316c466330b5d665.html. NEVER delete this file —
  Google re-runs the check periodically. Owner then clicks Verify and submits the sitemap manually.
- DECISION 2026-11-14: owner chose the **manual HTML-file route** for Search Console (they do the
  Google login + the "Verify" click; zyvo only hosts the file and proves it returns 200, then the
  owner submits `sitemap.xml` by hand). Do not push the service-account/OAuth route again unless the
  owner reopens it — `~/gsc-register.py` + the skill stay on disk as the fallback.
- 2026-11-14 (owner asked for full automation): Search Console **cannot** be registered with no
  credential — no API creates a property anonymously and GSC UI automation would need the owner's
  Google login + 2FA (refused). The workable path is the **Site Verification API with a service
  account**: the service account verifies the FILE token itself, becomes owner, then the human email
  is appended to `owners`, property added (`PUT webmasters/v3/sites/{siteUrl}`) and sitemap submitted
  (`PUT .../sitemaps/{feedpath}`). Owner's only manual part = Google Cloud console (project + enable
  Site Verification API & Search Console API + service-account JSON key, no billing). Tooling is
  ready: `~/gsc-register.py` (`check|token|verify|finish <gmail>`), libs `google-auth` + `requests`
  installed in Termux; key expected at `~/.config/zyvo/gsc-service-account.json` (chmod 600).
  Playbook: `~/.config/zyvo/skills/google-search-console-api-registration/SKILL.md`.
- Readiness check 2026-11-14: `/sitemap.xml` 200 `application/xml` (288 B, one `<loc>` = site root,
  `lastmod` 2026-11-14, weekly, priority 1.0) and `/robots.txt` 200 `text/plain` (`User-agent: *` /
  `Allow: /` + absolute `Sitemap:` line) are both live and correct. No `google*.html` file and no
  `google-site-verification` meta exist yet; repo root has no `_config.yml` / `CNAME` / `.nojekyll`.
  Do NOT add `.nojekyll`: Jekyll's default excludes keep `node_modules` (and the Expo sources) off
  the published site; plain `.html` files without front matter are already served verbatim, so the
  Google verification file will be reachable. Property must be the URL-prefix type
  `https://elyasyy23-lgtm.github.io/FocusBlocker/` (Domain property needs DNS — impossible on
  `github.io`).
- On-page audit 2026-11-14: 1 `<h1>`, 2 `<h2>`, 6 `<h3>`, 2 images (all with alt), ~346 visible
  words — thin for competitive terms like «ترک پورن». No FAQ/HowTo structured data, no in-page
  anchors, Google Fonts loaded from the network. These were the known gaps for the next SEO pass.

## Site content + performance pass (2026-11-14)

- `index.html` now has a jump-pill nav under the hero (`.jump` → `#features`, `#install`, `#guide`,
  `#faq`), an `id` on the features and install sections, smooth scrolling with a
  `prefers-reduced-motion` opt-out and `section[id]{scroll-margin-top:24px}`.
- New `#guide` «راهنمای ترک پورن» section: intro (`.intro`) + 7 numbered steps in `ol.plan`
  (CSS counters, `counter(step,persian)` → Persian digits, 38px green badges, becomes a stacked
  block under 820px) + amber `.tip` box about pacing. Plain honest copy — no medical promises.
- New `#faq` section: 8 `<details class="qa">` items (free? offline? images? how to turn off?
  privacy? Android 13 restriction? uninstall? battery?), `+`/`−` marker via `summary::after`,
  `::-webkit-details-marker` removed.
- Structured data: `HowTo` (3 install steps, `totalTime PT2M`) + `FAQPage` (same 8 Q&A) as separate
  `application/ld+json` blocks beside the existing `SoftwareApplication`. All three parse; the FAQ
  answers duplicate the visible text on purpose.
- Fonts self-hosted: `assets/fonts/Vazirmatn-{Regular,Bold,Black}.woff2` (~50 KB each) with
  `@font-face` + `font-display:swap`; the three `fonts.googleapis.com` / `fonts.gstatic.com`
  requests are GONE. Only Regular is preloaded; the icon gets
  `<link rel="preload" as="image" fetchpriority="high">` and the hero `<img>` `fetchpriority="high"`.
  `900` covers headings, `700` also serves `800`, so no synthetic-bold Persian.
- Dead CSS tokens `--space-1..4` removed (7 classes / 19 vars audited: no unused class left).
- Footer carries «آخرین به‌روزرسانی: آبان ۱۴۰۵ · نسخهٔ ۱.۴.۱۲» as a freshness signal.
- Resulting page: ~1,238 visible words, 1 `<h1>` / 4 `<h2>` / 13 `<h3>`, 0 broken anchors, tags
  balanced, no third-party font host. Sitemap `lastmod` stays 2026-11-14 (same day).

## v1.4.13 (2026-11-14, SHIPPED)

**Device-admin button still dead on HyperOS** (owner: no error in Debug Log, tapping «تنظیمات مدیر»
changed nothing). Root problem was diagnosability, not just routing: v1.4.12 returned only a label
and swallowed every exception, so a ROM that resolves an intent to a screen that immediately
finishes looked identical to "nothing happened".

- `FocusGuardModule.openDeviceAdminSettings` rewritten: returns
  `{opened, target, active}` where `target` is the `package/activity` the chosen Intent resolves to.
  New private `resolveTarget(ctx, intent)` uses `PackageManager.resolveActivity`
  (`ResolveInfoFlags.of(0)` on API 33+) and SKIPS intents that resolve to nothing
  (`admin_intent_skip`) instead of firing and swallowing `ActivityNotFoundException`.
- Ladder (order depends on state): if admin ACTIVE → `ACTION_ADD_DEVICE_ADMIN` (our component's
  details screen with Deactivate) → `android.settings.DEVICE_ADMIN_SETTINGS`; if INACTIVE → the
  reverse (activation dialog last). Then the explicit AOSP activities
  `com.android.settings/.Settings$DeviceAdminSettingsActivity` and
  `com.android.settings/.DeviceAdminSettings` (MIUI hides the entry but often keeps the class),
  then `ACTION_SECURITY_SETTINGS`, then `ACTION_SETTINGS`. `EXTRA_DEVICE_ADMIN` now rides on the
  list intent too — some ROMs only land on the right row with it.
- Debug log: `admin_button_clicked` (active + sdk + manufacturer/brand), `admin_intent_skip`,
  `admin_intent_ok` (with resolved component), `admin_intent_fail` (exception class + message),
  `admin_intent_none`, plus `admin_intent_result` written from JS. Colours added in
  `src/utils/debugLog.js`. New native bridge `logDebug(type, text)` (`text` is non-nullable — the
  Expo Kotlin DSL is safest with `String`, use `ifEmpty { null }`), JS helper `FocusGuard.logDebug`.
- `SettingsScreen.openDeviceAdminSettings` handles the object shape (old string shape still
  tolerated), logs the result, and ALWAYS shows a message: admin list opened / details+Deactivate /
  Security fallback / none → «تنظیمات ← امنیت ← برنامههای مدیر دستگاه». i18n 237 strings / 294
  entries (3 new).
- Version 1.4.13 / code 23 (app.json, package.json, package-lock, buildInfo), `version.json` 1.4.13,
  `index.html` ۱.۴.۱۳ (3 spots). Verified: check-i18n OK, `npm run verify` green (bundle contains
  `admin_activity_legacy` + `logDebug`), prebuild 1.4.13 (23), android/ + dist/ wiped, Kotlin
  braces/parens balanced (Kotlin compiles only in CI).
- If MIUI STILL opens nothing while the log shows `admin_intent_ok`, the ROM accepted the intent and
  killed the screen: the next step is a JS-visible in-app instructions card, not another intent.

SHIPPED 2026-11-14: commit `ce34b23` → main + tag `v1.4.13` (owner pasted the push block, zyvo ran
it). CI runs **43605311057** (main) and **43605315288** (tag) both SUCCESS — `Build release APK`
step green, so the new Kotlin compiled first try. Release `Tavakkol v1.4.13` live:
`Tavakkol-release.apk` 37,025,867 bytes; `releases/latest/...` 302 → v1.4.13; Pages `version.json`
serves `latestVersion: 1.4.13`. Pending owner on-device check: tap «تنظیمات مدیر» once, then read
Home → Debug Log (`admin_button_clicked` + `admin_intent_ok|skip|fail` + `admin_intent_result`).

## v1.4.14 (2026-11-14, SHIPPED)

**Plain list intent fired first + visible text guide.** Owner asked for the exact
`Intent("android.settings.DEVICE_ADMIN_SETTINGS")` (the Device admin APPS LIST, not the "Add admin"
screen) to be tried on its own, with a caught crash and a text fallback.

- `FocusGuardModule.kt` `openDeviceAdminSettings` rewritten: **attempt 1 = bare
  `Intent("android.settings.DEVICE_ADMIN_SETTINGS")`, no extras** (v1.4.13 attached
  `EXTRA_DEVICE_ADMIN`, which makes MIUI jump to the details page instead of the list), logged as
  `admin_list_intent` (before) → `admin_list_intent_ok` / `admin_list_intent_fail` (after), returns
  `opened='admin'`. Then the fallbacks (`component`, two AOSP admin activities, security, settings)
  each fire-and-catch.
- **ROOT CAUSE of v1.4.13's silence:** the `resolveActivity()` skip gate. On Android 11+ that call
  returns **null for `com.android.settings` intents** unless the package/intent is declared in
  `<queries>` — every candidate was skipped with only `admin_intent_skip` lines, i.e. a dead button.
  Gate removed (fire + catch is the only honest test); the resolve call is now used for the log text
  only, wrapped in `runCatching`.
- Module manifest `<queries>` gains `<package android:name="com.android.settings" />` + an intent
  entry for `android.settings.DEVICE_ADMIN_SETTINGS` so the logged target is real.
- `SettingsScreen.js`: new `adminGuide` state + card under the button — shown when the result is
  `none`, `security` or `settings` (i.e. the list really did not open): title, the manual path
  «تنظیمات ← امنیت ← برنامه‌های مدیر دستگاه», a MIUI-hides-it hint (search "device admin") and a
  «بستن راهنما» button. `debugLog.js` colors for `admin_list_intent{,_ok,_fail}`.
- i18n 241 strings / 298 translations (4 new). Version 1.4.14 / code 24 (app.json, package.json,
  package-lock, buildInfo), `version.json` 1.4.14, index.html ۱.۴.۱۴ (3 spots).
- Verified: check-i18n OK, `npm run verify` green (bundle contains `adminGuide` + `admin_list_intent`),
  prebuild 1.4.14, manifest XML parses, Kotlin braces/parens balanced (compiles only in CI),
  `android/` + `dist/` wiped.

Expected Debug Log order after a tap: `admin_button_clicked` → `admin_list_intent` →
`admin_list_intent_ok` (or `_fail` then `admin_intent_ok …` / `admin_intent_none`).

SHIPPED 2026-11-14: commit `e9d95bb` → main + tag `v1.4.14`. CI runs **43608390716** (main) and
**43608396174** (tag) both SUCCESS → Release `Tavakkol v1.4.14` live, `Tavakkol-release.apk`
37,027,423 bytes (`releases/latest/...` 302 → v1.4.14, Pages `version.json` = 1.4.14).
Gotcha: `git fetch && git rebase origin/main` FAILS while the tree has unstaged changes — commit
first, then rebase, then push (the push block order matters).

## Site analytics (2026-11-14, SHIPPED — commit `4833828`)

Google Analytics 4 added to `index.html` head: Measurement ID **`G-CVCKBEBCV1`** — one `async`
`gtag.js` loader + the standard `dataLayer` / `gtag('js')` / `gtag('config')` block, placed right
after `<meta name="theme-color">`, before the JSON-LD. It is the only third-party request on the
page (fonts stay self-hosted). Pages deployed, live page verified (gtag present in `<head>`,
`gtag.js` 200). No consent banner — the site sets no cookies of its own beyond GA's `_ga`.

## v1.4.15 (2026-11-14, SHIPPED)

**Owner verified the real path on their Xiaomi: Settings → Privacy → Special permissions → Device
admin apps.** Decision: stop firing intents entirely (they throw `ActivityNotFoundException` /
open the wrong page on HyperOS) and show the path as text.

- `FocusGuardModule.kt`: `openDeviceAdminSettings` (the whole 6-rung intent ladder) **deleted**, and
  the now-unused `resolveTarget()` helper + `PackageManager` import removed. Replaced by
  `deviceAdminHintState()` which logs `admin_guide_opened` and returns `{active}` — it never starts
  an activity.
- `modules/focus-guard/index.js`: `openDeviceAdminSettings` export → `deviceAdminHintState()`.
- `SettingsScreen.js`: button «تنظیمات مدیر» opens an RN `Modal` (reuses `modalBackdrop` /
  `modalCard` / `modalTitle` / `body`): title «تنظیمات مدیر», the exact owner sentence, the path line
  «تنظیمات ← حریم خصوصی ← مجوزهای ویژه ← برنامههای مدیر دستگاه ← توکل» in accent green, and ONE
  «بستن» button. **No copy button** (owner explicitly said not to add one). The v1.4.14 inline
  `adminGuide` card and its styles are gone. Section subtitle now points at "the path below" instead
  of naming the wrong (Security) route.
- i18n 233 strings / 291 translations: +3 (`To manage device admin access…`, the path, `Close`),
  9 dead admin-guide strings removed, subtitle key reworded.
- Verified: check-i18n OK, `npm run verify` green (bundle has `deviceAdminHintState` + `adminPath`),
  prebuild 1.4.15 / code 25, module manifest parses, Kotlin braces/parens balanced, `android/` +
  `dist/` wiped. Version 1.4.15 / 25 in app.json, package.json, package-lock, buildInfo,
  version.json, index.html ۱.۴.۱۵ (3 spots).

SHIPPED 2026-11-15: commit `0a4263b` → main + tag `v1.4.15`; CI runs **43615554922** (main) and
**43615568418** (tag) both SUCCESS → Release `Tavakkol v1.4.15`, `Tavakkol-release.apk`
37,024,231 bytes (`releases/latest/...` 302 → v1.4.15, Pages `version.json` = 1.4.15).
The button is now purely informational: it opens the modal and starts no activity at all.

## Site analytics #2 — public dashboard (2026-11-14, SHIPPED — commit `225d62e`)

Owner wants traffic visible on their OWN site, not only in the GA dashboard. Choice: **Umami Cloud,
Hobby plan (free, 100k events/month, 1 website, 6 months retention, cookieless, EU region at signup)** —
it is the only free option that ships a proper public read-only dashboard (Share URL). GoatCounter is
the free minimalist fallback; Plausible and Simple Analytics are paid (their public dashboards need a
subscription), so they were ruled out on cost.

- `index.html` head: after the GA block, a config script with two constants —
  `TAVAKKOL_UMAMI_ID` (`REPLACE_UMAMI_WEBSITE_ID`) and `TAVAKKOL_STATS_URL`
  (`REPLACE_UMAMI_SHARE_URL`). The Umami `script.js` is injected ONLY when the ID is not a
  placeholder, so an unconfigured site makes zero requests to cloud.umami.is.
- Footer last row: `<a id="statsLink" hidden>آمار بازدید</a>`; a small inline script sets `href`
  and removes `hidden` only when the share URL is real (no dead link ever ships). CSS: `.stats-link`
  pill with a `↗` marker; `.foot-meta` replaced the inline styles.
- Verified: HTML structure balanced, 8 script tags / 8 closes, all inline JS passes `node --check`,
  the three JSON-LD blocks still parse, head order GA → Umami → JSON-LD.
- PENDING owner: sign up at https://cloud.umami.is/signup → add website (domain
  `elyasyy23-lgtm.github.io`) → copy the website ID (UUID) → Website → Edit → Share URL → Add →
  enable **Traffic** → copy the share link. Then the two constants get filled and the link appears.

LIVE CONFIG: Umami website ID `a9e61d4a-7e53-45e4-9078-f6af538b6c68`, public dashboard
`https://cloud.umami.is/share/E5qW7nnc43EoLYez` (307 → `/analytics/us/share/…`, so the workspace is
in the **US** region). Footer «آمار بازدید» is a visible pill next to the version line
(`.stats-link`, `↗` marker). **Google Analytics 4 was REMOVED** (owner decision "GA baad") so the
footer promise «بدون جمع‌آوری اطلاعات» stays true — do not re-add gtag without being asked.
Verified live: page contains the ID, `cloud.umami.is/script.js` 200 (9,246 B), share page 200,
no `googletagmanager` anywhere.

## Site language switcher — Persian ↔ English (2026-11-14, SHIPPED `87560d6`)

The landing page is bilingual. **Persian markup is the source of truth**; English lives in one
dictionary and is applied in place — the app itself is unaffected (no APK change, version stays
1.4.15 / code 25).

- Markup: every translatable node has `data-i18n` (innerHTML), `data-i18n-title` / `-aria` / `-alt`
  (attributes). `<title>`/meta got ids (`page-title`, `meta-description`, `og-title`,
  `og-description`, `tw-title`, `tw-description`, `og-site-name`) and are driven by a `metaEls`
  array — that is why a naive "unused EN key" scan flags `meta.*` (they ARE used).
- Header: `.head-left` (flex) = `.brand` + `.lang` pill group (`data-lang="fa"` فارسی / `en` EN,
  `aria-pressed` marks the active one); `.ver` sits on the opposite side. Mobile
  `@media (max-width:420px)` shrinks the pills and hides the brand tagline.
- `<head>` bootstrap sets `window.TAVAKKOL_LANG` + `html.lang-en` + `lang/dir` BEFORE paint (no RTL
  flash). Persisted in `localStorage['tavakkol_lang']`.
- End-of-body script: `EN` dictionary (template literals, HTML allowed) + `apply(lang)`; Persian
  originals cached once in `faText`/`faAttr`/`faMeta` Maps so switching back is lossless;
  dispatches `CustomEvent('tavakkol:lang')`, which the stats script uses to re-render the download /
  online counters in `fa-IR` vs `en-US` digits (`fmt()`).
- CSS: all layout rules are logical (`margin-inline-*`, `text-align:start`) so `dir=ltr` needs no
  extra rules; `html.lang-en` swaps the display font stack and the step-number counters from
  `counter(step,persian)` to decimal.
- JSON-LD stays Persian (`inLanguage: fa-IR`) — do not add a second competing block.
- Verified: key coverage clean (88 `data-i18n` keys, all defined), 4 inline scripts pass
  `node --check`, 3 JSON-LD blocks parse, tag balance clean, and a **linkedom DOM test** clicks
  EN → asserts `dir=ltr` + title/h1/meta/alt/aria-pressed, then FA → asserts a byte-for-byte
  Persian restore. Tooling recipe: skill `site-bilingual-toggle`; `linkedom` lives in `$TMPDIR/domtest`.
- `hero.cta` now says ۳۷ مگابایت / 37 MB (the release APK is 37,024,231 B; the old 31 MB was stale).

### Install safety note (2026-11-14, SHIPPED `0110851`)

`.cta-note` sits directly under the green download button (owner copy, verbatim):
«⚠️ نکته امنیتی: ممکن است گوگل هنگام نصب هشدار دهد. نگران نباشید؛ این فایل مستقیماً از سایت رسمی
توکل دانلود شده و کاملاً امن است. کافی است روی «Install anyway» (نصب به هر حال) بزنید.» — English via
the `hero.safetyNote` key (`⚠️ Security Note: … Just tap 'Install anyway'.`).

Style: `font-size .82rem`, `line-height 1.85`, `color: var(--muted)`, `background: var(--accent-soft)`,
1px `rgba(21,128,61,.16)` border, `border-radius 14px`, `max-width 46ch`, `text-align:start` — readable
but clearly secondary to the CTA. Mobile (≤420px) drops to `.78rem` / `9px 11px`. Do not add an icon
element: the ⚠️ is part of the owner's text and must survive the i18n swap.



## v1.4.16 — live Service Status (real bound state, not the system toggle)

**Bug (owner):** the «وضعیت سرویس» / Home Protection hint stayed GREEN («سرویس دسترسیپذیری
روشن است») even after MIUI/HyperOS powerkeeper killed the guard process. Root cause: the status
was driven by `config.accessibilityEnabled`, which is only the SYSTEM TOGGLE — Android keeps it
`true` after the process is killed. The honest signal is the service's own bound flag.

- **Native**: `FocusGuardModule.getConfig` now also returns `serviceRunning =
  FocusAccessibilityService.isRunning` (the `@Volatile` companion flag, set in
  `onServiceConnected`, cleared in `onUnbind`/`onDestroy`/`onInterrupt`) — next to the existing
  `getServiceHealth().serviceRunning`. `modules/focus-guard/index.js` `EMPTY_CONFIG` gains
  `serviceRunning: false`.
- **App.js**: new `health` state + `refreshHealth()` (`FocusGuard.getServiceHealth()`), refreshed
  on mount and on every AppState → active, and POLLED every 4 s while `appState === 'active'`
  (`setInterval`, cleared on background/unmount) so the hint flips red without leaving the app.
  Derived `serviceRunning`/`accessibilityEnabled` prefer `health`, fall back to `config` before the
  first read. `blockingReady` now requires `serviceRunning` (the hero shows "Active" only when the
  guard is genuinely bound). Both values are passed to HomeScreen + SettingsScreen as props.
- **HomeScreen**: the Protection hint is three-state — green «سرویس دسترسیپذیری روشن است» when
  running; red «سیستم سرویس را متوقف کرده است…» when enabled but NOT running (the kill case);
  red «سرویس خاموش است — آن را در تنظیمات فعال کنید» when never enabled. New `switchHintOk` /
  `switchHintBad` styles (`COLORS.accent` / `COLORS.danger`).
- **SettingsScreen**: the «وضعیت سرویس» `StatusPill` is bound to `Boolean(serviceRunning)` with
  labels «در حال اجرا» / «متوقف» (was `cfg.accessibilityEnabled` with Enabled/Disabled), and the
  hint explains the enabled-but-stopped case.
- i18n 235 UI strings / 295 translations (+4: the stopped-by-system hint, the enabled-but-not-
  running hint, `Running`, `Stopped`).
- Version 1.4.16 / versionCode 26 (app.json, package.json, package-lock, buildInfo),
  `version.json` 1.4.16, `index.html` ۱.۴.۱۶ (3 spots + 3 EN dictionary spots).
- Verified: check-i18n OK; `npm run verify` green (647 modules; bundle contains `serviceRunning`,
  the two new hint strings); `npm run prebuild:android` → versionName 1.4.16 / versionCode 26,
  app_name Tavakkol; autolinking resolves `focus-guard`; module manifest parses; Kotlin brace/paren
  balance 0/0; `android/` + `dist/` wiped. Kotlin compiles only in CI.
- Lesson: a status indicator must read the AUTHORITATIVE live signal (the service's bound flag),
  never a cached config value that the OS leaves stale after a kill.

## v1.4.17 — update-URL version tag · Autostart card · clear Protection card (2026-11-15)

Three owner requests in one release:

1. **Update prompt: no more "Download file again?" warning.** The manifest always points at
   `releases/latest/download/Tavakkol-release.apk`, so the filename never changes and Chrome
   asked to re-download the same file. `App.js` now tags the URL with the version before opening
   it: `const separator = url.includes('?') ? '&' : '?'; const versionedUrl =
   `${url}${separator}v=${encodeURIComponent(latest)}``. A distinct query string = a fresh file
   every release. (String concat, not `URL`/`searchParams` — Hermes' URL is incomplete.)
2. **Autostart button is now its own card** (`SettingsScreen.js`): new `cardBox` style =
   `backgroundColor COLORS.surface`, `borderRadius 18`, `borderWidth 1`, `borderColor COLORS.border`,
   `padding 16` — byte-for-byte the same as the Section body (the Service Status card). The block
   has a title `Autostart ({{manufacturer}})` (reuses `statusTitle`), the existing secondary
   button, and the setup text (reuses `statusHint`).
3. **Home Protection card layout** (`HomeScreen.js`): the stats line (`heroHint`) and the service
   status are now separate — the status is its OWN `statusRow` with a coloured `statusDot`
   (green `COLORS.accent` when running / red `COLORS.danger` otherwise) + `statusText`, with
   `marginTop 10` so it never reads as part of the counts. The Protection switch cell's hint is
   now `This switch only turns Protection on and off` (new key) so the switch is unambiguous.
   Removed the v1.4.16 `switchHintOk`/`switchHintBad` styles (superseded by the badge).

- i18n 237 strings / 297 translations (+2: the switch caption, the Autostart card title).
- Version 1.4.17 / versionCode 27 (app.json, package.json, package-lock, buildInfo),
  `version.json` 1.4.17, `index.html` ۱.۴.۱۷ (fa + 3 EN dictionary spots).
- Verified: check-i18n OK; `npm run verify` green (bundle contains the two new strings,
  `statusDotOk`, and `v=${encodeURIComponent(...)}`); `npm run prebuild:android` → versionName
  1.4.17 / versionCode 27, app_name Tavakkol; `android/` + `dist/` wiped. Kotlin unchanged this
  release (JS-only) — still compiled only in CI.

**SHIPPED 2026-11-15**: commit `4bd8b33` → main + tag `v1.4.17`; CI 43686358371 (main) +
43686361522 (tag) both SUCCESS → Release `Tavakkol v1.4.17`, `Tavakkol-release.apk` 37,027,063
bytes live at https://github.com/elyasyy23-lgtm/FocusBlocker/releases/download/v1.4.17/Tavakkol-release.apk
(`releases/latest/...` 302 → v1.4.17, Pages `version.json` = 1.4.17, index.html ۱.۴.۱۷). Pending
owner on-device check: update prompt downloads with NO "Download file again?" warning, the Autostart
card matches the Service Status card, and the Home Protection card shows the stats line + a dotted
service-status line + the Protection-only switch caption.

## v1.4.18 — Autostart as its own card + green reminder switch (2026-11-15)

Owner request: ONLY the «اجرای خودکار (Xiaomi)» block changes; the «زنده‌نگه‌داشتن» (Keep-alive)
section must not be touched.

1. **Completely separate card.** The Autostart block was nested INSIDE the Keep-alive `<Section>`
   (v1.4.17's `cardBox`). It is now a sibling — a standalone `<View style={styles.cardBox}>`
   placed right after the Keep-alive `</Section>` and before the Stats section — so it has its own
   border/background and no longer reads as part of Keep-alive. The Keep-alive section itself is
   byte-identical (watchdog status row + «Start keep-alive now»).
2. **Green switch inside the card**, on the same row as the title (title + hint on the left,
   `Switch` on the right; `styles.statusRow` + `isRtl && styles.headerRtl` for RTL). Same visual
   contract as every other switch: `trackColor {false: COLORS.border, true: COLORS.accentSoft}`,
   `thumbColor = COLORS.accent (#4ADE80)` when on.
3. **Honest status — a user preference, not a system read.** Android exposes NO API for an OEM
   autostart (MIUI/HyperOS) switch, so the toggle stores the user's own marking:
   - `FocusGuardStore.kt`: `KEY_AUTOSTART = "autostart"` + `autostart()` / `setAutostart()`
     (SharedPreferences, survives restarts).
   - `FocusGuardModule.kt`: `getConfig` returns `autostart`; new `AsyncFunction("setAutostart")`.
   - `modules/focus-guard/index.js`: `EMPTY_CONFIG.autostart = false` + `setAutostart(allowed)`.
   - `SettingsScreen.js`: `autostartOn` state seeded from `config.autostart` (a `useEffect` re-syncs
     on every config refresh), `toggleAutostart(next)` moves the switch OPTIMISTICALLY, persists,
     calls `onRefresh()`, and reverts + messages on failure. Hint text says it is the user's own
     marking («On — you marked Tavakkol as allowed to start itself» / «Off — turn this on after you
     allow Tavakkol on the next screen»).
4. The button («باز کردن تنظیمات اجرای خودکار ({{manufacturer}})») and the long MIUI setup text
   stay inside the same card, below the switch row.

- i18n 240 strings / 300 translations (+3: the two switch hints, the save-failure message).
- Version 1.4.18 / versionCode 28 (app.json, package.json, package-lock, buildInfo),
  `version.json` 1.4.18, `index.html` ۱.۴.۱۸ (fa ×3 + en ×3).
- Verified: check-i18n OK (240/300); `npm run verify` green (647 modules, 1.2 MB — bundle contains
  `setAutostart` + the new hint strings); `npm run prebuild:android` → versionName 1.4.18 /
  versionCode 28, app_name Tavakkol; module manifest parses; Kotlin brace/paren balance 0/0;
  `android/` + `dist/` wiped. Kotlin compiles only in CI.

## v1.4.19 — Autostart card: measured status instead of a hand-set switch (2026-11-15)

Owner request: make the «اجرای خودکار (Xiaomi)» card fully independent, REMOVE the manual green
toggle, and show two MEASURED things — a live foreground-service pill exactly like the
«وضعیت سرویس» card, plus a boot-test line proving whether the system started Tavakkol by itself
after the last restart. The vendor button and the setup text stay. **v1.4.18 was never committed**,
so this release ships v1.4.17 → v1.4.19 in one go (the v1.4.18 switch is introduced and removed
inside the same diff — the sibling-card layout from v1.4.18 is what survives).

- **The switch is gone**: `autostartOn` / `autostartBusy` / `toggleAutostart` deleted from
  `SettingsScreen.js`; `KEY_AUTOSTART` + `autostart()` / `setAutostart()` deleted from
  `FocusGuardStore.kt`; `config.put("autostart", …)` + `AsyncFunction("setAutostart")` deleted from
  `FocusGuardModule.kt`; `EMPTY_CONFIG.autostart` + the `setAutostart()` bridge deleted from
  `modules/focus-guard/index.js`; the 3 reminder strings deleted from `src/i18n.js`.
- **Live pill** (real foreground service, not a preference): `StatusPill active={Boolean(health &&
  health.foregroundActive)}` with `Running` / `Stopped` — the same labels as the Service Status
  card. `SettingsScreen`'s health read is now POLLED every 4 s (was mount-only), so the pill and the
  boot line stay live while the screen is open.
- **Boot test — measured, not guessed.** Android has no API to read an OEM autostart toggle, so the
  app records EVIDENCE: `FocusGuardStore.recordBootBroadcast()` stamps `boot_broadcast_at` whenever
  `GuardWakeupReceiver` receives a REAL boot broadcast (`BOOT_COMPLETED` / `QUICKBOOT_POWERON` —
  never an alarm tick or `MY_PACKAGE_REPLACED`). `FocusGuardStore.currentBootAt()` derives the
  current boot's wall-clock time from `elapsedRealtime` (no permission, no receiver).
  `getServiceHealth` returns `bootAt` + `bootBroadcastAt`; JS compares them: same boot session →
  «سیستم توکل را پس از آخرین ریاستارت خودکار اجرا کرد ✓ {{time}}» (green), an older stamp →
  «✗ — اجرای خودکار را روشن کنید» (red), never seen a boot → «هنوز بررسی نشده — نتیجه پس از
  ریاستارت بعدی نمایش داده می‌شود.» (muted). Window: 10 min back / 60 min forward (MIUI can deliver
  the boot broadcast minutes late and a clock correction shifts `bootAt`).
  Honest limit: on a ROM that blocks autostart the broadcast simply never arrives — which IS the
  failure the card reports; nothing is invented.
- `src/utils/debugLog.js`: new `formatClock(value)` → "12:34" (the boot time shown in the line;
  `formatNumber(..., lang)` turns it into «۱۲:۳۴» in Persian).
- i18n 241 UI strings / 301 translations (+4: the pill hint, the ✓ line, the ✗ line, the
  not-checked line; −3 reminder strings).
- Version 1.4.19 / versionCode 29 (app.json, package.json, package-lock ×2, buildInfo),
  `version.json` 1.4.19, `index.html` ۱.۴.۱۹ (fa ×3 + en ×3).
- Verified: check-i18n OK (241/301); `npm run verify` green (647 modules, 1.2 MB — bundle contains
  `bootBroadcastAt`, `bootAt`, `formatClock`, `foregroundActive`, the ✓ line); `npm run prebuild:android`
  → versionName 1.4.19 / versionCode 29, app_name Tavakkol (fa توکل); both manifests parse; Kotlin
  brace/paren balance 0/0 on the three touched files; no stale `autostart` reference left anywhere;
  `android/` + `dist/` wiped. Kotlin compiles only in CI.
- SHIPPED 2026-11-15: commit `8690afb` → main + tag `v1.4.19`; CI runs 43693585620 (main) +
  43693608966 (tag) both SUCCESS → Release `Tavakkol v1.4.19`, `Tavakkol-release.apk` 37,029,139
  bytes live at
  https://github.com/elyasyy23-lgtm/FocusBlocker/releases/download/v1.4.19/Tavakkol-release.apk
  (`releases/latest/...` 302 → v1.4.19, Pages `version.json` = 1.4.19, Pages index = ۱.۴.۱۹).
  Pending owner on-device check: Autostart card shows the live pill «در حال اجرا»/«متوقف» and, after
  a real restart, the boot line «...پس از آخرین ریاستارت خودکار اجرا کرد ✓ ۱۲:۳۴» (or ✗ when the
  ROM blocked it).

## v1.4.20 — real-time service status + unique download URL (2026-11-15)
Two owner fixes.
- **FIX 2 — the status pill is now REAL-TIME.** The pill was driven by the in-process companion
  flags (`GuardWatchdogService.isRunning/isForeground`), which go stale when MIUI/HyperOS kills a
  service without killing the process. `FocusGuardModule.kt` now asks the SYSTEM: new private
  `runningServiceState(ctx, className): BooleanArray?` calls
  `ActivityManager.getRunningServices(Int.MAX_VALUE)` (deprecated, but since Android O it is
  restricted to the caller's own services) → `booleanArrayOf(info != null, info?.foreground == true)`,
  `null` when the platform refuses. `getServiceHealth` resolution order: system list present → its
  values are the truth; list says "gone" but `heartbeatFresh` (heartbeat within 75 s — the watchdog
  beats every 30 s) → trust the loop rather than lie red; otherwise really gone. New
  `systemCheck` field (true = values came from the system list) + `foregroundActive =
  watchdogForeground || (FocusAccessibilityService.isRunning && isForegroundActive)`.
  `modules/focus-guard/index.js` `EMPTY_HEALTH.systemCheck = false`. Poll interval 4000 → 3000 ms in
  `App.js` and `src/screens/SettingsScreen.js`. `DebugLogSection.js` health line gained
  «بررسی از طریق فهرست سیستم / پرچم‌های برنامه» (`checked via {{source}}`, `the system list`,
  `app flags`).
- **FIX 1 — no more Chrome "Download file again?"** on the website. `index.html`: the CTA anchor got
  `id="apk-cta"`, a `versionedUrl(base, tag)` helper appends `?v=<release.tag_name>`, and the
  releases-API fetch rewrites `cta.href` from the live tag. The anchor still points at
  `releases/latest/download/Tavakkol-release.apk`, so it works even when JS never runs. The app side
  (`App.js` `versionedUrl` with `?v=${encodeURIComponent(latest)}`) already existed since v1.4.17.
- i18n 244 UI strings / 304 translations (+3: `checked via {{source}}`, `the system list`,
  `app flags`).
- Version 1.4.20 / versionCode 30 (app.json, package.json, package-lock ×2, buildInfo),
  `version.json` 1.4.20, `index.html` ۱.۴.۲۰ (fa ×3 + en ×3).
- Verified: check-i18n OK (244/304); `npm run verify` green (bundle contains `systemCheck`,
  `checked via`, `watchdogForeground`, and two `setInterval(...,3000)` polls); `npm run
  prebuild:android` → versionName 1.4.20 / versionCode 30, app_name Tavakkol (fa توکل); both
  manifests parse; 4 inline JS blocks + 3 JSON-LD blocks in `index.html` all parse; div/a tag balance
  OK; Kotlin brace/paren balance 0/0 on `FocusGuardModule.kt` + `GuardWatchdogService.kt`;
  `android/` + `dist/` wiped. Kotlin compiles only in CI.
- SHIPPED 2026-11-15: commit `f4ed478` → main + tag `v1.4.20`; CI runs 43698767433 (main) +
  43698789262 (tag) both SUCCESS → Release `Tavakkol v1.4.20` live, `Tavakkol-release.apk`
  37,029,387 bytes at
  https://github.com/elyasyy23-lgtm/FocusBlocker/releases/download/v1.4.20/Tavakkol-release.apk
  (`releases/latest/...` 302 → v1.4.20, Pages `version.json` = 1.4.20, Pages index live with
  `id="apk-cta"` + `versionedUrl`). Pending owner on-device check: pill flips «متوقف» within
  ~3 s of the guard dying; download button shows no re-download warning.

## v1.4.21 — APK signed with v1 + v2 + v3 schemes (2026-11-15)

Owner report: the downloaded v1.4.20 APK refuses to install on the phone with **«Package appears
to be invalid»**. Triage first proved the artifact was NOT the cause — `apksigner verify
--print-certs` returns the SAME cert SHA-256
`fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` (CN=Android Debug) for v1.4.9,
v1.4.16, v1.4.19 and v1.4.20, so the signing key never changed; the APK verifies, has no
`testOnly`/`debuggable`, minSdk 24 / targetSdk 36, arm64-v8a + armeabi-v7a, stored + aligned
`resources.arsc`, clean `unzip -t` and `zipalign`, and `releases/latest/...` is byte-identical to
the tag asset. The remaining gap was the SIGNING SCHEME: the APK was **v2-only**, and that generic
installer status is the documented symptom of OEM installers rejecting a v2-only APK.

- **`plugins/withSigningSchemes.js` (new config plugin)** — `withAppBuildGradle` injects
  `enableV1Signing true` / `enableV2Signing true` / `enableV3Signing true` right after
  `keyPassword 'android'` inside the template's `signingConfigs.debug` block. That block is what
  the `release` buildType reuses (`signingConfig signingConfigs.debug`), so BOTH build types get
  all three schemes while the signing IDENTITY stays the debug cert — an update still installs
  over an existing Tavakkol install. Idempotent (skips when `enableV1Signing` is already present)
  and it throws a clear error if the template anchor ever moves.
- **Why a plugin and not an edit:** `android/` is generated by `expo prebuild --clean` on every CI
  run, so a hand-edited `android/app/build.gradle` would be wiped. The plugin is registered in
  `app.json` → `plugins: ["expo-audio", "./plugins/withSigningSchemes"]`.
- Verified locally: `npx expo prebuild --platform android --clean --no-install` produces
  `android/app/build.gradle` with the three flags inside `signingConfigs.debug` (and versionCode 31
  / versionName "1.4.21"); `android/app/debug.keystore` comes from the template (same cert).
- Version 1.4.21 / versionCode 31 (app.json, package.json, package-lock ×2, buildInfo),
  `version.json` 1.4.21, `index.html` ۱.۴.۲۱ (fa ×3 + en ×3).
- Verified: check-i18n OK (244/304), `npm run verify` green (1.2 MB android bundle), prebuild
  injection confirmed, `android/` + `dist/` wiped. Kotlin/AGP compile only in CI.
- Lesson: «Package appears to be invalid» is `PackageInstaller.STATUS_FAILURE_INVALID` — a generic
  status, not a signature error. Compare the cert digest across releases BEFORE believing a
  key-change theory, then close the remaining signing-scheme gap (v1+v2+v3) rather than rebuilding
  blind. Playbook: skill `apk-install-failure-triage`.
- **SHIPPED 2026-11-15**: commit `6ff7549` → main + tag `v1.4.21`; CI runs 43704628263 (main) +
  43704639127 (tag) both SUCCESS → Release `Tavakkol v1.4.21`, `Tavakkol-release.apk`
  **37,089,200 bytes**, sha256
  `532ecc59d306cb1eb70d2d24aa1b6980203f52cacd4ed2667e757d93bbcc8e6e` at
  https://github.com/elyasyy23-lgtm/FocusBlocker/releases/download/v1.4.21/Tavakkol-release.apk
  (`releases/latest/...` → v1.4.21). Cert unchanged
  (`fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`), so it installs over an
  existing Tavakkol install. Verified on the downloaded release APK: versionCode 31 /
  versionName 1.4.21, package `com.focusblocker.app`, minSdk 24 / targetSdk 36, arm64-v8a +
  armeabi-v7a, `unzip -t` OK, `zipalign -c -v 4` OK, and **v1 + v2 + v3 all true**
  (`apksigner verify --min-sdk-version 23 --verbose`).
- **apksigner v1 gotcha (important, cost a false alarm):** plain `apksigner verify --verbose`
  reports `Verified using v1 scheme (JAR signing): false` for BOTH APKs — including one that
  apksigner itself just signed with `--v1-signing-enabled true`. That is NOT a missing signature:
  with the APK's declared `minSdkVersion` 24, apksigner does not verify the v1 scheme at all (v1 is
  only needed for API < 24) and reports false. Force the check with
  `apksigner verify --min-sdk-version 23 --verbose` to see the truth. Cross-check: `unzip -l` shows
  `META-INF/CERT.SF` + `META-INF/CERT.RSA` and `jarsigner -verify` prints "jar verified". By that
  same test v1.4.20 FAILS verification at minSdk 23 (it was v2-only) — that is the real diff.
- **AGP 9 note:** the project's AGP is `9.2.1` (Gradle 9.4.1). It honours `enableV1Signing` /
  `enableV2Signing` / `enableV3Signing` in `signingConfigs.debug` — v1.4.21 has v1+v2+v3 where
  v1.4.20 had v2 only, so the plugin's three flags all took effect.

## Site structure — multi-page (2026-11-16, commit `588932e`)

The GitHub Pages site is no longer one long file. Architecture:

| file | role |
|---|---|
| `index.html` | home: hero (Tavakkol) + features/steps/guide/faq + **`#apps` app grid** |
| `rakaatcounter.html` | RakaatCounter detail page: dark hero (`.appcard-wide`), `.featgrid`, install steps, `.ctaband` |
| `assets/site.css` | ALL design-system CSS for both pages (was inline in index.html) |
| `assets/i18n.js` | the ONE language engine; each page only supplies `window.I18N_EN` before it loads |
| `assets/apk-links.js` | rewrites `a[data-repo][href$=".apk"]` with `?v=<latest tag>` from the releases API |
| `sitemap.xml` | both URLs (home 1.0, detail 0.8) |

**Adding a new app page = 3 edits, no engine work:** (1) copy `rakaatcounter.html`, swap the Persian
markup + its `window.I18N_EN` dict; (2) drop the icon in `assets/`; (3) copy one
`<article class="apptile">` block in `index.html`'s `#apps` grid and point it at the new page.
Every download link must carry `data-repo="owner/repo"` so `apk-links.js` can stamp the version.

Rules that bit us / must hold:
- Persian is the source of truth in the markup; the English dict is per page (page-specific keys
  differ), the engine is shared. `meta.*` keys are used by `i18n.js`, NOT by `data-i18n` — a naive
  "unused EN key" scan shows them as extras.
- Download links: stable filename (`RakaatCounter-release.apk`) + `?v=<tag>` (never a version in
  the filename — Chrome then asks "Download file again?" and renames to `name (1).apk`).
- `.reveal` is a plain CSS animation (`rise`), not IntersectionObserver — new sections animate on
  load with no JS.
- Verify before pushing: i18n key coverage (data-i18n ⊆ dict), tag balance, `node --check` on every
  inline `<script>`, JSON-LD `json.loads`, and the linkedom click test (EN → asserts dir/ltr, h1,
  meta, aria-pressed, localStorage; FA → byte-for-byte Persian restore) at `$TMPDIR/domtest/test-pages.mjs`.
- `pkill -f "http.server 8487"` inside a bash tool call kills the tool's own shell (self-match) —
  use `pkill -f "[h]ttp.server"`.

## App-store layer (2026-11-16, site v2)

Home is now a small app store, not a single-app page:

- **Header search** (`#app-search`): filters `#appgrid .apptile` by every space-separated token of
  the query. Each card carries `data-search` with BOTH languages, so the filter survives a language
  switch. Folding normalises ي/ی, ك/ک, hamza forms, ZWNJ and diacritics. No match → `#appgrid`
  collapses and `#apps-empty` (role="status") shows; both the field's × and the empty-state button
  reset. Escape also clears.
- **Cards**: icon 64px, name, developer, free pill, description, version/size/OS chips, full-width
  primary Download (data-repo) + ghost Details. No invented ratings or download counts.
- **Detail page** (`rakaatcounter.html`): `.apphero` (126px icon, h1, dev, pills, big CTA,
  version/size, install note) → `.shotrail` (5 × `.shot` phone-aspect placeholders, horizontal
  scroll + `scroll-snap`, swipe hint) → `.aboutapp` (3 paragraphs + `.desclist`) → `.featgrid`
  (how it works) → `.tech` `.infotable` → install steps → CTA band.
- **Technical table** (trust): version / file size in bytes / last updated / package / Android
  requirement / **SHA-256** with a copy button (`#copy-hash`, flash "کپی شد", execCommand
  fallback). The hash MUST be the release asset's own `digest` — never a made-up value.
- Engine note: `assets/i18n.js` also translates `placeholder` via `data-i18n-placeholder`.
- Verification lives at `$TMPDIR/domtest/test-appstore.mjs` (38 checks: search fa/en/no-match/reset,
  EN+FA round trip, hero, 5 shots, 6 table rows, exact hash, clipboard payload).

## Detail page = APKPure-style (2026-11-16, site v3)

`rakaatcounter.html` now follows the APKPure app-page structure, top to bottom:

1. **Breadcrumb** `.crumbs` — back pill + خانه / برنامه‌ها / رکعت‌شمار (`aria-current="page"`) +
   free/download pill on the far side.
2. **Hero** — 146px icon, h1, a `version · by developer · updated` meta line, feature pills,
   a `.hero-verify` link ("فایل تأییدشده") that jumps to `#tech`, big Download + version/size meta,
   install note.
3. **Screenshots** — horizontal rail, 5 phone-aspect placeholders (real screenshots replace these
   later; keep `.shot` and the `data-i18n` labels when swapping in `<img>`).
4. **About the app** — 3 paragraphs + checklist.
5. **What's new in 1.6.0** — `.version-tag` + `.newslist` of 5 REAL changes (calibration, Qibla,
   per-prayer reset, on-screen completion, log copy). Update this block on every release.
6. **How it works** — `.featgrid` feature cards.
7. **Technical table** — 8 rows: version, size in bytes, updated, package, requires Android,
   category, developer, SHA-256 + copy button. The hash is the release asset's own digest.
8. **Install in three steps** — `.steps-list`.
9. **More apps from us** — `.simgrid` with the Tavakkol card (`assets/web-icon.png` → `index.html`)
   and an "All apps" card (`index.html#apps`). Add one `.simcard` per future app.
10. **CTA band**.

**Sticky download bar** (`#sticky-dl`): appears only after the hero Download button scrolls above
the viewport (scroll handler → 120 ms throttle → `getBoundingClientRect().bottom < 0`), adds
`body.has-stickybar` (76px bottom padding) and hides again when the hero button returns. Full-width
strip on phones, centred floating pill ≥821px. Reduced-motion users get no animation.
To keep it honest, never let it show before the hero CTA has actually left the screen.

Verification: `$TMPDIR/domtest/test-appstore.mjs` now runs 61 checks (structure, hash exactness,
i18n both ways, plus the sticky-bar show/hide logic driven by a stubbed `getBoundingClientRect`).
