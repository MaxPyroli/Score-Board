package com.panagames.app.games

import androidx.compose.runtime.Composable
import com.panagames.core.StoredMatch

/** Réglage booléen propre à un jeu, proposé à la création d'une partie. */
data class GameOption(
    val key: String,
    val label: String,
    val description: String,
    val default: Boolean,
)

data class RoundDescription(
    val headline: String,
    val detail: String,
)

/**
 * Tout ce que l'interface a besoin de savoir d'un jeu. Les écrans communs
 * (accueil, nouvelle partie, tableau des scores, historique) sont génériques ;
 * seule la saisie d'une manche est propre à chaque jeu.
 */
interface GameDefinition {
    val id: String
    val displayName: String
    val tagline: String
    val minPlayers: Int
    val maxPlayers: Int
    val options: List<GameOption>

    fun totals(match: StoredMatch): Map<String, Double>

    fun roundScores(match: StoredMatch): List<Map<String, Double>>

    fun describeRound(match: StoredMatch, index: Int): RoundDescription

    @Composable
    fun RoundEditor(
        match: StoredMatch,
        roundIndex: Int?,
        onSave: (String) -> Unit,
        onDelete: (() -> Unit)?,
        onCancel: () -> Unit,
    )
}

object Games {
    val all: List<GameDefinition> = listOf(TarotGame)

    fun byId(id: String): GameDefinition? = all.firstOrNull { it.id == id }
}
