package com.billybox.terminai.dashboard

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.os.Bundle
import android.util.Log
import android.view.View
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.appcompat.app.AppCompatActivity
import com.billybox.terminai.TerminaiApplication
import com.billybox.terminai.R

@SuppressLint("SetJavaScriptEnabled")
class DashboardActivity : AppCompatActivity() {

    private var nativeServer: com.billybox.terminai.server.ServerController? = null
    private var webView: WebView? = null

    @Suppress("DEPRECATION")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        Log.i(TAG, "DASHBOARD onCreate")

        webView = WebView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            // Security: restrict to local-only server context.
            isSaveEnabled = true
            webViewClient = dashboardWebViewClient()
            webChromeClient = object : WebChromeClient() {
                override fun onProgressChanged(view: WebView?, newProgress: Int) {
                    if (newProgress == 100) {
                        Log.i(TAG, "DASHBOARD load finished")
                    }
                }
            }
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.blockNetworkImage = false
        }

        setContentView(webView)
        loadDashboard()
    }

    private fun loadDashboard() {
        nativeServer = (application as TerminaiApplication).nativeHttpServer
        val port = nativeServer?.boundPort() ?: 0
        val url = if (port > 0) "http://127.0.0.1:$port/" else null

        if (url == null) {
            Log.w(TAG, "DASHBOARD local server not running")
            webView?.loadData(
                dashboardOfflineHtml("Dashboard unavailable — local server not running."),
                "text/html",
                Charsets.UTF_8.name()
            )
            return
        }

        webView?.loadUrl(url)
    }

    private fun dashboardWebViewClient(): WebViewClient {
        return object : WebViewClient() {
            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                if (request?.isForMainFrame == true) {
                    Log.w(TAG, "DASHBOARD error: url=${request.url} description=${error?.description}")
                    showDashboardError("Connection failed: ${error?.description ?: "unknown"}")
                }
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                Log.d(TAG, "DASHBOARD loading: url=$url")
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                Log.i(TAG, "DASHBOARD loaded: url=$url")
            }

            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?
            ): android.webkit.WebResourceResponse? {
                val requestUrl = request?.url?.toString()
                if (requestUrl != null && !requestUrl.startsWith("http://127.0.0.1:")) {
                    Log.w(TAG, "DASHBOARD blocked non-local url=$requestUrl")
                    showDashboardError("Blocked: only local dashboard URLs are allowed")
                    return defaultBlockedResponse()
                }
                return super.shouldInterceptRequest(view, request)
            }
        }
    }

    private fun showDashboardError(message: String) {
        webView?.loadData(
            dashboardOfflineHtml(message),
            "text/html",
            Charsets.UTF_8.name()
        )
    }

    private fun defaultBlockedResponse(): android.webkit.WebResourceResponse? {
        val mime = "text/plain"
        val encoding = Charsets.UTF_8.name()
        val stream = "Blocked".byteInputStream(Charsets.UTF_8)
        return android.webkit.WebResourceResponse(mime, encoding, stream)
    }

    private fun dashboardOfflineHtml(message: String): String {
        return """
            <html>
              <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>Terminai Dashboard</title>
                <style>
                  body { font-family: sans-serif; padding: 24px; color: #fff; background:#101014; }
                  .card { background:#1c1c22; border-radius:12px; padding:20px; }
                </style>
              </head>
              <body>
                <div class="card">
                  <h1>Dashboard unavailable</h1>
                  <p>$message</p>
                  <p>Start the local server from the main Terminai shell, then reopen this activity.</p>
                </div>
              </body>
            </html>
        """.trimIndent()
    }

    override fun onDestroy() {
        super.onDestroy()
        webView?.destroy()
        webView = null
    }

    companion object {
        private const val TAG = "DashboardActivity"
    }
}
