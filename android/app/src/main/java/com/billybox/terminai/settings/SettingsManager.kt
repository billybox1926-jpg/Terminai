package com.billybox.terminai.settings

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "terminai_settings")

class SettingsManager(private val context: Context) {

    private object Keys {
        val BASE_URL = stringPreferencesKey("base_url")
        val API_KEY = stringPreferencesKey("api_key")
    }

    val baseUrl: Flow<String> = context.dataStore.data
        .map { prefs -> prefs[Keys.BASE_URL].orEmpty() }

    val apiKey: Flow<String> = context.dataStore.data
        .map { prefs -> prefs[Keys.API_KEY].orEmpty() }

    suspend fun setBaseUrl(value: String) {
        context.dataStore.edit { prefs -> prefs[Keys.BASE_URL] = value }
    }

    suspend fun setApiKey(value: String) {
        context.dataStore.edit { prefs -> prefs[Keys.API_KEY] = value }
    }
}
