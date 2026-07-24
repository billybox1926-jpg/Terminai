# Development setup

These steps are for contributors. If you only want to run TerminAI locally, start from `README.md`.

## Prerequisites

* Node.js 22+
* npm
* git
* Android SDK / JDK 17 only if building the native app
* Terminal package manager only on Linux hosts if you intend to actually use the package bootstrap features

## Clone

```bash
git clone https://github.com/billybox1926-jpg/Terminai.git
cd Terminai
```

## Install dependencies

```bash
npm install
```

## Web backend and frontend

```bash
npm run dev
```

Then open `http://localhost:3000`.

## Run validation

```bash
npm run check
```

## Platform notes

### Linux

Recommended environment because this project’s runtime/bootstrap layer is designed around `apt` and Linux shell semantics.

If `node` or `npm` are missing, use your distro’s nodejs package on Debian/Ubuntu or a NodeSource/FNM setup on others.

### macOS

Homebrew is the simplest path:

```bash
brew install node git
```

The web server and frontend run fine on macOS. The runtime/bootstrap endpoints are Linux-oriented, so some package install/status behavior will not match Linux exactly.

Treat bootstrap as platform-aware: `brew` is the equivalent for most developer tools, and `xcode-select --install` covers the command-line toolchain. System-level packages like `systemd` do not exist on macOS.

### Windows

Use WSL/Git Bash for the terminal/package-bootstrap paths:

```bash
winget install OpenJS.NodeJS Git.Git
```

Then run the same Node-based commands from a bash shell.

If you stay in pure Windows CMD/PowerShell, expect shell-command and path assumptions from the runtime layer to behave differently. Package bootstrap uses Linux equivalent mapping in the runtime manifest; Windows is supported for contributor workflows, not native terminal bootstrap.

## Android native app

The native app lives in `android/` and targets a local Android host environment.

Requirements:

* JDK 17+
* Android SDK where `adb` and build tools are available
* Enough disk for Gradle and build cache

Build:

```bash
cd android
./gradlew assembleDebug
```

Install via ADB:

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

For signing, keystore setup, and release artifact notes, see `docs/android-signing.md` and `docs/release-process.md`.

## Environment variables

See `README.md` for the full list. The important local override for contributor safety is:

```bash
TERMINAI_WORKSPACE_ROOT=./workspace
```

Do not point `TERMINAI_WORKSPACE_ROOT` at directories with secrets outside your project. The server defaults to `127.0.0.1`; only set network bind exposure intentionally when you need it.

## Contribution workflow

1. Pick or create an issue
1. Create a focused branch from `main`
1. Make the smallest change that satisfies the requirement
1. Run `npm run check`
1. Open a PR with affected areas and verification notes
