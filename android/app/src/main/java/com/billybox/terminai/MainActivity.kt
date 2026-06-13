package com.billybox.terminai

import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.billybox.terminai.api.TerminaiApiBridge
import com.billybox.terminai.runtime.RuntimeManager
import com.billybox.terminai.runtime.RuntimeBundleVerifier

/**
 * TerminAI MainActivity — native Android host shell.
 *
 * One app. One dashboard. One runtime.
 * Package: com.billybox.terminai
 *
 * This is the first native host scaffold. The web prototype still lives at
 * the repo root. This native app is the future app container.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var runtimeManager: RuntimeManager
    private lateinit var bundleVerifier: RuntimeBundleVerifier
    private lateinit var apiBridge: TerminaiApiBridge

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Initialize native components
        runtimeManager = RuntimeManager(applicationContext)
        bundleVerifier = RuntimeBundleVerifier(applicationContext)
        apiBridge = TerminaiApiBridge(applicationContext)

        // Ensure runtime directories exist
        runtimeManager.ensureRuntimeDirectories()

        // Update UI
        updateStatusDisplay()

        // Wire buttons
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

        val mode = runtimeManager.getRuntimeMode()
        modeText.text = "Mode: $mode"

        val bundleReady = bundleVerifier.isBundleReady()
        bundleText.text = "Bundle: ${if (bundleReady) "ready" else "not ready"}"
        bundleText.setTextColor(
            if (bundleReady) getColor(R.color.terminai_success)
            else getColor(R.color.terminai_warning)
        )

        val integrity = bundleVerifier.verifyBundleIntegrity()
        integrityText.text = "Integrity: ${if (integrity.integrityOk) "OK" else if (integrity.placeholderMode) "placeholder" else "not checked"}"
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
        // TODO: Integrate WebView pointing to local server or bundled dashboard
        showDialog("Dashboard", "Dashboard integration coming soon.\n\nFor now, run the web prototype:\ncd /data/data/com.termux/files/home/Terminai && node server.ts")
    }

    private fun showDialog(title: String, message: String) {
        androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle(title)
            .setMessage(message)
            .setPositiveButton("OK", null)
            .show()
    }
}
