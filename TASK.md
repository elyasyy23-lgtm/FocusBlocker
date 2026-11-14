# TASK — Tavakkol v1.4.5 (custom drawer · Settings lock · symmetric Delay Mode)

CURRENT RELEASE TARGET = **v1.4.5** (versionCode 16). See the v1.4.5 section at the bottom.
(The v1.4.0 goal below is the historical first task that created this file.)

GOAL (owner's list, 2026-11-13):
1. **Remote Deactivation via SMS** — a toggle inside a new Settings section «کنترل از راه دور»
   (Remote Control). Default OFF. OFF = every incoming SMS is ignored completely. ON = the app
   listens for a partner SMS (partner number + unlock code configured in the same section) and
   turning that SMS into "Protection OFF". Each new SMS is processed **only once**
   (`One-Time Processing`), and SMS that arrived BEFORE the toggle was switched on are never
   considered.
2. **Remove the "Support Us" / «پشتیبانی» block from the Help screen** — support lives ONLY in
   Settings now.
3. **Move "Share App" out of the More section** (where Contact Developer sits) into a new
   «دربارهٔ توکل» / About Tavakkol section at the TOP of Settings; same `Share.share()` logic.
4. Bump to **v1.4.0** (versionCode 12) and hand over the exact push/build commands.

Previous: v1.3.3 shipped 2026-11-13 (commit 549d4f2, tag v1.3.3) — both CI runs SUCCESS,
Release live: `Tavakkol-release.apk` 31.1 MB
(https://github.com/elyasyy23-lgtm/FocusBlocker/releases/download/v1.3.3/Tavakkol-release.apk).

## Design decisions (locked)

- Remote state lives in `FocusGuardStore` (SharedPreferences) so the SMS receiver works with
  React Native dead — same rule as the rest of the guard.
- Keys: `remote_enabled` (default **false**), `remote_number`, `remote_code`, `remote_since`
  (ms when the toggle was last switched ON — SMS with `timestampMillis <= remote_since` are
  ignored), `remote_last_hash` (dedupe: SHA-256 of `address|body|timestamp`), `remote_last_at`,
  `remote_count`.
- Sender match = digits-only, last 10 digits equal (handles +98 / 0 prefixes).
- Code match = case-insensitive `contains`, after folding Persian/Arabic digits to ASCII.
- Reaching the match: `setEnabled(false)` + `clearUnlockWindow()` + `logEvent("remote_deactivated")`
  + a HIGH-importance notification so the partner sees it worked.
- `RECEIVE_SMS` runtime permission is requested from Settings (PermissionsAndroid) — the toggle
  refuses to turn on while it is denied, and the section shows the live permission state.
- No new dependency: `RemoteSmsReceiver` is a `BroadcastReceiver` in the same local module.
- Turning the feature OFF is always allowed — validation (10+ digit number, 4+ char code) runs
  ONLY when enabling (a lock-in on your own kill switch would be the worst bug here).

## Steps

- [x] Re-read module (Store / Module / index.js / manifest) and the three UI files.
- [x] `FocusGuardStore.kt` — remote keys + getters/setters + `recordRemoteDeactivation` +
      `normalizeDigits()` / `foldDigits()` helpers.
- [x] `RemoteSmsReceiver.kt` (new) — SMS_RECEIVED receiver: OFF → return immediately; ON →
      join parts, drop pre-enable + already-handled messages, match sender + code, deactivate,
      notify.
- [x] `AndroidManifest.xml` — `<uses-permission RECEIVE_SMS>` + the receiver entry
      (exported=true, `android.permission.BROADCAST_SMS`, SMS_RECEIVED filter).
- [x] `FocusGuardModule.kt` — `getRemoteState` + `setRemoteDeactivation(enabled, number, code)`
      (+ remote fields in `getConfig`); validation only on enable.
- [x] `modules/focus-guard/index.js` — `EMPTY_REMOTE`, `getRemoteState()`,
      `setRemoteDeactivation()`; remote fields in `EMPTY_CONFIG`.
- [x] `src/screens/SettingsScreen.js` — «دربارهٔ توکل» at the top with the moved Share App
      button; «کنترل از راه دور» (Switch + number + code + Save + permission row + last-trigger
      line); Share App removed from More.
- [x] `src/screens/HelpScreen.js` — Support section removed, unused imports/props cleaned
      (GiftNote prayer note KEPT); `App.js` stops passing `onOpenSettings`.
- [x] `src/i18n.js` — 20 new English keys + Persian translations (202 strings / 233 entries).
- [x] Version: app.json 1.4.0 / versionCode 12, package.json + package-lock, buildInfo 1.4.0 (12).
- [x] Verify: `node scripts/check-i18n.js` OK, `npm run verify` green (631 modules, bundle
      contains `getRemoteState`/`setRemoteDeactivation`), `npm run prebuild:android` OK
      (versionName 1.4.0 / versionCode 12), generated `android/` + `dist/` wiped, AGENTS.md
      updated.
- [x] Pushed 2026-11-13: commit `020afbe` → main + tag `v1.4.0`. CI run 43454906903 (main) SUCCESS
      (Gradle compiled `RemoteSmsReceiver.kt`); tag/release run 43454928951 was still building.
- [ ] Owner on-device check (v1.4.1 includes the new Share link): toggle refuses to turn on without SMS permission; a partner SMS
      with the code turns Protection off ONCE (second identical delivery ignored); an SMS that
      arrived before the toggle was on is ignored; Help has no Support block; Share App sits at
      the top of Settings.

NOW: v1.4.5 code complete + verified locally — owner push pending (commands below).
Docs page live: https://elyasyy23-lgtm.github.io/FocusBlocker/ (index.html, main /).

## v1.4.2 — Delay Mode + background music (2026-11-13)

- [x] `assets/background_music.mp3` copied from `/storage/emulated/0/Download/ssss.mp3` (3.2 MB).
- [x] `expo-audio` installed (expo-av is gone in SDK 58); app.json blocks RECORD_AUDIO +
      FOREGROUND_SERVICE_MEDIA_PLAYBACK.
- [x] Native prefs `delay_mode` / `music_muted` + module getters/setters + bridge functions.
- [x] Main screen: Protection + Delay Mode switches side by side; player loops at 30 % while the
      app is active.
- [x] Delay challenge modal: exact-text, paste blocked (contextMenuHidden + >10-char jump
      rejected), cancel/wrong keeps Protection ON.
- [x] Settings → «موسیقی پس‌زمینه» mute switch (persisted natively).
- [x] i18n: both challenge texts + all new strings (220 keys / 252 translations).
- [x] `index.html` → `releases/latest/download/Tavakkol-release.apk`, labels ۱.۴.۲.
- [x] Version 1.4.2 / versionCode 14 (app.json, package.json, package-lock, buildInfo).
- [x] Verify: check-i18n OK, `npm run verify` 642 modules + music asset, prebuild 1.4.2 (14),
      `android/` + `dist/` wiped.
- [x] In-app update checker: `version.json` in repo root (Pages), silent fetch once per launch,
      semver compare, https-only URL, Persian prompt with «دانلود به‌روزرسانی» / «بعداً».
- [x] Verify again: check-i18n 225 keys / 257 translations, `npm run verify` green, version
      comparison self-tested (1.4.10 > 1.4.9, 1.4 == 1.4.0, "abc" → no prompt).
- [ ] Push main (done by zyvo) + tag v1.4.2 (owner) → CI builds `Tavakkol-release.apk`.
- [ ] Owner on-device check: music plays/mutes and pauses when leaving the app; Delay Mode ON →
      switching Protection off opens the typing screen; wrong text/cancel leaves it ON; correct
      text turns it off; paste does nothing.

## v1.4.3 — Delay Mode gate hardening (2026-11-14)

Bug (owner): v1.4.2 with Delay Mode ON still turned Protection off with one tap —
the long-text modal never appeared. Root cause: the gate trusted JS state
(`config.delayMode`), so any staleness could let the OFF write through. Fix makes
the NATIVE layer the source of truth.

- [x] `FocusGuardModule.kt`: `setEnabled(false)` now REFUSES while `delayMode` is on
      (throws); new `setEnabledAfterDelayChallenge` = the only OFF writer; shared
      private `applyEnabled(ctx, enabled)` helper.
- [x] `modules/focus-guard/index.js`: `disableProtectionAfterChallenge()` bridge.
- [x] `App.js`: `toggleBlocking` is async and reads the LIVE `delayMode` from native
      before opening the modal; `applyEnabled(value, {afterChallenge})` uses the
      bypass after the challenge; a native refusal auto-opens the modal (never a
      silent failure). `confirmDelayOff` → `applyEnabled(false, {afterChallenge:true})`.
- [x] Version 1.4.3 / versionCode 15 (app.json, package.json, package-lock, buildInfo),
      `version.json` latestVersion → 1.4.3, `index.html` labels → ۱.۴.۳.
- [x] Verify: check-i18n 225/257 OK; `npm run verify` green (642 modules; compiled
      gate confirmed = live getConfig read + `setEnabledAfterDelayChallenge`);
      prebuild versionName 1.4.3 / versionCode 15; `android/` + `dist/` wiped.
- [x] Owner push + tag v1.4.3 → CI builds `Tavakkol-release.apk`.
- [ ] Owner on-device check: Delay Mode ON → tapping Protection OFF opens the modal
      every time (even after restart); wrong text/cancel keeps it ON; correct text
      turns it off; the protection switch snaps back on its own if the write is
      refused.
- [x] SHIPPED 2026-11-14: commit `3776d4d` → main + tag `v1.4.3`; CI runs 43519797298
      (main) + 43519801031 (tag) both SUCCESS → Release `Tavakkol-release.apk` 35.3 MB
      live at
      https://github.com/elyasyy23-lgtm/FocusBlocker/releases/download/v1.4.3/Tavakkol-release.apk

## v1.4.5 — custom drawer · Settings lock · symmetric Delay Mode (2026-11-14)

Owner's list:
1. Drawer navigation (hamburger ☰, RTL) — Home / Settings / Help + Share App / Contact
   Developer / Support Us.
2. When Protection is ON: Settings is COMPLETELY inaccessible (gear/drawer shows
   «برای ورود به تنظیمات، ابتدا محافظت را خاموش کنید.»); Home lists are read-only.
   Only turning Protection OFF (Delay text or Partner PIN) grants access.
3. Delay Mode OFF must ALSO cost the typing challenge (turning Protection off costs one too).
4. Remote SMS kill switch bypasses the challenge (partner turns Protection off instantly).

Decisions:
- ABANDONED react-navigation — built the drawer on RN `Animated` + `PanResponder` (ZERO new
  native deps, no native rebuild, full RTL control). Uninstalled @react-navigation/drawer,
  @react-navigation/native, react-native-gesture-handler, -reanimated, -worklets,
  -safe-area-context, -screens (37 packages); `index.js` back to plain registerRootComponent.
- Native layer is the source of truth for BOTH switches (mirrors the v1.4.3 Protection gate).
- SMS bypass preserved: `RemoteSmsReceiver.kt` calls `FocusGuardStore.setEnabled` directly.

Steps:
- [x] Revert nav deps + `index.js`.
- [x] `src/components/Drawer.js` (Animated+PanResponder, slides left EN / right FA, backdrop +
      swipe-to-close, 🔒 Settings row when locked).
- [x] `src/components/DonateSheet.js` (Support Us modal, global drawer action).
- [x] Deleted nav-coupled `src/components/AppDrawerContent.js`.
- [x] `src/screens/HomeScreen.js` — title + 2 switches + keyword/domain lists (read-only when
      Protection ON).
- [x] `src/screens/SettingsScreen.js` — ☰ header + ALL advanced sections moved in (accessibility,
      device admin, keep-alive, debug log, stats, partner PIN, remote control, excluded apps,
      language, music).
- [x] `src/screens/HelpScreen.js` — ☰ header (`onOpenDrawer`).
- [x] `App.js` — state hub + routing (screen main|settings|help), drawer + donate sheet + delay +
      update modals, gate logic (toggleBlocking, applyEnabled, toggleDelayMode, confirmDelay).
- [x] Native: `setEnabled` refuses OFF while delayMode; `setEnabledAfterDelayChallenge`;
      `setDelayMode` refuses OFF while on; `setDelayModeAfterDelayChallenge`; bridge
      `disableDelayModeAfterDelayChallenge`.
- [x] i18n: 9 new keys (Menu/Home/settings-lock/Delay-Mode-off text) + extended
      `scripts/check-i18n.js` to scan HomeScreen/Drawer/DonateSheet (224 strings / 266 entries).
- [x] Version 1.4.5 / versionCode 16 (app.json, package.json, package-lock, buildInfo),
      `version.json` → 1.4.5, `index.html` labels → ۱.۴.۵.
- [x] Verify: check-i18n OK; `npm run verify` green (645 modules; bundle contains
      `disableDelayModeAfterDelayChallenge` + the lock string); prebuild versionName 1.4.5 /
      versionCode 16, app_name Tavakkol (fa توکل); module manifest parses (RECEIVE_SMS +
      receiver + keep-alive services); `android/` + `dist/` wiped.
- [ ] Owner push + tag v1.4.5 → CI builds `Tavakkol-release.apk`.
- [ ] Owner on-device check: drawer opens/slides from the correct side; while Protection ON the
      gear shows the lock message and Home lists are read-only; Delay Mode ON → turning Delay
      Mode OFF needs the typed text (one tap no longer disables it); partner SMS still kills
      Protection instantly.

## Handover commands (owner)

```bash
cd ~/storage/shared/ZYVO/session-20261110-133137/FocusBlocker
git fetch origin && git rebase origin/main
git push origin main
git tag v1.4.5
git push origin v1.4.5
```
