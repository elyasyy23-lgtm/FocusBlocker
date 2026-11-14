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
- NOT pushed: owner runs commit/push/tag (`git tag v1.4.11`).
