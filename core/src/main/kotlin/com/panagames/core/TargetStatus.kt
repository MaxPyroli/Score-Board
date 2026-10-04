package com.panagames.core

/**
 * Jeux à objectif de points (« fin de partie à 100 », « premier à 500 »…) :
 * qui est en tête, et l'objectif est-il atteint. Réglage de partie commun
 * à tous les jeux concernés.
 */
object TargetStatus {
    const val SETTING_TARGET = "target"
    const val SETTING_LOWEST_WINS = "lowestWins"

    fun target(match: StoredMatch): Double? = match.settings[SETTING_TARGET]?.let { ScoreInput.parse(it) }

    /** Meilleur joueur selon le sens du jeu ; en cas d'égalité, le premier de la table. */
    fun leader(players: List<Player>, totals: Map<String, Double>, lowestWins: Boolean): Player? {
        val ranked = players.filter { it.id in totals }
        return if (lowestWins) ranked.minByOrNull { totals.getValue(it.id) }
        else ranked.maxByOrNull { totals.getValue(it.id) }
    }

    /**
     * Phrase d'état affichée sous le tableau des scores, ou `null` s'il n'y a pas d'objectif.
     * L'objectif est atteint dès qu'un joueur a [target] points ou plus.
     */
    fun describe(players: List<Player>, totals: Map<String, Double>, target: Double?, lowestWins: Boolean): String? {
        if (target == null) return null
        val reached = players.filter { (totals[it.id] ?: 0.0) >= target }
        val goal = ScoreFormat.plain(target)
        if (reached.isEmpty()) return "Objectif : $goal points"
        val leader = leader(players, totals, lowestWins)
        val leaderText = leader?.let { " En tête : ${it.name} (${ScoreFormat.plain(totals.getValue(it.id))})." } ?: ""
        return "Objectif de $goal atteint par ${reached.joinToString(", ") { it.name }}.$leaderText"
    }
}
