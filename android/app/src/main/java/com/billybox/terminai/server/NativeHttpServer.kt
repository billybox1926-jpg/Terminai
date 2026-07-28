package com.billybox.terminai.server

import android.content.Context
import android.os.Build
import android.util.Log
import fi.iki.elonen.NanoHTTPD
import org.json.JSONObject

class NativeHttpServer(private val context: Context, private val port: Int = 0) : NanoHTTPD(port) {

    private val TAG = "NativeHttpServer"
    private val startTime = System.currentTimeMillis()

    fun start() {
        start(SOCKET_READ_TIMEOUT, false)
        Log.i(TAG, "Server started on ${hostname}:${listeningPort}")
    }

    fun shutdown() {
        super.stop()
        Log.i(TAG, "Server stopped")
    }

    fun boundPort(): Int = listeningPort

    override fun serve(session: IHTTPSession): Response {
        val path = session.uri
        Log.d(TAG, "REQUEST ${session.method} $path")
        return when {
            path == "/api/health" && session.method == Method.GET -> newFixedLengthResponse(
                Response.Status.OK,
                MIME_PLAINTEXT,
                InputSource("ok")
            ).also { Log.i(TAG, "HEALTH 200 $path") }
            path == "/api/system/stats" && session.method == Method.GET -> {
                val am = context.getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager
                val memInfo = android.app.ActivityManager.MemoryInfo()
                am.getMemoryInfo(memInfo)
                val totalMem = memInfo.totalMem / (1024 * 1024)
                val availMem = memInfo.availMem / (1024 * 1024)
                val usedMem = totalMem - availMem
                val memUsage = if (totalMem > 0) usedMem.toDouble() / totalMem else 0.0
                val uptimeSec = (System.currentTimeMillis() - startTime) / 1000.0

                val body = JSONObject()
                    .put("platform", "android")
                    .put("device", Build.MODEL)
                    .put("manufacturer", Build.MANUFACTURER)
                    .put("memoryUsage", memUsage)
                    .put("uptime", uptimeSec)
                    .put("cwd", context.filesDir.absolutePath)
                    .toString()

                newFixedLengthResponse(Response.Status.OK, "application/json", InputSource(body))
                    .also { Log.i(TAG, "STATS 200 $path") }
            }
            else -> {
                Log.i(TAG, "FALLBACK 404 $path")
                newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_PLAINTEXT, "").also {
                    it.addHeader("Content-Type", "text/plain; charset=UTF-8")
                }
            }
        }
    }
}
