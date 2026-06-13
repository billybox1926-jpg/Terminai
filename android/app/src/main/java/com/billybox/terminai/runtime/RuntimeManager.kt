package com.billybox.terminai.runtime

import android.content.Context
import java.io.File

/**
 * TerminAI Runtime Manager — native Android host.
 *
 * Manages runtime root, workspace root, and app-owned directories.
 * One app. One dashboard. One runtime.
 */
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

    /**
     * Ensure all runtime directories exist.
     */
    fun ensureRuntimeDirectories() {
        listOf(runtimeRoot, workspaceRoot, stateDir, runtimeBin, runtimeLib, runtimeEtc, runtimeHome).forEach {
            if (!it.exists()) it.mkdirs()
        }
    }

    /**
     * Get the current runtime mode.
     */
    fun getRuntimeMode(): String {
        return if (runtimeBin.exists() && runtimeBin.list()?.isNotEmpty() == true) {
            "native-bundled"
        } else {
            "placeholder"
        }
    }

    /**
     * Read the runtime bundle manifest if present.
     */
    fun readRuntimeBundleManifest(): RuntimeBundleManifest? {
        val manifestFile = File(runtimeEtc, "runtime-bundle.json")
        if (!manifestFile.exists()) return null
        return try {
            val json = manifestFile.readText()
            // Simple parsing — in production use Gson/Moshi
            RuntimeBundleManifest(
                bundleName = extractJsonString(json, "bundleName") ?: "unknown",
                bundleVersion = extractJsonString(json, "bundleVersion") ?: "0.0.0",
                targetMode = extractJsonString(json, "targetMode") ?: "native-bundled"
            )
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Read the package baseline manifest if present.
     */
    fun readPackageBaseline(): File? {
        val baseline = File(runtimeEtc, "package-baseline.json")
        return if (baseline.exists()) baseline else null
    }

    /**
     * Read the API baseline manifest if present.
     */
    fun readApiBaseline(): File? {
        val baseline = File(runtimeEtc, "api-baseline.json")
        return if (baseline.exists()) baseline else null
    }

    /**
     * Check if first run has been completed.
     */
    fun isFirstRunComplete(): Boolean {
        return File(stateDir, "first_run_complete").exists()
    }

    /**
     * Mark first run as complete.
     */
    fun markFirstRunComplete() {
        File(stateDir, "first_run_complete").writeText(System.currentTimeMillis().toString())
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
