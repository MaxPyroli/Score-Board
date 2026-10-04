package com.panagames.app.games

import androidx.compose.runtime.Composable
import com.panagames.core.StoredMatch
import com.panagames.core.roundScores
import com.panagames.core.totals
import com.panagames.tarot.TarotGameModule
import com.panagames.tarot.TarotRoundSummarizer

object TarotGame : GameDefinition {
    override val id = TarotGameModule.id
    override val displayName = TarotGameModule.displayName
    override val tagline = "3, 4 ou 5 joueurs · contrats, bouts, poignées, chelem"
    override val minPlayers = TarotGameModule.minPlayers
    override val maxPlayers = TarotGameModule.maxPlayers

    override val options = listOf(
        GameOption(
            key = TarotGameModule.SETTING_DEMI_POINTS,
            label = "Utiliser les demi-points",
            description = "Points réalisés par pas de 0,5 au lieu de 1.",
            default = false,
        ),
    )

    override fun totals(match: StoredMatch): Map<String, Double> = TarotGameModule.totals(match)

    override fun roundScores(match: StoredMatch): List<Map<String, Double>> = TarotGameModule.roundScores(match)

    override fun describeRound(match: StoredMatch, index: Int): RoundDescription {
        val names = match.players.associate { it.id to it.name }
        val round = TarotGameModule.decodeRound(match.rounds[index])
        val summary = TarotRoundSummarizer.summarize(round) { names[it] ?: it }
        return RoundDescription(summary.headline, summary.detail)
    }

    @Composable
    override fun RoundEditor(
        match: StoredMatch,
        roundIndex: Int?,
        onSave: (String) -> Unit,
        onDelete: (() -> Unit)?,
        onCancel: () -> Unit,
    ) = TarotRoundEditor(match, roundIndex, onSave, onDelete, onCancel)
}
