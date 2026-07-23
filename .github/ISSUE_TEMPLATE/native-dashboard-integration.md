---
name: Native Dashboard Integration
about: Replace the native Android 'dashboard coming soon' stub with a working embedded dashboard.
title: "[native] replace dashboard placeholder with real Android webview/runtime UI"
labels: android, dashboard, native, enhancement
assignees: ''
---

## Summary
Today the Android native host shows a hardcoded dialog saying dashboard integration is coming soon. Replace that path with a functional dashboard surface or embedded webview tied to TerminAI runtime/workspace state.

## Current behavior
- `MainActivity.openDashboard()` opens `AlertDialog` with:
  > Dashboard integration coming soon.  
  > For now, this native app proves the app-owned runtime, workspace, state, and API bridge status.

## Desired outcome
- Remove the “coming soon” dialog behavior.
- Implement one of:
  - embedded dashboard UI with runtime status + logs, or
  - webview to `http://localhost:<port>` when server is available, or
  - dedicated native device/runtime panel matching web readiness data.

## Considerations
- Keep offline first: show checks even if no server.
- Reuse existing runtime/workspace state instead of duplicating data.
- Preserve Android runtime proof narrative if used for demos.

## Acceptance criteria
- [ ] `openDashboard()` and any related menu item no longer show `coming soon`.
- [ ] Dashboard shows real runtime/packages/API bridge data.
- [ ] Refresh is possible without restarting the app.
- [ ] If webview path is used, fallback UI exists when port is unavailable.
