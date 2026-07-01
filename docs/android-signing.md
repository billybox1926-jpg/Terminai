# TerminAI Android signing

TerminAI supports **conditional signed release builds**. The release APK is only signed when all four required GitHub Actions secrets are configured. Without secrets, CI produces the existing unsigned release APK — no secrets required for normal PR checks or unsigned artifacts.

## Required secrets

Add these secrets in the GitHub repository under **Settings > Secrets and variables > Actions**:

| Secret name | Purpose |
| --- | --- |
| `TERMINAI_ANDROID_KEYSTORE_B64` | Base64-encoded Java KeyStore (`.jks`) containing the signing key |
| `TERMINAI_ANDROID_KEYSTORE_PASSWORD` | Password for the keystore file |
| `TERMINAI_ANDROID_KEY_ALIAS` | Alias of the signing key inside the keystore |
| `TERMINAI_ANDROID_KEY_PASSWORD` | Password for the signing key itself |

All four must be present. If any are missing, signing is silently skipped.

## Generate a local signing keystore

Run this on a trusted local machine (not CI):

```bash
# Generate a new keystore with a RSA 2048-bit key valid for 25 years.
keytool -genkeypair \
  -v \
  -storetype PKCS12 \
  -keystore terminai-release.jks \
  -alias terminai-release \
  -keyalg RSA \
  -keysize 2048 \
  -validity 9125 \
  -storepass "YOUR_KEYSTORE_PASSWORD" \
  -keypass "YOUR_KEY_PASSWORD" \
  -dname "CN=TerminAI, OU=Android, O=billybox, L=Unknown, ST=Unknown, C=US"
```

Replace `YOUR_KEYSTORE_PASSWORD` and `YOUR_KEY_PASSWORD` with strong, unique passwords.

**Security rules:**
- Never commit the `.jks` file to git.
- Never paste passwords into chat or logs.
- Store passwords only in GitHub Actions secrets or a local secrets manager.
- The `.gitignore` already excludes `*.jks`, `*.keystore`, `*.pem`, `*.key`.

## Base64 encode for GitHub Actions

```bash
# Linux / macOS
base64 -i terminai-release.jks | tr -d '\n' | pbcopy   # macOS
base64 -w0 terminai-release.jks | xclip -sel clip       # Linux

# Or save to a file first:
base64 -w0 terminai-release.jks > terminai-release.jks.b64
```

Take the full base64 string (no line breaks) and set it as the `TERMINAI_ANDROID_KEYSTORE_B64` secret value.

## Add secrets to GitHub

1. Open the repository on GitHub.
2. Navigate to **Settings > Secrets and variables > Actions**.
3. Click **New repository secret**.
4. Add each of the four secrets from the table above.
5. Double-check for leading/trailing whitespace before saving.

## How it works

1. `android/app/build.gradle` reads the four environment variables at build time.
2. If all four are present, an `android.signingConfigs.release` block is created using the keystore file at `$TERMINAI_KEYSTORE_PATH`.
3. The release `buildType` only applies `signingConfig` when signing is ready.
4. The release workflow decodes the base64 keystore into `$RUNNER_TEMP/terminai-release.jks` and passes signing env vars to Gradle.
5. When secrets are absent, Gradle produces an unsigned release APK exactly as before.
6. The keystore file is deleted at the end of the workflow run.

## Rotate or revoke signing material

If the signing key is compromised or needs rotation:

1. Generate a new keystore with new passwords (see above).
2. Base64-encode the new keystore.
3. Update all four GitHub secrets with the new values.
4. Any previously signed APKs should be considered untrustworthy.
5. Publish new signed releases from the updated CI pipeline.

**Warning:** Losing the signing key matters for distribution continuity. If you publish a signed APK and then lose the keystore, you cannot publish updates to the same app on the same distribution channel without a new key — which means existing users cannot upgrade seamlessly. Back up the keystore and passwords in a secure location outside of GitHub.

## Unsigned release APK is not final distribution

The unsigned release APK (`terminai-android-release-unsigned-*.apk`) is a CI-produced artifact for build verification and testing only. It cannot be installed on most Android devices without `adb install --unsigned` or sideloading with unknown-sources enabled. The signed release APK is the only distribution candidate.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Release build is unsigned despite secrets being set | One or more secrets are missing or have wrong names. Check exact spelling. |
| Gradle fails with "Keystore was tampered with" | `TERMINAI_ANDROID_KEYSTORE_PASSWORD` is wrong. |
| Gradle fails with "Cannot recover key" | `TERMINAI_ANDROID_KEY_ALIAS` or `TERMINAI_ANDROID_KEY_PASSWORD` is wrong. |
| `base64: invalid input` in CI | The `TERMINAI_ANDROID_KEYSTORE_B64` secret contains line breaks or whitespace. Re-encode with `base64 -w0`. |
