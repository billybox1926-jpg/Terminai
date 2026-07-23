---
name: Docs and Onboarding Clarity
about: Update docs and onboarding for dashboard + terminal + runtime assumptions across web and native.
title: "[docs] clarify web vs native status, runtime assumptions, and dashboard/terminal paths"
labels: documentation, enhancement, good first issue
assignees: ''
---

## Summary
Make it explicit which experiences are complete vs placeholder, and lower friction for developers using the web-only vs native+web workflows.

## Changes needed
1. **README precision**
   - clearly state dashboard state in native vs web.
   - document `TERMINAI_WORKSPACE_ROOT` security implications and sandbox scope.

2. **Setup docs**
   - add non-Linux dev setup notes for Windows/macOS contributors even if behavior is host-bootstrapped.

3. **Native docs**
   - update `docs/android-native-host.md` with current API bridge state and exact next step to replace the dashboard placeholder.

4. **Security/runtime docs**
   - call out what `npm run security:smoke` covers and does not cover.

## Acceptance criteria
- [ ] README no longer implies native dashboard is ready.
- [ ] setup docs reduce guesswork for non-apt environments.
- [ ] at least 1 doc explicitly lists terminal/dashboard ownership boundaries: web frontend vs native host vs server logic.
