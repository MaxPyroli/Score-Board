package com.panagames.app.games

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.panagames.app.ui.PlayerColumns
import com.panagames.app.ui.PlayerNameCell
import com.panagames.app.ui.ScoreCell
import com.panagames.app.ui.SectionTitle
import com.panagames.core.ScoreFormat
import com.panagames.core.StoredMatch
import com.panagames.tarot.TarotCamp
import com.panagames.tarot.TarotChelemChoice
import com.panagames.tarot.TarotContract
import com.panagames.tarot.TarotGameModule
import com.panagames.tarot.TarotPoignee
import com.panagames.tarot.TarotRoundDraft
import com.panagames.tarot.TarotScoring

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun TarotRoundEditor(
    match: StoredMatch,
    roundIndex: Int?,
    onSave: (String) -> Unit,
    onDelete: (() -> Unit)?,
    onCancel: () -> Unit,
) {
    val demiPoints = match.flag(TarotGameModule.SETTING_DEMI_POINTS)
    val names = match.players.associate { it.id to it.name }
    var draft by remember(match.id, roundIndex) {
        val existing = roundIndex?.let { match.rounds.getOrNull(it) }
        mutableStateOf(
            if (existing != null) TarotRoundDraft.from(TarotGameModule.decodeRound(existing), demiPoints)
            else TarotRoundDraft.initial(match.players.map { it.id }, demiPoints),
        )
    }
    val built = draft.build()
    val title = if (roundIndex != null) "Modifier la manche ${roundIndex + 1}" else "Manche ${match.rounds.size + 1}"

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
                    val round = built.getOrNull()
                    if (round == null) {
                        Text(
                            built.exceptionOrNull()?.message ?: "Saisie incomplète.",
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    } else {
                        val result = TarotScoring.calculer(round)
                        Text(
                            if (result.contratReussi) "Contrat réussi" else "Contrat chuté",
                            style = MaterialTheme.typography.labelLarge,
                            color = if (result.contratReussi) MaterialTheme.colorScheme.primary
                            else MaterialTheme.colorScheme.error,
                        )
                        PlayerColumns(match.players, Modifier.padding(top = 4.dp)) { player ->
                            PlayerNameCell(player.name)
                            ScoreCell(result.points[player.id] ?: 0.0, signed = true, bold = true)
                        }
                    }
                    Row(
                        Modifier.fillMaxWidth().padding(top = 10.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        OutlinedButton(onClick = onCancel, modifier = Modifier.weight(1f)) { Text("Annuler") }
                        Button(
                            onClick = { built.getOrNull()?.let { onSave(TarotGameModule.encodeRound(it)) } },
                            enabled = built.isSuccess,
                            modifier = Modifier.weight(1f),
                        ) { Text("Valider") }
                    }
                }
            }
        },
    ) { padding ->
        Column(
            Modifier
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
        ) {
            SectionTitle("Preneur", Modifier.padding(top = 4.dp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                match.players.forEach { player ->
                    FilterChip(
                        selected = draft.preneurId == player.id,
                        onClick = { draft = draft.withPreneur(player.id) },
                        label = { Text(player.name) },
                    )
                }
            }

            if (match.players.size == 5) {
                SectionTitle("Appelé")
                Text(
                    "« Seul » : le preneur a le roi appelé dans sa main ou au chien.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(bottom = 8.dp),
                )
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    match.players.forEach { player ->
                        val label = if (player.id == draft.preneurId) "${player.name} (seul)" else player.name
                        FilterChip(
                            selected = draft.appeleId == player.id,
                            onClick = { draft = draft.withAppele(player.id) },
                            label = { Text(label) },
                        )
                    }
                }
            }

            SectionTitle("Contrat")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TarotContract.entries.forEach { contract ->
                    FilterChip(
                        selected = draft.contract == contract,
                        onClick = { draft = draft.copy(contract = contract) },
                        label = { Text("${contract.label} ×${contract.multiplier}") },
                    )
                }
            }

            SectionTitle("Bouts de l'attaque")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                (0..3).forEach { bouts ->
                    FilterChip(
                        selected = draft.bouts == bouts,
                        onClick = { draft = draft.copy(bouts = bouts) },
                        label = { Text("$bouts") },
                    )
                }
            }
            Text(
                "Points à atteindre : ${TarotScoring.seuilRequis(draft.bouts)}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 6.dp),
            )

            SectionTitle("Points réalisés")
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Column {
                    Text("Attaque", style = MaterialTheme.typography.labelMedium)
                    Text(
                        ScoreFormat.plain(draft.pointsRealises),
                        fontSize = 32.sp,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text("Défense", style = MaterialTheme.typography.labelMedium)
                    Text(
                        ScoreFormat.plain(draft.pointsDefense),
                        fontSize = 32.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            Slider(
                value = draft.pointsRealises.toFloat(),
                onValueChange = { draft = draft.withPoints(it.toDouble()) },
                valueRange = 0f..TarotRoundDraft.TOTAL_POINTS.toFloat(),
                steps = (TarotRoundDraft.TOTAL_POINTS / draft.step).toInt() - 1,
                enabled = !draft.pointsVerrouilles,
            )
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                OutlinedButton(
                    onClick = { draft = draft.withPointsDelta(-1) },
                    enabled = !draft.pointsVerrouilles,
                ) { Text("− ${ScoreFormat.plain(draft.step)}") }
                OutlinedButton(
                    onClick = { draft = draft.withPointsDelta(1) },
                    enabled = !draft.pointsVerrouilles,
                ) { Text("+ ${ScoreFormat.plain(draft.step)}") }
            }
            if (draft.pointsVerrouilles) {
                Text(
                    "Chelem réussi : l'attaque a fait tous les points.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 6.dp),
                )
            }

            SectionTitle("Poignée")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = draft.poignee == null,
                    onClick = { draft = draft.copy(poignee = null) },
                    label = { Text("Aucune") },
                )
                TarotPoignee.entries.forEach { poignee ->
                    FilterChip(
                        selected = draft.poignee == poignee,
                        onClick = { draft = draft.copy(poignee = poignee) },
                        label = {
                            Text(
                                "${poignee.label.replaceFirstChar { it.uppercase() }} · " +
                                    "${poignee.atouts(match.players.size)} atouts (+${poignee.bonus})",
                            )
                        },
                    )
                }
            }
            if (draft.poignee != null) {
                Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    CampChip("Attaque", draft.poigneeCamp == TarotCamp.ATTAQUE) {
                        draft = draft.copy(poigneeCamp = TarotCamp.ATTAQUE)
                    }
                    CampChip("Défense", draft.poigneeCamp == TarotCamp.DEFENSE) {
                        draft = draft.copy(poigneeCamp = TarotCamp.DEFENSE)
                    }
                }
            }

            SectionTitle("Petit au bout")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                CampChip("Aucun", draft.petitAuBoutCamp == null) { draft = draft.copy(petitAuBoutCamp = null) }
                CampChip("Attaque (+10 × contrat)", draft.petitAuBoutCamp == TarotCamp.ATTAQUE) {
                    draft = draft.copy(petitAuBoutCamp = TarotCamp.ATTAQUE)
                }
                CampChip("Défense (−10 × contrat)", draft.petitAuBoutCamp == TarotCamp.DEFENSE) {
                    draft = draft.copy(petitAuBoutCamp = TarotCamp.DEFENSE)
                }
            }

            SectionTitle("Chelem")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TarotChelemChoice.entries.forEach { choice ->
                    CampChip(choice.label, draft.chelem == choice) { draft = draft.withChelem(choice) }
                }
            }

            if (onDelete != null) {
                TextButton(
                    onClick = onDelete,
                    modifier = Modifier.padding(top = 16.dp),
                ) { Text("Supprimer cette manche", color = MaterialTheme.colorScheme.error) }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CampChip(label: String, selected: Boolean, onClick: () -> Unit) {
    FilterChip(selected = selected, onClick = onClick, label = { Text(label) })
}
