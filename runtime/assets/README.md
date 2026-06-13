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

## Native Android Direction

The native app should:
1. Bundle these assets in the APK (or download on first launch)
2. Unpack into an app-private runtime directory (`$TERMINAI_RUNTIME_ROOT`)
3. Point `$TERMINAI_RUNTIME_ROOT/bin` onto PATH for terminal sessions
4. Use the same `runtime/package-baseline.json` as the source of truth
5. Fall back to host package manager only when bundled runtime is unavailable

See `docs/native-runtime-bootstrap.md` for the full plan.
