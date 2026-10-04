package com.panagames.skyjo

object SkyjoRoundSummarizer {
    /** Retourne (titre, détail) d'une manche pour l'historique. */
    fun summarize(round: SkyjoRound, nameOf: (String) -> String): Pair<String, String> {
        val result = SkyjoScoring.calculer(round)
        val finisher = nameOf(round.finisherId)
        val detail = if (result.finisherDoubled) {
            "points de $finisher doublés (${result.points.getValue(round.finisherId)} au lieu de ${round.scores.getValue(round.finisherId)})"
        } else ""
        return "$finisher a terminé la manche" to detail
    }
}
