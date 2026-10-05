package com.panagames.app.ui

import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import com.panagames.session.SessionPermissions

/**
 * Renvoie une fonction `(onGranted, onDenied) -> Unit` : demande les permissions
 * nécessaires au partage entre appareils si besoin, puis appelle le bon rappel.
 */
@Composable
fun rememberSessionPermissionRequest(): (onGranted: () -> Unit, onDenied: () -> Unit) -> Unit {
    val context = LocalContext.current
    var pending by remember { mutableStateOf<Pair<() -> Unit, () -> Unit>?>(null) }
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
        val callbacks = pending
        pending = null
        if (callbacks != null) {
            if (result.values.all { it }) callbacks.first() else callbacks.second()
        }
    }
    return { onGranted, onDenied ->
        val missing = SessionPermissions.required(Build.VERSION.SDK_INT).filter {
            ContextCompat.checkSelfPermission(context, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isEmpty()) {
            onGranted()
        } else {
            pending = onGranted to onDenied
            launcher.launch(missing.toTypedArray())
        }
    }
}

const val PERMISSION_DENIED_MESSAGE =
    "Sans l'autorisation « appareils à proximité » (ou la localisation sur Android 11 et moins), " +
        "la connexion est impossible. Autorise-la dans les réglages de l'appli."
