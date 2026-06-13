# TerminAI Runtime Assets

This directory is a placeholder for future native bundled runtime files.

## Purpose

When TerminAI ships as a native Android app, it should unpack its runtime
dependencies into an app-owned directory instead of relying on external
package managers (apt/pkg) after installation.

## Directory Structure

- `bin/` — Runtime binaries (busybox, coreutils, etc.)
- `lib/` — Shared libraries and support files
- `etc/` — Configuration files and defaults
- `home/` — Default home directory template for the runtime environment

## Current Status

The web prototype only simulates/checks host runtime. These directories
are empty placeholders with .gitkeep files.

**Do not commit large binary runtime payloads yet.** These will be
populated when the native Android build pipeline is established.

## Bundle Lock File

When real assets are added, run:

```bash
node scripts/build-runtime-bundle.mjs
```

This generates `runtime/runtime-bundle.lock.json` with SHA-256 checksums
for every file (ignoring .gitkeep). The lock file is gitignored since it
is generated from the actual assets.

See `runtime/runtime-bundle.lock.example.json` for the expected structure.

## Native Android Direction

The native app should:
1. Bundle these assets in the APK (or download on first launch)
2. Unpack into an app-private runtime directory (`$TERMINAI_RUNTIME_ROOT`)
3. Verify integrity using the lock file
4. Point `$TERMINAI_RUNTIME_ROOT/bin` onto PATH for terminal sessions
5. Use the same `runtime/package-baseline.json` as the source of truth
6. Fall back to host package manager only when bundled runtime is unavailable

See `docs/native-runtime-bootstrap.md` for the full plan.
