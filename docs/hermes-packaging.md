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

## Hermes venv artifact

- Run: `.github/workflows/build-hermes-venv.yml`
- Artifact: `hermes-arm64-venv`
- Source of truth: CI artifact from `092-phase-2` build, not local rebuilds
- Commit SHA: `a949ed3`
- Verified: `file` reports `ELF ... ARM aarch64`; `pyvenv.cfg` home is under the artifact tree; `python3`/`hermes` are executable git mode

Local verification before commit:

```bash
file runtime/assets/bin/hermes-venv/bin/python3
find runtime/assets/bin/hermes-venv/bin -maxdepth 1 -type l -printf '%p -> %l\n' || true
```

The interpreter is `bin/python3`; `bin/python` is generated for compatibility.

If PATH fallback is invoked, the wrapper falls back to `python3 -m hermes` from device `PATH`; do not treat this as successful offline Hermes smoke.

## Android smoke notes (#99)

- The APK build (with the committed venv) may produce a larger bundle; record actual size delta in this section after each build.
- Use `adb install -r -d` to handle signature/versionCode upgrades during smoke.
- On first run, monitor extraction logs with `adb logcat -v time | grep -iE 'terminai|runtime|workspace|hermes'`
- In-app: call `hermes --help` via `/api/terminal/execute` to confirm bundled runtime mode rather than placeholder.
- If extraction fails, redeploy using verified commit SHA `a949ed3` as the source artifact.

## .gitignore sanity check

Make sure nothing in the venv is being ignored:

```bash
git check-ignore -v runtime/assets/bin/hermes-venv/bin/python3
git check-ignore -v runtime/assets/bin/hermes-venv/bin/hermes
```

If either returns a rule, fix `.gitignore` before committing.

## Important note

No `.so`/`.pyd` native extensions are being assumed. If Hermes dependencies
require compiled artifacts, the CI workflow already builds on ARM64 and is the
safe path; do not build the venv on x86_64 Windows for ARM64 Android.
