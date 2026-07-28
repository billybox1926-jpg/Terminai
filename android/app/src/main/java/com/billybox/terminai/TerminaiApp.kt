package com.billybox.terminai

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.util.Log
import com.billybox.terminai.api.ApiClientHolder
import com.billybox.terminai.settings.SettingsManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class TerminaiApp : Application() {

    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onCreate() {
        super.onCreate()
        instance = this

        createNotificationChannel()
        hydrateBackendSettings()
    }

    private fun hydrateBackendSettings() {
        appScope.launch {
            try {
                val settings = SettingsManager(applicationContext)
                val baseUrl = settings.baseUrl.first().trim()
                val apiKey = settings.apiKey.first().trim()
                if (baseUrl.isNotBlank()) {
                    ApiClientHolder.baseUrl = baseUrl
                }
                if (apiKey.isNotBlank()) {
                    ApiClientHolder.apiKey = apiKey
                }
            } catch (e: Exception) {
                Log.w("TerminaiApp", "hydrateBackendSettings failed", e)
            }
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "TerminAI runtime",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Runtime status and command results"
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    companion object {
        const val CHANNEL_ID = "terminai_runtime"
        lateinit var instance: TerminaiApp
            private set
    }
}
