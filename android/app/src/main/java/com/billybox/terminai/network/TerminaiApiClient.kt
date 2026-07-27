package com.billybox.terminai.network

import android.util.Log
import com.billybox.terminai.BuildConfig
import okhttp3.*
import okhttp3.logging.HttpLoggingInterceptor
import org.json.JSONObject
import java.io.IOException
import java.time.Duration

/**
 * TerminAI API Client — handles authenticated requests to the TerminAI backend.
 *
 * This client automatically includes the X-API-Key header in all requests.
 * The API key is read from BuildConfig.TERMINAI_API_KEY at build time.
 *
 * Usage:
 *   val client = TerminaiApiClient("http://10.0.2.2:3000")  // Android emulator localhost
 *   client.getSystemStats { result -> ... }
 */
class TerminaiApiClient(
    private val baseUrl: String,
    private val timeoutSeconds: Long = 30L
) {
    private val apiKey = BuildConfig.TERMINAI_API_KEY

    private val okHttpClient = OkHttpClient.Builder()
        .addInterceptor(HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BODY
            else HttpLoggingInterceptor.Level.NONE
        })
        .addInterceptor(ApiKeyInterceptor(apiKey))
        .callTimeout(Duration.ofSeconds(timeoutSeconds))
        .build()

    /**
     * Makes an authenticated GET request to the specified endpoint.
     *
     * @param endpoint The API endpoint path (e.g., "/api/system/stats")
     * @param callback Receives the result as a JSONObject on success, or an error message on failure
     */
    fun get(endpoint: String, callback: (Result<JSONObject>) -> Unit) {
        val request = Request.Builder()
            .url(baseUrl + endpoint)
            .get()
            .addHeader("Accept", "application/json")
            .build()

        okHttpClient.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e("TerminaiAPI", "Request failed: ${e.message}", e)
                callback(Result.failure(Exception("Network error: ${e.message}")))
            }

            override fun onResponse(call: Call, response: Response) {
                response.use {
                    val body = response.body?.string()
                    val result = if (response.isSuccessful) {
                        try {
                            Result.success(JSONObject(body ?: "{}"))
                        } catch (e: Exception) {
                            Log.e("TerminaiAPI", "Failed to parse response: $body", e)
                            Result.failure(Exception("Invalid response format"))
                        }
                    } else {
                        val errorBody = body ?: response.message
                        Log.w("TerminaiAPI", "Request failed with status ${response.code}: $errorBody")
                        Result.failure(ApiException(response.code, errorBody))
                    }
                    callback(result)
                }
            }
        })
    }

    /**
     * Convenience method for GET /api/system/stats
     */
    fun getSystemStats(callback: (Result<JSONObject>) -> Unit) {
        get("/api/system/stats", callback)
    }

    /**
     * Convenience method for GET /api/health
     */
    fun getHealth(callback: (Result<JSONObject>) -> Unit) {
        get("/api/health", callback)
    }
}

/**
 * Interceptor that adds the X-API-Key header to all requests.
 * If the API key is empty, the header is not added (request will fail with 401).
 */
class ApiKeyInterceptor(private val apiKey: String) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        
        if (apiKey.isEmpty()) {
            Log.w("TerminaiAPI", "API key is empty - requests will fail with 401 Unauthorized")
            return chain.proceed(original)
        }
        
        val request = original.newBuilder()
            .addHeader("X-API-Key", apiKey)
            .build()
        
        return chain.proceed(request)
    }
}

/**
 * Custom exception for API errors with status code and message.
 */
class ApiException(val statusCode: Int, message: String) : Exception(message)