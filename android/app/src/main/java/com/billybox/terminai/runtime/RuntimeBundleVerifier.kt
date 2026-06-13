package com.billybox.terminai.runtime

import android.content.Context
import java.io.File
import java.security.MessageDigest

/**
 * TerminAI Runtime Bundle Verifier — native Android host.
 *
 * Verifies integrity of runtime bundle assets against lock file.
 * One app. One dashboard. One runtime.
 */
class RuntimeBundleVerifier(private val context: Context) {

    private val runtimeManager = RuntimeManager(context)
    private val runtimeRoot: File get() = runtimeManager.runtimeRoot

    /**
     * Check if the bundle is ready (manifest + assets present).
     */
    fun isBundleReady(): Boolean {
        val manifest = runtimeManager.readRuntimeBundleManifest()
        return manifest != null && runtimeRoot.exists()
    }

    /**
     * List all runtime asset files (excluding .gitkeep).
     */
    fun listRuntimeAssets(): List<FileInfo> {
        val assets = mutableListOf<FileInfo>()
        if (!runtimeRoot.exists()) return assets

        runtimeRoot.walkTopDown()
            .filter { it.isFile && it.name != ".gitkeep" }
            .forEach { file ->
                assets.add(FileInfo(
                    path = file.relativeTo(runtimeRoot).path,
                    size = file.length(),
                    sha256 = sha256(file)
                ))
            }
        return assets.sortedBy { it.path }
    }

    /**
     * Verify bundle integrity against lock file.
     */
    fun verifyBundleIntegrity(): IntegrityResult {
        val lockFile = File(runtimeManager.runtimeEtc, "runtime-bundle.lock.json")

        // No lock file present
        if (!lockFile.exists()) {
            val assets = listRuntimeAssets()
            return IntegrityResult(
                lockFilePresent = false,
                placeholderMode = assets.isEmpty(),
                hasRealFiles = assets.isNotEmpty(),
                fileCountExpected = 0,
                fileCountActual = assets.size,
                totalBytesExpected = 0,
                totalBytesActual = assets.sumOf { it.size },
                matchCount = 0,
                integrityOk = assets.isEmpty(), // OK if nothing to check
                missingFiles = emptyList(),
                changedFiles = emptyList(),
                extraFiles = emptyList(),
                notes = if (assets.isEmpty()) {
                    "Placeholder mode: no lock file and no real asset files."
                } else {
                    "Lock file missing but ${assets.size} asset files exist. Run build-runtime-bundle to generate lock."
                }
            )
        }

        // Parse lock file
        return try {
            val lockJson = lockFile.readText()
            val expectedFiles = parseLockFiles(lockJson)
            val actualAssets = listRuntimeAssets()
            val actualMap = actualAssets.associateBy { it.path }

            val missingFiles = mutableListOf<String>()
            val changedFiles = mutableListOf<String>()
            val extraFiles = mutableListOf<String>()
            var matchCount = 0

            for (expected in expectedFiles) {
                val actual = actualMap[expected.path]
                if (actual == null) {
                    missingFiles.add(expected.path)
                } else if (actual.size != expected.size || actual.sha256 != expected.sha256) {
                    changedFiles.add(expected.path)
                } else {
                    matchCount++
                }
            }

            for (actual in actualAssets) {
                if (expectedFiles.none { it.path == actual.path }) {
                    extraFiles.add(actual.path)
                }
            }

            val integrityOk = missingFiles.isEmpty() && changedFiles.isEmpty() && extraFiles.isEmpty()

            IntegrityResult(
                lockFilePresent = true,
                placeholderMode = false,
                hasRealFiles = true,
                fileCountExpected = expectedFiles.size,
                fileCountActual = actualAssets.size,
                totalBytesExpected = expectedFiles.sumOf { it.size },
                totalBytesActual = actualAssets.sumOf { it.size },
                matchCount,
                integrityOk,
                missingFiles,
                changedFiles,
                extraFiles,
                notes = if (integrityOk) {
                    "Integrity OK: $matchCount files verified."
                } else {
                    "Integrity issues: ${missingFiles.size} missing, ${changedFiles.size} changed, ${extraFiles.size} extra."
                }
            )
        } catch (e: Exception) {
            IntegrityResult(
                lockFilePresent = true,
                placeholderMode = false,
                hasRealFiles = true,
                fileCountExpected = 0,
                fileCountActual = listRuntimeAssets().size,
                totalBytesExpected = 0,
                totalBytesActual = 0,
                matchCount = 0,
                integrityOk = false,
                missingFiles = emptyList(),
                changedFiles = emptyList(),
                extraFiles = emptyList(),
                notes = "Error reading lock file: ${e.message}"
            )
        }
    }

    private fun parseLockFiles(lockJson: String): List<FileInfo> {
        val files = mutableListOf<FileInfo>()
        // Simple JSON array parsing — in production use Gson/Moshi
        val fileArrayRegex = "\"files\"\\s*:\\s*\\[([^\\]]*)\\]".toRegex(RegexOption.DOT_MATCHES_ALL)
        val arrayContent = fileArrayRegex.find(lockJson)?.groupValues?.get(1) ?: return files

        val objectRegex = "\\{([^}]+)\\}".toRegex()
        for (match in objectRegex.findAll(arrayContent)) {
            val obj = match.groupValues[1]
            val path = extractJsonString(obj, "path") ?: continue
            val size = extractJsonString(obj, "size")?.toLongOrNull() ?: 0
            val sha256 = extractJsonString(obj, "sha256") ?: ""
            files.add(FileInfo(path, size, sha256))
        }
        return files
    }

    private fun extractJsonString(json: String, key: String): String? {
        val pattern = "\"$key\"\\s*:\\s*\"?([^\",\\}]+)\"?".toRegex()
        return pattern.find(json)?.groupValues?.get(1)?.trim()
    }

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buffer = ByteArray(8192)
            var read: Int
            while (input.read(buffer).also { read = it } != -1) {
                digest.update(buffer, 0, read)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }
}

data class FileInfo(
    val path: String,
    val size: Long,
    val sha256: String
)

data class IntegrityResult(
    val lockFilePresent: Boolean,
    val placeholderMode: Boolean,
    val hasRealFiles: Boolean,
    val fileCountExpected: Int,
    val fileCountActual: Int,
    val totalBytesExpected: Long,
    val totalBytesActual: Long,
    val matchCount: Int,
    val integrityOk: Boolean,
    val missingFiles: List<String>,
    val changedFiles: List<String>,
    val extraFiles: List<String>,
    val notes: String
)
