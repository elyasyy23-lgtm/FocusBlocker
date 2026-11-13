# TASK — Tavakkol v1.3.2 (rebrand + UI fixes + Protection-gated system-page guard)

GOAL (owner's list, 2026-11-13 — all items applied in one release):
1. Persian app name **توکل** (English Tavakkol) + the owner's photo as the app icon.
2. Text that sits on the bright background photo must be black / very dark gray.
3. "Save block list" / "Save domain list" buttons: green after saving, white again as soon as
   the text is edited.
4. Excluded Apps: only the first 3 rows, "نمایش بیشتر" button at the bottom, search bar stays
   on top.
5. Support Us: owner's exact Persian description + two donation buttons (inside Iran =
   ZarinPal, outside Iran = crypto). Share App + Contact Developer move OUT of Support into a
   separate "More" section below it.
6. Lock screen title «برنامه توکل قفل است», no green "باز کردن" button, auto-submit on the
   correct PIN.
7. Kotlin: detect the Settings "Device admin apps" page (com.android.settings) and press
   `GLOBAL_ACTION_BACK` immediately — gated on **Protection ON**, not on the PIN.
8. Build v1.3.2 and hand over the exact commit / push / tag commands.

Previous releases: v1.3.1 (strict lock / Partner PIN) shipped 2026-11-12 (commit fd3a1bf, tag
v1.3.1) — see the git log and AGENTS.md for history. v1.3.0 (Help + Donate) rides along in the
v1.3.2 release; it was built but never pushed.

## Steps

- [x] **Icon + name** — `scripts/make-icon.js` (new) from the owner's photo:
      `assets/icon.png` 1024², `android-icon-foreground.png` (inset + rounded safe zone),
      `android-icon-background.png` (#0B0F14); `android-icon-monochrome.png` deleted;
      `monochromeImage` removed from `app.json`. `locales/fa.json` →
      `values-b+fa/strings.xml` `app_name` = توکل; English `app_name` = Tavakkol.
- [x] **app.json** — 1.3.2 / versionCode 10, `userInterfaceStyle: light`,
      `backgroundColor #EEF3F8`, `locales.fa`.
- [x] **Light page theme** — `src/theme.js` second color set (`pageBackground`, `pageText`,
      `pageMuted`, `pageAccent`, `pageWarning`, `pageError`); applied to every text that sits
      directly on the photo in `App.js`, `SettingsScreen.js`, `HelpScreen.js` +
      `StatusBar barStyle="dark-content"` there. Cards keep the dark translucent look.
- [x] **Save buttons** — `src/components/ui.js` `ActionButton` `saved` prop is three-state
      (undefined / false = pending white / true = saved green); App.js `keywordsSaved` /
      `domainsSaved` derive from the stored list, so white means "unsaved edits".
- [x] **Excluded apps** — first 3 rows + `Show more ({{count}})` / `Show less`
      (`showAllApps`), search shows all matches.
- [x] **Support / More** — exact owner description, two donation buttons, mode-aware donate
      sheet (`donateMode` = 'iran' | 'crypto'), `DONATION_ZARINPAL_URL` (empty until the owner
      pastes it), Share App + Contact Developer moved to the new "More" section.
- [x] **Lock screen** — title «برنامه توکل قفل است», no Unlock button, auto-submit on the
      correct PIN (wrong PIN reported after 700 ms, field cleared; immediate at the 8-digit
      cap), `PinPad showOk={false}`.
- [x] **Kotlin guard** — `guardStrictSettings` now gated on `FocusGuardStore.isEnabled`
      (Protection ON), detects the Settings activity name
      (`rememberSettingsActivity` + `ADMIN_ACTIVITY_TOKENS` deviceadmin/device_admin) for an
      instant Back, keeps the page-text scan as a throttled fallback, presses Back up to
      MAX_ADMIN_BACKS = 3 inside a 6 s window and then goes Home; PIN-aware toast
      (`guardLockedMessage`).
- [x] **i18n** — new fa strings for every new English key; lock title + PIN-section wording
      updated to the v1.3.2 truth. `node scripts/check-i18n.js` = 183 UI strings / 210 entries.
- [x] **Version** — `package.json` 1.3.2, `src/buildInfo.js` 1.3.2 (10).
- [x] **Verify** — `npm run verify` green (631 modules, 1.1 MB android bundle);
      `npm run prebuild:android` OK → versionName 1.3.2 / versionCode 10, `app_name` = Tavakkol
      (values-b+fa: توکل); module manifest (accessibility service + device admin + keep-alive)
      intact.
- [ ] **Push + build** — owner runs the git commands (below): commit → push main (CI artifact)
      → tag `v1.3.2` (CI Release). Watch both runs to green; a green PC/main build with a
      failed tag build is not shipped.
- [ ] **Owner on-device** — icon, dark text on the photo, 3-app list + Show more, both donation
      sheets, auto-submit lock screen, and the Device-admin page kicked while Protection is on.
- [ ] **Owner input** — paste the ZarinPal link (`DONATION_ZARINPAL_URL`) and the crypto wallet
      (`DONATION_WALLET`) into `src/defaults.js`.

## Decisions (this release)

- The device-admin guard follows **Protection ON**, not the PIN (owner decision): the PIN only
  guards opening the app. With Protection off the guard is silent, so the owner can always
  reach the page.
- Donation destinations stay EMPTY placeholders — never invent a payment address.
- Save-button color is derived from the stored list (no extra flag), so it survives restarts.

NOW: code complete + verified locally (bundle green, prebuild green). Next = owner runs the
commit/push/tag block, then the CI Release v1.3.2 APK is the artifact to install.

## Git commands (run from the project root)

```bash
cd ~/storage/shared/ZYVO/session-20261110-133137/FocusBlocker
git add -A
git commit -m "v1.3.2: توکل name + photo icon, light text on photo, green/white save buttons, 3-app list, ZarinPal+Crypto donations, auto-submit lock screen, Protection-gated device-admin guard"
git push origin main
git tag v1.3.2
git push origin v1.3.2
```
