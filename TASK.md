# TASK — Tavakkol v1.3.3 (donation copy, Rubika contact, PIN lockout)

GOAL (owner's list, 2026-11-13 — all applied):
1. **Support Us box** (both donation sheets — inside Iran and outside Iran): exact new Persian
   text «از اینکه با حمایت خود، به ادامه توسعه برنامه توکل کمک می‌کنید سپاسگزاریم. هر کمک شما،
   هر چقدر هم کوچک، باعث دلگرمی ماست.»
2. **Contact Developer** → opens Rubika directly at **@yasmajyd**.
3. **PIN lockout timer on the lock screen**: count wrong PINs, at 3 the whole keypad is dead for
   30 seconds with a live countdown («۳۰ ثانیه دیگر تلاش کنید»), then the counter resets and the
   user may try again.
4. Bump to **v1.3.3** and hand over the exact push/build commands.

Previous: v1.3.2 shipped 2026-11-13 (commit 4dd1a0b, tag v1.3.2) — both CI runs SUCCESS,
Release live: `Tavakkol-release.apk` 31.1 MB
(https://github.com/elyasyy23-lgtm/FocusBlocker/releases/download/v1.3.2/Tavakkol-release.apk).
v1.3.2 also filled `DONATION_WALLET` = TANP1ibS4DsF2C1p1rBGAZ5MrGZyS5sUmU (checksum verified
offline); the ZarinPal link is still intentionally empty.

## Steps

- [x] `src/defaults.js` — `DEVELOPER_RUBIKA_ID = 'yasmajyd'` (the `rubika://` scheme and the
      `https://rubika.ir/...` URL are derived from it, so this is the only place to change).
- [x] `src/screens/SettingsScreen.js` — donate sheet body replaced with the new owner text
      (one shared string, so local + international sheets both show it).
- [x] `src/i18n.js` — new fa entry for the support text (exact owner wording),
      `formatNumber(value, lang)` helper (Persian digits: «۳۰» not «30»), lockout strings
      `Try again in {{seconds}}s…` / `Too many wrong attempts.` translated.
- [x] `src/screens/LockScreen.js` — lockout state machine:
      `MAX_ATTEMPTS = 3`, `LOCKOUT_MS = 30_000`, module-level `guardState {failures,
      lockedUntil}` (survives the gate being unmounted when the app backgrounds — otherwise
      backgrounding would hand out free retries), countdown effect (500 ms tick, clears the
      counter at zero), `PinPad disabled` while locked, `change()` refuses input while locked,
      success resets the counter.
      Counting rule: ONE failure per completed wrong entry (the 700 ms pause or the 8-digit
      cap), never per keystroke — otherwise a 6-digit PIN would burn three attempts while the
      user is still typing.
- [x] Version: app.json 1.3.3 / versionCode 11, package.json 1.3.3, buildInfo 1.3.3 (11).
- [x] Verify: `node scripts/check-i18n.js` = 185 UI strings / 213 translations;
      `npm run verify` green (631 modules, 1.1 MB bundle).
- [ ] Push + build (commands below) → main artifact + tag `v1.3.3` Release, both watched to green.
- [ ] Owner on-device: new support text in both sheets, Contact Developer opening
      rubika.ir/yasmajyd, and 3 wrong PINs → 30 s countdown → tries allowed again.

## Known limits (honest)

- The lockout counter is process memory: force-stopping the app (or a reboot) clears it. Android
  gives a normal app no tamper-proof timer without shared storage; this is a self-control tool,
  not a security product.
- A wrong PIN only counts once the entry is "finished" (700 ms with no typing) — continuous
  typing of a long PIN is verified on every keystroke but does not count as separate attempts.

NOW: code complete + verified locally. Next = push/tag (owner's command block below).

## Git commands (run from the project root)

```bash
cd ~/storage/shared/ZYVO/session-20261110-133137/FocusBlocker
git add -A
git commit -m "v1.3.3: new support text, Rubika contact @yasmajyd, PIN lockout (3 wrong → 30s countdown)"
git push origin main
git tag v1.3.3
git push origin v1.3.3
```
