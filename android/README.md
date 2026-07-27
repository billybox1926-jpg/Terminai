# TerminAI Android Native App

`android/` is the native Android host for TerminAI. It is the future single-app container for the project, but it is not yet equivalent to the web frontend.

## ADB install / launch

```bash
cd android
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.billybox.terminai/.MainActivity
adb logcat -s Terminai:D
```

## First-run / non-ADB install

1. Copy `app-debug.apk` to the device.
2. Allow installs from unknown sources for the file manager/browser.
3. Tap the APK to install.
4. On first launch, follow the on-screen storage/workspace flow.
5. If you skip workspace selection, you can return to it later from Settings.

## Troubleshooting

* If the backend is needed, run `npm run dev` from the repo root
* Use `TERMINAI_WORKSPACE_ROOT=./workspace` to keep file access scoped during development
* Default backend bind is `127.0.0.1`, so device-side access requires explicit network exposure and should only happen on trusted networks
* If storage access fails, re-open **Server Configuration** or the workspace picker rather than broad storage permissions; this app uses app-specific storage plus optional SAF directory access
