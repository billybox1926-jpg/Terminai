package com.billybox.terminai.dashboard

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import com.billybox.terminai.ui.theme.TerminaiTheme

/**
 * Dashboard activity — hosts the Compose dashboard UI.
 *
 * Replaces the old placeholder AlertDialog.
 * The ViewModel survives configuration changes; the Compose UI
 * simply observes the StateFlow.
 */
class DashboardActivity : ComponentActivity() {

    private val viewModel: DashboardViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            TerminaiTheme {
                DashboardScreen(
                    uiState = viewModel.uiState,
                    connectionState = viewModel.connectionState,
                    onRefresh = { viewModel.refresh() },
                    onBack = { finish() }
                )
            }
        }
    }
}
