# Hermes smoke test — on-device verification checklist

Use this on an ARM64 device or ARM64 emulator with a fresh install of the `092-phase-2` build that includes `runtime/assets/bin/hermes-venv/`.

## Prerequisites

- Fresh install of the APK built from `092-phase-2`
- Local HTTP client (`curl`, HTTPie, Postman, etc.)
- The native server bound port from app logs or `/api/runtime/status`

Find the port:

```bash
curl -s http://127.0.0.1:<PORT>/api/runtime/status | jq .
```

## 1. Confirm `hermes --help` via `/api/terminal/execute`

```bash
curl -s -X POST http://127.0.0.1:<PORT>/api/terminal/execute \
  -H 'Content-Type: application/json' \
  -d '{"command":"hermes --help"}'
```

Expected:
- `exitCode` is `0`
- `output` contains recognizable Hermes help text
- `error` is null or empty

Save the full JSON response as evidence for #99.

## 2. Confirm it resolved through the committed venv, not PATH fallback

Run `hermes` via the wrapper directly to expose the interpreter path inside the sandbox cwd:

```bash
curl -s -X POST http://127.0.0.1:<PORT>/api/terminal/execute \
  -H 'Content-Type: application/json' \
  -d '{"command":"/data/data/com.billybox.terminai/files/runtime/bin/hermes -c '"'"'import sys; print(sys.executable)'"'"'"}'
```

**Important:** The exact runtime path may vary by device. Adjust the wrapper path to match `RuntimeManager.runtimeBin` plus `../bin/hermes` if needed. The point is to invoke the wrapper explicitly so its venv-first branch is what executes, not a device PATH hit.

Expected:
- `output` ends with a path under `runtime/.../hermes-venv/bin/python`
- `exitCode` is `0`

If it instead resolves to `/usr/bin/python3` or similar, the venv extraction/assets path is broken.

## 3. Regression: out-of-workspace path

```bash
curl -s -X POST http://127.0.0.1:<PORT>/api/terminal/execute \
  -H 'Content-Type: application/json' \
  -d '{"command":"hermes --cwd /"}'
```

Expected:
- `exitCode` is `126` or `403`
- `error` mentions workspace restriction or sandbox cwd rejection

## 4. Regression: shell metacharacters

```bash
curl -s -X POST http://127.0.0.1:<PORT>/api/terminal/execute \
  -H 'Content-Type: application/json' \
  -d '{"command":"hermes --help; ls"}'
```

Expected:
- `exitCode` is `126` or `400`
- `error` mentions shell metacharacters / control operators blocked

## 5. Regression: disallowed command

```bash
curl -s -X POST http://127.0.0.1:<PORT>/api/terminal/execute \
  -H 'Content-Type: application/json' \
  -d '{"command":"rm -rf /"}'
```

Expected:
- `exitCode` is `400`
- `error` mentions command not allowed

## 6. Record APK size delta

```bash
adb shell pm path com.billybox.terminai
adb shell ls -lh /data/app/com.billybox.terminai-*/base.apk
```

Compare against a baseline build without `hermes-venv/`. Update `docs/hermes-packaging.md` with:
- `Before: <size>`
- `After: <size>`
- `Delta: <size>`

## 7. Capture evidence for #99

Collect:
- Full JSON response from step 1 (`hermes --help`)
- Full JSON response from step 2 (resolved interpreter path)
- APK size numbers from step 6

Post these as evidence in #99 and close both #98 and #99.
