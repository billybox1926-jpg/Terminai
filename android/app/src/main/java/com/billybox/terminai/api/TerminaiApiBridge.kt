package com.billybox.terminai.api

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import com.billybox.terminai.runtime.RuntimeManager

/**
 * TerminAI API Bridge — native Android adapter.
 *
 * One internal API bridge. Not separate companion apps.
 * Maps to runtime/api-bridge-contract.json invocation categories.
 *
 * Adapter modes:
 * - simulated: web prototype (Node.js)
 * - android-native: this adapter (future native app)
 *
 * Blocked until explicit runtime permission flow:
 * - camera, microphone, location
 */
class TerminaiApiBridge(private val context: Context) {

    private val runtimeManager = RuntimeManager(context)
    private val audit = TerminaiApiAudit(context)

    companion object {
        const val ADAPTER_NAME = "android-native"

        // Blocked capabilities — require native permission flow
        val BLOCKED_CAPABILITIES = setOf("camera", "microphone", "location")
    }

    /**
     * Get the current adapter mode.
     */
    fun getAdapterMode(): String = ADAPTER_NAME

    /**
     * Get bridge status summary.
     */
    fun getBridgeStatus(): BridgeStatus {
        return BridgeStatus(
            adapter = ADAPTER_NAME,
            total = 15, // from api-baseline.json
            available = 2, // storage, script-shortcuts
            simulated = 7, // battery, clipboard, notifications, intents, vibration, network, sensors
            unavailable = 6, // camera, mic, location, file-picker, boot-startup (partial)
            blockedCount = BLOCKED_CAPABILITIES.size
        )
    }

    /**
     * Invoke a capability action.
     * All invocations are audited.
     */
    fun invoke(capabilityId: String, action: String, payload: Map<String, Any?> = emptyMap()): InvokeResult {
        // Check blocked
        if (capabilityId in BLOCKED_CAPABILITIES) {
            val result = InvokeResult(false, "blocked", null, "Capability '$capabilityId' is blocked until native permission flow exists.")
            audit.log(capabilityId, action, "blocked", result.message)
            return result
        }

        // Dispatch
        val result = when ("$capabilityId:$action") {
            "battery:read" -> batteryRead()
            "clipboard:read" -> clipboardRead()
            "clipboard:write" -> clipboardWrite(payload)
            "notifications:send" -> notificationSend(payload)
            "storage:status" -> storageStatus()
            "intent-open-url:validate" -> intentValidate(payload)
            "intent-send:validate" -> intentValidate(payload)
            "vibration:pulse" -> vibrationPulse(payload)
            "network-info:read" -> networkInfoRead()
            "sensors:snapshot" -> sensorSnapshot()
            "boot-startup:status" -> bootStartupStatus()
            "file-picker:status" -> filePickerStatus()
            "script-shortcuts:list" -> scriptShortcutsList()
            else -> InvokeResult(false, "error", null, "Unknown capability:action '$capabilityId:$action'")
        }

        audit.log(capabilityId, action, result.status, result.message)
        return result
    }

    // ── Capability handlers ────────────────────────────────────────────

    private fun batteryRead(): InvokeResult {
        // TODO: Use BatteryManager for real battery status
        return InvokeResult(true, "simulated", mapOf(
            "level" to 82,
            "temperature" to "28.5 °C",
            "isCharging" to false,
            "source" to "simulated"
        ), "Battery status (simulated). Use BatteryManager for real data.")
    }

    private fun clipboardRead(): InvokeResult {
        return InvokeResult(true, "simulated", mapOf(
            "content" to "TerminAI clipboard placeholder",
            "source" to "simulated"
        ), "Clipboard read (simulated). Use ClipboardManager for real data.")
    }

    private fun clipboardWrite(payload: Map<String, Any?>): InvokeResult {
        val content = payload["content"] as? String ?: ""
        return InvokeResult(true, "simulated", mapOf(
            "content" to content,
            "source" to "simulated"
        ), "Clipboard write (simulated). Use ClipboardManager for real data.")
    }

    private fun notificationSend(payload: Map<String, Any?>): InvokeResult {
        // TODO: Use NotificationManager for real notifications
        return InvokeResult(true, "simulated", mapOf(
            "sent" to false,
            "title" to (payload["title"] ?: "TerminAI"),
            "body" to (payload["body"] ?: "Test notification")
        ), "Native notification bridge not yet active. Notification logged.")
    }

    private fun storageStatus(): InvokeResult {
        return InvokeResult(true, "ok", mapOf(
            "workspaceRoot" to runtimeManager.workspaceRoot.absolutePath,
            "runtimeRoot" to runtimeManager.runtimeRoot.absolutePath,
            "stateDir" to runtimeManager.stateDir.absolutePath
        ), "Storage status.")
    }

    private fun intentValidate(payload: Map<String, Any?>): InvokeResult {
        val url = payload["url"] as? String ?: ""
        val valid = url.startsWith("http://") || url.startsWith("https://") || url.startsWith("intent://")
        return InvokeResult(true, "simulated", mapOf("url" to url, "valid" to valid),
            if (valid) "URL format valid." else "Invalid URL format.")
    }

    private fun vibrationPulse(payload: Map<String, Any?>): InvokeResult {
        val pattern = (payload["pattern"] as? List<*>)?.mapNotNull { (it as? Number)?.toLong() } ?: listOf(200L)
        return try {
            val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val manager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                manager.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(pattern.toLongArray(), -1))
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(pattern.toLongArray(), -1)
            }
            InvokeResult(true, "ok", mapOf("pattern" to pattern), "Vibration executed.")
        } catch (e: Exception) {
            InvokeResult(true, "simulated", mapOf("pattern" to pattern), "Vibration simulated: ${e.message}")
        }
    }

    private fun networkInfoRead(): InvokeResult {
        return InvokeResult(true, "simulated", mapOf(
            "platform" to "Android ${Build.VERSION.RELEASE}",
            "device" to Build.MODEL,
            "manufacturer" to Build.MANUFACTURER,
            "source" to "simulated"
        ), "Network info (simulated). Use ConnectivityManager for real data.")
    }

    private fun sensorSnapshot(): InvokeResult {
        return InvokeResult(true, "simulated", mapOf(
            "accelerometer" to mapOf("x" to 0, "y" to 0, "z" to 9.8),
            "gyroscope" to mapOf("x" to 0, "y" to 0, "z" to 0),
            "light" to 200,
            "proximity" to 5,
            "source" to "simulated"
        ), "Sensor data is simulated. Native sensor bridge not yet active.")
    }

    private fun bootStartupStatus(): InvokeResult {
        return InvokeResult(true, "simulated", mapOf("enabled" to false),
            "Boot startup status (simulated). Native boot receiver not yet active.")
    }

    private fun filePickerStatus(): InvokeResult {
        return InvokeResult(true, "unavailable", null,
            "File picker requires native Android permission flow.")
    }

    private fun scriptShortcutsList(): InvokeResult {
        return InvokeResult(true, "ok", mapOf(
            "categories" to listOf("system", "network", "development", "utility")
        ), "Script shortcut categories available.")
    }
}

data class BridgeStatus(
    val adapter: String,
    val total: Int,
    val available: Int,
    val simulated: Int,
    val unavailable: Int,
    val blockedCount: Int
)

data class InvokeResult(
    val success: Boolean,
    val status: String,
    val data: Any?,
    val message: String
)
