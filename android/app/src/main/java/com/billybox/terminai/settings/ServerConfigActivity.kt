package com.billybox.terminai.settings

import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.billybox.terminai.api.ApiClient
import com.billybox.terminai.api.ApiClientHolder
import com.billybox.terminai.api.apiService
import com.billybox.terminai.R
import kotlinx.coroutines.flow.first
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

class ServerConfigActivity : AppCompatActivity() {

    private lateinit var settings: SettingsManager
    private lateinit var hostInput: EditText
    private lateinit var portInput: EditText
    private lateinit var apiKeyInput: EditText
    private lateinit var statusText: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_server_config)

        settings = SettingsManager(applicationContext)
        hostInput = findViewById(R.id.et_host)
        portInput = findViewById(R.id.et_port)
        apiKeyInput = findViewById(R.id.et_api_key)
        statusText = findViewById(R.id.tv_connection_status)

        lifecycleScope.launch {
            val savedHost = settings.baseUrl.first()
            val savedKey = settings.apiKey.first()
            val host = savedHost.removePrefix("http://").removePrefix("https://").removeSuffix("/")
            val parts = host.split(":")
            hostInput.setText(parts.getOrNull(0) ?: "10.0.2.2")
            if (parts.size > 1) portInput.setText(parts[1]) else portInput.setText("3099")
            if (savedKey.isNotBlank()) apiKeyInput.setText(savedKey)
        }

        findViewById<Button>(R.id.btn_test_connection).setOnClickListener {
            testConnection()
        }

        findViewById<Button>(R.id.btn_save).setOnClickListener {
            saveSettings()
        }
    }

    private fun buildBaseUrl(): String {
        val host = hostInput.text.toString().trim().ifBlank { "10.0.2.2" }
        val port = portInput.text.toString().trim().ifBlank { "3099" }
        return "http://$host:$port"
    }

    private fun testConnection() {
        statusText.text = "Testing..."
        statusText.setTextColor(getColor(R.color.terminai_info))
        lifecycleScope.launch {
            try {
                ApiClientHolder.baseUrl = buildBaseUrl()
                ApiClientHolder.apiKey = apiKeyInput.text.toString()
                ApiClient.refreshBaseUrl()

                val response = apiService().health()
                statusText.text = "Connected: ${response.status}"
                statusText.setTextColor(getColor(R.color.terminai_success))
            } catch (e: Exception) {
                statusText.text = "Connection failed: ${e.message}"
                statusText.setTextColor(getColor(R.color.terminai_warning))
            }
        }
    }

    private fun saveSettings() {
        val baseUrl = buildBaseUrl()
        val apiKey = apiKeyInput.text.toString()
        lifecycleScope.launch {
            settings.setBaseUrl(baseUrl)
            settings.setApiKey(apiKey)
            ApiClientHolder.baseUrl = baseUrl
            ApiClientHolder.apiKey = apiKey
            ApiClient.refreshBaseUrl()
            statusText.text = "Saved"
            statusText.setTextColor(getColor(R.color.terminai_success))
        }
    }
}
