package com.billybox.terminai.dashboard

import android.app.Application
import android.os.Build
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.billybox.terminai.api.TerminaiApiAudit
import com.billybox.terminai.api.TerminaiApiBridge
import com.billybox.terminai.runtime.RuntimeBundleVerifier
import com.billybox.terminai.runtime.RuntimeManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * ViewModel that hoists all dashboard state via [StateFlow].
 *
 * Consumes the existing [RuntimeManager], [RuntimeBundleVerifier],
 * [TerminaiApiBridge], and [TerminaiApiAudit] — no new data sources.
 *
 * Offline-first: loads cached state synchronously on init, then
 * asynchronously refreshes from the live APIs. If the refresh fails
 * (e.g. runtime port unavailable, device offline) the cached state
 * is preserved and [DashboardUiState.Success.isStale] is set to true.
 */
class DashboardViewModel(application: Application) : AndroidViewModel(application) {

    private val runtimeManager = RuntimeManager(application)
    private val bundleVerifier = RuntimeBundleVerifier(application)
    private val apiBridge = TerminaiApiBridge(application)
    private val apiAudit = TerminaiApiAudit(application)

    private val _uiState = MutableStateFlow<DashboardUiState>(DashboardUiState.Loading)
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    init {
        // Emit cached state immediately (offline-first)
        emitCachedState()
        // Then refresh from live APIs
        refresh()
    }

    /**
     * Synchronously emit whatever we can read from disk right now.
     * This guarantees the UI has content before any async work completes.
     */
    private fun emitCachedState() {
        try {
            val cached = loadDashboardData()
            _uiState.value = DashboardUiState.Success(
                workspacePath = cached.workspacePath,
                runtimeRoot = cached.runtimeRoot,
                stateDir = cached.stateDir,
                runtimeMode = cached.runtimeMode,
                bundleReady = cached.bundleReady,
                bundleName = cached.bundleName,
                bundleVersion = cached.bundleVersion,
                integrityOk = cached.integrityOk,
                integrityPlaceholder = cached.integrityPlaceholder,
                integrityNotes = cached.integrityNotes,
                fileCountActual = cached.fileCountActual,
                fileCountExpected = cached.fileCountExpected,
                bridgeAdapter = cached.bridgeAdapter,
                bridgeTotal = cached.bridgeTotal,
                bridgeAvailable = cached.bridgeAvailable,
                bridgeSimulated = cached.bridgeSimulated,
                bridgeUnavailable = cached.bridgeUnavailable,
                bridgeBlocked = cached.bridgeBlocked,
                firstRunComplete = cached.firstRunComplete,
                auditEventCount = cached.auditEventCount,
                auditLogSize = cached.auditLogSize,
                recentAuditEvents = cached.recentAuditEvents,
                deviceManufacturer = Build.MANUFACTURER,
                deviceModel = Build.MODEL,
                androidSdk = Build.VERSION.SDK_INT,
                appVersionName = "${getAppVersionName()} (${getAppVersionCode()})",
                lastRefreshedAt = nowIsoUtc(),
                isStale = true // will be cleared on successful refresh
            )
        } catch (_: Exception) {
            // If even cached load fails, stay in Loading
        }
    }

