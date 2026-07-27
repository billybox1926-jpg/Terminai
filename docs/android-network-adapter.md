# Android Network Adapter

This note defines the behavior required to connect the native Android host to a TerminAI backend over LAN. It is intended as issue-local documentation for issue #70 and as implementation guidance for PR #83.

## Requirements

1. **Config surface**
   - Provide user-editable `BACKEND_HOST` and `BACKEND_PORT` values inside the app.
   - Persist values with `SharedPreferences` or `DataStore`.
   - Apply the values to all server-bound network calls.

2. **Network adapter**
   - Build the API base URL from the configured host and port as `http://$host:$port`.
   - Use this base URL in the HTTP client / API bridge so the app does not hardcode `localhost`.

3. **Auth headers**
   - Read `TERMINAI_API_KEY` from app config or build/runtime config.
   - Inject it on every request as an API key header.
   - Support `X-API-Key`, and prefer `Authorization: Bearer ...` when configured.

4. **Documentation**
   - Document that the device and server must be on the same network.
   - Explain how to determine the server's local IP.

## Suggested Layout

This repo currently stores native host code in `android/app/src/main/...`. Missing pieces for this feature should be added there, with tests/smokes under `android/src/[type]/Test...` as needed.

- `android/app/src/main/java/com/billybox/terminai/settings/ServerSettingsActivity.kt`
- `android/app/src/main/java/com/billybox/terminai/settings/ServerSettingsFragment.kt`
- `android/app/src/main/res/xml/server_preferences.xml`
- `android/app/src/main/java/com/billybox/terminai/network/TerminaiRetrofitClient.kt`
- `android/app/src/main/java/com/billybox/terminai/network/ServerConfig.kt`

## ServerConfig Example

Create a small config object that owns the current backend settings and a single source of truth for the base URL.

```kotlin
class ServerConfig(context: Context) {
    private val prefs = context.getSharedPreferences("server_prefs", Context.MODE_PRIVATE)

    var host: String
        get() = prefs.getString("backend_host", "127.0.0.1") ?: "127.0.0.1"
        set(value) = prefs.edit().putString("backend_host", value).apply()

    var port: String
        get() = prefs.getString("backend_port", "3000") ?: "3000"
        set(value) = prefs.edit().putString("backend_port", value).apply()

    var apiKey: String?
        get() = prefs.getString("backend_api_key", null)
        set(value) = prefs.edit().putString("backend_api_key", value).apply()

    val baseUrl: String
        get() {
            val trimmedHost = host.trim().ifEmpty { "127.0.0.1" }
            val trimmedPort = port.trim().ifEmpty { "3000" }
            return "http://$trimmedHost:$trimmedPort".also {
                if (!Uri.parse(it).isHierarchical) {
                    throw IllegalArgumentException("Invalid backend base URL: $it")
                }
            }
        }
}
```

## Retrofit Client Example

Use the config object to construct `OkHttpClient` and `Retrofit` rather than hardcoding `http://10.0.2.2:3000` or `localhost`.

```kotlin
object TerminaiRetrofitClient {
    fun create(context: Context): TerminaiApiService {
        val config = ServerConfig(context)
        val apiKey = config.apiKey?.ifBlank { null }

        val client = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .addInterceptor { chain ->
                val original = chain.request()
                val builder = original.newBuilder()

                if (!apiKey.isNullOrBlank()) {
                    val scheme = original.header("Authorization").isNullOrBlank()
                    builder.header("X-API-Key", apiKey)
                    if (scheme) {
                        builder.header("Authorization", "Bearer $apiKey")
                    }
                }

                builder.method(original.method, original.body)
                chain.proceed(builder.build())
            }
            .build()

        return Retrofit.Builder()
            .baseUrl(config.baseUrl)
            .client(client)
            .addConverterFactory(MoshiConverterFactory.create())
            .build()
            .create(TerminaiApiService::class.java)
    }
}
```

## Preferences XML Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<PreferenceScreen xmlns:android="http://schemas.android.com/apk/res/android">
    <EditTextPreference
        android:key="backend_host"
        android:title="Backend host"
        android:summary="LAN IP of the TerminAI backend, for example 192.168.1.50"
        android:inputType="textNoSuggestions" />
    <EditTextPreference
        android:key="backend_port"
        android:title="Backend port"
        android:summary="Port the backend is listening on, default 3000"
        android:inputType="number" />
    <EditTextPreference
        android:key="backend_api_key"
        android:title="API key"
        android:summary="Optional TERMINAI_API_KEY"
        android:inputType="textPassword" />
</PreferenceScreen>
```

## Health Check Integration

In `MainActivity` or the dashboard, expose a simple connectivity check so the user can verify LAN pairing without leaving the app.

```kotlin
suspend fun checkServerHealth(context: Context): HealthResult = withContext(Dispatchers.IO) {
    return@withContext try {
        val service = TerminaiRetrofitClient.create(context)
        val response = service.health().execute()
        if (response.isSuccessful) {
            HealthResult.Reachable(response.body()?.status)
        } else {
            HealthResult.Unreachable("HTTP ${response.code()}")
        }
    } catch (e: IOException) {
        HealthResult.Unreachable(e.message ?: "Network error")
    }
}
```

## LAN Setup Notes

- The Android device and the TerminAI backend must be on the same Wi-Fi/LAN.
- Start the backend with `TERMINAI_BIND_ADDRESS=0.0.0.0` so it listens on all interfaces, not only `127.0.0.1`.
- Find the local IP on the backend host:
  - macOS/Linux/WSL: `ipconfig getifaddr en0`, `hostname -I`, or `ifconfig`
  - Windows: `ipconfig`
- Use the IP and the backend port in the Android settings.

## Acceptance Criteria

- [ ] Settings screen hosts `BACKEND_HOST`, `BACKEND_PORT`, and optional API key fields.
- [ ] Retrofit/OkHttp uses the configured host and port instead of a hardcoded localhost URL.
- [ ] App applies an API key header, with `X-API-Key` and, where applicable, `Authorization: Bearer`.
- [ ] README or docs include LAN setup instructions and local IP discovery guidance.
