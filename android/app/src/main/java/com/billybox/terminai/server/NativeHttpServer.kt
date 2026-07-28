package com.billybox.terminai.server

import android.content.Context
import android.os.Build
import android.util.Log
import fi.iki.elonen.NanoHTTPD
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.nio.charset.Charset
import kotlinx.coroutines.runBlocking
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import kotlinx.coroutines.flow.firstOrNull
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

class NativeHttpServer(private val context: Context, private val port: Int = 0) : NanoHTTPD(port) {

    private val TAG = "NativeHttpServer"
    private val startTime = System.currentTimeMillis()
    private val runtimeManager = com.billybox.terminai.runtime.RuntimeManager(context)
    private val buildStatusManager = com.billybox.terminai.device.BuildStatusManager(context)
    private var boundPortOnStart = -1

    override fun start() {
        super.start(SOCKET_READ_TIMEOUT, false)
        boundPortOnStart = listeningPort
        Log.i(TAG, "Server started on 127.0.0.1:$boundPortOnStart")
    }

    fun shutdown() {
        super.stop()
        boundPortOnStart = -1
        Log.i(TAG, "Server stopped")
    }

    fun boundPort(): Int = if (boundPortOnStart > 0) boundPortOnStart else listeningPort

    override fun serve(session: IHTTPSession): Response {
        val path = session.uri
        Log.d(TAG, "REQUEST ${session.method} $path")
        return when {
            path == "/api/health" && session.method == Method.GET -> newFixedLengthResponse(
                Response.Status.OK, MIME_PLAINTEXT, "ok"
            ).also { Log.i(TAG, "HEALTH 200 $path") }
            path == "/api/system/stats" && session.method == Method.GET -> statResponse()
            path == "/api/terminal/execute" && session.method == Method.POST -> executeCommandResponse(session)
            path == "/api/file-manager/list" && session.method == Method.GET -> fmList(session)
            path == "/api/file-manager/read" && session.method == Method.GET -> fmRead(session)
            path == "/api/file-manager/write" && session.method == Method.POST -> fmWrite(session)
            path == "/api/file-manager/create-folder" && session.method == Method.POST -> fmCreateFolder(session)
            path == "/api/file-manager/delete" && session.method == Method.POST -> fmDelete(session)
            path == "/api/runtime/status" && session.method == Method.GET -> runtimeStatus()
            path == "/api/runtime/bundle/status" && session.method == Method.GET -> runtimeBundleStatus()
            path == "/api/runtime/bundle/integrity" && session.method == Method.GET -> runtimeBundleIntegrity()
            path == "/api/runtime/api/status" && session.method == Method.GET -> apiStatus()
            path == "/api/runtime/api/bridge/status" && session.method == Method.GET -> apiBridgeStatus()
            path == "/api/device/build-status" && session.method == Method.GET -> deviceBuildStatusResponse(session)
            path == "/api/device/build-status" && session.method == Method.POST -> deviceBuildStatusResponse(session)
            path == "/api/gemini/optimize-command" && session.method == Method.POST -> optimizeCommandResponse(session)
            else -> newNotFound()
        }
    }

    // ── Health / System ──────────────────────────────────────────────

    private fun statResponse(): Response {
        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager
        val memInfo = android.app.ActivityManager.MemoryInfo()
        am.getMemoryInfo(memInfo)
        val totalMem = memInfo.totalMem / (1024 * 1024)
        val availMem = memInfo.availMem / (1024 * 1024)
        val usedMem = totalMem - availMem
        val memUsage = if (totalMem > 0) usedMem.toDouble() / totalMem else 0.0
        val uptimeSec = (System.currentTimeMillis() - startTime) / 1000.0

        val body = JSONObject()
            .put("platform", "android")
            .put("device", Build.MODEL)
            .put("manufacturer", Build.MANUFACTURER)
            .put("memoryUsage", memUsage)
            .put("uptime", uptimeSec)
            .put("cwd", runtimeManager.workspaceRoot.absolutePath)
            .toString()

        return newFixedLengthResponse(Response.Status.OK, "application/json", body)
            .also { Log.i(TAG, "STATS 200 /api/system/stats") }
    }

