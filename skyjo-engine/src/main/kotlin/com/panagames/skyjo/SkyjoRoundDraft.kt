package com.panagames.skyjo

import com.panagames.core.ScoreFormat
import com.panagames.core.ScoreInput

/** État du formulaire d'une manche de Skyjo : score saisi par joueur, et qui a terminé. */
data class SkyjoRoundDraft(
    val players: List<String>,
    val texts: Map<String, String> = emptyMap(),
    val negatives: Set<String> = emptySet(),
    val finisherId: String? = null,
) {
    fun withText(id: String, text: String): SkyjoRoundDraft = copy(texts = texts + (id to text))

    fun withNegative(id: String, negative: Boolean): SkyjoRoundDraft =
        copy(negatives = if (negative) negatives + id else negatives - id)

    fun withFinisher(id: String): SkyjoRoundDraft = copy(finisherId = id)

    /** Aperçu : points réellement marqués si la saisie est complète et valide. */
    fun build(nameOf: (String) -> String): Result<SkyjoRound> = runCatching {
        val scores = players.associateWith { id ->
            val text = texts[id].orEmpty()
            require(text.isNotBlank()) { "Saisis le score de ${nameOf(id)}." }
            val value = ScoreInput.parse(text, negative = id in negatives)
                ?: throw IllegalArgumentException("Nombre invalide pour ${nameOf(id)}.")
            require(value % 1.0 == 0.0) { "Le score de ${nameOf(id)} doit être un nombre entier." }
            value.toInt()
        }
        val finisher = requireNotNull(finisherId) { "Indique qui a terminé la manche." }
        SkyjoRound(scores, finisher)
    }

    companion object {
        fun from(round: SkyjoRound, players: List<String>): SkyjoRoundDraft = SkyjoRoundDraft(
            players = players,
            texts = players.associateWith { ScoreFormat.plain(kotlin.math.abs((round.scores[it] ?: 0).toDouble())) },
            negatives = players.filter { (round.scores[it] ?: 0) < 0 }.toSet(),
            finisherId = round.finisherId,
        )
    }
}
