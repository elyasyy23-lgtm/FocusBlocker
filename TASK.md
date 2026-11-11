# TASK — FocusBlocker v1.1.3 (debug log + keep-alive diagnostics)

GOAL: the guard died again ~a day after install and we were blind — add an
in-app debug log so the next death shows its cause, harden keep-alive
(battery-optimization exemption), ship v1.1.3.

- [x] v1.1.2 SHIPPED: commit 3b1b155 + tag v1.1.2; CI build 42864735125 SUCCESS;
      Release live: https://github.com/elyasyy23-lgtm/FocusBlocker/releases/download/v1.1.2/FocusBlocker-release.apk
      → owner reports it stopped working again after ~a day (v1.1.2 was never
      verified on-device; FGS failure would have been silent).
- [x] FocusGuardStore: debug-log ring buffer — last 100 events as JSON in the
      same SharedPreferences, synchronized writes, survives process kills,
      text capped at 160 chars, corrupted JSON self-heals to empty.
- [x] FocusAccessibilityService logs: service_connected/unbound/destroyed/
      interrupted, fgs_started / fgs_failed (startForeground refusal now
      VISIBLE — the prime suspect for the overnight death), keyword_detected
      (pkg + matched text), domain_detected, block_triggered,
      block_recheck_back/home/clear, scan_failed.
- [x] Keep-alive: new isForegroundActive flag + getServiceHealth() bridge
      (accessibility enabled, service bound, FGS active, battery state, SDK);
      requestIgnoreBatteryOptimizations() opens the system "Unrestricted"
      dialog (REQUEST_IGNORE_BATTERY_OPTIMIZATIONS permission in module
      manifest — merges in CI like the FGS permissions). NO wake-lock added:
      a wake-lock keeps the CPU awake but does not stop Android killing the
      process — the failure mode is process death, not sleeping CPU.
- [x] FocusGuardModule: getDebugLogs / clearDebugLogs / getServiceHealth /
      requestIgnoreBatteryOptimizations.
- [x] index.js: getDebugLogs (newest first), clearDebugLogs, getServiceHealth,
      requestIgnoreBatteryOptimizations + EMPTY_HEALTH.
- [x] App.js: "5. Debug Log" section (live health line: service / foreground
      notification / battery state) + Show Logs modal (health banner, battery
      fix button, FlatList of 100 events with time + colored type + pkg + text,
      Refresh / Clear / Close). Health refetches on every app foreground.
- [x] app.json: 1.1.3 / versionCode 5.
- [x] Verify: npm run verify green (614 modules; bundle contains Show Logs /
      getDebugLogs / requestIgnoreBatteryOptimizations), autolinking resolves
      focus-guard, prebuild clean (+ android/ deleted after), module manifest
      XML parses, app.json JSON valid. expo-doctor 19/20 — the 1 failed check
      (config schema) fetched HTML over mobile data = network, not project.
- [ ] User: commit/push + tag v1.1.3 → CI builds APK, Release on the tag.
- [ ] After install: open Debug Log → Show Logs and read what happened —
      fgs_failed = startForeground refused (needs different FGS approach);
      service_unbound overnight = OEM/user toggled accessibility off;
      log simply stops = hard SIGKILL with no restart → battery exemption +
      OEM "unrestricted" setting is the fix to verify.

NOW: code complete + verified locally. Waiting on git push + tag v1.1.3
(Kotlin compiles in CI; Termux cannot compile Kotlin).

Decisions (2026-11-11, owner request "debug log feature"):
- Log lives in SharedPreferences, not a file: same process, tiny volume
  (≤100 entries), and it already survives process death.
- keyword_detected is logged only AFTER the ownWindowActive gate — otherwise
  every keystroke on our own setup screen (which contains the keyword itself)
  would flood the 100-entry buffer.
- Detection (keyword/domain) and block_triggered are separate entries: a
  detection swallowed by the 900 ms cooldown still shows in the log.
- Battery-optimization exemption button instead of a wake-lock (see above).
