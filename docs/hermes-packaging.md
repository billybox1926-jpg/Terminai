# Hermes packaging — #98

## Binary-first with PATH fallback

Wanted shape:

runtime/assets/bin/hermes            ← shell wrapper
runtime/assets/bin/hermes-venv/      ← Python venv with Hermes + deps

## Wrapper behavior

- If `runtime/assets/bin/hermes-venv/bin/python` exists at runtime, use it.
- Otherwise try `python3 -m hermes` / `python -m hermes` from device `PATH`.
- Exit code is preserved; args are passed through unchanged.

## Build steps

1. Build/create ARM64 Hermes package/install set on ARM64 or emulator.
2. Create venv in `runtime/assets/bin/hermes-venv/` and install Hermes + required deps only.
3. Strip caches/tests/dev deps to reduce APK size.
4. Run `chmod +x runtime/assets/bin/hermes`.

## Extraction notes

- `RuntimeManager.ensureRuntimeExtracted()` copies `runtime/assets/*` recursively into `context.filesDir/runtime/`.
- Every leaf asset is chmod’d executable via `copyAssetFile()`.
- Therefore nested `hermes-venv/bin/{python,hermes}` are extracted executable without code changes.

## On-device invocation

Call `hermes --help` directly from `/api/terminal/execute`. The existing allowlist already permits `hermes`; PATH resolution is handled by the shell wrapper, so no server changes are required.

## APK size impact

- Baseline: `_`
- With Hermes artifacts: `_`
- Delta: `_`

## Status

- [x] `"hermes"` in `NativeHttpServer.allowedCommands`
- [x] Wrapper script exists
- [ ] ARM64 Hermes venv packaged
- [ ] Fresh-install extraction verified
- [ ] `hermes --help` confirmed via `/api/terminal/execute`
- [ ] APK size delta recorded
- [ ] #99 smoke-test instructions unblocked
