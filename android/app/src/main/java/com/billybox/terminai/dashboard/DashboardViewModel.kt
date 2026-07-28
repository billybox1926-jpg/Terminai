package com.billybox.terminai.dashboard

import android.app.Application
import android.os.Build
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.billybox.terminai.api.TerminaiApiAudit
import com.billybox.terminai.api.TerminaiApiBridge
import com.billybox.terminai.api.apiService
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

class DashboardViewModel(application: Application) : AndroidViewModel(application) {

    private val runtimeManager = RuntimeManager(application)
    private val bundleVerifier = RuntimeBundleVerifier(application)
    private val apiBridge = TerminaiApiBridge(application)
    private val apiAudit = TerminaiApiAudit(application)

    private val _connectionState = MutableStateFlow<ConnectionState>(ConnectionState.Idle)
    val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()

    private val _uiState = MutableStateFlow<DashboardUiState>(DashboardUiState.Loading)
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    init {
        emitCachedState()
        refresh()
    }

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
                systemPlatform = cached.systemPlatform,
                systemDevice = cached.systemDevice,
                systemManufacturer = cached.systemManufacturer,
                memoryUsage = cached.memoryUsage,
                uptime = cached.uptime,
                runtimeReady = cached.runtimeReady,
                installedCount = cached.installedCount,
                requiredMissing = cached.requiredMissing,
                bootstrapMode = cached.bootstrapMode,
                firstRunComplete = cached.firstRunComplete,
                auditEventCount = cached.auditEventCount,
                auditLogSize = cached.auditLogSize,
                recentAuditEvents = cached.recentAuditEvents,
                deviceManufacturer = Build.MANUFACTURER,
                deviceModel = Build.MODEL,
                androidSdk = Build.VERSION.SDK_INT,
                appVersionName = "${getAppVersionName()} (${getAppVersionCode()})",
                lastRefreshedAt = nowIsoUtc(),
                isStale = true
            )
        } catch (_: Exception) {
            // Keep Loading if cache is unavailable
        }
    }

    fun refresh() {
        viewModelScope.launch(Dispatchers.IO) {
            _connectionState.value = ConnectionState.Loading
            try {
                val snapshot = loadDashboardData()
                val systemStats = apiService().systemStats()
                val runtimeStatus = apiService().runtimeStatus()

                _connectionState.value = ConnectionState.Connected
                _uiState.value = DashboardUiState.Success(
                    workspacePath = snapshot.workspacePath,
                    runtimeRoot = snapshot.runtimeRoot,
                    stateDir = snapshot.stateDir,
                    runtimeMode = snapshot.runtimeMode,
                    bundleReady = snapshot.bundleReady,
                    bundleName = snapshot.bundleName,
                    bundleVersion = snapshot.bundleVersion,
                    integrityOk = snapshot.integrityOk,
                    integrityPlaceholder = snapshot.integrityPlaceholder,
                    integrityNotes = snapshot.integrityNotes,
                    fileCountActual = snapshot.fileCountActual,
                    fileCountExpected = snapshot.fileCountExpected,
                    bridgeAdapter = snapshot.bridgeAdapter,
                    bridgeTotal = snapshot.bridgeTotal,
                    bridgeAvailable = snapshot.bridgeAvailable,
                    bridgeSimulated = snapshot.bridgeSimulated,
                    bridgeUnavailable = snapshot.bridgeUnavailable,
                    bridgeBlocked = snapshot.bridgeBlocked,
                    systemPlatform = systemStats.platform ?: snapshot.systemPlatform,
                    systemDevice = systemStats.device ?: snapshot.systemDevice,
                    systemManufacturer = systemStats.manufacturer ?: snapshot.systemManufacturer,
                    memoryUsage = systemStats.memoryUsage ?: snapshot.memoryUsage,
                    uptime = systemStats.uptime ?: snapshot.uptime,
                    runtimeReady = runtimeStatus.runtimeReady ?: snapshot.runtimeReady,
                    installedCount = runtimeStatus.installedCount ?: snapshot.installedCount,
                    requiredMissing = runtimeStatus.requiredMissing ?: snapshot.requiredMissing,
                    bootstrapMode = runtimeStatus.bootstrapMode ?: snapshot.bootstrapMode,
                    firstRunComplete = snapshot.firstRunComplete,
                    auditEventCount = snapshot.auditEventCount,
                    auditLogSize = snapshot.auditLogSize,
                    recentAuditEvents = snapshot.recentAuditEvents,
                    deviceManufacturer = Build.MANUFACTURER,
                    deviceModel = Build.MODEL,
                    androidSdk = Build.VERSION.SDK_INT,
                    appVersionName = "${getAppVersionName()} (${getAppVersionCode()})",
                    lastRefreshedAt = nowIsoUtc(),
                    isStale = false
                )
            } catch (e: Exception) {
                _connectionState.value = ConnectionState.Error(e.message ?: "Unknown error")
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
            systemPlatform = "unknown",
            systemDevice = Build.MODEL,
            systemManufacturer = Build.MANUFACTURER,
            memoryUsage = null,
            uptime = null,
            runtimeReady = null,
            installedCount = null,
            requiredMissing = emptyList(),
            bootstrapMode = null,
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
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) pi.longVersionCode else pi.versionCode.toLong()
        } catch (_: Exception) { -1 }
    }

    private fun nowIsoUtc(): String {
        return SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.format(Date())
    }

    fun getHealthReportFile(): File {
        return File(runtimeManager.stateDir, "terminai-health-report.json")
    }
}

sealed interface ConnectionState {
    data object Idle : ConnectionState
    data object Loading : ConnectionState
    data object Connected : ConnectionState
    data class Error(val message: String) : ConnectionState
}

sealed interface DashboardUiState {
    data object Loading : DashboardUiState

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
        val systemPlatform: String,
        val systemDevice: String,
        val systemManufacturer: String,
        val memoryUsage: Double?,
        val uptime: Double?,
        val runtimeReady: Boolean?,
        val installedCount: Int?,
        val requiredMissing: List<String>?,
        val bootstrapMode: String?,
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

    data class Error(
        val throwable: Throwable,
        val isOffline: Boolean
    ) : DashboardUiState
}

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
    val systemPlatform: String,
    val systemDevice: String,
    val systemManufacturer: String,
    val memoryUsage: Double?,
    val uptime: Double?,
    val runtimeReady: Boolean?,
    val installedCount: Int?,
    val requiredMissing: List<String>?,
    val bootstrapMode: String?,
    val firstRunComplete: Boolean,
    val auditEventCount: Int,
    val auditLogSize: Long,
    val recentAuditEvents: List<String>
)
