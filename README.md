# Tavakkol

A personal self-control app for Android (formerly FocusBlocker) with seven safeguards,
a full Settings screen, and an English/Persian interface:

1. **Targeted keyword blocker** — the Accessibility Service does *not* read the whole screen.
   It checks the text inside input fields only (`EditText` / `AutoCompleteTextView`, i.e. the
   Google search bar, a browser address bar, any text box). A blocked keyword closes the
   keyboard/search immediately with `GLOBAL_ACTION_BACK`. Tavakkol never inspects its own
   window, so typing your block lists in the setup screen is always safe.
2. **Domain blocker** — inside Chrome (and other browsers, including Chrome Custom Tabs) the
   service reads the URL from the address-bar node. If the page host matches the blocked-domain
   list (including subdomains), it presses Back immediately; if the site is still on screen, it
   keeps backing out and finally goes Home.
3. **Device admin (anti-uninstall)** — while the app is an active device administrator, Android
   refuses to uninstall it. The same admin also exposes a "panic lock" that locks the screen
   immediately (`<force-lock />` policy).
4. **Excluded apps** — apps you whitelist (a prayer app, a messenger you need) are skipped
   completely: keyword and domain checks never touch their windows.
5. **Whole-word Persian matching** — a keyword only fires as a whole word, so `gi` no longer
   triggers inside `payam-resan`. Arabic/Persian letter variants, the half-space (ZWNJ) and
   diacritics are normalized before matching, so a phrase with a space matches too.
6. **Settings** — language (English / Persian, RTL without restarting), excluded-app picker
   with search, share the app, contact the developer, and the version footer.
7. **Help screen** — five numbered setup steps (keywords, accessibility, device admin, partner
   PIN, excluded apps) in both languages, reachable from the "?" button on the main screen.
8. **Support Us** — the app is free and ad-free; two donation routes (inside Iran via ZarinPal,
   outside Iran via a crypto wallet) open from Settings, plus Share App / Contact Developer in
   the "More" section below. Destinations are configured in `src/defaults.js`
   (`DONATION_ZARINPAL_URL`, `DONATION_WALLET`); the crypto wallet is filled, the ZarinPal link
   stays empty until the owner pastes it (the sheet then says "not set yet" rather than showing a
   fake address). Contact Developer opens Rubika at **@yasmajyd** (`DEVELOPER_RUBIKA_ID`).
9. **Partner PIN (v1.3.1/v1.3.2)** — a 4-8 digit PIN is set in Settings and handed to a partner.
   From then on the app is gated behind that PIN every time it opens (Settings and the
   Protection switch never ask for it). There is **no Unlock button**: the correct PIN opens the
   app the moment the last digit is typed. **v1.3.3 lockout**: three wrong PINs disable the whole
   keypad for 30 seconds while the screen counts down ("Try again in 30s…" / «۳۰ ثانیه دیگر
   تلاش کنید»), then the counter resets. The PIN is stored only as `SHA-256(salt + pin)`.
10. **System-page guard (v1.3.2)** — while **Protection is on**, the accessibility service leaves
   the system *Device admin apps* page (`com.android.settings`) and Tavakkol's own app-info page
   (force-stop / uninstall) immediately with `GLOBAL_ACTION_BACK` — detected from the Settings
   activity name, with a second Back and finally Home if the page comes back. No PIN is needed
   for this part; turning Protection off makes the guard silent again.
   Honest limits: a Settings entry cannot be removed, only left; the Device Admin toggle cannot
   be locked by a normal app (only a device-owner build); clearing app data erases the PIN.
11. **App name & icon (v1.3.2)** — the launcher shows **توکل** in Persian and **Tavakkol** in
   English, with the icon built from your own photo (`scripts/make-icon.js`).

Everything runs on the phone, offline. Nothing is uploaded, no analytics, no network calls.

> Expo Go cannot run accessibility services or device admin. You need a real build
> (`eas build -p android --profile preview`). In Expo Go the UI renders with a yellow
> "Native build required" banner.

## Project layout

