package com.billybox.terminai.utils

import android.content.Context
import android.net.Uri
import androidx.documentfile.provider.DocumentFile
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream

/**
 * Sync utilities that bridge the app-private `workspaceRoot` directory (used directly
 * by the backend HTTP server) and a user-selected SAF tree URI.
 *
 * Design: Option 1 from Issue #89 Part B. The backend never touches SAF; these
 * functions are the only place DocumentFile / ContentResolver APIs are used.
 */
object WorkspaceSync {

    data class SyncResult(
        val filesCopied: Int,
        val bytesCopied: Long,
        val errors: List<String>
    )

    /**
     * Copies all contents from the SAF tree URI into destinationRoot (a real File dir),
     * overwriting any existing files with the same relative path.
     */
    suspend fun importFromSAF(
        context: Context,
        sourceUri: Uri,
        destinationRoot: File,
        onProgress: ((Int, String) -> Unit)? = null
    ): SyncResult = withContext(Dispatchers.IO) {
        val errors = mutableListOf<String>()
        var filesCopied = 0
        var bytesCopied = 0L

        val rootDoc = DocumentFile.fromTreeUri(context, sourceUri)
            ?: return@withContext SyncResult(0, 0, listOf("Could not open SAF tree URI: $sourceUri"))

        if (!destinationRoot.exists()) {
            destinationRoot.mkdirs()
        }

        fun walk(doc: DocumentFile, destDir: File) {
            val children = doc.listFiles()
            for (child in children) {
                val name = child.name ?: continue
                try {
                    if (child.isDirectory) {
                        val childDestDir = File(destDir, name)
                        if (!childDestDir.exists()) childDestDir.mkdirs()
                        walk(child, childDestDir)
                    } else {
                        val destFile = File(destDir, name)
                        destFile.parentFile?.let { if (!it.exists()) it.mkdirs() }
                        context.contentResolver.openInputStream(child.uri)?.use { input ->
                            FileOutputStream(destFile).use { output ->
                                bytesCopied += input.copyTo(output)
                            }
                        } ?: run {
                            errors.add("Could not open input stream for ${child.uri}")
                            return@run
                        }
                        filesCopied++
                        onProgress?.invoke(filesCopied, destFile.path)
                    }
                } catch (e: Exception) {
                    errors.add("Failed importing '$name': ${e.message}")
                }
            }
        }

        walk(rootDoc, destinationRoot)

        SyncResult(filesCopied, bytesCopied, errors)
    }

    /**
     * Copies all contents from sourceRoot (a real File dir) to the SAF tree URI,
     * overwriting any existing files/documents with the same relative path.
     */
    suspend fun exportToSAF(
        context: Context,
        sourceRoot: File,
        destinationUri: Uri,
        onProgress: ((Int, String) -> Unit)? = null
    ): SyncResult = withContext(Dispatchers.IO) {
        val errors = mutableListOf<String>()
        var filesCopied = 0
        var bytesCopied = 0L

        val rootDoc = DocumentFile.fromTreeUri(context, destinationUri)
            ?: return@withContext SyncResult(0, 0, listOf("Could not open SAF tree URI: $destinationUri"))

        if (!sourceRoot.exists() || !sourceRoot.isDirectory) {
            return@withContext SyncResult(0, 0, listOf("Source root does not exist: ${sourceRoot.path}"))
        }

        // Finds (or creates) the DocumentFile directory matching a relative path,
        // creating intermediate directories as needed.
        fun findOrCreateDir(parent: DocumentFile, name: String): DocumentFile {
            return parent.findFile(name)?.takeIf { it.isDirectory }
                ?: parent.createDirectory(name)
                ?: throw IllegalStateException("Could not create directory '$name' under ${parent.uri}")
        }

        // Finds (or creates+overwrites) the DocumentFile file matching a name under parent.
        fun findOrCreateFile(parent: DocumentFile, name: String, mimeType: String): DocumentFile {
            val existing = parent.findFile(name)
            if (existing != null && existing.isFile) {
                // Overwrite: truncate existing document by reopening its output stream.
                return existing
            }
            existing?.delete() // in case it's a stale directory with the same name
            return parent.createFile(mimeType, name)
                ?: throw IllegalStateException("Could not create file '$name' under ${parent.uri}")
        }

        fun walk(dir: File, destDoc: DocumentFile) {
            val children = dir.listFiles() ?: return
            for (child in children) {
                try {
                    if (child.isDirectory) {
                        val childDestDoc = findOrCreateDir(destDoc, child.name)
                        walk(child, childDestDoc)
                    } else {
                        val mimeType = guessMimeType(child.name)
                        val destFileDoc = findOrCreateFile(destDoc, child.name, mimeType)
                        context.contentResolver.openOutputStream(destFileDoc.uri, "wt")?.use { output ->
                            child.inputStream().use { input ->
                                bytesCopied += input.copyTo(output)
                            }
                        } ?: run {
                            errors.add("Could not open output stream for ${destFileDoc.uri}")
                            return@run
                        }
                        filesCopied++
                        onProgress?.invoke(filesCopied, child.path)
                    }
                } catch (e: Exception) {
                    errors.add("Failed exporting '${child.name}': ${e.message}")
                }
            }
        }

        walk(sourceRoot, rootDoc)

        SyncResult(filesCopied, bytesCopied, errors)
    }

    private fun guessMimeType(fileName: String): String {
        return when (fileName.substringAfterLast('.', "").lowercase()) {
            "txt", "md", "kt", "java", "py", "js", "ts", "json", "xml", "yml", "yaml",
            "gradle", "properties", "sh", "html", "css" -> "text/plain"
            "png" -> "image/png"
            "jpg", "jpeg" -> "image/jpeg"
            "zip" -> "application/zip"
            "pdf" -> "application/pdf"
            else -> "application/octet-stream"
        }
    }

    /**
     * Confirms the app still holds a persisted, active permission grant for [uri].
     * Call before offering Import/Export — hide/disable the actions if this returns false.
     */
    fun hasActivePersistedPermission(context: Context, uri: Uri): Boolean {
        return context.contentResolver.persistedUriPermissions.any {
            it.uri == uri && it.isReadPermission && it.isWritePermission
        }
    }
}
