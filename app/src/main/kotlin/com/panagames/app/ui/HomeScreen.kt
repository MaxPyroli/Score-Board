package com.panagames.app.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.panagames.app.games.GameDefinition
import com.panagames.app.games.Games
import com.panagames.core.ScoreFormat
import com.panagames.core.StoredMatch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    matches: List<StoredMatch>?,
    onNewMatch: (GameDefinition) -> Unit,
    onOpenMatch: (StoredMatch) -> Unit,
    onDeleteMatch: (StoredMatch) -> Unit,
) {
    var toDelete by remember { mutableStateOf<StoredMatch?>(null) }

    Scaffold(
        topBar = { TopAppBar(title = { Text("PanaGames") }) },
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item { SectionTitle("Nouvelle partie", Modifier.padding(top = 4.dp)) }
            items(Games.all) { game ->
                Card(
                    onClick = { onNewMatch(game) },
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
                ) {
                    Column(Modifier.padding(16.dp)) {
                        Text(game.displayName, style = MaterialTheme.typography.titleLarge)
                        Text(
                            game.tagline,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onPrimaryContainer,
                        )
                    }
                }
            }

            item { SectionTitle("Parties") }
            when {
                matches == null -> Unit
                matches.isEmpty() -> item {
                    Text(
                        "Aucune partie pour l'instant. Lance-en une ci-dessus.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                else -> items(matches, key = { it.id }) { match ->
                    MatchCard(match, onOpen = { onOpenMatch(match) }, onDelete = { toDelete = match })
                }
            }
        }
    }

    toDelete?.let { match ->
        AlertDialog(
            onDismissRequest = { toDelete = null },
            title = { Text("Supprimer la partie ?") },
            text = { Text("Les scores de cette partie seront perdus.") },
            confirmButton = {
                TextButton(onClick = { onDeleteMatch(match); toDelete = null }) { Text("Supprimer") }
            },
            dismissButton = { TextButton(onClick = { toDelete = null }) { Text("Annuler") } },
        )
    }
}

@Composable
private fun MatchCard(match: StoredMatch, onOpen: () -> Unit, onDelete: () -> Unit) {
    val game = Games.byId(match.moduleId)
    val date = remember(match.createdAt) {
        SimpleDateFormat("d MMM yyyy", Locale.FRANCE).format(Date(match.createdAt))
    }
    val leader = remember(match) {
        if (game == null || match.rounds.isEmpty()) null
        else game.totals(match).maxByOrNull { it.value }?.let { (id, total) ->
            (match.players.firstOrNull { it.id == id }?.name ?: id) to total
        }
    }

    Card(Modifier.fillMaxWidth().clickable(onClick = onOpen)) {
        Row(
            Modifier.padding(start = 16.dp, top = 12.dp, bottom = 12.dp, end = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    "${game?.displayName ?: "Jeu inconnu"} · $date",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    match.players.joinToString(", ") { it.name },
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = if (leader == null) "Aucune manche jouée"
                    else "${match.rounds.size} manche${if (match.rounds.size > 1) "s" else ""} · en tête : " +
                        "${leader.first} (${ScoreFormat.signed(leader.second)})",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            IconButton(onClick = onDelete) {
                Icon(Icons.Default.Delete, contentDescription = "Supprimer la partie")
            }
        }
    }
}
