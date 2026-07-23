package com.billybox.terminai.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SmallTopAppBar
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.billybox.terminai.ui.theme.TerminaiColors
import kotlinx.coroutines.flow.StateFlow

/**
 * Top-level Compose entry point for the dashboard screen.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    uiState: StateFlow<DashboardUiState>,
    onRefresh: () -> Unit,
    onBack: () -> Unit
) {
    val state by uiState.collectAsState()

    Scaffold(
        topBar = {
            SmallTopAppBar(
                title = {
                    Text(
                        text = "TerminAI Dashboard",
                        fontWeight = FontWeight.Bold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                },
                colors = TopAppBarDefaults.smallTopAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = onRefresh,
                containerColor = MaterialTheme.colorScheme.primary
            ) {
                Icon(
                    Icons.Default.Refresh,
                    contentDescription = "Refresh dashboard"
                )
            }
        },
        containerColor = TerminaiColors.Bg
    ) { innerPadding ->
        when (val current = state) {
            is DashboardUiState.Loading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(innerPadding),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                }
            }

            is DashboardUiState.Success -> {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(innerPadding)
                        .padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    item { Spacer(Modifier.height(8.dp)) }

                    // Stale banner
                    if (current.isStale) {
                        item {
                            StaleBanner()
                        }
                    }

                    // Device identity card
                    item {
                        SectionCard(title = "Device Identity") {
                            DataRow(label = "App Version", value = current.appVersionName)
                            DataRow(label = "Device", value = "${current.deviceManufacturer} ${current.deviceModel}")
                            DataRow(label = "Android SDK", value = current.androidSdk.toString())
                        }
                    }

                    // Workspace & paths card
                    item {
                        SectionCard(title = "Workspace & Paths") {
                            MonospaceRow(label = "Runtime", value = current.runtimeRoot)
                            MonospaceRow(label = "Workspace", value = current.workspacePath)
                            MonospaceRow(label = "State", value = current.stateDir)
                            StatusRow(
                                label = "Mode",
                                value = current.runtimeMode,
                                status = if (current.runtimeMode == "native-bundled") StatusKind.Success else StatusKind.Warning
                            )
                            StatusRow(
                                label = "First Run",
                                value = if (current.firstRunComplete) "Complete" else "Pending",
                                status = if (current.firstRunComplete) StatusKind.Success else StatusKind.Warning
                            )
                        }
                    }

                    // Runtime bundle card
                    item {
                        SectionCard(title = "Runtime Bundle") {
                            StatusRow(
                                label = "Bundle",
                                value = if (current.bundleReady) "Ready" else "Not Ready",
                                status = if (current.bundleReady) StatusKind.Success else StatusKind.Warning
                            )
                            if (current.bundleReady) {
                                DataRow(label = "Name", value = current.bundleName)
                                DataRow(label = "Version", value = current.bundleVersion)
                            }
                        }
                    }

                    // Integrity card
                    item {
                        SectionCard(title = "Runtime Integrity") {
                            StatusRow(
                                label = "Status",
                                value = when {
                                    current.integrityPlaceholder -> "Placeholder"
                                    current.integrityOk -> "OK"
                                    else -> "Issues Found"
                                },
                                status = when {
                                    current.integrityPlaceholder -> StatusKind.Info
                                    current.integrityOk -> StatusKind.Success
                                    else -> StatusKind.Error
                                }
                            )
                            DataRow(
                                label = "Files",
                                value = "${current.fileCountActual} / ${current.fileCountExpected}"
                            )
                            DataRow(
                                label = "Notes",
                                value = current.integrityNotes
                            )
                        }
                    }

                    // API Bridge card
                    item {
                        SectionCard(title = "API Bridge") {
                            DataRow(label = "Adapter", value = current.bridgeAdapter)
                            Spacer(Modifier.height(4.dp))
                            BridgeBar(label = "Available", count = current.bridgeAvailable, total = current.bridgeTotal, color = TerminaiColors.Success)
                            BridgeBar(label = "Simulated", count = current.bridgeSimulated, total = current.bridgeTotal, color = TerminaiColors.Warning)
                            BridgeBar(label = "Unavailable", count = current.bridgeUnavailable, total = current.bridgeTotal, color = TerminaiColors.Error)
                            BridgeBar(label = "Blocked", count = current.bridgeBlocked, total = current.bridgeTotal, color = TerminaiColors.Info)
                        }
                    }

                    // Audit log card
                    item {
                        SectionCard(title = "API Audit Log") {
                            DataRow(label = "Events (recent)", value = current.auditEventCount.toString())
                            DataRow(
                                label = "Log size",
                                value = formatBytes(current.auditLogSize)
                            )
                            if (current.recentAuditEvents.isNotEmpty()) {
                                Spacer(Modifier.height(8.dp))
                                HorizontalDivider(
                                    color = TerminaiColors.TextDim.copy(alpha = 0.3f)
                                )
                                Spacer(Modifier.height(8.dp))
                                Text(
                                    text = "Recent Events",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = TerminaiColors.TextDim
                                )
                                Spacer(Modifier.height(4.dp))
                                current.recentAuditEvents.forEach { event ->
                                    Text(
                                        text = event,
                                        fontSize = 10.sp,
                                        fontFamily = FontFamily.Monospace,
                                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                                        maxLines = 2,
                                        overflow = TextOverflow.Ellipsis,
                                        modifier = Modifier.padding(vertical = 2.dp)
                                    )
                                }
                            }
                        }
                    }

                    // Last refreshed timestamp
                    item {
                        Text(
                            text = "Last refreshed: ${current.lastRefreshedAt}",
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace,
                            color = TerminaiColors.TextDim,
                            modifier = Modifier.padding(bottom = 16.dp)
                        )
                    }
                }
            }

            is DashboardUiState.Error -> {
                ErrorFallbackScreen(
                    throwable = current.throwable,
                    isOffline = current.isOffline,
                    onRetry = onRefresh,
                    onBack = onBack,
                    modifier = Modifier.padding(innerPadding)
                )
            }
        }
    }
}

// ── Reusable Components ───────────────────────────────────────────

@Composable
private fun StaleBanner() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = TerminaiColors.Warning.copy(alpha = 0.15f)
        )
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                Icons.Default.Warning,
                contentDescription = null,
                tint = TerminaiColors.Warning,
                modifier = Modifier.size(20.dp)
            )
            Spacer(Modifier.width(8.dp))
            Text(
                text = "Showing cached data. Refresh failed — check network or runtime port.",
                fontSize = 13.sp,
                color = TerminaiColors.Warning
            )
        }
    }
}

@Composable
private fun SectionCard(
    title: String,
    content: @Composable () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = TerminaiColors.Surface
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = title,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
            Spacer(Modifier.height(12.dp))
            content()
        }
    }
}

@Composable
private fun DataRow(
    label: String,
    value: String
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            fontSize = 13.sp,
            color = TerminaiColors.TextDim
        )
        Text(
            text = value,
            fontSize = 13.sp,
            color = MaterialTheme.colorScheme.onSurface,
            maxLines = 3,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f, fill = false)
        )
    }
}

@Composable
private fun MonospaceRow(
    label: String,
    value: String
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp)
    ) {
        Text(
            text = label,
            fontSize = 11.sp,
            color = TerminaiColors.TextDim
        )
        Text(
            text = value,
            fontSize = 11.sp,
            fontFamily = FontFamily.Monospace,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f),
            maxLines = 2,
            overflow = TextOverflow.Ellipsis
        )
    }
}

private enum class StatusKind { Success, Warning, Error, Info }

@Composable
private fun StatusRow(
    label: String,
    value: String,
    status: StatusKind
) {
    val (tint, icon) = when (status) {
        StatusKind.Success -> TerminaiColors.Success to Icons.Default.CheckCircle
        StatusKind.Warning -> TerminaiColors.Warning to Icons.Default.Warning
        StatusKind.Error -> TerminaiColors.Error to Icons.Default.Error
        StatusKind.Info -> TerminaiColors.Info to Icons.Default.Info
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = "$label:",
            fontSize = 13.sp,
            color = TerminaiColors.TextDim,
            modifier = Modifier.weight(1f)
        )
        Icon(
            icon,
            contentDescription = null,
            tint = tint,
            modifier = Modifier.size(16.dp)
        )
        Spacer(Modifier.width(4.dp))
        Text(
            text = value,
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
            color = tint
        )
    }
}

@Composable
private fun BridgeBar(
    label: String,
    count: Int,
    total: Int,
    color: androidx.compose.ui.graphics.Color
) {
    val fraction = if (total > 0) count.toFloat() / total else 0f
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = "$label: $count",
            fontSize = 12.sp,
            color = TerminaiColors.TextDim,
            modifier = Modifier.width(100.dp)
        )
        Box(
            modifier = Modifier
                .weight(1f)
                .height(14.dp)
                .clip(MaterialTheme.shapes.extraSmall)
                .background(TerminaiColors.TextDim.copy(alpha = 0.2f))
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(fraction)
                    .fillMaxSize()
                    .background(color)
            )
        }
    }
}

/**
 * Fallback UI shown when refresh fails and no cached state is available.
 */
