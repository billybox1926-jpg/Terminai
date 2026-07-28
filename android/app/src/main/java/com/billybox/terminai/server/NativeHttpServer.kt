package com.billybox.terminai.server

import android.content.Context
import android.util.Log
import fi.iki.elonen.NanoHTTPD
import java.io.File
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URLEncoder

class NativeHttpServer(private val context: Context, private val port: Int = 0) : NanoHTTPD(port) {

    private val TAG = "NativeHttpServer"

    fun start() {
        start(SOCKET_READ_TIMEOUT, false)
        Log.i(TAG, "Server started on ${hostname}:${listeningPort}")
    }

    fun stop() {
        stop()
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
            else -> {
                Log.i(TAG, "FALLBACK 404 $path")
                newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_PLAINTEXT, "").also {
                    it.addHeader("Content-Type", "text/plain; charset=UTF-8")
                }
            }
        }
    }
}
