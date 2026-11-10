# FocusBlocker

A personal self-control app for Android with three features:

1. **Targeted keyword blocker** — the Accessibility Service does *not* read the whole screen.
   It checks the text inside input fields only (`EditText` / `AutoCompleteTextView`, i.e. the
   Google search bar, a browser address bar, any text box). A blocked keyword closes the
   keyboard/search immediately with `GLOBAL_ACTION_BACK`. FocusBlocker never inspects its own
   window, so typing your block lists in the setup screen is always safe.
2. **Domain blocker** — inside Chrome (and other browsers, including Chrome Custom Tabs) the
   service reads the URL from the address-bar node. If the page host matches the blocked-domain
   list (including subdomains), it presses Back immediately; if the site is still on screen, it
   keeps backing out and finally goes Home.
3. **Device admin (anti-uninstall)** — while the app is an active device administrator, Android
   refuses to uninstall it. The same admin also exposes a "panic lock" that locks the screen
   immediately (`<force-lock />` policy).

Everything runs on the phone, offline. Nothing is uploaded, no analytics, no network calls.

> Expo Go cannot run accessibility services or device admin. You need a real build
> (`eas build -p android --profile preview`). In Expo Go the UI renders with a yellow
> "Native build required" banner.

## Project layout

```
App.js                                   React Native UI (the whole screen)
modules/focus-guard/                     local Expo module (autolinked, no npm publish)
  index.js                               JS bridge with Expo Go fail-safe
  android/src/main/AndroidManifest.xml   <service> + <receiver> declarations
  android/src/main/res/xml/
    accessibility_service_config.xml     what the service is allowed to read
    device_admin.xml                     <force-lock /> policy
  android/src/main/res/values/strings.xml
  android/src/main/java/com/focusblocker/guard/
    FocusGuardModule.kt                  native functions used by App.js
    FocusAccessibilityService.kt         the guard: input-field keywords + browser domain check
    FocusDeviceAdminReceiver.kt          device admin receiver
    FocusGuardStore.kt                   SharedPreferences storage (keywords, domains, counter)
app.json                                 package name, icons, version
eas.json                                 preview profile = APK
```

### Why the blocking logic is in Kotlin, not JS

`expo-pilot` and similar libraries expose an accessibility service to JavaScript, which is fine
for scripted automation while your app is on screen. A self-control guard has to fire while the
user is inside *another* app with the React Native runtime backgrounded or killed. Android
throttles and later kills a background JS timer, so the check lives in the service itself
(`FocusAccessibilityService.onAccessibilityEvent`) and reads the keyword/domain lists from native
storage. The result: blocking keeps working when the UI is not running.

The trade-off is that this module is hand-written and Android-only (same as expo-pilot).
`react-native-device-admin` does not exist on npm (404), so the device admin receiver is part of
the same local module.

## Build the APK (EAS, no Android Studio needed)

```bash
npx eas-cli@latest login                 # create a free Expo account if needed
cd FocusBlocker
npx eas-cli@latest build:configure       # first time only: creates/updates the project id
npx eas-cli@latest build -p android --profile preview
```

When the build finishes the CLI prints a download URL (also visible at
https://expo.dev/projects). Open that link on the phone and install the `.apk`.

The `preview` profile in `eas.json` sets `"buildType": "apk"` — without that line EAS produces an
`.aab`, which cannot be sideloaded.

Local alternative (needs JDK 17 + Android SDK on a PC):

```bash
npx expo run:android --variant release
```

## First run on the phone

1. Install and open FocusBlocker.
2. Type your keywords, comma separated (`sex, porn, casino`), tap **Save block list**.
3. Type the domains you want closed, one per line or comma separated (`facebook.com,
   instagram.com`), tap **Save domain list**. `https://`, `www.` and paths are stripped for you.
4. Tap **Open Accessibility settings** → *Installed apps* → **FocusBlocker guard (keywords +
   domains)** → On.
   - On Android 13+ a sideloaded app may show a greyed-out toggle with
     *"Restricted setting"*. Fix: Settings → Apps → FocusBlocker → ⋮ → **Allow restricted
     settings**, then enable the service again.
5. Tap **Activate device admin** → confirm the system dialog.
6. Type a blocked keyword into a search bar — the keyboard/search closes and the counter
   increases. Open a blocked domain in Chrome — the page closes and the counter increases.

## Removing the app

An active device admin blocks uninstall by design. To remove FocusBlocker:
Settings → Security → Device admin apps → **FocusBlocker device admin** → Deactivate, then
uninstall normally. If you lock Android Settings with a third-party app locker, deactivate the
admin first — otherwise the app is stuck on the phone.

## Automatic APK builds (GitHub Actions)

`.github/workflows/android-release.yml` builds a signed, installable release APK on every push
to `main`, and publishes it as a GitHub Release when a `v*` tag is pushed:

```bash
git add -A
git commit -m "feat: targeted keyword + domain blocking"
git push origin main          # → APK artifact in the Actions run
git tag v1.1.0
git push origin v1.1.0        # → APK attached to the GitHub Release
```

Download it from the Actions run (Artifacts → `FocusBlocker-release-apk`) or from
**Releases**. The CI template signs the release APK with the debug keystore, so it installs
directly — replace it with a real keystore before publishing to a store.

## Known limits (read before trusting it)

- Keyword matching is substring based and only runs on input-field text (search bars, address
  bars, text boxes). Page body text is deliberately ignored, and images/videos/games that draw
  text on a canvas are invisible to accessibility.
- Domain matching needs a browser whose address bar exposes its URL through accessibility
  (Chrome, Firefox, Edge, Brave, Samsung Internet, Opera, DuckDuckGo, Vivaldi, Kiwi, Yandex).
  Pages opened inside a non-browser app's own WebView without a URL bar cannot be checked.
- Some apps load content lazily; the guard reacts on the next accessibility event (usually
  within a few hundred milliseconds). The guard ignores its own package entirely — events from
  the keyboard or launcher are only acted on when the foreground window belongs to another app.
- Deep scans are throttled (~350 ms per app) to protect battery; very fast scrolls can slip past
  a single frame but will be caught on the next event.
- Device admin stops *normal* uninstall. It is not a security product: `adb uninstall`, a factory
  reset, or a user who knows Settings → Device admin apps can still remove it. That is Android's
  rule, not a bug in the app.
- After a reboot, accessibility services normally restart by themselves; open the app once if the
  status shows Disabled.

## Verification without a device (what CI/this repo checks)

```bash
npx expo-modules-autolinking resolve -p android --json | grep focus-guard
npx expo prebuild -p android --no-install      # proves the manifest merges into a project
npx expo export --platform android             # proves the JS bundle compiles
```

Kotlin is compiled only by the EAS/Gradle build — Termux has no Android SDK, so a green
`export` + autolinking is the local ceiling.
