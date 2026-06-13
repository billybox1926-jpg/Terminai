# Native Android Host

This document explains the TerminAI native Android host scaffold.

## Core Principle

**One app. One dashboard. One runtime.**

TerminAI is NOT a family of companion apps. Everything — terminal, package layer, API bridge, file tools, scripts, AI optimizer — lives inside a single Android application.

## Package Identity

- **App name:** TerminAI
- **Package ID:** `com.billybox.terminai`
- **NOT** `com.termux`
- **NOT** WebTermux
- **NOT** AI Studio

## Project Structure

```
android/
├── settings.gradle
├── build.gradle
├── gradle.properties
├── app/
│   ├── build.gradle
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── java/com/billybox/terminai/
│       │   ├── MainActivity.kt          # Native shell screen
│       │   ├── runtime/
│       │   │   ├── RuntimeManager.kt     # Runtime/workspace root management
│       │   │   └── RuntimeBundleVerifier.kt  # Bundle integrity verification
│       │   └── api/
│       │       ├── TerminaiApiBridge.kt   # Native API bridge adapter
│       │       └── TerminaiApiAudit.kt   # JSONL audit writer
│       └── res/
│           ├── values/strings.xml
│           ├── values/colors.xml
│           ├── values/themes.xml
│           └── layout/activity_main.xml
```

## Current Status

This is the **first native host scaffold**. It is a placeholder that:
- Displays a TerminAI native shell screen
- Shows app name, package name, and runtime mode
- Has buttons for Check Runtime Bundle, Verify Runtime Integrity, API Bridge Status, Open Dashboard
- All capability handlers are simulated placeholders
- Camera, microphone, location are explicitly blocked

## App-Owned Directories

The native app uses app-owned directories (no broad storage permissions):

| Directory | Purpose |
| --- | --- |
| `filesDir/runtime/` | Runtime bundle assets (bin, lib, etc, home) |
| `filesDir/workspace/` | User/project files |
| `filesDir/state/` | Runtime state, audit logs |

## API Bridge Native Adapter

The native adapter (`TerminaiApiBridge.kt`) maps to the same `runtime/api-bridge-contract.json` used by the web prototype.

### Supported Capabilities (Simulated)

| Capability | Actions | Status |
| --- | --- | --- |
| `battery` | `read` | Simulated |
| `clipboard` | `read`, `write` | Simulated |
| `notifications` | `send` | Simulated |
| `storage` | `status` | Available |
| `intent-open-url` | `validate` | Simulated |
| `intent-send` | `validate` | Simulated |
| `vibration` | `pulse` | Real (uses Vibrator) |
| `network-info` | `read` | Simulated |
| `sensors` | `snapshot` | Simulated |
| `boot-startup` | `status` | Simulated |
| `file-picker` | `status` | Unavailable |
| `script-shortcuts` | `list` | Available |

### Blocked Capabilities

These are explicitly blocked until native Android permission flow exists:
- `camera`
- `microphone`
- `location`

## Audit Log

Every API bridge invocation writes a JSONL audit event to `filesDir/state/terminai_api_audit.jsonl`:

```json
{"timestamp":"2026-01-15T10:30:00.000Z","capabilityId":"battery","action":"read","adapter":"android-native","status":"simulated","message":"Battery status (simulated)."}
```

## Future Path

1. **WebView/Dashboard integration** — embed the web prototype or serve it locally
2. **Runtime unpack flow** — APK ships runtime payload, first launch unpacks to `TERMINAI_RUNTIME_ROOT`
3. **Integrity check** — verify bundle against lock file on first launch
4. **Package bootstrap** — only repair missing/changed files
5. **Real Android APIs** — BatteryManager, ClipboardManager, NotificationManager, ConnectivityManager, SensorManager
6. **Permission flow** — camera, microphone, location with runtime permission prompts
7. **Boot receiver** — TerminBootReceiver for startup automation
8. **Script shortcuts** — TerminShortcutManager for home screen shortcuts

## What This Does NOT Do

- Does NOT create separate companion apps
- Does NOT request camera/microphone/location permissions
- Does NOT fake real Android API access
- Does NOT commit large binary runtime payloads
- Does NOT remove the existing web prototype

## Android CI

Android CI is the next step. The current CI (`ci.yml`) only covers the Node.js web prototype.
