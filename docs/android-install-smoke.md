# Android APK Install Smoke Test

TerminAI's Android install smoke test proves the APK does more than compile: it installs on an Android runtime and launches the native host activity.

## What it proves

- The project can compile a debug APK.
- The APK can be installed with `adb install`.
- The main activity starts: `com.billybox.terminai/.MainActivity`.
- The app process is present after launch.
- Logcat is captured when the smoke test fails.

This workflow does not prove the full runtime bundle, terminal engine, or native API bridge is production-complete. It is an install-and-launch gate for the current native host scaffold.

## How to run it manually (recommended: real device)

The most reliable way to verify the APK is on a **real Android device** connected via USB debugging. The hosted GitHub emulator may fail to boot on runners without KVM — this is an infrastructure limitation, not a TerminAI issue.

The workflow builds the debug APK, starts a headless Android emulator (API 30, Nexus 6 profile), installs the APK, launches `MainActivity`, and checks that the `com.billybox.terminai` process is running.

## Emulator configuration

The smoke test uses a **lightweight API 30 emulator** for CI stability:

- **API level:** 30 (Android 11) — lighter than API 34, faster boot on hosted runners
- **Profile:** Nexus 6 — smaller screen footprint than Pixel 6
- **Animations:** disabled
- **Boot timeout:** 600 seconds

The app's **compileSdk and targetSdk remain 34** — only the emulator runtime is API 30. This validates that the APK built with SDK 34 can install and launch on a lower API level runtime.

From the repository root on a Windows machine with ADB and a connected device:

```powershell
.\scripts\android-install-smoke.ps1
```

### Bash (Linux / macOS)

```bash
./scripts/android-install-smoke.sh
```

Both scripts will:
1. Build the debug APK if not already present.
2. Check that a connected Android device is visible to `adb`.
3. Install the APK with `adb install -r`.
4. Launch `com.billybox.terminai/.MainActivity`.
5. Wait 5 seconds, then verify the process is running via `adb shell pidof com.billybox.terminai`.
6. On failure, write logcat to `android-install-smoke-logcat.txt`.

### Expected success output

```
Checking ADB devices...
Installing APK...
Launching MainActivity...
Checking process...

SUCCESS: TerminAI installed, launched, and running (PID: 12345)
```

## GitHub-hosted emulator (optional, may be flaky)

The workflow at `.github/workflows/android-install-smoke.yml` is `workflow_dispatch` only and defaults to building/uploading the APK **without** the emulator.

The `run_emulator` input can be set to `true` to attempt an in-workflow emulator install, but this often fails on GitHub-hosted runners due to the lack of KVM hardware acceleration. This is why real-device verification is the recommended path.

When `run_emulator=false` (default), the workflow:
1. Sets up JDK 17 and Android SDK.
2. Builds the debug APK.
3. Uploads `app-debug.apk` as a workflow artifact.
4. Prints local ADB verification instructions.

## Artifacts

The workflow always uploads `terminai-android-debug-apk`.

Expected contents:

- `app-debug.apk` — the debug APK that was built.

If `run_emulator=true` and the emulator step fails, `logcat.txt` is also uploaded.

## Target identity

- App name: TerminAI
- Package/application ID: `com.billybox.terminai`
- Main activity: `com.billybox.terminai/.MainActivity`

Do not add companion apps for this test. The native host remains one app / one dashboard / one runtime.
