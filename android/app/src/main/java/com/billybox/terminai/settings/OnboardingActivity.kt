package com.billybox.terminai.settings

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.widget.Button
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.billybox.terminai.MainActivity
import com.billybox.terminai.R
import com.billybox.terminai.runtime.RuntimeManager

class OnboardingActivity : AppCompatActivity() {

    private lateinit var runtimeManager: RuntimeManager

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { _ -> proceedToMain() }

    private val pickWorkspace = registerForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri ->
        uri?.let {
            try {
                contentResolver.takePersistableUriPermission(
                    it,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                )
                runtimeManager.setPersistedWorkspaceUri(it.toString())
            } catch (e: Exception) {
                // best-effort; default workspace remains available
            }
        }
        proceedToMain()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_onboarding)

        runtimeManager = RuntimeManager(applicationContext)
        runtimeManager.ensureRuntimeDirectories()

        findViewById<Button>(R.id.btn_proceed).setOnClickListener {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                notificationPermissionLauncher.launch(android.Manifest.permission.POST_NOTIFICATIONS)
            } else {
                proceedToMain()
            }
        }

        findViewById<Button>(R.id.btn_pick_workspace).setOnClickListener {
            pickWorkspace.launch(null)
        }

        findViewById<Button>(R.id.btn_skip).setOnClickListener {
            proceedToMain()
        }
    }

    private fun proceedToMain() {
        runtimeManager.markFirstRunComplete()
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }
}
