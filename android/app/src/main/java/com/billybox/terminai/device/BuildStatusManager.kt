package com.billybox.terminai.device

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringSetPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.deviceDataStore by preferencesDataStore(name = "terminai_device")

class BuildStatusManager(private val context: Context) {

    private object Keys {
        val TELEMETRY_JSON = stringSetPreferencesKey("build_status_telemetry")
    }

    val telemetryJson: Flow<String?> = context.deviceDataStore.data
        .map { prefs -> prefs[Keys.TELEMETRY_JSON]?.lastOrNull() }

    suspend fun setTelemetryJson(value: String) {
        context.deviceDataStore.edit { prefs ->
            prefs[Keys.TELEMETRY_JSON] = setOf(value)
        }
    }
}