```
App.js                                   React Native UI (main screen)
src/
  theme.js                               colors, overlay, RTL direction helpers
  i18n.js                                English-keyed dictionary + Persian translation
  defaults.js                            default keywords, share/contact links
  buildInfo.js                           version label shown in Settings
  components/ui.js                       Section / StatusPill / ActionButton / Chip / GiftNote
  components/PinPad.js                   numeric keypad + PIN dots (v1.3.1)
  screens/LockScreen.js                  full-screen Partner-PIN gate, auto-submit (v1.3.2)
  screens/SettingsScreen.js              language, excluded apps, help, donate, share, contact
  screens/HelpScreen.js                  the five setup steps + support note
locales/
  fa.json                                Persian app name (توکل) for the launcher
scripts/
  check-i18n.js                          fails if a UI string has no Persian translation
  make-icon.js                           builds assets/icon*.png from your own photo
  make-background.js                     generates the placeholder background
  set-background.js                      crops your own photo to assets/background.jpg
assets/background.jpg                    main screen background (placeholder shipped)
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

## Checks

```bash
npm run verify            # Metro bundle (expo export, --no-bytecode)
node scripts/check-i18n.js # every t('…') key must exist in the Persian dictionary
node scripts/set-background.js ~/photo.jpg   # optional: your own background
```

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
6. In **5. Keep-alive** tap **Start keep-alive now**, then **Open Autostart settings** and allow
   FocusBlocker to autostart. On Redmi/POCO/Xiaomi also set *Battery saver → No restrictions*
   and pull the app down in Recents to lock it — see [Keep-alive](#keep-alive-v114).
7. Type a blocked keyword into a search bar — the keyboard/search closes and the counter
   increases. Open a blocked domain in Chrome — the page closes and the counter increases.

## Keep-alive (v1.1.4)

The guard used to die quietly after a day on MIUI/HyperOS. It now has four independent
restarters, all registered with the system (so they work while the app process is dead):

1. **Watchdog service** (`GuardWatchdogService`) — a normal `START_STICKY` foreground service
   that owns the persistent notification. Android restarts it by itself after a kill, and
   starting it brings the app process back up, which is what lets the system rebind the
   accessibility service.
2. **15-minute alarm** (`AlarmManager`, inexact + a Doze-proof `setAndAllowWhileIdle` arm) →
   `GuardWakeupReceiver` → watchdog.
3. **15-minute persisted job** (`JobScheduler`) → same receiver path; persisted jobs survive
   reboots without any of our code running.
4. **Boot / app-update receiver** (`BOOT_COMPLETED`, `QUICKBOOT_POWERON`, `MY_PACKAGE_REPLACED`).

The watchdog writes a heartbeat every 30 s, checks once a minute whether the accessibility
guard is bound again, and after three minutes without it posts a visible
**"FocusBlocker guard is off"** notification instead of dying silently. Every wake-up that
revives a dead process is written to the Debug Log (`watchdog_wakeup`).

**One-time setup that no code can do for you** (there is no API for it):

- **Autostart ON** — the *Open Autostart settings* button opens the right screen on MIUI/HyperOS,
  Huawei, OPPO/Realme, vivo, Samsung and ASUS builds.
- **Battery saver → No restrictions** for FocusBlocker.
- **Lock the app in Recents** (MIUI) — pull the card down, tap the lock icon.

Without Autostart, MIUI's powerkeeper can still kill the app; the alarm/job/boot paths will
bring it back, but every kill costs up to 15 minutes of protection.


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

Download it from the Actions run (Artifacts → `Tavakkol-release-apk`) or from
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
  reset, or a user who turns Protection off and then opens Settings → Device admin apps can still
  remove it. While Protection is on, the guard leaves that page immediately (v1.3.2), but Android
  gives a normal app no way to hide or lock the entry — that is Android's rule, not a bug here.
- After a reboot the boot receiver restarts the keep-alive chain; if the UI still shows
  *Accessibility: DISABLED* the toggle was switched off and only you can turn it back on.
- Keep-alive is not magic: OEM power managers (MIUI, ColorOS, EMUI, Funtouch) can force-stop an
  app, and a force-stop is the one state Android will not let any app escape. With Autostart +
  *No restrictions* + the Recents lock it does not happen; the watchdog then only ever handles
  ordinary low-memory kills.

## Verification without a device (what CI/this repo checks)

```bash
npx expo-modules-autolinking resolve -p android --json | grep focus-guard
npx expo prebuild -p android --no-install      # proves the manifest merges into a project
npx expo export --platform android             # proves the JS bundle compiles
```

Kotlin is compiled only by the EAS/Gradle build — Termux has no Android SDK, so a green
`export` + autolinking is the local ceiling.
