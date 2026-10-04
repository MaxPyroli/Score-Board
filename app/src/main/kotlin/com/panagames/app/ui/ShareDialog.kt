package com.panagames.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.panagames.app.session.SessionManager.HostState
import com.panagames.core.StoredMatch
import com.panagames.session.SessionCode

@Composable
fun ShareDialog(
    match: StoredMatch,
    hostState: HostState,
    onStart: () -> Unit,
    onStop: () -> Unit,
    onDismiss: () -> Unit,
) {
    val requestPermissions = rememberSessionPermissionRequest()
    var denied by remember { mutableStateOf(false) }
    val sharing = (hostState as? HostState.Sharing)?.takeIf { it.matchId == match.id }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Partager la partie") },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                if (sharing != null) {
                    Text(
                        sharing.code,
                        fontSize = 44.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        letterSpacing = 8.sp,
                        color = MaterialTheme.colorScheme.primary,
                    )
                    QrCode(SessionCode.toQrText(sharing.code), Modifier.width(200.dp))
                    Text(
                        when (sharing.viewers) {
                            0 -> "Aucun spectateur connecté pour l'instant."
                            1 -> "1 spectateur connecté."
                            else -> "${sharing.viewers} spectateurs connectés."
                        },
                        style = MaterialTheme.typography.bodyMedium,
                        textAlign = TextAlign.Center,
                    )
                    Text(
                        "Les autres téléphones entrent ce code (ou scannent le QR code) depuis « Rejoindre une partie » " +
                            "et suivent les scores en direct, en lecture seule. Pas besoin d'internet, mais les " +
                            "téléphones doivent rester proches.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                    )
                } else {
                    Text(
                        "Les autres téléphones suivront les scores de cette partie en direct, en lecture seule, " +
                            "sans internet (Bluetooth et Wi-Fi activés). Tu restes le seul à pouvoir saisir les manches.",
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    if (hostState is HostState.Failed) {
                        Text(hostState.message, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                    }
                    if (denied) {
                        Text(PERMISSION_DENIED_MESSAGE, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        },
        confirmButton = {
            if (sharing != null) {
                TextButton(onClick = { onStop(); onDismiss() }) { Text("Arrêter le partage") }
            } else {
                TextButton(
                    onClick = {
                        denied = false
                        requestPermissions({ onStart() }, { denied = true })
                    },
                ) { Text("Démarrer le partage") }
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, modifier = Modifier.padding(end = 4.dp)) { Text("Fermer") }
        },
    )
}
