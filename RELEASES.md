# TerminAI Release Notes

## [0.1.0] - Unreleased

### Android
- Bundled the TerminAI runtime inside the APK as `assets/runtime/*`.
- On first launch, `RuntimeManager.ensureRuntimeExtracted()` copies bundled assets into app-private `filesDir/runtime/`.
- `OnboardingActivity` now persists the chosen SAF workspace URI via `setPersistedWorkspaceUri()` / `getPersistedWorkspaceUri()`, and `markFirstRunComplete()` gates first-run behavior.
- `MainActivity` shows the persisted SAF workspace URI in the status panel when present.
- `RuntimeBundleManifest`, `readApiBaseline()`, and `readPackageBaseline()` expose bundled metadata in-process.
- Requires Android Studio Hedgehog or newer, SDK 34, and JDK 17.
- No broad storage permissions required on Android 13/14.
- Tracked: #89, #90, #91.
