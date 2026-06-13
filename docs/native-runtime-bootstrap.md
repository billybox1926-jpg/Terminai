# Native Runtime Bootstrap — Locked and Loaded

This document explains how the future native TerminAI Android app should ship locked-and-loaded from first launch.

## Core Principle

**One app. One dashboard. One runtime.**

TerminAI is NOT a family of companion apps. Everything — terminal, package layer, API bridge, file tools, scripts, AI optimizer — lives inside a single Android application with one package ID.

## Package Identity

- **Package ID:** `io.terminai.app`
- **One APK** — no separate API app, no Boot app, no Widget app, no Float app, no Styling app, no Tasker bridge
- All capabilities are internal modules referenced through one TerminAI identity

## Bootstrap Architecture

### Web Prototype (Current)

The web prototype runs on Node.js and can:
- Check host package status via `which` + `--version`
- Detect package manager (apt vs pkg)
- Generate sanitized install commands
- Write `terminai_runtime_state.json` to track runtime state
- Auto-bootstrap if `TERMINAI_AUTO_BOOTSTRAP=true`

### Native Android (Future)

The native app should:

1. **Prebundle or unpack runtime assets on first launch**
   - Package baseline (`runtime/package-baseline.json`) baked into APK assets
   - API baseline (`runtime/api-baseline.json`) baked into APK assets
   - Native binaries for core tools (busybox, coreutils, etc.) unpacked to app-private directory

2. **Provision the runtime silently on first launch**
   - No separate "install Termux:API" step
   - No "please install companion app" dialogs
   - Runtime state tracked in app-private SharedPreferences or JSON file

3. **Expose API capabilities as internal modules**
   - Battery, clipboard, notifications, vibration → `TerminApiBridge` module
   - Storage, file picker → `TerminFileProvider` module
   - Camera, microphone, location → permission-gated internal modules
   - Boot startup → `TerminBootReceiver` (internal, not separate app)
   - Script shortcuts → `TerminShortcutManager` (internal)

4. **Use the manifest as source of truth**
   - Same `package-baseline.json` format, read from APK assets
   - Same `api-baseline.json` format, read from APK assets
   - UI renders capabilities from manifest, not hardcoded lists
   - Adding a new API = adding a JSON entry + native implementation

## Manifest-Driven UI

Both web and native versions render the dashboard from the manifests:

```javascript
// Package baseline drives Package Library UI
const baseline = await fetch("/api/package-manager/baseline");
// Each package entry → one row in the UI
// required badge, category, install button — all from manifest

// API baseline drives Device & Build panel
const apiStatus = await fetch("/api/runtime/api/status");
// Each capability → one status chip
// simulated/available/unavailable — all from manifest
```

## Runtime State

The native app should maintain the same `terminai_runtime_state.json` structure:

```json
{
  "firstRunCompleted": true,
  "lastBootstrapCheck": "2026-01-15T10:30:00Z",
  "lastBootstrapInstall": "2026-01-15T10:35:00Z",
  "detectedPackageManager": "native-bundled",
  "runtimeReady": true,
  "installedCount": 19,
  "missingCount": 0,
  "requiredMissingCount": 0,
  "apiReadyCount": 15,
  "apiSimulatedCount": 0,
  "apiUnavailableCount": 0,
  "bootstrapMode": "native-bundled"
}
```

## Bootstrap Modes

| Mode | Behavior |
| --- | --- |
| `check-only` | Detect packages, show status, never install |
| `prompt-user` | Detect packages, show status, UI offers install buttons |
| `auto-install-enabled` | Detect packages, auto-install missing `installByDefault` packages |
| `native-bundled` | Native app ships with runtime pre-provisioned |

## Security

- Package names strictly sanitized: `^[a-z0-9][a-z0.+-]*$`
- No raw user input interpolated into shell commands
- All install commands logged and visible in terminal output
- Unknown package names refused
- Destructive operations require user confirmation

## Migration Path

1. **Web prototype** → checks/installs host packages, simulates APIs
2. **Native alpha** → bundles core tools, implements storage + script shortcuts
3. **Native beta** → adds battery, clipboard, notifications, vibration
4. **Native 1.0** → full API bridge, all capabilities available or clearly marked simulated

## Runtime Bundle

The runtime bundle manifest (`runtime/runtime-bundle.json`) defines how TerminAI packages its runtime:

```json
{
  "bundleName": "terminai-runtime",
  "bundleVersion": "0.1.0",
  "targetMode": "native-bundled",
  "packageManifest": "runtime/package-baseline.json",
  "apiManifest": "runtime/api-baseline.json",
  "installRootCandidates": [
    "$TERMINAI_RUNTIME_ROOT",
    "./terminai-runtime",
    "~/.terminai/runtime"
  ]
}
```

### Runtime Assets

The `runtime/assets/` directory is a placeholder for future native bundled runtime:

- `bin/` — Runtime binaries (busybox, coreutils, etc.)
- `lib/` — Shared libraries and support files
- `etc/` — Configuration files and defaults
- `home/` — Default home directory template

**Do not commit large binary runtime payloads yet.** These will be populated when the native Android build pipeline is established.

### Runtime Root vs Workspace Root

- `TERMINAI_WORKSPACE_ROOT` = user/project files (terminal workspace, file browser)
- `TERMINAI_RUNTIME_ROOT` = bundled/provisioned runtime files (binaries, libs)

These are separate concerns. The workspace root is where user files live. The runtime root is where the TerminAI runtime environment lives.

### Bootstrap Strategy

The native app should:
1. Check if `TERMINAI_RUNTIME_ROOT` is set and contains runtime assets
2. If yes → use native-bundled mode (add `$TERMINAI_RUNTIME_ROOT/bin` to PATH)
3. If no → fall back to host package manager (pkg on Termux, apt-get on Debian)
4. Never silently install unless `TERMINAI_AUTO_BOOTSTRAP=true`

## What TerminAI Does NOT Do

- Does NOT create separate companion apps
- Does NOT require Termux:API or any external API app
- Does NOT pretend simulated APIs are real native APIs
- Does NOT split the terminal, package layer, or API bridge into separate APKs
- Does NOT hardcode package lists or API capabilities in the frontend
