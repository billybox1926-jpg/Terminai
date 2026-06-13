# Unified Runtime Architecture

TerminAI is one app, one dashboard, one runtime. It is not a family of companion apps like the split Termux ecosystem (Termux, Termux:API, Termux:Boot, Termux:Widget, Termux:Float, Termux:Styling, Termux:Tasker). All capabilities live inside a single TerminAI surface.

## Product Rule

| Old split-app concept | TerminAI direction |
| --- | --- |
| Terminal app | Core terminal/dashboard module |
| Termux:API | Internal API bridge module |
| Termux:Boot | Internal startup/automation module |
| Termux:Widget | Dashboard shortcuts and script launcher |
| Termux:Float | Native overlay/detached panel later, not a separate app |
| Termux:Styling | Built-in themes and profile settings |
| Termux:Tasker | Internal intent/automation bridge later, not a separate app |

## Package Baseline Manifest

The core set of required terminal utilities is formally declared in:
`runtime/package-baseline.json`

This manifest acts as the **single source of truth** for both the backend checks and the frontend monitor UI.

### Manifest Configuration Schema

- `id` (string): Unique identifier for the baseline utility (e.g., `"ripgrep"`).
- `displayName` (string): Presentable GUI title (e.g., `"Ripgrep"`).
- `aptPackages` (string): Debian/APT package names (e.g., `"ripgrep"` or `"openssh-client openssh-server"`).
- `termuxPackages` (string): Termux/pkg package names (e.g., `"python"` instead of `"python3"`).
- `queryCommand` (string): The command binary to look up on the carrier system (e.g., `"rg"` or `"ssh"`).
- `category` (string): Decorative classification (e.g., `"Utility"`, `"Network"`, `"Runtime"`).
- `description` (string): Human-readable explanation of utility capabilities.
- `required` (boolean): Whether this package is required for runtime readiness.
- `installByDefault` (boolean): Whether to include in default bootstrap install.

### Benefits of the Unified Manifest Design

1. **No Frontend Hardcoding:** The dashboard queries `/api/package-manager/list` which reads directly from `runtime/package-baseline.json`. Client apps automatically adapt if new packages are registered.
2. **Deterministic Commands:** Auto-install commands are assembled directly from `aptPackages`/`termuxPackages` properties instead of arbitrary mapping files.
3. **Execution Safety/Sanitization:** Package names are strictly sanitized (`^[a-z0-9][a-z0.+-]*$`), ensuring container protection. No raw user input is interpolated into shell commands.
4. **Readiness Summary:** The `/api/runtime/bootstrap/status` route returns a full readiness object (`total`, `installed`, `missing`, `requiredMissing`, `runtimeReady`, `packageManager`).
5. **Dedicated Bootstrap Endpoints:** `/api/runtime/bootstrap/status`, `/api/runtime/bootstrap/install`, and `/api/runtime/bootstrap/repair` provide the full bootstrap lifecycle.
6. **Package Manager Detection:** The backend auto-detects `apt` vs `pkg` (Termux) and builds the correct install command.

## API Bridge Baseline

API capabilities TerminAI exposes as internal modules are declared in:
`runtime/api-baseline.json`

This is the source of truth for the API bridge layer. All capabilities live inside one TerminAI app — not as separate companion apps.

### API Capability Schema

- `id` (string): Unique identifier (e.g., `"battery"`).
- `displayName` (string): Presentable GUI title.
- `category` (string): Classification (e.g., `"Device"`, `"Intent"`, `"Media"`).
- `description` (string): Human-readable explanation.
- `permission` (string): Android permission required.
- `status` (string): `"simulated"` | `"available"` | `"unavailable"`.
- `nativeRequired` (boolean): Whether real Android runtime is needed.

### Current Status

The web prototype marks most hardware APIs as `simulated` or `unavailable`. Only file system access and script shortcuts are `available` in the web environment. The native Android runtime will promote simulated APIs to `available` as real implementations are connected.

