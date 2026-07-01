# Android APK Install Smoke Test

TerminAI's Android install smoke workflow proves the APK does more than compile: it installs on an Android runtime and launches the native host activity.

## What it proves

- The project can compile a debug APK.
- The APK can be installed with `adb install`.
- The main activity starts: `com.billybox.terminai/.MainActivity`.
- The app process is present after launch.
- Logcat is captured when the smoke test fails.

This workflow does not prove the full runtime bundle, terminal engine, or native API bridge is production-complete. It is an install-and-launch gate for the current native host scaffold.

## How to run it manually

1. Open the repository on GitHub.
2. Go to **Actions**.
3. Select **Android APK Install Smoke Test**.
4. Click **Run workflow**.
5. Choose the branch to test.
6. Run the workflow.

The workflow builds the debug APK, starts a headless Android emulator, installs the APK, launches `MainActivity`, and checks that the `com.billybox.terminai` process is running.

## Artifacts

The workflow uploads `android-smoke-test-artifacts`.

Expected contents:

- `app-debug.apk` — the debug APK used in the smoke test.
- `logcat.txt` — captured Android logs when the smoke test fails.

## Why it is manual-only for now

Android emulators on hosted CI runners can be slow or flaky. Until the workflow proves reliable over several runs, it should stay manual-only and should not be a required branch protection check.

The required gates remain:

- `TerminAI Web CI`
- `TerminAI Android Native`

## Target identity

- App name: TerminAI
- Package/application ID: `com.billybox.terminai`
- Main activity: `com.billybox.terminai/.MainActivity`

Do not add companion apps for this test. The native host remains one app / one dashboard / one runtime.
