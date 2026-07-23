package com.billybox.terminai.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

/**
 * TerminAI Compose theme — mirrors the existing XML color palette
 * defined in res/values/colors.xml.
 */
private val TerminaiPrimary = Color(0xFF10B981)
private val TerminaiPrimaryDark = Color(0xFF059669)
private val TerminaiAccent = Color(0xFF3B82F6)
private val TerminaiBg = Color(0xFF0A0A0B)
private val TerminaiSurface = Color(0xFF141417)
private val TerminaiText = Color(0xFFE0E0E0)
private val TerminaiTextDim = Color(0xFF666666)
private val TerminaiSuccess = Color(0xFF10B981)
private val TerminaiWarning = Color(0xFFF59E0B)
private val TerminaiError = Color(0xFFEF4444)
private val TerminaiInfo = Color(0xFF3B82F6)

private val DarkColorScheme = darkColorScheme(
    primary = TerminaiPrimary,
    onPrimary = Color.White,
    primaryContainer = TerminaiPrimaryDark,
    secondary = TerminaiAccent,
    background = TerminaiBg,
    surface = TerminaiSurface,
    onBackground = TerminaiText,
    onSurface = TerminaiText,
    error = TerminaiError,
    onError = Color.White,
)

@Composable
fun TerminaiTheme(
    content: @Composable () -> Unit
) {
    val colorScheme = DarkColorScheme

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = TerminaiPrimaryDark.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = false
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        content = content
    )
}

// ── Shared color constants for use outside of Theme composable ──

object TerminaiColors {
    val Success = TerminaiSuccess
    val Warning = TerminaiWarning
    val Error = TerminaiError
    val Info = TerminaiInfo
    val TextDim = TerminaiTextDim
    val Surface = TerminaiSurface
    val Bg = TerminaiBg
}