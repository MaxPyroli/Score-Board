package com.panagames.app.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.panagames.app.games.GameDefinition
import com.panagames.core.StoredMatch
import kotlinx.coroutines.launch

/** Partage en cours de cette partie (code et nombre de spectateurs connectés). */
data class SharingInfo(val code: String, val viewers: Int)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MatchScreen(
    match: StoredMatch,
    game: GameDefinition,
    onBack: () -> Unit,
    onNewRound: () -> Unit,
    onEditRound: (Int) -> Unit,
    onChange: (StoredMatch) -> Unit,
    onDelete: () -> Unit,
    readOnly: Boolean = false,
    title: String? = null,
    sharing: SharingInfo? = null,
    onShare: (() -> Unit)? = null,
    note: (@Composable () -> Unit)? = null,
) {
    val totals = game.totals(match)
    val roundScores = game.roundScores(match)
    val snackbarHost = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    var menuOpen by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(title ?: game.displayName) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour")
                    }
                },
                actions = {
                    if (!readOnly && onShare != null) {
                        IconButton(onClick = onShare) {
                            Icon(Icons.Default.Share, contentDescription = "Partager la partie")
                        }
                    }
                    if (!readOnly) Box {
                        IconButton(onClick = { menuOpen = true }) {
                            Icon(Icons.Default.MoreVert, contentDescription = "Plus d'actions")
                        }
                        DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                            DropdownMenuItem(
                                text = { Text("Annuler la dernière manche") },
                                enabled = match.rounds.isNotEmpty(),
                                onClick = {
                                    menuOpen = false
                                    val before = match
                                    onChange(match.withoutLastRound())
                                    scope.launch {
                                        snackbarHost.currentSnackbarData?.dismiss()
                                        val result = snackbarHost.showSnackbar(
                                            message = "Dernière manche annulée",
                                            actionLabel = "Rétablir",
                                        )
                                        if (result == SnackbarResult.ActionPerformed) onChange(before)
                                    }
                                },
                            )
                            DropdownMenuItem(
                                text = { Text("Supprimer la partie") },
                                onClick = { menuOpen = false; confirmDelete = true },
                            )
                        }
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbarHost) },
        floatingActionButton = {
            if (!readOnly) {
                ExtendedFloatingActionButton(
                    onClick = onNewRound,
                    icon = { Icon(Icons.Default.Add, contentDescription = null) },
                    text = { Text("Nouvelle manche") },
                )
            }
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            Card(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
            ) {
                val compact = match.players.size > 6
                Column(Modifier.padding(vertical = 12.dp, horizontal = 8.dp)) {
                    PlayerColumns(match.players) { PlayerNameCell(it.name, compact) }
                    PlayerColumns(match.players, Modifier.padding(top = 4.dp)) { player ->
                        ScoreCell(
                            totals[player.id] ?: 0.0,
                            signed = false,
                            size = if (compact) 14.sp else if (match.players.size > 4) 20.sp else 24.sp,
                            bold = true,
                        )
                    }
                }
            }

            note?.invoke()
            sharing?.let {
                Text(
                    "Partage actif · code ${it.code} · " +
                        if (it.viewers == 1) "1 spectateur" else "${it.viewers} spectateurs",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 24.dp, vertical = 2.dp),
                )
            }

            game.status(match)?.let { status ->
                Text(
                    status,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(horizontal = 24.dp, vertical = 4.dp),
                )
            }

            if (match.rounds.isEmpty()) {
                Text(
                    "Aucune manche pour l'instant.\nAppuie sur « Nouvelle manche » pour commencer.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 24.dp, vertical = 32.dp),
                )
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 96.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(match.rounds.indices.reversed().toList(), key = { it }) { index ->
                        val description = game.describeRound(match, index)
                        Card(
                            modifier = Modifier.fillMaxWidth().clickable(enabled = !readOnly) { onEditRound(index) },
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                            border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
                        ) {
                            Column(Modifier.padding(horizontal = 8.dp, vertical = 10.dp)) {
                                Column(Modifier.padding(horizontal = 8.dp)) {
                                    Text(
                                        if (description.headline.isBlank()) "Manche ${index + 1}"
                                        else "${index + 1}. ${description.headline}",
                                        style = MaterialTheme.typography.titleSmall,
                                    )
                                    if (description.detail.isNotBlank()) {
                                        Text(
                                            description.detail,
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        )
                                    }
                                }
                                HorizontalDivider(Modifier.padding(vertical = 8.dp))
                                PlayerColumns(match.players) { player ->
                                    ScoreCell(
                                        roundScores[index][player.id] ?: 0.0,
                                        signed = true,
                                        size = if (match.players.size > 6) 13.sp else 16.sp,
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (confirmDelete) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("Supprimer la partie ?") },
            text = { Text("Les scores de cette partie seront perdus.") },
            confirmButton = {
                TextButton(onClick = { confirmDelete = false; onDelete() }) { Text("Supprimer") }
            },
            dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("Annuler") } },
        )
    }
}
