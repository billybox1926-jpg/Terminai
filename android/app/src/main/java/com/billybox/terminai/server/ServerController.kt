package com.billybox.terminai.server

import android.content.Context
import android.util.Log
import com.billybox.terminai.BuildConfig

class ServerController(private val context: Context) {
    private val server by lazy { NativeHttpServer(context) }

    fun startIfEnabled() {
        if (context.packageName != BuildConfig.APPLICATION_ID) {
            Log.w("ServerController", "Skip server start: package mismatch")
            return
        }

        kotlin.concurrent.thread(name = "native-http-server") {
            try {
                server.start()
            } catch (e: Exception) {
                Log.e("ServerController", "Failed to start native server", e)
            }
        }
    }

    fun stop() {
        try {
            server.stop()
        } catch (ignored: Exception) {
        }
    }
}
