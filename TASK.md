# TASK — Tavakkol v1.4.0 (Remote Deactivation via SMS · Help cleanup · Share App → About)

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

NOW: v1.4.0 shipped + v1.4.1 shipped (download page + Share App → Pages URL).
Docs page live: https://elyasyy23-lgtm.github.io/FocusBlocker/ (index.html, main /).

## Handover commands (owner)

```bash
cd ~/storage/shared/ZYVO/session-20261110-133137/FocusBlocker
git add -A
git commit -m "v1.4.0: remote deactivation via partner SMS, Help support block removed, Share App moved to About"
git push origin main
git tag v1.4.0
git push origin v1.4.0
```
