package com.billybox.terminai.server

import android.content.Context
import android.util.Log
import com.billybox.terminai.BuildConfig

class ServerController(private val context: Context) {
    private val server by lazy { NativeHttpServer(context) }

    private val TAG = "ServerController"
    private var boundPortValue: Int = -1

    fun startIfEnabled() {
        if (context.packageName != BuildConfig.APPLICATION_ID) {
            Log.w(TAG, "Skip server start: package mismatch")
            return
        }

        kotlin.concurrent.thread(name = "native-http-server") {
            try {
                server.start()
                val port = server.boundPort()
                boundPortValue = port
                Log.i(TAG, "Server started on 127.0.0.1:$port")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start native server", e)
            }
        }
    }

    fun stop() {
        try {
            server.shutdown()
        } catch (ignored: Exception) {
        } finally {
            boundPortValue = -1
        }
    }

    fun boundPort(): Int = boundPortValue
}
