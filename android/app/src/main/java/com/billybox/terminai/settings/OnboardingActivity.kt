package com.billybox.terminai.settings

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import androidx.appcompat.app.AppCompatActivity
import com.billybox.terminai.MainActivity
import com.billybox.terminai.R
import com.billybox.terminai.runtime.RuntimeManager

class OnboardingActivity : AppCompatActivity() {

    private lateinit var runtimeManager: RuntimeManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_onboarding)
        runtimeManager = RuntimeManager(applicationContext)
        runtimeManager.ensureRuntimeDirectories()
        runtimeManager.markFirstRunComplete()

        findViewById<Button>(R.id.btn_get_started).setOnClickListener {
            startActivity(Intent(this, MainActivity::class.java))
            finish()
        }

        findViewById<Button>(R.id.btn_skip).setOnClickListener {
            startActivity(Intent(this, MainActivity::class.java))
            finish()
        }
    }
}
