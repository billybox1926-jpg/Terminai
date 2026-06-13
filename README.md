# TerminAI
A terminal that thinks with you.

TerminAI is a single integrated terminal workspace: graphical shell, package layer, API bridge, file tools, telemetry, scripts, and AI command optimization in one app surface.

The goal is not to recreate the split Termux ecosystem where the main app, API app, Boot app, Widget app, Float app, Styling app, and Tasker bridge all live separately. TerminAI should feel locked and loaded from first launch.

## Product rule
One app. One dashboard. One runtime.

TerminAI should bundle or provision the pieces a developer normally has to stitch together manually:

* terminal sessions
* local shell execution
* API/device bridge layer
* package bootstrap layer
* package status and install UI
* file browser and editor
* quick scripts and automations
* system telemetry
* AI command optimizer through OpenRouter or Gemini.

## What it does today
TerminAI currently runs as a local Node/Vite app with an Express backend. It provides:

* a multi-session terminal console,
* local command execution through the backend,
* workspace-scoped file browsing, reading, editing, creating, and deleting,
* system telemetry for CPU, memory, disk, OS, uptime, and working directory,
* quick script launchers,
* a package/tool availability panel,
* install helpers for missing packages on apt-based hosts,
* device/build status and artifact telemetry controls,
* optional AI command optimization through OpenRouter or Gemini.
## Locked-and-loaded package direction

The current web workspace can detect and install missing tools. The target native app should go further:

* ship a curated bootstrap package set defined in `runtime/package-baseline.json` (the source of truth),
* expose package status and a runtime readiness summary (total/installed/missing/ready) in the dashboard,
* install/update packages from inside the same UI via sanitized manifest-driven commands,
* avoid separate companion apps for API features,
* keep device/API permissions behind one TerminAI identity.

The package baseline is defined in `runtime/package-baseline.json` and currently includes:
`git curl wget jq tmux sqlite3 python3 nodejs npm gcc build-essential make ripgrep htop nano openssh unzip zip tar`

Each entry includes `id`, `displayName`, `aptPackages`, `queryCommand`, `category`, `description`, and `required`.

The `/api/package-manager/list` route reads the manifest, queries each tool, and returns a `readiness` summary.
The `/api/package-manager/baseline` route exposes the raw manifest.
The `/api/package-manager/install` route builds sanitized install commands from the manifest.

## API direction
TerminAI should absorb the useful parts of Termux:API as an internal module, not as a separate app. The dashboard should eventually expose device/API capabilities through a unified panel, including battery/device info, clipboard helpers, notifications, sensors where available, storage/file pickers, and Android intent helpers.

## Important safety note
TerminAI can execute local shell commands and edit files in its configured workspace. Treat it like a local developer console, not a public web app.

Do not expose the running server directly to the public internet unless you add authentication, authorization, transport security, and a stricter execution policy.

By default, file operations should stay scoped to the workspace root. You can set that root explicitly with `TERMINAI_WORKSPACE_ROOT`.

## Local setup
Requirements:
* Node.js 22 or newer
* npm

Install dependencies:
```bash
npm install
```

Copy the example environment file:
```bash
cp .env.example .env.local
```

Run the development server:
```bash
npm run dev
```

Open:
`http://localhost:3000`

## AI provider setup
TerminAI works without an AI key, but the AI Optimizer needs one provider configured.

Preferred route:
```env
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=google/gemini-2.5-flash
```

Fallback direct Gemini route:
```env
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
```

If both provider keys are present, TerminAI uses OpenRouter first.
## API Bridge

TerminAI has one internal API bridge — not separate companion apps. The bridge reads `runtime/api-baseline.json` and `runtime/api-bridge-contract.json` to expose safe, audited capability invocation.

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/runtime/api/bridge/status` | GET | Bridge contract + capability counts |
| `/api/runtime/api/invoke` | POST | Invoke a capability (allowlisted + audited) |

See `docs/api-bridge-contract.md` for the full contract.

The runtime bundle manifest (`runtime/runtime-bundle.json`) defines how TerminAI packages its runtime for native deployment. The lock file (`runtime/runtime-bundle.lock.json`) provides SHA-256 integrity verification.

```text
runtime/
├── runtime-bundle.json           # Bundle manifest (source of truth)
├── runtime-bundle.lock.example.json  # Example lock structure
├── package-baseline.json         # Package manifest
├── api-baseline.json             # API bridge manifest
├── runtime-state.example.json    # Example runtime state
└── assets/                       # Placeholder for native bundled runtime
    ├── README.md
    ├── bin/
    ├── lib/
    ├── etc/
    └── home/
