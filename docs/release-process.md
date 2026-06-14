# TerminAI release process

TerminAI uses GitHub Actions as the official build and release gate.

Local machines are useful for fast development checks, but they should not be trusted as the only build source. Official artifacts should come from GitHub-hosted workflow runs so every build has a commit SHA, workflow log, and downloadable artifact trail.

## Required gates

### Web gate: TerminAI Web CI

`TerminAI Web CI` is the required gate for the Node/Vite/Express side of TerminAI.

It verifies:

- Node 22 dependency installation with `npm ci`
- TypeScript type-checking
- runtime manifest validation with `npm run runtime:validate`
- real automated tests with `npm test`
- runtime manifest status output
- production web/client and bundled server build
- runtime bundle lock generation
- production server smoke test, including `/api/runtime/status`
- command/file API safety smoke tests with `npm run security:smoke`
- `terminai-web-dist` artifact upload

The web gate protects the local terminal workspace, PackageLibrary, Device & Build UI surface, runtime manifests, API bridge routes, and production server bundle.

### Android gate: TerminAI Android Native

`TerminAI Android Native` is the APK build gate for `com.billybox.terminai`.

It verifies:

- JDK 17 and Android SDK/build-tools setup
- Gradle unit tests
- Android lint
- debug APK build
- unsigned release APK build
- APK and report artifact upload

The Android gate preserves the one app / one dashboard / one runtime direction. It does not create separate companion apps.

## Release workflow

`TerminAI Release` lives at `.github/workflows/release.yml`.

It runs on:

- manual dispatch from the GitHub Actions UI
- pushed tags matching `v*`

The release workflow performs the same build-gate checks needed for a releasable artifact set:

1. Install web dependencies with `npm ci`.
2. Run TypeScript type-checking.
3. Validate runtime manifests with `npm run runtime:validate`.
4. Run real automated tests with `npm test`.
5. Print runtime manifest status.
6. Build the production web/client and server dist.
7. Run `npm run runtime:bundle`.
8. Smoke-test the production server and `/api/runtime/status`.
9. Run command/file API safety smoke tests.
10. Run Android unit tests.
11. Run Android lint.
12. Build the Android debug APK.
13. Build the Android unsigned release APK.
14. Package versioned artifacts.
15. Upload workflow artifacts.
16. If triggered by a tag, create a GitHub Release and attach artifacts.

## Versioned artifacts

Manual runs use a generated version like:

```text
manual-<run-number>-<short-sha>
```

Tag-triggered runs use the tag name, for example:

```text
v0.1.0
```

The workflow packages:

- `terminai-web-dist-<version>.tar.gz`
- `terminai-android-debug-<version>.apk`
- `terminai-android-release-unsigned-<version>.apk`
- `terminai-android-release-signed-<version>.apk` (only when signing secrets are configured)
- `terminai-<version>-sha256sums.txt`
- `terminai-web-server-<version>.log`

## Creating a tagged release

1. Ensure `TerminAI Web CI` and `TerminAI Android Native` are green on `main`.
2. Choose a version tag, for example `v0.1.0`.
3. Tag the already-green commit.
4. Push the tag.
5. Let `TerminAI Release` create the GitHub Release and attach artifacts.

Example:

```bash
git fetch origin
git checkout main
git pull origin main
git tag v0.1.0
git push origin v0.1.0
```

Do not tag a commit just because it built locally. The release source should be a commit already validated by GitHub Actions.

## Branch protection

Protect `main` in GitHub repository settings and require these status checks before merging:

- `TerminAI Web CI`
- `TerminAI Android Native`

Do not treat type-checking alone as the only test signal. The web gate now includes runtime manifest validation, Node automated tests, production server smoke testing, and command/file API safety smoke testing.

## Android signing status

The release workflow intentionally does not require signing secrets yet.

`terminai-android-release-unsigned-<version>.apk` is not final distribution signing. It is a release-shape artifact produced by CI so the project can verify build reproducibility and packaging before adding keystore handling.

Signed Android release builds are now supported via conditional signing secrets. When `TERMINAI_ANDROID_KEYSTORE_B64`, `TERMINAI_ANDROID_KEYSTORE_PASSWORD`, `TERMINAI_ANDROID_KEY_ALIAS`, and `TERMINAI_ANDROID_KEY_PASSWORD` are all configured as GitHub Actions secrets, the release workflow decodes the keystore and produces a signed release APK. Without secrets, the workflow produces the existing unsigned release APK. See `docs/android-signing.md` for full setup.

## Future release-hardening issues

- #4 — signed Android release path
- #5 — APK install smoke test

## Completed hardening references

- #6 — runtime integrity checks are now enforced by `npm run runtime:validate` in Web CI and Release.
- #8 — command/file API safety smoke tests are now part of the web and release gates.
- #12 — real Node tests run with `npm test`; type-checking is no longer the only test signal.
