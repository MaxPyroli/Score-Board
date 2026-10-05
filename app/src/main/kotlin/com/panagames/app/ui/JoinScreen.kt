package com.panagames.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import com.panagames.app.session.SessionManager.JoinState
import com.panagames.session.SessionCode

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun JoinScreen(
    state: JoinState,
    onJoin: (String) -> Unit,
    onCancel: () -> Unit,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    val requestPermissions = rememberSessionPermissionRequest()
    var input by remember { mutableStateOf("") }
    var localError by remember { mutableStateOf<String?>(null) }
    val busy = state is JoinState.Searching || state is JoinState.Connecting
    val code = SessionCode.normalize(input)

    fun start(joinCode: String) {
        localError = null
        requestPermissions({ onJoin(joinCode) }, { localError = PERMISSION_DENIED_MESSAGE })
    }

    fun scan() {
        localError = null
        val options = GmsBarcodeScannerOptions.Builder().setBarcodeFormats(Barcode.FORMAT_QR_CODE).build()
        GmsBarcodeScanning.getClient(context, options).startScan()
            .addOnSuccessListener { barcode ->
                val scanned = barcode.rawValue?.let { SessionCode.fromQrText(it) }
                if (scanned != null) {
                    input = scanned
                    start(scanned)
                } else {
                    localError = "Ce QR code n'est pas celui d'une partie PanaGames."
                }
            }
            .addOnFailureListener { e ->
                if (e.message?.contains("cancel", ignoreCase = true) != true) {
                    localError = "Impossible de scanner le QR code. Saisis le code à la main."
                }
            }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Rejoindre une partie") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour")
                    }
                },
            )
        },
    ) { padding ->
        Column(
            Modifier
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                "Entre le code affiché sur le téléphone de l'hôte, ou scanne son QR code. " +
                    "Pas besoin d'internet : les deux téléphones doivent être proches, " +
                    "avec le Bluetooth et le Wi-Fi activés.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            OutlinedTextField(
                value = input,
                onValueChange = { input = it.uppercase().filter { c -> c.isLetterOrDigit() }.take(SessionCode.LENGTH) },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Code de la partie") },
                textStyle = MaterialTheme.typography.headlineMedium.copy(fontFamily = FontFamily.Monospace, letterSpacing = 6.sp),
                singleLine = true,
                enabled = !busy,
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters, imeAction = ImeAction.Done),
            )

            Button(
                onClick = { code?.let { start(it) } },
                enabled = !busy && code != null,
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Rejoindre") }

            OutlinedButton(
                onClick = { scan() },
                enabled = !busy,
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Scanner un QR code") }

            when (state) {
                is JoinState.Searching -> Progress("Recherche de la partie ${state.code}…", onCancel)
                is JoinState.Connecting -> Progress("Connexion à la partie ${state.code}…", onCancel)
                is JoinState.Failed -> Text(state.message, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
                else -> Unit
            }
            localError?.let {
                Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}

@Composable
private fun Progress(text: String, onCancel: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        CircularProgressIndicator(Modifier.size(24.dp), strokeWidth = 3.dp)
        Text(text, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
        TextButton(onClick = onCancel) { Text("Annuler") }
    }
}
