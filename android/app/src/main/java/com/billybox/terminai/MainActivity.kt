package com.billybox.terminai

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION
import android.content.Intent.FLAG_GRANT_WRITE_URI_PERMISSION
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.billybox.terminai.api.TerminaiApiBridge
import com.billybox.terminai.api.TerminaiApiService
import com.billybox.terminai.api.CommandRequest
import com.billybox.terminai.api.apiService
import com.billybox.terminai.settings.ServerConfigActivity
import com.billybox.terminai.dashboard.DashboardActivity
import com.billybox.terminai.runtime.RuntimeManager
import com.billybox.terminai.runtime.RuntimeBundleVerifier
import com.billybox.terminai.settings.OnboardingActivity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
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
    private lateinit var commandInput: EditText
    private lateinit var backendOutput: TextView

    private val pickWorkspace = registerForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri ->
        uri?.let {
            try {
                contentResolver.takePersistableUriPermission(
                    it,
                    FLAG_GRANT_READ_URI_PERMISSION or FLAG_GRANT_WRITE_URI_PERMISSION
                )
                runtimeManager.setPersistedWorkspaceUri(it.toString())
                Toast.makeText(this, "Workspace folder saved", Toast.LENGTH_SHORT).show()
                updateStatusDisplay()
            } catch (e: Exception) {
                Toast.makeText(this, "Failed to access folder: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        runtimeManager = RuntimeManager(applicationContext)
        bundleVerifier = RuntimeBundleVerifier(applicationContext)
        apiBridge = TerminaiApiBridge(applicationContext)
        reportText = findViewById(R.id.tv_health_report)

        runtimeManager.ensureRuntimeDirectories()
        runtimeManager.ensureRuntimeExtracted(applicationContext)
        updateStatusDisplay()

        if (!runtimeManager.isFirstRunComplete()) {
            startActivity(Intent(this, OnboardingActivity::class.java))
            finish()
            return
        }

        commandInput = findViewById(R.id.et_backend_command)
        backendOutput = findViewById(R.id.tv_backend_output)

        findViewById<Button>(R.id.btn_run_health_check).setOnClickListener {
            runHealthCheck()
        }

        if (!runtimeManager.hasPersistedWorkspaceUri()) {
            showWorkspacePickerExplanation {
                pickWorkspace.launch(null)
            }
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

        findViewById<Button>(R.id.btn_open_server_config).setOnClickListener {
            startActivity(Intent(this, ServerConfigActivity::class.java))
        }

        findViewById<Button>(R.id.btn_run_backend_command).setOnClickListener {
            runBackendCommand()
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
            if (runtimeManager.hasPersistedWorkspaceUri()) {
                appendLine("Workspace SAF URI: ${runtimeManager.getPersistedWorkspaceUri()}")
            }
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
        startActivity(Intent(this, DashboardActivity::class.java))
    }

    private fun runBackendCommand() {
        val raw = commandInput.text.toString().trim()
        if (raw.isEmpty()) {
            Toast.makeText(this, "Enter a command", Toast.LENGTH_SHORT).show()
            return
        }
        backendOutput.text = "Sending: $raw"
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val response = apiService().execute(CommandRequest(raw))
                val output = buildString {
                    appendLine("Command: $raw")
                    if (!response.output.isNullOrBlank()) appendLine(response.output.trim())
                    if (!response.error.isNullOrBlank()) appendLine("err: ${response.error.trim()}")
                    appendLine("exitCode=${response.exitCode ?: "unknown"}")
                    if (response.truncated == true) appendLine("truncated=true")
                }.trim()
                withContext(Dispatchers.Main) {
                    backendOutput.text = output
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    backendOutput.text = "Failed: ${e.message}"
                }
            }
        }
    }

    private fun showDialog(title: String, message: String) {
        androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle(title)
            .setMessage(message)
            .setPositiveButton("OK", null)
            .show()
    }

    private fun showWorkspacePickerExplanation(onContinue: () -> Unit) {
        androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle("Workspace folder")
            .setMessage("TerminAI needs a folder to store workspaces and configuration. You can pick a shared folder now.")
            .setPositiveButton("Choose folder") { _, _ -> onContinue() }
            .setNegativeButton("Skip") { _, _ ->
                Toast.makeText(this, "You can pick a workspace folder later from settings", Toast.LENGTH_LONG).show()
            }
            .show()
    }

    private fun pickWorkspaceFolder() {
        pickWorkspace.launch(null)
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
