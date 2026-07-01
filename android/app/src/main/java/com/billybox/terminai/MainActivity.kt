package com.billybox.terminai

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.billybox.terminai.api.TerminaiApiBridge
import com.billybox.terminai.runtime.RuntimeManager
import com.billybox.terminai.runtime.RuntimeBundleVerifier
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * TerminAI MainActivity — native Android host shell.
 *
 * One app. One dashboard. One runtime.
 * Package: com.billybox.terminai
 */
class MainActivity : AppCompatActivity() {

    private lateinit var runtimeManager: RuntimeManager
    private lateinit var bundleVerifier: RuntimeBundleVerifier
    private lateinit var apiBridge: TerminaiApiBridge

    private var lastHealthReport: String = ""
    private lateinit var reportText: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        runtimeManager = RuntimeManager(applicationContext)
        bundleVerifier = RuntimeBundleVerifier(applicationContext)
        apiBridge = TerminaiApiBridge(applicationContext)
        reportText = findViewById(R.id.tv_health_report)

        runtimeManager.ensureRuntimeDirectories()
        updateStatusDisplay()

        findViewById<Button>(R.id.btn_run_health_check).setOnClickListener {
            runHealthCheck()
        }

        findViewById<Button>(R.id.btn_copy_report).setOnClickListener {
            copyReport()
        }

        findViewById<Button>(R.id.btn_share_report).setOnClickListener {
            shareReport()
        }

        findViewById<Button>(R.id.btn_check_runtime_bundle).setOnClickListener {
            checkRuntimeBundle()
        }

        findViewById<Button>(R.id.btn_verify_runtime_integrity).setOnClickListener {
            verifyRuntimeIntegrity()
        }

        findViewById<Button>(R.id.btn_api_bridge_status).setOnClickListener {
            showApiBridgeStatus()
        }

