# TerminAI Android Native App

`android/` is the native Android host for TerminAI. It is the future single-app container for the project, but it is not yet equivalent to the web frontend.

## Current status

| Area | Status | Notes |
|---|---|---|
| Dashboard UI | Partial | Compose dashboard scaffold exists; navigation/runtime state exist, but this layer is still evolving |
| Runtime/workspace state | Partial | Runtime manager and workspace concepts are present |
| API bridge | Partial | Bridge adapter exists; capabilities are largely simulated placeholders |
| Native terminal | Not ready | Full native terminal execution is not implemented yet |
| Permissions | Partial | Only app-private storage is used so far; device APIs are simulated |

Do not treat the native surface as production-ready. The backend server remains the source of truth for execution and filesystem behavior.

## Documentation pointers

The shared platform documents describe intended future behavior, not current native completeness:
* `docs/native-runtime-bootstrap.md`
* `docs/android-native-host.md`
* `docs/api-bridge-contract.md`
* `docs/android-signing.md`
* `docs/release-process.md`

## Build

```bash
cd android
./gradlew assembleDebug
```

Install:

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## Troubleshooting

* If the backend is needed, run `npm run dev` from the repo root
* Use `TERMINAI_WORKSPACE_ROOT=./workspace` to keep file access scoped during development
* Default backend bind is `127.0.0.1`, so device-side access requires explicit network exposure and should only happen on trusted networks