## Runtime Bootstrap API

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/runtime/status` | GET | Unified readiness (packages + API + device + state) |
| `/api/runtime/bootstrap/status` | GET | Package readiness from manifest |
| `/api/runtime/bootstrap/install` | POST | Install missing baseline packages |
| `/api/runtime/bootstrap/repair` | POST | Repair all missing packages |
| `/api/runtime/api/status` | GET | API bridge capability status |
| `/api/runtime/first-run/complete` | POST | Mark first-run provisioning complete |

## First-Run Provisioning

When TerminAI starts, it runs a non-blocking startup check:

1. Reads `runtime/package-baseline.json`
2. Detects package manager (apt vs pkg)
3. Checks each package via `which` + `--version`
4. Writes `terminai_runtime_state.json` with current status
5. If `TERMINAI_AUTO_BOOTSTRAP=true`, installs missing `installByDefault` packages
6. After install, re-checks status and updates state

The runtime state file (`terminai_runtime_state.json`) tracks:
- `firstRunCompleted` — whether the user has completed first-run provisioning
- `lastBootstrapCheck` — timestamp of last package check
- `lastBootstrapInstall` — timestamp of last install attempt
- `detectedPackageManager` — apt, pkg, or unknown
- `runtimeReady` — whether all required packages are installed
- `installedCount` / `missingCount` / `requiredMissingCount`
- `apiReadyCount` / `apiSimulatedCount` / `apiUnavailableCount`
- `bootstrapMode` — check-only, prompt-user, auto-install-enabled, or native-bundled

### Bootstrap Modes

| Mode | Behavior |
| --- | --- |
| `check-only` | Detect packages, show status, never install |
| `prompt-user` | Detect packages, show status, UI offers install buttons |
| `auto-install-enabled` | Detect packages, auto-install missing `installByDefault` packages on startup |
| `native-bundled` | Native app ships with runtime pre-provisioned |

### Environment Variables

- `TERMINAI_AUTO_BOOTSTRAP=false` — Set to `true` to enable automatic package installation on startup. Default is `false` (safe mode: check only, prompt user).

## Runtime Bundle Manifest

The runtime bundle (`runtime/runtime-bundle.json`) defines how TerminAI packages its runtime:

| Field | Purpose |
| --- | --- |
| `bundleName` | Identifier for the runtime bundle |
| `bundleVersion` | Semantic version of the bundle |
| `targetMode` | `native-bundled` — the goal is to ship runtime inside the app |
| `packageManifest` | Path to `runtime/package-baseline.json` |
| `apiManifest` | Path to `runtime/api-baseline.json` |
| `installRootCandidates` | Ordered list of paths where runtime may be rooted |
| `bootstrapStrategy` | Rules for how to provision packages |

### Runtime Root vs Workspace Root

- `TERMINAI_WORKSPACE_ROOT` = user/project files (terminal workspace, file browser)
- `TERMINAI_RUNTIME_ROOT` = bundled/provisioned runtime files (binaries, libs, etc.)

These are separate. The workspace root is where user files live. The runtime root is where the TerminAI runtime environment lives.

### Bundle Status Endpoint

`GET /api/runtime/bundle/status` returns:
- Bundle manifest data
- Whether runtime assets directories exist
- Detected `TERMINAI_RUNTIME_ROOT` if set
- `bundleReady` boolean
- Notes explaining current mode

### Runtime Modes

| Mode | Condition |
| --- | --- |
| `host-bootstrap` | No bundled runtime detected, using host package manager |
| `mixed` | Runtime root set but assets incomplete |
| `native-bundled` | Runtime root set with bin/lib assets present |

## Guardrails

- No separate companion apps unless Android platform restrictions absolutely force it.
- Package installs must be sanitized and visible in the terminal output.
- Device/build simulation must be labeled as simulation until backed by a real native build worker.
- Destructive shell operations must remain user-visible.
- Public network exposure requires auth before it is supported.

## Native Android Direction

See [`docs/native-runtime-bootstrap.md`](./native-runtime-bootstrap.md) for the full plan to ship TerminAI as a locked-and-loaded native Android app with:
- One package ID, one app identity
- Internal API bridge module (not separate Termux:API app)
- Bootstrap packages provisioned on first launch
- Package and API manifests as source of truth
- Native layer prebundling or unpacking runtime assets