    /**
     * Refresh all data from the live APIs. Must be called on a background thread.
     */
    fun refresh() {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val data = loadDashboardData()
                _uiState.value = DashboardUiState.Success(
                    workspacePath = data.workspacePath,
                    runtimeRoot = data.runtimeRoot,
                    stateDir = data.stateDir,
                    runtimeMode = data.runtimeMode,
                    bundleReady = data.bundleReady,
                    bundleName = data.bundleName,
                    bundleVersion = data.bundleVersion,
                    integrityOk = data.integrityOk,
                    integrityPlaceholder = data.integrityPlaceholder,
                    integrityNotes = data.integrityNotes,
                    fileCountActual = data.fileCountActual,
                    fileCountExpected = data.fileCountExpected,
                    bridgeAdapter = data.bridgeAdapter,
                    bridgeTotal = data.bridgeTotal,
                    bridgeAvailable = data.bridgeAvailable,
                    bridgeSimulated = data.bridgeSimulated,
                    bridgeUnavailable = data.bridgeUnavailable,
                    bridgeBlocked = data.bridgeBlocked,
                    firstRunComplete = data.firstRunComplete,
                    auditEventCount = data.auditEventCount,
                    auditLogSize = data.auditLogSize,
                    recentAuditEvents = data.recentAuditEvents,
                    deviceManufacturer = Build.MANUFACTURER,
                    deviceModel = Build.MODEL,
                    androidSdk = Build.VERSION.SDK_INT,
                    appVersionName = "${getAppVersionName()} (${getAppVersionCode()})",
                    lastRefreshedAt = nowIsoUtc(),
                    isStale = false
                )
            } catch (e: Exception) {
                // If refresh fails, keep existing cached state but mark stale
                val current = _uiState.value
                if (current is DashboardUiState.Success) {
                    _uiState.value = current.copy(isStale = true)
                } else {
                    _uiState.value = DashboardUiState.Error(
                        throwable = e,
                        isOffline = true
                    )
                }
            }
        }
    }

    // ── Data loading (all synchronous, called on IO dispatcher) ──

    private fun loadDashboardData(): DashboardSnapshot {
        val manifest = runtimeManager.readRuntimeBundleManifest()
        val integrity = bundleVerifier.verifyBundleIntegrity()
        val bridge = apiBridge.getBridgeStatus()
        val auditEvents = apiAudit.readRecentEvents(10)
        val auditSize = apiAudit.getAuditLogSize()

        return DashboardSnapshot(
            workspacePath = runtimeManager.workspaceRoot.absolutePath,
            runtimeRoot = runtimeManager.runtimeRoot.absolutePath,
            stateDir = runtimeManager.stateDir.absolutePath,
            runtimeMode = runtimeManager.getRuntimeMode(),
            bundleReady = bundleVerifier.isBundleReady(),
            bundleName = manifest?.bundleName ?: "N/A",
            bundleVersion = manifest?.bundleVersion ?: "N/A",
            integrityOk = integrity.integrityOk,
            integrityPlaceholder = integrity.placeholderMode,
            integrityNotes = integrity.notes,
            fileCountActual = integrity.fileCountActual,
            fileCountExpected = integrity.fileCountExpected,
            bridgeAdapter = bridge.adapter,
            bridgeTotal = bridge.total,
            bridgeAvailable = bridge.available,
            bridgeSimulated = bridge.simulated,
            bridgeUnavailable = bridge.unavailable,
            bridgeBlocked = bridge.blockedCount,
            firstRunComplete = runtimeManager.isFirstRunComplete(),
            auditEventCount = auditEvents.size,
            auditLogSize = auditSize,
            recentAuditEvents = auditEvents
        )
    }

    private fun getAppVersionName(): String {
        return try {
            val pm = getApplication<Application>().packageManager
            val pi = pm.getPackageInfo(getApplication<Application>().packageName, 0)
            pi.versionName ?: "unknown"
        } catch (_: Exception) { "unknown" }
    }

    private fun getAppVersionCode(): Long {
        return try {
            val pm = getApplication<Application>().packageManager
            val pi = pm.getPackageInfo(getApplication<Application>().packageName, 0)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) pi.longVersionCode
            else pi.versionCode.toLong()
        } catch (_: Exception) { -1 }
    }

    private fun nowIsoUtc(): String {
        return SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.format(Date())
    }

    /**
     * Try to read the last-cached health report JSON from the state directory.
     */
    fun getHealthReportFile(): File {
        return File(runtimeManager.stateDir, "terminai-health-report.json")
    }
}

// ── UI State ──────────────────────────────────────────────────────

sealed interface DashboardUiState {
    /** Initial loading — should flash briefly or be skipped if cached state exists. */
    object Loading : DashboardUiState

    /** Live or cached dashboard data. */
    data class Success(
        val workspacePath: String,
        val runtimeRoot: String,
        val stateDir: String,
        val runtimeMode: String,
        val bundleReady: Boolean,
        val bundleName: String,
        val bundleVersion: String,
        val integrityOk: Boolean,
        val integrityPlaceholder: Boolean,
        val integrityNotes: String,
        val fileCountActual: Int,
        val fileCountExpected: Int,
        val bridgeAdapter: String,
        val bridgeTotal: Int,
        val bridgeAvailable: Int,
        val bridgeSimulated: Int,
        val bridgeUnavailable: Int,
        val bridgeBlocked: Int,
        val firstRunComplete: Boolean,
        val auditEventCount: Int,
        val auditLogSize: Long,
        val recentAuditEvents: List<String>,
        val deviceManufacturer: String,
        val deviceModel: String,
        val androidSdk: Int,
        val appVersionName: String,
        val lastRefreshedAt: String,
        val isStale: Boolean
    ) : DashboardUiState

    /** Refresh failed — show fallback UI. */
    data class Error(
        val throwable: Throwable,
        val isOffline: Boolean
    ) : DashboardUiState
}

// ── Internal snapshot (not exposed to UI) ─────────────────────────

private data class DashboardSnapshot(
    val workspacePath: String,
    val runtimeRoot: String,
    val stateDir: String,
    val runtimeMode: String,
    val bundleReady: Boolean,
    val bundleName: String,
    val bundleVersion: String,
    val integrityOk: Boolean,
    val integrityPlaceholder: Boolean,
    val integrityNotes: String,
    val fileCountActual: Int,
    val fileCountExpected: Int,
    val bridgeAdapter: String,
    val bridgeTotal: Int,
    val bridgeAvailable: Int,
    val bridgeSimulated: Int,
    val bridgeUnavailable: Int,
    val bridgeBlocked: Int,
    val firstRunComplete: Boolean,
    val auditEventCount: Int,
    val auditLogSize: Long,
    val recentAuditEvents: List<String>
)
