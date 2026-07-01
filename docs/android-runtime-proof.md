# Android Runtime Proof

This document describes how to turn the current Android scaffold in `android/`
into a verifiable runtime package and how to prove that package from CI.

## Current state

The Android host is an early scaffold with a simulated API bridge. The web
prototype at the repo root still drives feature development.

## Goal

Move from scaffold to locked-and-loaded by treating the Android app as a
runtime container for one versioned bundle instead of separate companion apps.

## One-app package rule

The native app should:
- bundle or provision the runtime defined by `runtime/`
- expose the same terminal/file/package dashboard UI as the web app
- keep API capabilities under one TerminAI identity
- avoid shipping separate Termux:API-style companion apps

## Branching strategy

- `android-native` for app scaffold and runtime integration PRs
- `feat/android-*` for device-specific features
- `fix/manual-smoke-*` for install/boot smoke fixes

Merge only after `TerminAI Web CI` and `TerminAI Android Native` are green.

## Proof artifacts

Each native release should produce explicit verification artifacts:
- `terminai-android-debug-<version>.apk`
- `terminai-android-release-unsigned-<version>.apk`
- `terminai-android-release-signed-<version>.apk` when signing secrets are configured
- `android-test-report` with Gradle unit-test output
- `android-lint-report` with lint results
- `runtime-bundle-lock` with `runtime/runtime-bundle.lock.json`

## Verification commands

```bash
adb install -r terminai-android-debug-<version>.apk
adb shell monkey -p com.billybox.terminai -c android.intent.category.LAUNCHER 1
adb logcat -s TerminAI
```

For release-shape verification without signing, use `apksigner verify --verbose`
or `aapt2 dump badging`.

## Next steps

1. Replace simulated API bridge with real `runtime/api-bridge-contract.json`
   capability calls surfaced through the app.
2. Embed `runtime/runtime-bundle.lock.json` in APK assets and verify at startup.
3. Add a Gradle task to publish an AAB alongside the APK when release secrets are available.
4. Add an emulator install smoke workflow that installs, launches, and checks
   `/api/runtime/status` from the app itself.
