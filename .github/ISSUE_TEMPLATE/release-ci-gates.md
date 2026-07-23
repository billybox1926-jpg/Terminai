---
name: Release and CI Feedback Loop
about: Expand automated release verification so dash/tab terminal and runtime behavior stay green across builds.
title: "[ci/release] add smokes for web+vite/builds and native APK smoke scenes + release gate checks"
labels: ci, release, testing, android, enhancement
assignees: ''
---

## Summary
Add narrow but meaningful verification steps so every candidate release proves at least the core web+runtime paths are functional.

## Context
- `npm run check` already chains typecheck, runtime validation, test, build, runtime status, and security smoke.
- Android workflows build/debug/release APKs.
- Dashboard is still placeholder on native.

## Changes needed
1. **Web runtime smoke sequence**
   - add browser-end-to-end or at least init-time script-level smoke covering terminal tab open, `/api/health`, and runtime state structure.
2. **Native APK smoke**
   - expand `.github/workflows/android-native.yml` to install a debug APK and assert runtime bundle/APK integrity states valid at runtime.
3. **Release gate messages**
   - ensure failure messaging is actionable: missing key states, runtime/telemetry failures.

## Acceptance criteria
- [ ] CI fails if core API contract/state structure changes unexpectedly.
- [ ] Android install smoke validates package id, runtime artifacts/readiness states, logs, and runtime profiles.
- [ ] Run impact visible in reviewers and PR/open threads.