```

### Bundle Commands

```bash
npm run runtime:bundle    # Build lock file from assets
npm run runtime:status    # Print runtime config summary
```

See `docs/native-runtime-bootstrap.md` for the full native Android locked-and-loaded plan.

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/runtime/status` | GET | Unified readiness (packages + API + device + state) |
| `/api/runtime/bootstrap/status` | GET | Package readiness from manifest |
| `/api/runtime/bootstrap/install` | POST | Install missing baseline packages |
| `/api/runtime/bootstrap/repair` | POST | Repair all missing packages |
| `/api/runtime/api/status` | GET | API bridge capability status |
| `/api/runtime/first-run/complete` | POST | Mark first-run provisioning complete |

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | No | Server port. Defaults to `3000`. |
| `TERMINAI_WORKSPACE_ROOT` | No | Root directory exposed to the terminal/file APIs. Defaults to the repo working directory. |
| `TERMINAI_COMMAND_TIMEOUT_MS` | No | Command execution timeout. Defaults to `30000`. |
| `TERMINAI_COMMAND_MAX_BUFFER` | No | Max command output buffer. Defaults to `1048576`. |
| `TERMINAI_RUNTIME_ROOT` | No | Root directory for bundled/provisioned runtime files. Separate from `TERMINAI_WORKSPACE_ROOT`. |
| `TERMINAI_AUTO_BOOTSTRAP` | No | Auto-install missing baseline packages on startup. Defaults to `false`. |
| `OPENROUTER_API_KEY` | Only for AI optimizer | Enables OpenRouter-backed command optimization. |
| `OPENROUTER_MODEL` | No | OpenRouter model name. Defaults to `google/gemini-2.5-flash`. |
| `GEMINI_API_KEY` | Only for AI optimizer fallback | Enables direct Gemini-backed command optimization. |
| `GEMINI_MODEL` | No | Gemini model name. Defaults to `gemini-2.5-flash`. |

## Scripts
* `npm run dev`        # Start the local development server
* `npm run build`      # Build the Vite client and bundled server
* `npm run start`      # Run the production build
* `npm run typecheck`  # Type-check without emitting files
* `npm run check`      # Type-check and build
* `npm run clean`      # Remove generated build output
* `node scripts/runtime-status.mjs` # Print runtime config summary (no server)

## Project layout
```text
.
├── docs/                           # Architecture notes and migration plans
│   ├── unified-runtime.md          # Runtime architecture and bootstrap API
│   └── native-runtime-bootstrap.md # Native Android locked-and-loaded direction
├── runtime/                        # Runtime manifests and state
│   ├── package-baseline.json       # Source of truth for the locked-and-loaded package layer
│   ├── api-baseline.json           # Source of truth for the API bridge layer
│   └── runtime-state.example.json  # Example runtime state file
├── src/                            # React UI
│   ├── components/                 # Terminal, file browser, monitor, editor, scripts
│   ├── App.tsx                     # Main workspace shell
│   └── types.ts                    # Shared frontend types
├── server.ts                       # Express API + Vite integration
├── index.html                      # App shell
├── package.json                    # Node scripts and dependencies
└── .env.example                    # Local configuration template
```

## Direction
The next serious milestones are:
1. Keep the dashboard identity fully TerminAI end-to-end.
2. Keep CI green for type-checking and production builds.
3. Build native Android runtime (see `docs/native-runtime-bootstrap.md`).
4. Connect the Device & Build panel to real Android/APK status.
5. Implement remaining API bridge modules (battery, clipboard, notifications).

## License
No license has been selected yet.
