package com.billybox.terminai.api

import android.content.Context
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * TerminAI API Audit — native Android host.
 *
 * Writes JSONL audit events for every API bridge invocation.
 * One app. One dashboard. One runtime.
 */
class TerminaiApiAudit(private val context: Context) {

    private val auditFile: File
        get() = File(context.filesDir, "state/terminai_api_audit.jsonl")

    private val dateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
        timeZone = java.util.TimeZone.getTimeZone("UTC")
    }

    init {
        auditFile.parentFile?.mkdirs()
    }

    /**
     * Log an API invocation event.
     */
    fun log(capabilityId: String, action: String, status: String, message: String) {
        try {
            val event = mapOf(
                "timestamp" to dateFormat.format(Date()),
                "capabilityId" to capabilityId,
                "action" to action,
                "adapter" to "android-native",
                "status" to status,
                "message" to message.take(200) // Don't log huge payloads
            )
            val line = event.entries.joinToString(",", "{", "}") { (k, v) ->
                "\"$k\":\"${v.toString().replace("\"", "\\\"").replace("\n", "\\n")}\""
            }
            auditFile.appendText("$line\n")
        } catch (e: Exception) {
            // Audit logging should never crash the app
            android.util.Log.w("TerminaiApiAudit", "Failed to log audit event: ${e.message}")
        }
    }

    /**
     * Read recent audit events (last N).
     */
    fun readRecentEvents(count: Int = 20): List<String> {
        return try {
            if (!auditFile.exists()) return emptyList()
            val lines = auditFile.readLines().filter { it.isNotBlank() }
            lines.takeLast(count)
        } catch (e: Exception) {
            emptyList()
        }
    }

    /**
     * Get audit log file path.
     */
    fun getAuditLogPath(): String = auditFile.absolutePath

    /**
     * Get audit log file size.
     */
    fun getAuditLogSize(): Long = if (auditFile.exists()) auditFile.length() else 0
}
