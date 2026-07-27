package com.billybox.terminai.api

import android.util.Log
import com.billybox.terminai.BuildConfig
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory

object ApiClientHolder {
    @Volatile var baseUrl: String = "http://10.0.2.2:3099"
    @Volatile var apiKey: String = BuildConfig.TERMINAI_API_KEY.orEmpty()
}

class AuthInterceptor : Interceptor {
    override fun intercept(chain: Interceptor.Chain): okhttp3.Response {
        val key = ApiClientHolder.apiKey
        val request = if (key.isBlank()) {
            chain.request()
        } else {
            chain.request().newBuilder()
                .addHeader("X-API-Key", key)
                .build()
        }
        return chain.proceed(request)
    }
}

object ApiClient {
    private val moshi: Moshi = Moshi.Builder()
        .add(KotlinJsonAdapterFactory())
        .build()

    private val logging = HttpLoggingInterceptor { message ->
        android.util.Log.d("Retrofit", message)
    }.apply {
        level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BODY else HttpLoggingInterceptor.Level.NONE
    }

    private val okHttp = OkHttpClient.Builder()
        .addInterceptor(logging)
        .addInterceptor(AuthInterceptor())
        .build()

    @Volatile
    private var currentBaseUrl: String = sanitize(ApiClientHolder.baseUrl)

    @Volatile
    private var retrofit: Retrofit = Retrofit.Builder()
        .baseUrl(currentBaseUrl)
        .client(okHttp)
        .addConverterFactory(MoshiConverterFactory.create(moshi))
        .build()

    fun retrofit(): Retrofit = retrofit

    fun refreshBaseUrl() {
        val newBase = sanitize(ApiClientHolder.baseUrl)
        if (!newBase.equals(currentBaseUrl, ignoreCase = true)) {
            synchronized(this) {
                currentBaseUrl = newBase
                retrofit = Retrofit.Builder()
                    .baseUrl(currentBaseUrl)
                    .client(okHttp)
                    .addConverterFactory(MoshiConverterFactory.create(moshi))
                    .build()
            }
        }
    }

    private fun sanitize(url: String): String {
        val trimmed = url.trim()
        if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
            return "http://$trimmed/"
        }
        return if (trimmed.endsWith("/")) trimmed else "$trimmed/"
    }
}

interface TerminaiApiService {
    @GET("api/health")
    suspend fun health(): HealthResponse

    @POST("api/terminal/execute")
    suspend fun execute(@Body request: CommandRequest): CommandResponse

    @GET("api/system/stats")
    suspend fun systemStats(): SystemStatsResponse

    @GET("api/runtime/status")
    suspend fun runtimeStatus(): RuntimeStatusResponse
}

data class HealthResponse(
    val status: String
)

data class CommandRequest(
    val command: String
)

data class CommandResponse(
    val output: String?,
    val error: String?,
    val exitCode: Int?,
    val truncated: Boolean?
)

data class SystemStatsResponse(
    val platform: String?,
    val device: String?,
    val manufacturer: String?,
    val memoryUsage: Double?,
    val uptime: Double?
)

data class RuntimeStatusResponse(
    val runtimeReady: Boolean?,
    val installedCount: Int?,
    val requiredMissing: List<String>?,
    val bootstrapMode: String?
)

fun apiService(): TerminaiApiService = ApiClient.retrofit().create(TerminaiApiService::class.java)
