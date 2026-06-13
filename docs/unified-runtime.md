# Unified TerminAI runtime plan

TerminAI should be a single locked-and-loaded developer workspace, not a family of companion apps.

## Decision

TerminAI absorbs the useful Termux-style roles into one app identity:

| Old split-app concept | TerminAI direction |
| --- | --- |
| Terminal app | Core terminal/dashboard module |
| Termux:API | Internal API bridge module |
| Termux:Boot | Internal startup/automation module |
| Termux:Widget | Dashboard shortcuts and script launcher |
| Termux:Float | Native overlay/detached panel later, not a separate app |
| Termux:Styling | Built-in themes and profile settings |
| Termux:Tasker | Internal intent/automation bridge later, not a separate app |

## Runtime layers

TerminAI should ship as one runtime with these layers:

1. **Graphical shell** — native-feeling terminal sessions, extra keys, prompt history, themes, session switching.
2. **Package bootstrap** — curated base packages installed or bundled from first launch.
3. **Package manager UI** — package status, install missing, update, search, and custom safe install commands.
4. **API bridge** — battery/device/clipboard/notification/storage/intent helpers behind one TerminAI permission model.
5. **Automation layer** — scripts, startup jobs, scheduled checks, and reusable command snippets.
6. **AI optimizer** — OpenRouter-first shell command planning with Gemini fallback.
7. **Telemetry layer** — CPU, RAM, disk, workspace, package status, build artifacts, and device state.

## Locked-and-loaded package baseline

The first baseline package set should cover daily local development:

```text
git curl wget jq tmux sqlite3 python3 nodejs npm gcc build-essential make ripgrep htop nano openssh unzip zip tar
```

Future Android/native builds can move this from an apt-install helper into a bootstrap manifest so the app can verify, repair, and update its own runtime.

## API bridge baseline

The first internal API bridge targets:

```text
battery status
clipboard get/set
notification send/cancel
storage picker/open
intent send/open-url
vibration/haptics
sensor snapshot where available
wifi/network info where available
camera/mic only after explicit permission design
```

## Guardrails

- No separate companion apps unless Android platform restrictions absolutely force it.
- If Android forces a separate package for a capability, the dashboard should still present it as one TerminAI feature and install/verify it automatically.
- Package installs must be sanitized and visible in the terminal output.
- Destructive shell operations must remain user-visible.
- Public network exposure requires auth before it is supported.

## Near-term repo tasks

1. Keep the web prototype stable and branded.
2. Keep CI green.
3. Promote package baseline into a checked-in manifest.
4. Add a dashboard panel for package/runtime readiness.
5. Start the native Android plan with one package ID and one visible app identity.
