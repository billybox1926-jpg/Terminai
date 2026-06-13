# TerminAI GitHub issues worklist

Use this as the backlog to create in GitHub Issues once auth is working. Suggested labels: `ci`, `android`, `web`, `runtime`, `release`, `security`, `docs`, `priority:high`, `priority:medium`.

## 1. CI: make web build workflow the required gate

Labels: `ci`, `web`, `priority:high`

TerminAI needs a required GitHub Actions gate for the Node/Vite/Express side.

Acceptance criteria:
- `TerminAI Web CI` runs on pull requests to `main`.
- Workflow uses Node 22 and `npm ci`.
- Workflow runs `npm run typecheck`.
- Workflow runs `npm run runtime:status`.
- Workflow runs `npm run runtime:bundle`.
- Workflow runs `npm run build`.
- `dist/` is uploaded as `terminai-web-dist`.
- Branch protection can require this workflow before merge.

## 2. CI: make Android native workflow build every APK flavor we care about

Labels: `ci`, `android`, `priority:high`

The Android host should produce downloadable APK artifacts from GitHub Actions.

Acceptance criteria:
- `TerminAI Android Native` runs on pull requests touching `android/**`, `runtime/**`, or its workflow file.
- Workflow installs JDK 17 and Android SDK 34/build-tools 34.0.0.
- Workflow runs `testDebugUnitTest`.
- Workflow runs `lintDebug`.
- Workflow builds `assembleDebug`.
- Workflow builds `assembleRelease`.
- Debug APK is uploaded as `terminai-android-debug-apk`.
- Unsigned release APK is uploaded as `terminai-android-release-unsigned-apk`.
- Android reports are uploaded even on failure.

## 3. Release: add tag-based release artifact workflow

Labels: `ci`, `release`, `priority:medium`

Create a release workflow for tagged versions after the basic CI is green.

Acceptance criteria:
- Workflow runs on tags like `v*` and manual dispatch.
- Builds web/server `dist/` artifact.
- Builds Android debug APK.
- Builds unsigned Android release APK.
- Packages artifacts with versioned names.
- Publishes artifacts to a GitHub Release when triggered by a tag.
- Does not require signing secrets for the first version.

## 4. Android: add signed release build path

Labels: `android`, `release`, `security`, `priority:medium`

Unsigned release APKs are useful for CI, but real distribution needs signing.

Acceptance criteria:
- Document required GitHub secrets: keystore base64, keystore password, key alias, key password.
- Add Gradle signing config that only activates when signing env vars are present.
- CI produces a signed release APK when secrets exist.
- CI still builds unsigned release APK on forks or missing secrets.
- Secrets are never printed in logs.

## 5. Android: verify APK installs on target Android version

Labels: `android`, `priority:medium`

Add confidence that the APK installs cleanly beyond just compiling.

Acceptance criteria:
- Add an emulator or device-smoke-test workflow/job.
- Install debug APK with `adb install`.
- Launch `com.billybox.terminai/.MainActivity`.
- Capture logcat on failure.
- Keep this optional/manual if runtime is too slow for every PR.

## 6. Runtime: enforce manifest and bundle integrity checks

Labels: `runtime`, `ci`, `priority:high`

Runtime manifests are source-of-truth files and should fail CI when malformed.

Acceptance criteria:
- Add a script that validates `runtime/package-baseline.json` required fields.
- Validate `runtime/api-baseline.json` required fields.
- Validate `runtime/runtime-bundle.json` structure.
- `npm run runtime:bundle` fails if asset hashes or manifest paths are inconsistent.
- CI runs these checks before build artifacts are uploaded.

## 7. Web: add lightweight server smoke test after production build

Labels: `web`, `ci`, `priority:medium`

The current build proves compilation; it should also prove the production server boots.

Acceptance criteria:
- Start `npm run start` after `npm run build` in CI.
- Health-check `http://localhost:3000`.
- Health-check key API endpoints such as `/api/runtime/status`.
- Stop the server cleanly.
- Upload server logs on failure.

## 8. Security: add command/file API safety regression tests

Labels: `security`, `web`, `priority:high`

TerminAI executes shell commands and edits files, so guardrails need tests.

Acceptance criteria:
- Add tests or smoke scripts for workspace path confinement.
- Verify path traversal attempts are rejected.
- Verify command timeout and max-buffer env vars are honored.
- Verify dangerous package install requests must map to manifest entries.
- CI runs these checks without real secrets.

## 9. Docs: add CI/build badge and artifact instructions to README

Labels: `docs`, `ci`, `priority:low`

Users should know where the builds are and how to download artifacts.

Acceptance criteria:
- README shows web CI and Android CI badges.
- README explains manual workflow dispatch.
- README explains where to download `terminai-web-dist`.
- README explains where to download debug and unsigned release APK artifacts.
- README states unsigned release APKs are not final distribution builds.

## 10. Repository: fix git root / repo checkout hygiene if needed

Labels: `docs`, `priority:medium`

Local inspection showed `git rev-parse --show-toplevel` resolving to `C:/Users/Billy`, not the TerminAI folder. That makes status/diff noisy and dangerous.

Acceptance criteria:
- Confirm whether `Terminai` should be its own Git repository.
- If yes, initialize or reclone it so `.git` lives at `C:/Users/Billy/Documents/GitHub/Terminai/.git`.
- Ensure `git status` only reports TerminAI files.
- Ensure remote is `https://github.com/billybox1926-jpg/Terminai.git` or the intended SSH equivalent.
- Do not commit unrelated home-directory files.

## 11. GitHub auth: repair local `gh` credentials

Labels: `docs`, `priority:medium`

The local `gh` CLI currently returns `HTTP 401: Bad credentials`, so issues/workflows cannot be managed from the CLI yet.

Acceptance criteria:
- Run `gh auth status` and confirm the bad credential state.
- Re-authenticate with `gh auth login` or refresh the stored token.
- Verify `gh issue list --repo billybox1926-jpg/Terminai` works.
- Verify `gh workflow list --repo billybox1926-jpg/Terminai` works.
- Create the issues from this worklist or import them with a script.

## 12. Tests: add real automated tests beyond typecheck

Labels: `web`, `android`, `ci`, `priority:medium`

`npm run lint` currently aliases typecheck. Add actual behavior-level checks before the app grows.

Acceptance criteria:
- Choose a JS/TS test runner for backend utility/API tests.
- Add tests for runtime manifest parsing.
- Add tests for workspace path resolution.
- Add tests for AI provider selection without real API keys.
- Wire tests into `npm run check` and CI.
