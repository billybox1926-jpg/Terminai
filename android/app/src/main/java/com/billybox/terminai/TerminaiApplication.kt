package com.billybox.terminai

import android.app.Application
import android.util.Log
import com.billybox.terminai.api.ApiClientHolder
import com.billybox.terminai.settings.SettingsManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.launch

class TerminaiApplication : Application() {
    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onCreate() {
        super.onCreate()
        appScope.launch {
            try {
                val settings = runCatching { SettingsManager(applicationContext) }.getOrNull() ?: return@launch
                val baseUrl = settings.baseUrl.firstOrNull().orEmpty()
                val apiKey = settings.apiKey.firstOrNull().orEmpty()
                if (baseUrl.isNotBlank()) {
                    ApiClientHolder.baseUrl = baseUrl
                }
                if (apiKey.isNotBlank()) {
                    ApiClientHolder.apiKey = apiKey
                }
            } catch (e: Exception) {
                Log.w("TerminaiApplication", "Settings hydration failed", e)
            }
        }
    }
}
