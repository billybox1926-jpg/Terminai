---
name: Terminal Stability and State Polish
about: Make terminal execution, working-directory sync, sessions, and safety behavior production-ready.
title: "[web/terminal] harden execute/session sync/sandbox/telemetry and UX polish"
labels: terminal, battery, backend, frontend, enhancement
assignees: ''
---

## Summary
The web terminal is usable, but execution/session/runtime experience needs a stabilization pass to be “fully functional” for daily use.

## Context
- `server.ts` `/api/terminal/execute` is a primary surface.
- `src/App.tsx` manages sessions, cwd syncing, telemetry polling, and UI-only `clear`/`help`.
- `PackageLibrary.tsx` expands runtime/package provision onscreen.
- `runtime/package-baseline.json` is the package/runtime source of truth.

## Work to do
1. **Execution reliability**
   - harden timeout/buffer handling and normalize retryable vs terminal client errors.
   - improve stderr/stdout ordering and truncation strategy for long-running commands.

2. **Working directory integrity**
   - fix/verify cwd sync after commands that fail, cd via `.` or `..`, or use env vars.
   - avoid accidental cwd desync when app shell and backend resolve paths differently.

3. **Session UX hardening**
   - prevent redundant `setSessions(...)` batches on rapid command entry.
   - align `help`, badge prompts, and null-state behavior.

4. **Workspace/file safety**
   - keep sandboxing aligned with `TERMINAI_WORKSPACE_ROOT` instead of implicit `process.cwd()` drift.

5. **Telemetry/monitor stability**
   - make `SystemMonitor` tolerant of slow `/api/system/stats` calls without UI lockup.
   - add refresh controls and last-failed indicators.

## Acceptance criteria
- [ ] `cd`, failed commands, and long outputs do not desync `currentCwd`.
- [ ] terminal controls remain responsive under slow backend responses.
- [ ] file ops and telemetry stay within configured workspace/runtime roots.
- [ ] no console errors during normal interactive use of terminal tabs.