@Composable
private fun ErrorFallbackScreen(
    throwable: Throwable,
    isOffline: Boolean,
    onRetry: () -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            if (isOffline) Icons.Filled.WifiOff else Icons.Default.Error,
            contentDescription = null,
            tint = if (isOffline) TerminaiColors.Warning else TerminaiColors.Error,
            modifier = Modifier.size(64.dp)
        )
        Spacer(Modifier.height(16.dp))
        Text(
            text = if (isOffline) "Runtime Unavailable" else "Dashboard Error",
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = if (isOffline) {
                "The local runtime server is not reachable or the device is offline. " +
                    "Ensure the runtime port is active and try again."
            } else {
                throwable.message ?: "An unexpected error occurred while loading dashboard data."
            },
            fontSize = 14.sp,
            color = TerminaiColors.TextDim
        )
        Spacer(Modifier.height(24.dp))
        TextButton(onClick = onRetry) {
            Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text("Retry")
        }
        Spacer(Modifier.height(8.dp))
        TextButton(onClick = onBack) {
            Text("Go Back")
        }
    }
}

// ── Utilities ─────────────────────────────────────────────────────

private fun formatBytes(bytes: Long): String {
    if (bytes < 1024) return "$bytes B"
    if (bytes < 1024 * 1024) return "${"%.1f".format(bytes / 1024.0)} KB"
    return "${"%.1f".format(bytes / (1024.0 * 1024.0))} MB"
}
