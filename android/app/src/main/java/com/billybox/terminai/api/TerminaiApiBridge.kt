package com.billybox.terminai.api

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
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

    /**
     * Reads device battery status.
     *
     * Currently this method returns simulated data. To implement real battery status,
     * you would need to register a BroadcastReceiver for ACTION_BATTERY_CHANGED
     * and query BatteryManager for battery level, voltage, temperature, and charging state.
     *
     * @return InvokeResult with battery level, temperature, and charging state.
     *         Currently returns simulated values with "simulated" status.
     */
    private fun batteryRead(): InvokeResult {
        Log.w("TerminaiAPI", "batteryRead() called - returning simulated battery status. To implement, register BroadcastReceiver for ACTION_BATTERY_CHANGED")
        return InvokeResult(true, "simulated", mapOf(
            "level" to 82,
            "temperature" to "28.5 °C",
            "isCharging" to false,
            "source" to "simulated"
        ), "Battery status (simulated). Use BatteryManager for real data.")
    }

    /**
     * Reads clipboard content.
     *
     * Currently this method returns simulated data. To implement real clipboard access,
     * you would need to use ClipboardManager with a proper ClipboardManager.Listener
     * to read the primary clip content.
     *
     * @return InvokeResult with clipboard content.
     *         Currently returns simulated placeholder text with "simulated" status.
     */
    private fun clipboardRead(): InvokeResult {
        Log.w("TerminaiAPI", "clipboardRead() called - returning simulated clipboard. To implement, use ClipboardManager")
        return InvokeResult(true, "simulated", mapOf(
            "content" to "TerminAI clipboard placeholder",
            "source" to "simulated"
        ), "Clipboard read (simulated). Use ClipboardManager for real data.")
    }

    /**
     * Writes content to clipboard.
     *
     * Currently this method returns simulated data. To implement real clipboard write,
     * you would need to use ClipboardManager.setPrimaryClip() with a ClipData object.
     *
     * @param payload Map containing "content" key with text to copy.
     * @return InvokeResult indicating success with the written content.
     *         Currently returns simulated response with "simulated" status.
     */
    private fun clipboardWrite(payload: Map<String, Any?>): InvokeResult {
        val content = payload["content"] as? String ?: ""
        Log.w("TerminaiAPI", "clipboardWrite() called with content: '$content' - returning simulated result. To implement, use ClipboardManager.setPrimaryClip()")
        return InvokeResult(true, "simulated", mapOf(
            "content" to content,
            "source" to "simulated"
        ), "Clipboard write (simulated). Use ClipboardManager for real data.")
    }

    /**
     * Sends a notification to the user.
     *
     * Currently this method returns simulated data. To implement real notifications,
     * you would need to use NotificationManager.notify() with a properly built
     * Notification object. This requires NOTIFICATION permission on Android 13+.
     *
     * @param payload Map containing "title" and "body" keys for notification content.
     * @return InvokeResult with "sent" flag and notification details.
     *         Currently returns simulated response with "simulated" status and sent=false.
     */
    private fun notificationSend(payload: Map<String, Any?>): InvokeResult {
        Log.w("TerminaiAPI", "notificationSend() called - native notification bridge not yet active. To implement, use NotificationManager.notify()")
        return InvokeResult(true, "simulated", mapOf(
            "sent" to false,
            "title" to (payload["title"] ?: "TerminAI"),
            "body" to (payload["body"] ?: "Test notification")
        ), "Native notification bridge not yet active. Notification logged.")
    }

    /**
     * Returns storage paths for workspace, runtime, and state directories.
     */
    private fun storageStatus(): InvokeResult {
        return InvokeResult(true, "ok", mapOf(
            "workspaceRoot" to runtimeManager.workspaceRoot.absolutePath,
            "runtimeRoot" to runtimeManager.runtimeRoot.absolutePath,
            "stateDir" to runtimeManager.stateDir.absolutePath
        ), "Storage status.")
    }

    /**
     * Validates a URL or intent string.
     *
     * @param payload Map containing "url" key with the URL or intent to validate.
     * @return InvokeResult with validated URL and validity flag.
     */
    private fun intentValidate(payload: Map<String, Any?>): InvokeResult {
        val url = payload["url"] as? String ?: ""
        val valid = url.startsWith("http://") || url.startsWith("https://") || url.startsWith("intent://")
        return InvokeResult(true, "simulated", mapOf("url" to url, "valid" to valid),
            if (valid) "URL format valid." else "Invalid URL format.")
    }

    /**
     * Triggers a vibration pulse pattern.
     *
     * @param payload Map containing "pattern" key with list of Long values for vibration timing.
     * @return InvokeResult indicating success or simulated fallback.
     */
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
            Log.w("TerminaiAPI", "vibrationPulse() failed: ${e.message}", e)
            InvokeResult(true, "simulated", mapOf("pattern" to pattern), "Vibration simulated: ${e.message}")
        }
    }

    /**
     * Returns network information about the device.
     *
     * Currently this method returns simulated data. To implement real network info,
     * you would need to use ConnectivityManager and NetworkCapabilities to query
     * active network, bandwidth, and connection type.
     *
     * @return InvokeResult with platform, device, and manufacturer info.
     *         Currently returns simulated values with "simulated" status.
     */
    private fun networkInfoRead(): InvokeResult {
        Log.w("TerminaiAPI", "networkInfoRead() called - returning simulated data. To implement, use ConnectivityManager")
        return InvokeResult(true, "simulated", mapOf(
            "platform" to "Android ${Build.VERSION.RELEASE}",
            "device" to Build.MODEL,
            "manufacturer" to Build.MANUFACTURER,
            "source" to "simulated"
        ), "Network info (simulated). Use ConnectivityManager for real data.")
    }

    /**
     * Returns simulated sensor data.
     *
     * Currently this method returns simulated data. To implement real sensor data,
     * you would need to register SensorEventListener and query SensorManager
     * for accelerometer, gyroscope, light, and proximity sensors.
     *
     * @return InvokeResult with simulated accelerometer, gyroscope, light, and proximity values.
     *         Currently returns simulated values with "simulated" source.
     */
    private fun sensorSnapshot(): InvokeResult {
        Log.w("TerminaiAPI", "sensorSnapshot() called - returning simulated data. To implement, use SensorManager")
        return InvokeResult(true, "simulated", mapOf(
            "accelerometer" to mapOf("x" to 0, "y" to 0, "z" to 9.8),
            "gyroscope" to mapOf("x" to 0, "y" to 0, "z" to 0),
            "light" to 200,
            "proximity" to 5,
            "source" to "simulated"
        ), "Sensor data is simulated. Native sensor bridge not yet active.")
    }

    /**
     * Returns boot/startup enabled status.
     *
     * Currently this method returns simulated data. To implement real boot status,
     * you would need to check for RECEIVE_BOOT_COMPLETED permission and query
     * PackageManager for installed boot receiver components.
     *
     * @return InvokeResult with enabled flag.
     *         Currently returns simulated values with "simulated" status.
     */
    private fun bootStartupStatus(): InvokeResult {
        Log.w("TerminaiAPI", "bootStartupStatus() called - returning simulated data. To implement, check RECEIVE_BOOT_COMPLETED permission")
        return InvokeResult(true, "simulated", mapOf("enabled" to false),
            "Boot startup status (simulated). Native boot receiver not yet active.")
    }

    /**
     * Returns file picker availability status.
     *
     * This method is currently unavailable because it requires native Android
     * permission flow (READ_EXTERNAL_STORAGE or use of Activity Result APIs).
     *
     * @return InvokeResult with "unavailable" status.
     */
    private fun filePickerStatus(): InvokeResult {
        return InvokeResult(true, "unavailable", null,
            "File picker requires native Android permission flow.")
    }

    /**
     * Returns available script shortcut categories.
     */
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