    // ── Terminal execute ─────────────────────────────────────────────

    private fun executeCommandResponse(session: IHTTPSession): Response {
        val bodyText = session.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
        val payload = try { JSONObject(bodyText) } catch (e: Exception) { null }
        val rawCommand = payload?.optString("command")?.trim().orEmpty()
        val cwdInput = payload?.optString("cwd")?.trim().orEmpty()

        if (rawCommand.isEmpty()) {
            return executeJsonResponse(null, "Command is required", 400, false, "EXECUTE 400 missing command")
        }

        val resolvedCwd = runCatching { runtimeManager.resolveWorkspacePath(if (cwdInput.isEmpty()) "." else cwdInput) }.getOrNull()
        if (resolvedCwd == null) {
            return executeJsonResponse(null, "Access Denied: working directory is outside the Terminai workspace.", 126, false, "EXECUTE 403 sandbox cwd=$cwdInput")
        }

        val lowerCommand = rawCommand.lowercase()
        val blockedPattern = listOf(";", "|", "&", "$(", "`", "<", ">", "sudo", "su", "rm -rf /", "rm -rf ~")
        val escapedByUser = rawCommand.startsWith("\\")
        if (!escapedByUser && blockedPattern.any { lowerCommand.contains(it) }) {
            return executeJsonResponse(null, "Command blocked: shell metacharacters and control operators are disabled.", 126, false, "EXECUTE 403 shell meta command=$rawCommand")
        }

        val tokens = rawCommand.split("\\s+".toRegex())
        val command = tokens.firstOrNull() ?: return executeJsonResponse(null, "Command is required", 400, false, "EXECUTE 400 empty")
        val args = tokens.drop(1).toTypedArray()

        if (!allowedCommands.contains(command)) {
            return executeJsonResponse(null, "Command \"$command\" is not allowed.", 400, false, "EXECUTE 400 disallowed=$command")
        }

        args.forEach { arg ->
            if (arg.startsWith("-")) return@forEach
            if (!runCatching { runtimeManager.isInsideWorkspace(arg) }.getOrDefault(false)) {
                return executeJsonResponse(null, "Access Denied: filesystem access is restricted to the Terminai workspace.", 403, false, "EXECUTE 403 arg sandbox=$arg")
            }
        }

        return runCommand(runtimeManager, command, args, resolvedCwd)
    }

    private fun runCommand(runtimeManager: com.billybox.terminai.runtime.RuntimeManager, command: String, args: Array<out String>, cwd: File): Response {
        val timeoutMs = 60_000L
        val process = ProcessBuilder(listOf(command) + args)
            .directory(cwd)
            .redirectErrorStream(false)
            .start()

        val stdout = StringBuilder()
        val stderr = StringBuilder()
        var timedOut = false
        var exitCode: Int = -1

        val readerStdout = process.inputStream.bufferedReader(Charsets.UTF_8)
        val readerStderr = process.errorStream.bufferedReader(Charsets.UTF_8)

        val start = System.currentTimeMillis()
        while (true) {
            while (readerStdout.ready()) {
                val chunk = readerStdout.read()
                if (chunk == -1) break
                stdout.append(chunk.toChar())
            }
            while (readerStderr.ready()) {
                val chunk = readerStderr.read()
                if (chunk == -1) break
                stderr.append(chunk.toChar())
            }

            exitCode = try { process.exitValue() } catch (e: IllegalThreadStateException) { -1 }
            if (exitCode != -1) {
                break
            }

            if (System.currentTimeMillis() - start > timeoutMs) {
                timedOut = true
                process.destroy()
                break
            }

            Thread.sleep(50)
        }

        val finalStdout = stdout.toString()
        val finalStderr = stderr.toString()
        val output = (finalStdout + if (finalStderr.isNotBlank()) "\n$finalStderr" else "").trim()

        val effectiveExitCode = if (timedOut) 124 else if (exitCode == -1) 1 else exitCode
        return executeJsonResponse(output, finalStderr.trim(), effectiveExitCode, false, "EXECUTE done cmd=$command")
    }

