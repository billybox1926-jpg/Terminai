package com.billybox.terminai.runtime

import android.content.Context
import java.io.File
import java.nio.file.Path
import java.nio.file.Paths

class RuntimeManager(private val context: Context) {

    // App-owned directories (no broad storage permissions needed)
    val runtimeRoot: File get() = File(context.filesDir, "runtime")
    val workspaceRoot: File get() = File(context.filesDir, "workspace")
    val stateDir: File get() = File(context.filesDir, "state")

    // Subdirectories
    val runtimeBin: File get() = File(runtimeRoot, "bin")
    val runtimeLib: File get() = File(runtimeRoot, "lib")
    val runtimeEtc: File get() = File(runtimeRoot, "etc")
    val runtimeHome: File get() = File(runtimeRoot, "home")

    fun ensureRuntimeDirectories() {
        listOf(runtimeRoot, workspaceRoot, stateDir, runtimeBin, runtimeLib, runtimeEtc, runtimeHome).forEach {
            if (!it.exists()) it.mkdirs()
        }
    }

    fun ensureRuntimeExtracted(context: Context) {
        val extractedMarker = File(stateDir, "runtime_extracted")
        if (extractedMarker.exists() && runtimeRoot.exists() && runtimeRoot.list()?.isNotEmpty() == true) {
            return
        }

        ensureRuntimeDirectories()

        try {
            context.assets.list("runtime")?.forEach { assetPath ->
                copyAssetFolder(context, "runtime/$assetPath", File(runtimeRoot, assetPath))
            }
            extractedMarker.writeText(System.currentTimeMillis().toString())
        } catch (e: Exception) {
            // Extraction is best-effort; the app continues in placeholder mode
            // if assets cannot be copied for any reason.
        }
    }

    private fun copyAssetFolder(context: Context, assetPath: String, targetDir: File) {
        val children = context.assets.list(assetPath)
        if (children.isNullOrEmpty()) {
            copyAssetFile(context, assetPath, targetDir)
            return
        }

        if (!targetDir.exists()) targetDir.mkdirs()
        children.forEach { child ->
            val childAssetPath = "$assetPath/$child"
            copyAssetFolder(context, childAssetPath, File(targetDir, child))
        }
    }

    private fun copyAssetFile(context: Context, assetPath: String, targetFile: File) {
        context.assets.open(assetPath).use { input ->
            targetFile.outputStream().use { output ->
                input.copyTo(output)
            }
        }
        targetFile.setExecutable(true, false)
    }

    fun getRuntimeMode(): String {
        return if (runtimeBin.exists() && runtimeBin.list()?.isNotEmpty() == true) {
            "native-bundled"
        } else {
            "placeholder"
        }
    }

    fun readRuntimeBundleManifest(): RuntimeBundleManifest? {
        val manifestFile = File(runtimeEtc, "runtime-bundle.json")
        if (!manifestFile.exists()) return null
        return try {
            val json = manifestFile.readText()
            RuntimeBundleManifest(
                bundleName = extractJsonString(json, "bundleName") ?: "unknown",
                bundleVersion = extractJsonString(json, "bundleVersion") ?: "0.0.0",
                targetMode = extractJsonString(json, "targetMode") ?: "native-bundled"
            )
        } catch (e: Exception) {
            null
        }
    }

    fun readPackageBaseline(): File? {
        val baseline = File(runtimeEtc, "package-baseline.json")
        return if (baseline.exists()) baseline else null
    }

    fun readApiBaseline(): File? {
        val baseline = File(runtimeEtc, "api-baseline.json")
        return if (baseline.exists()) baseline else null
    }

    fun isFirstRunComplete(): Boolean {
        return File(stateDir, "first_run_complete").exists()
    }

    fun markFirstRunComplete() {
        File(stateDir, "first_run_complete").writeText(System.currentTimeMillis().toString())
    }

    fun setPersistedWorkspaceUri(uri: String) {
        val sharedPref = context.getSharedPreferences("terminai_prefs", Context.MODE_PRIVATE)
        sharedPref.edit().putString("persisted_workspace_uri", uri).apply()
    }

    fun hasPersistedWorkspaceUri(): Boolean {
        val sharedPref = context.getSharedPreferences("terminai_prefs", Context.MODE_PRIVATE)
        return !sharedPref.getString("persisted_workspace_uri", "").isNullOrEmpty()
    }

    fun getPersistedWorkspaceUri(): String? {
        val sharedPref = context.getSharedPreferences("terminai_prefs", Context.MODE_PRIVATE)
        return sharedPref.getString("persisted_workspace_uri", null)
    }

    // --- Workspace sandbox resolution (ported from `src/server/workspacePaths.mjs`) ---

    fun resolveWorkspacePath(inputPath: String = "."): File {
        val root = workspaceRoot.canonicalFile
        val candidate = File(root, inputPath).canonicalFile
        assertInsideWorkspace(candidate, root)
        return candidate
    }

    fun isInsideWorkspace(inputPath: String): Boolean {
        return try {
            resolveWorkspacePath(inputPath)
            true
        } catch (e: Exception) {
            false
        }
    }

    private fun assertInsideWorkspace(target: File, root: File) {
        // Canonicalize root once; if it doesn't exist yet, fall back to absolute path.
        val normalizedRoot = runCatching { root.canonicalFile }.getOrElse { root.absoluteFile }
        val normalizedTarget = runCatching { target.canonicalFile }.getOrElse { target.absoluteFile }

        var current: Path = normalizedTarget.toPath()
        while (true) {
            if (current == normalizedRoot.toPath()) {
                return
            }
            if (!current.startsWith(normalizedRoot.toPath())) {
                throw SecurityException("Access Denied: Sandbox escape prevented.")
            }
            current = current.parent ?: break
        }

        val relative = normalizedRoot.toPath().relativize(normalizedTarget.toPath())
        if (relative.toString().startsWith("..")) {
            throw SecurityException("Access Denied: Sandbox escape prevented.")
        }
    }

    private fun extractJsonString(json: String, key: String): String? {
        val pattern = "\"$key\"\\s*:\\s*\"([^\"]+)\"".toRegex()
        return pattern.find(json)?.groupValues?.get(1)
    }
}

data class RuntimeBundleManifest(
    val bundleName: String,
    val bundleVersion: String,
    val targetMode: String
)
