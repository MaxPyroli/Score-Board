package com.panagames.freecounter

import com.panagames.core.ScoreFormat
import com.panagames.core.ScoreInput

/** État du formulaire d'une manche de compteur : un texte et un signe par joueur. */
data class FreeRoundDraft(
    val players: List<String>,
    val texts: Map<String, String> = emptyMap(),
    val negatives: Set<String> = emptySet(),
) {
    fun withText(id: String, text: String): FreeRoundDraft = copy(texts = texts + (id to text))

    fun withNegative(id: String, negative: Boolean): FreeRoundDraft =
        copy(negatives = if (negative) negatives + id else negatives - id)

    /** Un champ laissé vide compte 0 ; au moins un champ doit être rempli. */
    fun build(nameOf: (String) -> String, allowNegative: Boolean = true): Result<FreeRound> = runCatching {
        require(players.any { !texts[it].isNullOrBlank() }) { "Saisis au moins un score." }
        val points = players.associateWith { id ->
            val text = texts[id].orEmpty()
            if (text.isBlank()) 0.0
            else {
                val value = ScoreInput.parse(text, negative = id in negatives)
                    ?: throw IllegalArgumentException("Nombre invalide pour ${nameOf(id)}.")
                require(allowNegative || value >= 0) { "Score négatif impossible pour ${nameOf(id)}." }
                value
            }
        }
        FreeRound(points)
    }

    companion object {
        fun from(round: FreeRound, players: List<String>): FreeRoundDraft = FreeRoundDraft(
            players = players,
            texts = players.associateWith { ScoreFormat.plain(kotlin.math.abs(round.points[it] ?: 0.0)) },
            negatives = players.filter { (round.points[it] ?: 0.0) < 0 }.toSet(),
        )
    }
}
