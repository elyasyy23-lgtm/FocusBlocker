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

## Project: FocusBlocker (state as of 2026-11-11, v1.1.3)

Android-only self-control app, English UI, Expo SDK 58 / RN 0.88.1 / React 19.3.
v1.1.2 died again ~a day after install (never verified on-device); v1.1.3 adds an
in-app DEBUG LOG so the next death shows its cause.

- `App.js` — the entire UI. Talks to the native module through `modules/focus-guard/index.js`
  (never import `requireNativeModule` in a screen; the wrapper no-ops in Expo Go).
  Save buttons turn WHITE while the editor text equals the stored list (`keywordsSaved` /
  `domainsSaved` derived from `config.*.join(', ')` — stateless, survives restart) and go
  green again on any text change. Requests `POST_NOTIFICATIONS` once on mount (Android 13+).
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
    property) + receiver, both `exported="true"`, full class names, merged into the app by
    Gradle. Declares `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_SPECIAL_USE`,
    `POST_NOTIFICATIONS`, `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`.
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
- Decisions (2026-11-10): `expo-pilot` is NOT used as the engine — its listeners run in JS and die
  with the backgrounded RN runtime. `react-native-device-admin` does not exist on npm (404).
  v1.1.0's "page body text deliberately ignored" was SUPERSEDED in v1.1.2 by owner request:
  keywords match any on-screen text CHANGE (chat apps included); the throttled tree walk
  still matches only input fields + address bars, so static page body text stays ignored.
  Known edge accepted: a text-change hit from a non-active split-screen app still presses
  BACK once.
- Verification (`npm run verify` = `expo export --platform android --no-bytecode`): 614 modules,
  plus `npx expo-modules-autolinking resolve -p android --json | grep focus-guard`,
  `npm run prebuild:android`, `npx expo-doctor` (20/20).
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
