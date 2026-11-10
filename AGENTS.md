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

## Project: FocusBlocker (state as of 2026-11-10)

Android-only self-control app, English UI, Expo SDK 58 / RN 0.88.1 / React 19.3.

- `App.js` — the entire UI. Talks to the native module through `modules/focus-guard/index.js`
  (never import `requireNativeModule` in a screen; the wrapper no-ops in Expo Go).
- `modules/focus-guard/` — local Expo module, autolinked, no package.json:
  - `FocusAccessibilityService.kt` — the keyword engine. Event-text fast path, then a throttled
    (350 ms per package) BFS of `rootInActiveWindow` (depth 40 / 600 nodes). On a hit: 900 ms
    cooldown, counter++, Toast, BACK ×3 (400 ms apart) then HOME.
  - `FocusGuardModule.kt` — JS API: `getConfig` (JSON string), `setKeywords`, `setEnabled`,
    `isAccessibilityEnabled`, `openAccessibilitySettings`, `isDeviceAdminActive`,
    `requestDeviceAdmin`, `lockScreen`, `resetBlockCount`.
  - `FocusGuardStore.kt` — SharedPreferences (`focus_blocker_prefs`) so the service works with
    the RN runtime dead.
  - `FocusDeviceAdminReceiver.kt` + `res/xml/device_admin.xml` (`<force-lock />`) —
    an ACTIVE admin is what blocks uninstall; the policy only grants `lockNow()`.
  - `android/src/main/AndroidManifest.xml` — service + receiver, both `exported="true"`,
    full class names, merged into the app by Gradle.
- Decision (2026-11-10): `expo-pilot` is NOT used as the engine — its listeners run in JS and die
  with the backgrounded RN runtime. `react-native-device-admin` does not exist on npm (404).
- Verification (`npm run verify` = `expo export --platform android --no-bytecode`): 614 modules,
  plus `npx expo-modules-autolinking resolve -p android --json | grep focus-guard`,
  `npm run prebuild:android`, `npx expo-doctor` (20/20).
  Termux cannot compile Kotlin — a green bundle is the local ceiling; Gradle compiles on EAS.
- `android/` and `dist/` are generated; deleted after verification. Do not hand-edit them.
- Build: `eas build -p android --profile preview` (`eas.json` preview = `buildType: apk`).
  Never ship the default `.aab` — it cannot be sideloaded.
- Not yet installed on a device: first-run steps are in README.md (accessibility toggle,
  Android 13+ "Restricted setting" workaround, device admin, removal steps).

### Testing (2026-11-10)

- **Expo Go cannot test this app.** `requireNativeModule('FocusGuard')` fails there (no custom
  native code in the Go client), the module no-ops, buttons disable, and the accessibility
  service/device admin entries never exist in Android Settings. Expo Go only proves the UI layout.
- A **development build** is required: `expo-dev-client` is installed (`~58.0.18`) and the
  `development` profile in `eas.json` already sets `developmentClient: true` + `buildType: apk`.
- EAS is logged in on this machine as `elyasyass`; project not yet linked (no `extra.eas.projectId`
  in app.json) → run `npx eas-cli@latest init` once.
- EAS uploads **committed** git state; uncommitted edits are not in the build unless the worktree
  is committed first (or `EAS_NO_VCS=1` is set).
- Dev server: `npx expo start --dev-client --localhost` (Metro runs on the phone; the dev build
  reaches it at `http://127.0.0.1:8081`). Dev bundle verified: 742 modules, 4.1 MB, contains
  `FocusGuard`. `--tunnel` only needed when Metro runs on a different machine (this phone has
  mobile data only, so LAN mode never works).
- Termux noise on start: `An unknown error occurred while installing React Native DevTools —
  Cannot read properties of undefined (reading 'arm64')` — harmless, Metro serves normally.
- JS/UI changes hot-reload in the dev build; native changes (Kotlin, manifest, new module) need a
  new dev build. `app.json`'s `scheme` is set to `focusblocker` for dev-client deep links.
