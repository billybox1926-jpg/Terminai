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
* optional AI command optimization through OpenRouter or Gemini.

## Locked-and-loaded package direction
The current web workspace can detect and install missing tools. The target native app should go further:

* ship a curated bootstrap package set defined in `/runtime/package-baseline.json` (the source of truth),
* expose package status in the dashboard,
* install/update packages from inside the same UI,
* avoid separate companion apps for API features,
* keep device/API permissions behind one TerminAI identity.

The package baseline is dynamically retrieved from `/runtime/package-baseline.json` and currently includes:
`git curl wget jq tmux sqlite3 python3 nodejs npm gcc build-essential make ripgrep htop nano openssh unzip zip tar`

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

## Environment variables
| Variable | Required | Purpose |
| --- | --- | --- |
| PORT | No | Server port. Defaults to 3000. |
| TERMINAI_WORKSPACE_ROOT | No | Root directory exposed to the terminal/file APIs. Defaults to the repo working directory. |
| TERMINAI_COMMAND_TIMEOUT_MS | No | Command execution timeout. Defaults to 30000. |
| TERMINAI_COMMAND_MAX_BUFFER | No | Max command output buffer. Defaults to 1048576. |
| OPENROUTER_API_KEY | Only for AI optimizer | Enables OpenRouter-backed command optimization. |
| OPENROUTER_MODEL | No | OpenRouter model name. Defaults to google/gemini-2.5-flash. |
| GEMINI_API_KEY | Only for AI optimizer fallback | Enables direct Gemini-backed command optimization. |
| GEMINI_MODEL | No | Gemini model name. Defaults to gemini-2.5-flash. |

## Scripts
* `npm run dev`        # Start the local development server
* `npm run build`      # Build the Vite client and bundled server
* `npm run start`      # Run the production build
* `npm run typecheck`  # Type-check without emitting files
* `npm run clean`      # Remove generated build output

## Project layout
```text
.
├── docs/                # Architecture notes and migration plans
├── src/                 # React UI
│   ├── components/      # Terminal, file browser, monitor, editor, scripts
│   ├── App.tsx          # Main workspace shell
│   └── types.ts         # Shared frontend types
├── server.ts            # Express API + Vite integration
├── index.html           # App shell
├── package.json         # Node scripts and dependencies
└── .env.example         # Local configuration template
```

## Direction
The next serious milestones are:
1. Keep the dashboard identity fully TerminAI end-to-end.
2. Keep CI green for type-checking and production builds.
3. Define an artifact telemetry format for Android/APK workflows.
4. Add a device/build status panel.
5. Turn the package/API layer into first-class TerminAI runtime modules.

## License
No license has been selected yet.
