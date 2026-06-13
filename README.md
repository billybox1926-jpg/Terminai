# TerminAI

**A terminal that thinks with you.**

TerminAI is an AI-powered local developer workspace that combines a browser-based terminal dashboard, file explorer, code editor, system telemetry, quick scripts, and shell-command assistance.

It is meant to become the control surface for local-first coding, Android build workflows, artifact tracking, and headless agent operations.

## What it does today

TerminAI currently runs as a local Node/Vite app with an Express backend. It provides:

- a multi-session terminal console,
- local command execution through the backend,
- workspace-scoped file browsing, reading, editing, creating, and deleting,
- system telemetry for CPU, memory, disk, OS, uptime, and working directory,
- quick script launchers,
- a package/tool availability panel,
- optional AI command optimization through OpenRouter or Gemini.

## Important safety note

TerminAI can execute local shell commands and edit files in its configured workspace. Treat it like a local developer console, not a public web app.

Do not expose the running server directly to the public internet unless you add authentication, authorization, transport security, and a stricter execution policy.

By default, file operations are scoped to the workspace root. You can set that root explicitly with `TERMINAI_WORKSPACE_ROOT`.

## Local setup

Requirements:

- Node.js 22 or newer
- npm

Install dependencies:

```bash
npm install
```

Copy the example environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` as needed.

Run the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## AI provider setup

TerminAI works without an AI key, but the AI Optimizer needs one provider configured.

Preferred route:

```text
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=google/gemini-2.5-flash
```

Fallback direct Gemini route:

```text
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
```

If both provider keys are present, TerminAI uses OpenRouter first.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | No | Server port. Defaults to `3000`. |
| `TERMINAI_WORKSPACE_ROOT` | No | Root directory exposed to the terminal/file APIs. Defaults to the repo working directory. |
| `TERMINAI_COMMAND_TIMEOUT_MS` | No | Command execution timeout. Defaults to `30000`. |
| `TERMINAI_COMMAND_MAX_BUFFER` | No | Max command output buffer. Defaults to `1048576`. |
| `OPENROUTER_API_KEY` | Only for AI optimizer | Enables OpenRouter-backed command optimization. |
| `OPENROUTER_MODEL` | No | OpenRouter model name. Defaults to `google/gemini-2.5-flash`. |
| `GEMINI_API_KEY` | Only for AI optimizer fallback | Enables direct Gemini-backed command optimization. |
| `GEMINI_MODEL` | No | Gemini model name. Defaults to `gemini-2.5-flash`. |

## Scripts

```bash
npm run dev        # Start the local development server
npm run build      # Build the Vite client and bundled server
npm run start      # Run the production build
npm run typecheck  # Type-check without emitting files
npm run clean      # Remove generated build output
```

## Project layout

```text
.
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

1. keep the dashboard identity fully TerminAI end-to-end,
2. keep CI green for type-checking and production builds,
3. define an artifact telemetry format for Android/APK workflows,
4. add a device/build status panel,
5. split risky local execution behind explicit local-only controls.

## License

No license has been selected yet.
