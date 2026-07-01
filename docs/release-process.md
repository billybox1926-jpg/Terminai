Use these commands to verify the release bundle. They do not sign or publish anything.

```bash
npm ci
npm run check
npm run build
npm run runtime:bundle
node scripts/runtime-status.mjs

cd android
./gradlew testDebugUnitTest
./gradlew lintDebug
./gradlew assembleDebug
./gradlew assembleRelease
```

Release artifacts are produced by the `TerminAI Release` workflow. From GitHub Actions:

- `terminai-web-dist` — production Vite client and bundled Express server
- `terminai-android-debug-apk` — debug APK for install/testing
- `terminai-android-release-unsigned-apk` — release-shape APK without distribution signing

Signed release APKs are not currently produced from CI. Manually generated release artifacts can be reviewed under Releases when a tag triggers the release workflow.
