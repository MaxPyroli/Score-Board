package com.panagames.app.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColors = lightColorScheme(
    primary = Color(0xFF2F6F4F),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFCFE8D9),
    onPrimaryContainer = Color(0xFF0B2A1B),
    secondary = Color(0xFFB8863B),
    background = Color(0xFFF6F4EE),
    onBackground = Color(0xFF1C231D),
    surface = Color(0xFFF6F4EE),
    onSurface = Color(0xFF1C231D),
    surfaceVariant = Color(0xFFE6EADF),
    onSurfaceVariant = Color(0xFF5B6459),
    outline = Color(0xFFB9BFB1),
    error = Color(0xFFA5432F),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF6BC796),
    onPrimary = Color(0xFF06281A),
    primaryContainer = Color(0xFF1E4A33),
    onPrimaryContainer = Color(0xFFCFE8D9),
    secondary = Color(0xFFD7A75C),
    background = Color(0xFF10160F),
    onBackground = Color(0xFFECEFE6),
    surface = Color(0xFF10160F),
    onSurface = Color(0xFFECEFE6),
    surfaceVariant = Color(0xFF1E281C),
    onSurfaceVariant = Color(0xFFA2AB98),
    outline = Color(0xFF3B4636),
    error = Color(0xFFE08066),
)

@Composable
fun PanaTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) DarkColors else LightColors,
        content = content,
    )
}
