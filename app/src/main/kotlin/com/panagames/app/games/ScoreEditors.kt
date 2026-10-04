package com.panagames.app.games

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
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
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.panagames.app.ui.PlayerColumns
import com.panagames.app.ui.PlayerNameCell
import com.panagames.app.ui.ScoreCell
import com.panagames.core.Player
import com.panagames.core.StoredMatch
import com.panagames.freecounter.FreeCounterGameModule
import com.panagames.freecounter.FreeRoundDraft
import com.panagames.skyjo.SkyjoGameModule
import com.panagames.skyjo.SkyjoRoundDraft
import com.panagames.skyjo.SkyjoScoring

/** Cadre commun des écrans de saisie « un score par joueur » : barre du haut, aperçu, Annuler / Valider. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ScoreEditorScaffold(
    title: String,
    error: String?,
    canSave: Boolean,
    onSave: () -> Unit,
    onDelete: (() -> Unit)?,
    onCancel: () -> Unit,
    preview: @Composable ColumnScope.() -> Unit = {},
    content: @Composable ColumnScope.() -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(title) },
                navigationIcon = {
                    IconButton(onClick = onCancel) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour")
                    }
                },
            )
        },
        bottomBar = {
            Surface(tonalElevation = 3.dp, shadowElevation = 6.dp) {
                Column(Modifier.navigationBarsPadding().padding(horizontal = 16.dp, vertical = 10.dp)) {
                    if (error != null) {
                        Text(error, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                    } else {
                        preview()
                    }
                    Row(
                        Modifier.fillMaxWidth().padding(top = 10.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        OutlinedButton(onClick = onCancel, modifier = Modifier.weight(1f)) { Text("Annuler") }
                        Button(onClick = onSave, enabled = canSave, modifier = Modifier.weight(1f)) { Text("Valider") }
                    }
                }
            }
        },
    ) { padding ->
        Column(
            Modifier
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 8.dp),
        ) {
            content()
            if (onDelete != null) {
                TextButton(onClick = onDelete, modifier = Modifier.padding(top = 16.dp)) {
                    Text("Supprimer cette manche", color = MaterialTheme.colorScheme.error)
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

/** Une ligne par joueur : (choix de celui qui a terminé), nom, signe, score. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PlayerScoreFields(
    players: List<Player>,
    texts: Map<String, String>,
    negatives: Set<String>,
    allowNegative: Boolean,
    integersOnly: Boolean,
    finisherId: String?,
    onFinisher: ((String) -> Unit)?,
    onText: (String, String) -> Unit,
    onNegative: (String, Boolean) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        players.forEachIndexed { index, player ->
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (onFinisher != null) {
                    RadioButton(selected = finisherId == player.id, onClick = { onFinisher(player.id) })
                }
                Text(player.name, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                if (allowNegative) {
                    FilterChip(
                        selected = player.id in negatives,
                        onClick = { onNegative(player.id, player.id !in negatives) },
                        label = { Text("−") },
                    )
                }
                OutlinedTextField(
                    value = texts[player.id].orEmpty(),
                    onValueChange = { onText(player.id, it) },
                    modifier = Modifier.width(110.dp),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = if (integersOnly) KeyboardType.Number else KeyboardType.Decimal,
                        imeAction = if (index == players.lastIndex) ImeAction.Done else ImeAction.Next,
                    ),
                )
            }
        }
    }
}

@Composable
fun CounterRoundEditor(
    match: StoredMatch,
    roundIndex: Int?,
    module: FreeCounterGameModule,
    allowNegative: Boolean,
    onSave: (String) -> Unit,
    onDelete: (() -> Unit)?,
    onCancel: () -> Unit,
) {
    val ids = match.players.map { it.id }
    val names = match.players.associate { it.id to it.name }
    var draft by remember(match.id, roundIndex) {
        val existing = roundIndex?.let { match.rounds.getOrNull(it) }
        mutableStateOf(
            if (existing != null) FreeRoundDraft.from(module.decodeRound(existing), ids) else FreeRoundDraft(ids),
        )
    }
    val built = draft.build({ names[it] ?: it }, allowNegative)
    val untouched = draft.texts.values.all { it.isBlank() }

    ScoreEditorScaffold(
        title = if (roundIndex != null) "Modifier la manche ${roundIndex + 1}" else "Manche ${match.rounds.size + 1}",
        error = if (untouched) null else built.exceptionOrNull()?.message,
        canSave = built.isSuccess,
        onSave = { built.getOrNull()?.let { onSave(module.encodeRound(it)) } },
        onDelete = onDelete,
        onCancel = onCancel,
        preview = {
            Text(
                "Un champ vide compte 0.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        },
    ) {
        PlayerScoreFields(
            players = match.players,
            texts = draft.texts,
            negatives = draft.negatives,
            allowNegative = allowNegative,
            integersOnly = false,
            finisherId = null,
            onFinisher = null,
            onText = { id, text -> draft = draft.withText(id, text) },
            onNegative = { id, negative -> draft = draft.withNegative(id, negative) },
        )
    }
}

@Composable
fun SkyjoRoundEditor(
    match: StoredMatch,
    roundIndex: Int?,
    onSave: (String) -> Unit,
    onDelete: (() -> Unit)?,
    onCancel: () -> Unit,
) {
    val ids = match.players.map { it.id }
    val names = match.players.associate { it.id to it.name }
    var draft by remember(match.id, roundIndex) {
        val existing = roundIndex?.let { match.rounds.getOrNull(it) }
        mutableStateOf(
            if (existing != null) SkyjoRoundDraft.from(SkyjoGameModule.decodeRound(existing), ids)
            else SkyjoRoundDraft(ids),
        )
    }
    val built = draft.build { names[it] ?: it }
    val untouched = draft.texts.values.all { it.isBlank() } && draft.finisherId == null

    ScoreEditorScaffold(
        title = if (roundIndex != null) "Modifier la manche ${roundIndex + 1}" else "Manche ${match.rounds.size + 1}",
        error = if (untouched) null else built.exceptionOrNull()?.message,
        canSave = built.isSuccess,
        onSave = { built.getOrNull()?.let { onSave(SkyjoGameModule.encodeRound(it)) } },
        onDelete = onDelete,
        onCancel = onCancel,
        preview = {
            val round = built.getOrNull()
            if (round == null) {
                Text(
                    "Saisis le total des cartes de chaque joueur et coche celui qui a terminé.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                val result = SkyjoScoring.calculer(round)
                if (result.finisherDoubled) {
                    Text(
                        "Points de ${names[round.finisherId]} doublés : il n'a pas le score le plus bas.",
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.error,
                    )
                }
                PlayerColumns(match.players, Modifier.padding(top = 4.dp)) { player ->
                    PlayerNameCell(player.name, compact = match.players.size > 6)
                    ScoreCell((result.points[player.id] ?: 0).toDouble(), signed = true, bold = true)
                }
            }
        },
    ) {
        Text(
            "Total des cartes de chaque joueur en fin de manche. Coche celui qui l'a terminée.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(bottom = 12.dp),
        )
        PlayerScoreFields(
            players = match.players,
            texts = draft.texts,
            negatives = draft.negatives,
            allowNegative = true,
            integersOnly = true,
            finisherId = draft.finisherId,
            onFinisher = { draft = draft.withFinisher(it) },
            onText = { id, text -> draft = draft.withText(id, text) },
            onNegative = { id, negative -> draft = draft.withNegative(id, negative) },
        )
    }
}