        findViewById<Button>(R.id.btn_open_dashboard).setOnClickListener {
            openDashboard()
        }
    }

    private fun updateStatusDisplay() {
        val modeText = findViewById<TextView>(R.id.tv_runtime_mode)
        val bundleText = findViewById<TextView>(R.id.tv_bundle_status)
        val integrityText = findViewById<TextView>(R.id.tv_integrity)
        val apiText = findViewById<TextView>(R.id.tv_api_bridge)
        val firstRunText = findViewById<TextView>(R.id.tv_first_run)
        val identityText = findViewById<TextView>(R.id.tv_identity_status)
        val pathsText = findViewById<TextView>(R.id.tv_path_status)

        val appInfo = appInfo()
        identityText.text = buildString {
            appendLine("App: ${appInfo.label} ${appInfo.versionName} (${appInfo.versionCode})")
            appendLine("Package: ${appInfo.packageName}")
            appendLine("Android SDK/API: ${Build.VERSION.SDK_INT}")
            append("Device: ${Build.MANUFACTURER} ${Build.MODEL}")
        }

        pathsText.text = buildString {
            appendLine("Runtime root: ${runtimeManager.runtimeRoot.absolutePath}")
            appendLine("Workspace root: ${runtimeManager.workspaceRoot.absolutePath}")
            appendLine("State root: ${runtimeManager.stateDir.absolutePath}")
            append("Timestamp: ${nowIsoUtc()}")
        }

        val mode = runtimeManager.getRuntimeMode()
        modeText.text = "Mode: $mode"

        val bundleReady = bundleVerifier.isBundleReady()
        bundleText.text = "Bundle: ${if (bundleReady) "ready" else "not ready"}"
        bundleText.setTextColor(
            if (bundleReady) getColor(R.color.terminai_success)
            else getColor(R.color.terminai_warning)
        )

        val integrity = bundleVerifier.verifyBundleIntegrity()
        integrityText.text = "Integrity: ${if (integrity.integrityOk) "OK" else if (integrity.placeholderMode) "placeholder" else "issues found"}"
        integrityText.setTextColor(
            when {
                integrity.integrityOk -> getColor(R.color.terminai_success)
                integrity.placeholderMode -> getColor(R.color.terminai_info)
                else -> getColor(R.color.terminai_warning)
            }
        )

        apiText.text = "API Bridge: ${apiBridge.getAdapterMode()}"

        val firstRunDone = runtimeManager.isFirstRunComplete()
        firstRunText.text = "First Run: ${if (firstRunDone) "complete" else "pending"}"
    }

    private fun runHealthCheck() {
        runtimeManager.ensureRuntimeDirectories()
        val report = buildHealthReport()
        lastHealthReport = report.toString(2)

        val reportFile = File(runtimeManager.stateDir, HEALTH_REPORT_FILE)
        reportFile.writeText(lastHealthReport)

        reportText.text = buildString {
            appendLine("Last health check: ${nowIsoUtc()}")
            appendLine("Report file: ${reportFile.absolutePath}")
            appendLine()
            append(lastHealthReport)
        }
        runtimeManager.markFirstRunComplete()
        updateStatusDisplay()
        Toast.makeText(this, "Health report written", Toast.LENGTH_SHORT).show()
    }

    private fun buildHealthReport(): JSONObject {
        val appInfo = appInfo()
        val integrity = bundleVerifier.verifyBundleIntegrity()
        val bridge = apiBridge.getBridgeStatus()

        return JSONObject()
            .put("packageName", appInfo.packageName)
            .put("appVersionName", appInfo.versionName)
            .put("appVersionCode", appInfo.versionCode)
            .put("androidSdk", Build.VERSION.SDK_INT)
            .put("manufacturer", Build.MANUFACTURER)
            .put("model", Build.MODEL)
            .put("runtimeRootExists", runtimeManager.runtimeRoot.exists())
            .put("workspaceRootExists", runtimeManager.workspaceRoot.exists())
            .put("stateRootExists", runtimeManager.stateDir.exists())
            .put("runtimeBundleStatus", JSONObject()
                .put("ready", bundleVerifier.isBundleReady())
                .put("integrityOk", integrity.integrityOk)
                .put("placeholderMode", integrity.placeholderMode)
                .put("lockFilePresent", integrity.lockFilePresent)
                .put("fileCountExpected", integrity.fileCountExpected)
                .put("fileCountActual", integrity.fileCountActual)
                .put("notes", integrity.notes))
            .put("apiBridgeStatus", JSONObject()
                .put("adapter", bridge.adapter)
                .put("total", bridge.total)
                .put("available", bridge.available)
                .put("simulated", bridge.simulated)
                .put("unavailable", bridge.unavailable)
                .put("blockedCount", bridge.blockedCount))
            .put("generatedAt", nowIsoUtc())
    }

    private fun copyReport() {
        val report = currentReportOrWarn() ?: return
        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText("TerminAI health report", report))
        Toast.makeText(this, "Health report copied", Toast.LENGTH_SHORT).show()
    }

    private fun shareReport() {
        val report = currentReportOrWarn() ?: return
        val shareIntent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, "TerminAI health report")
            putExtra(Intent.EXTRA_TEXT, report)
        }
        startActivity(Intent.createChooser(shareIntent, "Share TerminAI health report"))
    }

    private fun currentReportOrWarn(): String? {
        if (lastHealthReport.isBlank()) {
            val reportFile = File(runtimeManager.stateDir, HEALTH_REPORT_FILE)
            if (reportFile.exists()) {
                lastHealthReport = reportFile.readText()
            }
        }
        if (lastHealthReport.isBlank()) {
            Toast.makeText(this, "Run Health Check first", Toast.LENGTH_SHORT).show()
            return null
        }
        return lastHealthReport
    }

    private fun checkRuntimeBundle() {
        val manifest = runtimeManager.readRuntimeBundleManifest()
        val message = if (manifest != null) {
            "Bundle: ${manifest.bundleName} v${manifest.bundleVersion}\nMode: ${runtimeManager.getRuntimeMode()}"
        } else {
            "No bundle manifest found. Placeholder mode."
        }
        showDialog("Runtime Bundle", message)
    }

    private fun verifyRuntimeIntegrity() {
        val result = bundleVerifier.verifyBundleIntegrity()
        val message = buildString {
            appendLine("Integrity: ${if (result.integrityOk) "OK" else "issues found"}")
            appendLine("Files: ${result.fileCountActual}/${result.fileCountExpected}")
            if (result.missingFiles.isNotEmpty()) appendLine("Missing: ${result.missingFiles.size}")
            if (result.changedFiles.isNotEmpty()) appendLine("Changed: ${result.changedFiles.size}")
            if (result.extraFiles.isNotEmpty()) appendLine("Extra: ${result.extraFiles.size}")
            appendLine()
            append(result.notes)
        }
        showDialog("Runtime Integrity", message)
    }

    private fun showApiBridgeStatus() {
        val status = apiBridge.getBridgeStatus()
        val message = buildString {
            appendLine("Adapter: ${status.adapter}")
            appendLine("Total: ${status.total}")
            appendLine("Available: ${status.available}")
            appendLine("Simulated: ${status.simulated}")
            appendLine("Unavailable: ${status.unavailable}")
            appendLine("Blocked: ${status.blockedCount}")
        }
        showDialog("API Bridge", message)
    }

    private fun openDashboard() {
        showDialog(
            "Dashboard",
            "Dashboard integration coming soon.\n\nFor now, this native app proves the app-owned runtime, workspace, state, and API bridge status."
        )
    }

    private fun showDialog(title: String, message: String) {
        androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle(title)
            .setMessage(message)
            .setPositiveButton("OK", null)
            .show()
    }

    @Suppress("DEPRECATION")
    private fun appInfo(): AppInfo {
        val packageInfo = packageManager.getPackageInfo(packageName, 0)
        val applicationLabel = packageManager.getApplicationLabel(applicationInfo).toString()
        val versionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            packageInfo.longVersionCode
        } else {
            packageInfo.versionCode.toLong()
        }
        return AppInfo(
            label = applicationLabel,
            packageName = packageName,
            versionName = packageInfo.versionName ?: "unknown",
            versionCode = versionCode
        )
    }

    private fun nowIsoUtc(): String {
        return SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.format(Date())
    }

    private data class AppInfo(
        val label: String,
        val packageName: String,
        val versionName: String,
        val versionCode: Long
    )

    companion object {
        private const val HEALTH_REPORT_FILE = "terminai-health-report.json"
    }
}
