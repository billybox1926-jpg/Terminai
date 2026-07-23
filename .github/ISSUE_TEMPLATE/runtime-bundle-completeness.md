---
name: Runtime Bundle Completeness
about: Move runtime bundle out of placeholder mode and into a real locked-and-loaded native-ready state.
title: "[runtime] finish native-ready bundle, lockfile generation, integrity checks, windows/mac fallbacks"
labels: runtime, native, testing, enhancement
assignees: ''
---

## Summary
`runtime/` currently works in placeholder mode for asset-free installs. Make it authoritative for all platforms and release artifacts.

## Context
- `runtime/runtime-bundle.json` and `runtime/runtime-bundle.lock.json` define packaging.
- `scripts/*.mjs` validate, bundle, and report runtime state.
- `server.ts` `checkRuntimeBundleStatus()` / `checkRuntimeBundleIntegrity()` show status in UI.
- Web prototype path assumes host bootstrap with `apt`.

## Changes needed
1. Replace missing lockfile behavior with centered generation/validation flows in docs + docs for explicit `NO LOCK` state behavior.
2. Provide non-`apt` guidance for non-Linux environments:
   - Homebrew/Chocolatey/Scoop mapping for baseline tools.
   - skipped, partially available, or mocked reporting on unsupported packages or environments.
3. tighten package baseline docs and add CI for Windows/macOS variations.

## Acceptance criteria
- [ ] placeholders replaced with deterministic README/GUIDE + explicit package/provider mapping.
- [ ] generated contracts verified per script/runtime state.
