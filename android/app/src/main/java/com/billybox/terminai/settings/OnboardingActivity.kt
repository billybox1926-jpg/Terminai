package com.billybox.terminai.settings

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.billybox.terminai.MainActivity
import com.billybox.terminai.R
import com.billybox.terminai.runtime.RuntimeManager

class OnboardingActivity : AppCompatActivity() {

    private lateinit var runtimeManager: RuntimeManager

    private val requestNotificationPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            Toast.makeText(this, "Notifications enabled", Toast.LENGTH_SHORT).show()
        } else {
            Toast.makeText(this, "Notifications disabled; runtime updates may be limited", Toast.LENGTH_LONG).show()
        }
        proceedToMain()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_onboarding)
        runtimeManager = RuntimeManager(applicationContext)
        runtimeManager.ensureRuntimeDirectories()

        findViewById<Button>(R.id.btn_get_started).setOnClickListener {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                requestNotificationPermission.launch(android.Manifest.permission.POST_NOTIFICATIONS)
            } else {
                proceedToMain()
            }
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
