# Android v0.2 runtime proof

TerminAI v0.2 adds an on-device native runtime proof screen. The goal is to prove the installed Android app can do one useful local action without signing or release-flow changes: inspect its runtime/device state, write a local JSON health report, and let the user copy/share that report.

## Scope

- Package remains `com.billybox.terminai`.
- App label remains `TerminAI`.
- Data stays in app-owned internal storage; no broad storage permission is required.
- Signing and release workflow are unchanged.

## Dashboard fields

The native `MainActivity` displays:

- TerminAI app label, version name, and version code.
- Package name.
- Android SDK/API level.
- Device manufacturer and model.
- Runtime root path.
- Workspace root path.
- State root path.
- Current UTC timestamp.
- Runtime mode, bundle readiness, integrity status, API bridge mode, and first-run state.

## Health check action

Tap `Run Health Check` in the Android app. The app creates:

```text
<app files dir>/state/terminai-health-report.json
```

The report includes:

- `packageName`
- `appVersionName`
- `appVersionCode`
- `androidSdk`
- `manufacturer`
- `model`
- `runtimeRootExists`
- `workspaceRootExists`
- `stateRootExists`
- `runtimeBundleStatus`
- `apiBridgeStatus`
- `generatedAt`

The UI shows the latest report text immediately after the health check completes.

## Copy/share actions

After a health check:

- `Copy Report` writes the JSON report text to the Android clipboard with `ClipboardManager`.
- `Share Report` opens the Android share sheet with an `ACTION_SEND` `text/plain` intent.

If no report exists yet, both actions prompt the user to run the health check first.

## Verification checklist

Local Gradle gates for this change:

```sh
cd android
./gradlew testDebugUnitTest --no-daemon --stacktrace
./gradlew lintDebug --no-daemon --stacktrace
./gradlew assembleDebug --no-daemon --stacktrace
```

Device acceptance:

1. Install and launch the debug APK.
2. Confirm the dashboard displays the real package/device/path fields.
3. Tap `Run Health Check`.
4. Confirm JSON report output appears in the UI.
5. Confirm `terminai-health-report.json` is written under app-owned state.
6. Tap `Copy Report` and paste elsewhere to verify clipboard contents.
7. Tap `Share Report` and confirm the Android share sheet opens.
