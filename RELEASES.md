# TerminAI Release Notes

## [0.1.0] - Unreleased

### Android
- Bundled the TerminAI runtime inside the APK.
- On first launch, the app extracts `assets/runtime/*` into app-private storage automatically.
- No manual setup or additional storage permissions are required on Android 13/14.
- `getRuntimeMode()` now returns a bundled runtime mode instead of `placeholder` after extraction.
