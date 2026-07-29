# Hermes packaging — #98

## Status

- [x] `"hermes"` in `NativeHttpServer.allowedCommands`
- [x] Wrapper script exists: `runtime/assets/bin/hermes`
- [x] Packaging docs exist
- [x] GitHub Actions workflow added: `.github/workflows/build-hermes-venv.yml`
- [ ] ARM64 venv committed to `runtime/assets/bin/hermes-venv/`
- [ ] Fresh-install extraction verified
- [ ] `hermes --help` confirmed via `/api/terminal/execute`
- [ ] APK/AAB size delta recorded

## Canonical build path: GitHub Actions

This repo does not build the ARM64 Hermes venv locally.

Use `.github/workflows/build-hermes-venv.yml` instead.

### How to trigger

1. Push the wrapper/docs/workflow changes to GitHub.
2. In GitHub UI go to Actions → Build Hermes ARM64 Venv Artifact → Run workflow.
3. Wait for the `build-hermes-venv` job to complete.
4. Download the `hermes-arm64-venv` artifact.

### Where to put the artifact

Copy the downloaded `hermes-arm64-venv` contents into:

```
runtime/assets/bin/hermes-venv/
```

Commit and push that directory with the measured venv size noted in `docs/hermes-packaging.md`.

### Why CI/QEMU

The canonical build runs inside an `arm64v8/python` container on `ubuntu-latest`.
Native ARM64 runners are not guaranteed available for every org/plan, and this
local session is x86_64 Windows MSVC with no ARM64 execution target.

## Wrapper behavior

- If `runtime/assets/bin/hermes-venv/bin/python` exists at runtime, use it.
- Otherwise try `python3 -m hermes` / `python -m hermes` from device `PATH`.
- Exit code is preserved; args are passed through unchanged.

## Extraction notes

- `RuntimeManager.ensureRuntimeExtracted()` copies `runtime/assets/*` recursively into `context.filesDir/runtime/`.
- Every leaf asset is chmod’d executable via `copyAssetFile()`.
- Therefore nested `hermes-venv/bin/{python,hermes}` are extracted executable without code changes.

## On-device invocation

Call `hermes --help` directly from `/api/terminal/execute`. The existing allowlist already permits `hermes`; PATH resolution is handled by the shell wrapper, so no server changes are required.

## APK size impact

- Baseline: _
- With Hermes artifacts: _
- Delta: _

## Important note

No `.so`/`.pyd` native extensions are being assumed. If Hermes dependencies
require compiled artifacts, the CI workflow already builds on ARM64 and is the
safe path; do not build the venv on x86_64 Windows for ARM64 Android.