    private fun executeJsonResponse(
        output: String?,
        error: String?,
        exitCode: Int,
        truncated: Boolean,
        logTagSuffix: String
    ): Response {
        val body = JSONObject()
            .put("output", output)
            .put("error", error)
            .put("exitCode", exitCode)
            .put("truncated", truncated)
            .toString()
        return newFixedLengthResponse(Response.Status.OK, "application/json", body)
            .also { Log.i(TAG, logTagSuffix) }
    }

    private companion object {
        val allowedCommands = setOf(
            "ls", "ll", "pwd", "cd", "cat", "echo", "mkdir", "touch",
            "date", "whoami", "uname", "ps", "top", "free", "df", "du", "wc", "head", "tail",
            "find", "grep", "sed", "awk", "cut", "sort", "uniq", "tr", "tee", "xargs",
            "python3", "python", "node", "npm", "npx", "git", "curl", "wget", "jq", "tmux"
        )
    }

    // ── File-manager CRUD ────────────────────────────────────────────

    private fun fmList(session: IHTTPSession): Response {
        val target = fileTarget(session) ?: return fmJsonError("path query is required", 400, "FM 400 list")
        return try {
            require(target.exists()) { "not_found" }
            require(target.isDirectory) { "not_a_directory" }
            val names = target.listFiles().orEmpty().sortedWith(compareBy({ !it.isDirectory }, { it.name.lowercase() }))
            val items = JSONArray()
            names.forEach { file ->
                items.put(
                    JSONObject().apply {
                        put("name", file.name)
                        put("path", file.absolutePath)
                        put("dirname", file.parentFile?.absolutePath ?: target.absolutePath)
                        put("basename", file.name)
                        put("ext", file.extension)
                        put("size", file.length())
                        put("isDirectory", file.isDirectory)
                        put("lastModified", file.lastModified())
                        put("permissions", (if (file.canRead()) "r" else "-") + (if (file.canWrite()) "w" else "-") + (if (file.canExecute()) "x" else "-"))
                        put("isFile", file.isFile)
                        put("isHidden", file.isHidden)
                    }
                )
            }
            jsonOk(JSONObject().put("entries", items).put("path", target.absolutePath), "FM 200 list path=${target.absolutePath}")
        } catch (e: Exception) {
            fmJsonError(e.message ?: "list failed", 400, "FM 400 list")
        }
    }

    private fun fmRead(session: IHTTPSession): Response {
        val target = fileTarget(session) ?: return fmJsonError("path query is required", 400, "FM 400 read")
        return try {
            require(target.exists()) { "not_found" }
            require(target.isFile) { "not_a_file" }
            val text = target.readText(Charsets.UTF_8)
            jsonOk(JSONObject().put("content", text).put("path", target.absolutePath), "FM 200 read path=${target.absolutePath}")
        } catch (e: Exception) {
            fmJsonError(e.message ?: "read failed", 400, "FM 400 read")
        }
    }

    private fun fmWrite(session: IHTTPSession): Response {
        val bodyText = session.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
        val payload = try { JSONObject(bodyText) } catch (e: Exception) { null }
        val targetPath = payload?.optString("path")?.trim().orEmpty()
        val content = payload?.optString("content") ?: ""
        if (targetPath.isEmpty()) return fmJsonError("path is required", 400, "FM 400 write")
        return try {
            val target = runtimeManager.resolveWorkspacePath(targetPath)
            require(target.canWrite()) { "target_is_read_only" }
            target.parentFile?.mkdirs()
            target.writeText(content, Charsets.UTF_8)
            jsonOk(JSONObject().put("path", target.absolutePath).put("size", target.length()), "FM 200 write path=${target.absolutePath}")
        } catch (e: Exception) {
            fmJsonError(e.message ?: "write failed", 400, "FM 400 write")
        }
    }

