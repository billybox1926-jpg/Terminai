# API Bridge Contract

TerminAI has **one internal API bridge** — not a family of companion apps like the split Termux ecosystem (Termux, Termux:API, Termux:Boot, Termux:Widget, etc.).

All device/API capabilities are exposed through a single, audited, allowlisted invocation layer.

## Contract File

`runtime/api-bridge-contract.json` defines:
- **bridgeName**: `terminai-api-bridge`
- **defaultAdapter**: `simulated` (current)
- **futureNativeAdapter**: `android-native` (future)
- **invocationMode**: `allowlisted` — only known capability IDs and actions
- **permissionMode**: `explicit` — camera/mic/location blocked until native permission flow
- **auditLogFile**: `terminai_api_audit.jsonl`

## Adapter Modes

| Mode | Description |
| --- | --- |
| `simulated` | Returns safe simulated data (current web prototype) |
| `host` | Uses host OS APIs where available (future) |
| `android-native` | Uses real Android system services (future native app) |

## Invocation Categories

### Read-Only Device Status
Safe queries that don't modify state: `battery`, `network-info`, `sensors`, `storage`, `boot-startup`, `script-shortcuts`

### Clipboard
Read/write clipboard contents. Uses same simulated clipboard state as Device & Build panel.

### Notifications
Send notifications. Simulated until native notification bridge exists.

### Storage
Storage status (workspace root, runtime root). File picker unavailable until native permission flow.

### Intents
URL validation only. Does not actually open URLs until native intent bridge exists.

### Haptics
Vibration pulse. Simulated until native haptics bridge exists.

### Media (Blocked)
Camera and microphone are **blocked** until native Android permission flow exists.

### Location (Blocked)
GPS/location is **blocked** until native Android permission flow exists.

## Blocked Capabilities

These capabilities are explicitly blocked and cannot be invoked:
- `camera`
- `microphone`
- `location`

## Allowlisted Actions

Each capability only allows specific actions:

| Capability | Allowed Actions |
| --- | --- |
| `battery` | `read` |
| `clipboard` | `read`, `write` |
| `notifications` | `send` |
| `storage` | `status` |
| `intent-open-url` | `validate` |
| `intent-send` | `validate` |
| `vibration` | `pulse` |
| `sensors` | `snapshot` |
| `network-info` | `read` |
| `boot-startup` | `status` |
| `file-picker` | `status` |
| `script-shortcuts` | `list` |

## Audit Log

Every invocation of `POST /api/runtime/api/invoke` writes an audit event to `terminai_api_audit.jsonl`:

```json
{
  "timestamp": "2026-01-15T10:30:00.000Z",
  "capabilityId": "battery",
  "action": "read",
  "adapter": "simulated",
  "status": "simulated",
  "message": "Battery status (simulated)."
}
```

## Endpoints

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/runtime/api/bridge/status` | GET | Bridge contract + capability counts |
| `/api/runtime/api/invoke` | POST | Invoke a capability (allowlisted + audited) |

## Security Rules

1. Only capability IDs from `runtime/api-baseline.json` are accepted
2. Only allowlisted actions per capability are accepted
3. Blocked capabilities (camera, mic, location) are rejected
4. Unavailable capabilities are rejected
5. No arbitrary shell commands are executed
6. Every invocation is audited
7. No secrets or large payloads are logged

## Native Android Future Path

1. APK ships with `runtime/api-baseline.json` and `runtime/api-bridge-contract.json`
2. Native app implements `android-native` adapter
3. Camera/mic/location require runtime permission prompts
4. Notification bridge connects to `NotificationManager`
5. Intent bridge connects to `startActivity()`
6. Same audit log format, same endpoints, same contract
