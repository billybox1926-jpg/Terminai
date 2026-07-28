# #92 Design: Native Kotlin HTTP server (Phase 1)

## Objective
Remove the Node.js runtime dependency from the Android app by replacing `server.ts`'s API layer with a lightweight native Kotlin HTTP server. The backend is served on-device and accessed by the bundled WebView client.

## Framework choice: NanoHTTPD
**Selected:** NanoHTTPD  
**Rationale:**
- Single-file, zero extra Gradle plugins
- Chunked response streaming available for terminal stdout
- Output/request bodies map cleanly to `InputStream`/`OutputStream`
- Overkill to add Ktor coroutine client stack for an internal WebView-only host

## Scope: Phase 1 minimum viable backend

### Routes to implement
- `GET  /api/health`
- `GET  /api/system/stats` — CPU/mem/disk from `android.os.StatFs`, `ActivityManager`
- `POST /api/terminal/execute` — `ProcessBuilder` + optional PTY/stdout streaming
- `POST /api/file-manager/list`
- `POST /api/file-manager/read`
- `POST /api/file-manager/write`
- `POST /api/file-manager/delete`
- `POST /api/file-manager/create-folder`
- `GET  /api/runtime/status`
- `GET  /api/runtime/bundle/status`
- `GET  /api/runtime/bundle/integrity`
- `GET  /*` — serve bundled web client assets from app-private extracted storage + metadata endpoints
  - Bundling decision tracked separately: `dist/` is currently git-ignored, so the Phase 1 client asset path needs its own copy/CI mechanism (`assets/runtime/dist`, `prepareRuntimeAssets`, or an additional packaging step)
  - Server contract: static fallback returns `index.html` for SPA routing; API routes remain `/api/*`

### Routes deferred
- `/api/package-manager/*`, `/api/runtime/bootstrap/*` — not actionable on non-root Android
- `/api/runtime/api/status`, `/api/runtime/api/bridge/status` — metadata, not blocking
- `/api/runtime/api/invoke` — simulated only on web today
- `/api/device/build-status` (GET+POST) — move to Phase 2 DataStore persistence
- `/api/gemini/optimize-command` — Phase 2, OkHttp-backed
- `/api/runtime/first-run/complete` — redundant; `RuntimeManager.markFirstRunComplete()` already handles this on Android
- `/api/health` duplicate registration — drop; one liveness route is enough
- Vite middleware / dev server — not needed; serve bundled `dist/` directly

## Transport / security
- Bind only to `127.0.0.1`
- Require `int?token=` query param match against `TERMINAI_API_KEY` BuildConfig field when set; liveness stays open
- Do not open external network listeners

## Frontend compatibility
- Web app already hits `/api/*`; no route path changes in Phase 1
- Base URL becomes `http://127.0.0.1:<port>/` inside WebView instead of remote host
- If remote backend URL is configured, WebView should still support it; treat native host as the default

## Implementation plan
1. Create `android/app/src/main/java/com/billybox/terminai/server/NativeHttpServer.kt` — NanoHTTPD subclass
2. Create route handlers as small classes/functions in `android/app/src/main/java/com/billybox/terminai/server/routes/`
3. Translate sandbox path checks from `workspacePaths.mjs` into Kotlin `java.nio.file.Path` checks against `workspaceRoot`
4. Add NanoHTTPD dependency to `android/app/build.gradle`
5. Start server in `MainActivity` or dedicated `ServerLifecycleService` after runtime extraction

## Not doing in Phase 1
- No native package install path — surface metadata as "install argv hints" instead
- No PTY allocation yet — start with `ProcessBuilder` stdout, add PTY later if line editing matters