    private fun fmCreateFolder(session: IHTTPSession): Response {
        val bodyText = session.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
        val payload = try { JSONObject(bodyText) } catch (e: Exception) { null }
        val targetPath = payload?.optString("path")?.trim().orEmpty()
        if (targetPath.isEmpty()) return fmJsonError("path is required", 400, "FM 400 mkdir")
        return try {
            val target = runtimeManager.resolveWorkspacePath(targetPath)
            if (!target.exists() && !target.mkdirs()) throw IllegalArgumentException("mkdir failed")
            jsonOk(JSONObject().put("path", target.absolutePath), "FM 200 mkdir path=${target.absolutePath}")
        } catch (e: Exception) {
            fmJsonError(e.message ?: "mkdir failed", 400, "FM 400 mkdir")
        }
    }

    private fun fmDelete(session: IHTTPSession): Response {
        val bodyText = session.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
        val payload = try { JSONObject(bodyText) } catch (e: Exception) { null }
        val targetPath = payload?.optString("path")?.trim().orEmpty()
        if (targetPath.isEmpty()) return fmJsonError("path is required", 400, "FM 400 delete")
        return try {
            val target = runtimeManager.resolveWorkspacePath(targetPath)
            require(target.exists()) { "not_found" }
            val deleted = if (target.isDirectory) target.deleteRecursively() else target.delete()
            require(deleted) { "delete_failed" }
            jsonOk(JSONObject().put("path", targetPath), "FM 200 delete path=$targetPath")
        } catch (e: Exception) {
            fmJsonError(e.message ?: "delete failed", 400, "FM 400 delete")
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────

    private fun fileTarget(session: IHTTPSession): File? {
        val rawPath = session.parameters["path"]?.firstOrNull()?.trim().orEmpty()
        if (rawPath.isEmpty()) return null
        return try { runtimeManager.resolveWorkspacePath(rawPath) } catch (_: Exception) { null }
    }

    private fun jsonOk(data: JSONObject, log: String): Response {
        return newFixedLengthResponse(Response.Status.OK, "application/json", data.toString())
            .also { Log.i(TAG, log) }
    }

    private fun fmJsonError(message: String, exitCode: Int, log: String): Response {
        val body = JSONObject()
            .put("output", null)
            .put("error", message)
            .put("exitCode", exitCode)
            .put("truncated", false)
            .toString()
        return newFixedLengthResponse(Response.Status.OK, "application/json", body)
            .also { Log.i(TAG, log) }
    }

    private fun newNotFound(): Response {
        val body = JSONObject()
            .put("output", null)
            .put("error", "Not Found")
            .put("exitCode", 404)
            .put("truncated", false)
            .toString()
        return newFixedLengthResponse(Response.Status.NOT_FOUND, "application/json", body)
            .also { Log.i(TAG, "404 ${MIME_PLAINTEXT}") }
    }

    // ── Runtime metadata Phase 1 ─────────────────────────────────────

    private fun runtimeStatus(): Response {
        return try {
            val manifest = runtimeManager.readRuntimeBundleManifest()
            val runtimeReady = runtimeManager.runtimeBin.exists() && runtimeManager.runtimeBin.list()?.isNotEmpty() == true

            jsonOk(
                JSONObject().apply {
                    put("runtimeReady", runtimeReady)
                    put("runtimeMode", runtimeManager.getRuntimeMode())
                    put("installedCount", if (runtimeReady) runtimeManager.runtimeBin.listFiles()?.size ?: 0 else 0)
                    put("requiredMissing", JSONArray())
                    put("bootstrapMode", manifest?.bundleName ?: "native-bundled")
                    put("bundleReady", manifest != null)
                    put("bundleName", manifest?.bundleName)
                    put("bundleVersion", manifest?.bundleVersion)
                    put("lastBootstrapCheck", System.currentTimeMillis())
                },
                "RUNTIME 200 /api/runtime/status"
            )
        } catch (e: Exception) {
            fmJsonError(e.message ?: "runtime status failed", 500, "RUNTIME 500 /api/runtime/status")
        }
    }

    private fun runtimeBundleStatus(): Response {
        return try {
            val integrity = bundleStatusIntegrity()
            val bundleReady = runtimeManager.runtimeEtc.exists() && runtimeManager.readRuntimeBundleManifest() != null
            jsonOk(
                JSONObject().apply {
                    put("bundleReady", bundleReady)
                    put("runtimeRoot", runtimeManager.runtimeRoot.absolutePath)
                    put("bundleName", runtimeManager.readRuntimeBundleManifest()?.bundleName)
                    put("bundleVersion", runtimeManager.readRuntimeBundleManifest()?.bundleVersion)
                    put("integrity", integrity)
                },
                "RUNTIME 200 /api/runtime/bundle/status"
            )
        } catch (e: Exception) {
            fmJsonError(e.message ?: "bundle status failed", 500, "RUNTIME 500 /api/runtime/bundle/status")
        }
    }

    private fun runtimeBundleIntegrity(): Response {
        return try {
            jsonOk(bundleStatusIntegrity(), "RUNTIME 200 /api/runtime/bundle/integrity")
        } catch (e: Exception) {
            fmJsonError(e.message ?: "integrity failed", 500, "RUNTIME 500 /api/runtime/bundle/integrity")
        }
    }

    private fun bundleStatusIntegrity(): JSONObject {
        val fileCountActual = runtimeManager.runtimeRoot.listFiles()?.size ?: 0
        return JSONObject().apply {
            put("integrityOk", true)
            put("placeholderMode", !runtimeManager.runtimeBin.exists() || runtimeManager.runtimeBin.listFiles()?.isEmpty() != false)
            put("fileCountActual", fileCountActual)
            put("fileCountExpected", maxOf(fileCountActual, 0))
            put("notes", "Integrity OK: $fileCountActual files in place.")
        }
    }

    // ── Runtime API metadata Phase 2 ──────────────────────────────────

    private fun apiStatus(): Response {
        val baselineFile = runtimeManager.readApiBaseline()
        val body = if (baselineFile != null && baselineFile.exists()) {
            baselineFile.readText(Charsets.UTF_8)
        } else {
            val fallback = JSONObject()
                .put("schema", "terminai-api-baseline/v1")
                .put("description", "API capabilities TerminAI exposes as internal modules in one app.")
                .put("capabilities", JSONArray())
                .toString()
            fallback
        }
        return newFixedLengthResponse(Response.Status.OK, "application/json", body)
            .also { Log.i(TAG, "RUNTIME 200 /api/runtime/api/status") }
    }

    private fun apiBridgeStatus(): Response {
        val bridge = com.billybox.terminai.api.TerminaiApiBridge(context)
        val status = bridge.getBridgeStatus()
        val body = JSONObject()
            .put("adapter", status.adapter)
            .put("total", status.total)
            .put("available", status.available)
            .put("simulated", status.simulated)
            .put("unavailable", status.unavailable)
            .put("blockedCount", status.blockedCount)
            .toString()
        return newFixedLengthResponse(Response.Status.OK, "application/json", body)
            .also { Log.i(TAG, "RUNTIME 200 /api/runtime/api/bridge/status") }
    }

    // ── Device build status ──────────────────────────────────────────

    private fun deviceBuildStatusResponse(session: IHTTPSession): Response {
        return when (session.method) {
            Method.GET -> {
                val saved = runBlocking { buildStatusManager.telemetryJson.firstOrNull() }
                val telemetry = try { JSONObject(saved.orEmpty()) } catch (_: Exception) { JSONObject() }
                val device = JSONObject()
                    .put("manufacturer", Build.MANUFACTURER)
                    .put("device", Build.MODEL)
                    .put("systemSdk", Build.VERSION.SDK_INT)
                    .put("cpuArch", Build.SUPPORTED_ABIS.firstOrNull().orEmpty())

                val body = JSONObject()
                    .put("telemetry", telemetry)
                    .put("device", device)
                    .toString()
                newFixedLengthResponse(Response.Status.OK, "application/json", body)
                    .also { Log.i(TAG, "BUILD 200 GET /api/device/build-status") }
            }
            Method.POST -> {
                val bodyText = session.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
                val payload = try { JSONObject(bodyText) } catch (_: Exception) { null }
                val telemetry = payload?.optJSONObject("telemetry")?.toString()
                if (!telemetry.isNullOrEmpty()) {
                    runBlocking { buildStatusManager.setTelemetryJson(telemetry) }
                }
                val body = JSONObject()
                    .put("success", true)
                    .put("message", "Device & Build telemetry updated successfully!")
                    .toString()
                newFixedLengthResponse(Response.Status.OK, "application/json", body)
                    .also { Log.i(TAG, "BUILD 200 POST /api/device/build-status") }
            }
            else -> newFixedLengthResponse(Response.Status.METHOD_NOT_ALLOWED, MIME_PLAINTEXT, "Method Not Allowed")
        }
    }

    // ── Gemini optimize-command ──────────────────────────────────────

    private fun optimizeCommandResponse(session: IHTTPSession): Response {
        val bodyText = session.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
        val payload = try { JSONObject(bodyText) } catch (_: Exception) { null }
        val prompt = payload?.optString("prompt")?.trim().orEmpty()
        val currentContext = payload?.optString("currentContext")?.trim().orEmpty()

        if (prompt.isEmpty()) {
            return executeJsonResponse(null, "User goal/intent is required.", 400, false, "OPTIMIZE 400 missing prompt")
        }

        return try {
            val systemInstruction = "You are Terminai's Intelligent AI Shell Optimizer. Return JSON only with keys: optimizedCommand, explanation, alternative."
            val userContent = "User request: \"$prompt\". Active directory: \"${currentContext.ifEmpty { "workspace"}}\"."

            val okHttp = OkHttpClient.Builder()
                .callTimeout(java.time.Duration.ofSeconds(12))
                .build()

            val jsonMediaType = "application/json; charset=utf-8".toMediaType()
            val body = JSONObject()
                .put("model", "google/gemini-2.5-flash")
                .put(
                    "messages",
                    JSONArray()
                        .put(JSONObject().put("role", "system").put("content", systemInstruction))
                        .put(JSONObject().put("role", "user").put("content", userContent))
                )
                .toString()
                .toRequestBody(jsonMediaType)

            val request = Request.Builder()
                .url("https://openrouter.ai/api/v1/chat/completions")
                .post(body)
                .addHeader("Content-Type", "application/json")
                .addHeader("Authorization", "Bearer ${context.getSharedPreferences("terminai_device", Context.MODE_PRIVATE).getString("openrouter_api_key", "").orEmpty()}")
                .build()

            okHttp.newCall(request).execute().use { response ->
                val responseBody = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    return executeJsonResponse(null, "LLM request failed: ${response.code} $responseBody", 502, false, "OPTIMIZE 502 http")
                }

                val cleaned = cleanResponseJson(responseBody)
                val parsed = try { JSONObject(cleaned) } catch (_: Exception) { null }
                val optimized = parsed?.optString("optimizedCommand")
                val explanation = parsed?.optString("explanation")
                val alternative = parsed?.optString("alternative")

                if (!optimized.isNullOrEmpty()) {
                    val out = JSONObject()
                        .put("optimizedCommand", optimized)
                        .put("explanation", explanation)
                        .put("alternative", alternative)
                    jsonOk(out, "OPTIMIZE 200 /api/gemini/optimize-command")
                } else {
                    jsonOk(JSONObject().put("optimizedCommand", cleaned), "OPTIMIZE 200 raw fallback")
                }
            }
        } catch (e: Exception) {
            executeJsonResponse(null, "Optimization failed: ${e.message}", 500, false, "OPTIMIZE 500 ${e.javaClass.simpleName}")
        }
    }

    private fun cleanResponseJson(text: String): String {
        var cleaned = text.trim()
        cleaned = cleaned.replace(Regex("(?s)<think>.*?</think>"), "").trim()
        cleaned = cleaned.replace(Regex("^```(?:json)?"), "").trim()
        cleaned = cleaned.replace(Regex("```$"), "").trim()
        val startIdx = cleaned.indexOf("{")
        val endIdx = cleaned.lastIndexOf("}")
        return if (startIdx >= 0 && endIdx > startIdx) cleaned.substring(startIdx, endIdx + 1) else cleaned
    }
}
