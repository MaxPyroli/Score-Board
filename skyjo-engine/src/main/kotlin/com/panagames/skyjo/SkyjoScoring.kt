package com.panagames.skyjo

/** Points réellement marqués sur une manche, après application de la règle du doublement. */
data class SkyjoRoundResult(
    val points: Map<String, Int>,
    /** `true` si les points de celui qui a terminé ont été doublés. */
    val finisherDoubled: Boolean,
)

object SkyjoScoring {
    /**
     * Celui qui termine la manche doit avoir le score strictement le plus bas :
     * sinon, si son score est positif, il est doublé. Un score nul ou négatif
     * n'est jamais doublé.
     */
    fun calculer(round: SkyjoRound): SkyjoRoundResult {
        val finisherScore = round.scores.getValue(round.finisherId)
        val notStrictlyLowest = round.scores.any { (id, score) -> id != round.finisherId && score <= finisherScore }
        val doubled = finisherScore > 0 && notStrictlyLowest
        val points = if (doubled) round.scores + (round.finisherId to finisherScore * 2) else round.scores
        return SkyjoRoundResult(points, doubled)
    }
}
