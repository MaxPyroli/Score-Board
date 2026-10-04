package com.panagames.core

/**
 * Un jeu = un module. [R] est la forme d'une manche propre à ce jeu : le cœur
 * ne l'impose pas, il ne connaît que ses points par joueur et son encodage.
 */
interface GameModule<R : Any> {
    val id: String
    val displayName: String
    val minPlayers: Int
    val maxPlayers: Int

    /** Points gagnés (ou perdus) par chaque joueur (clé = id) pour cette manche. */
    fun scoreRound(round: R): Map<String, Double>

    fun encodeRound(round: R): String

    fun decodeRound(raw: String): R
}

/** Points de chaque manche, dans l'ordre. Tous les joueurs de la partie sont présents. */
fun <R : Any> GameModule<R>.roundScores(match: StoredMatch): List<Map<String, Double>> =
    match.rounds.map { raw ->
        val scores = scoreRound(decodeRound(raw))
        match.players.associate { it.id to (scores[it.id] ?: 0.0) }
    }

/** Total de chaque joueur (clé = id), déduit de la liste des manches. */
fun <R : Any> GameModule<R>.totals(match: StoredMatch): Map<String, Double> {
    val totals = match.players.associate { it.id to 0.0 }.toMutableMap()
    roundScores(match).forEach { round ->
        round.forEach { (id, delta) -> totals[id] = (totals[id] ?: 0.0) + delta }
    }
    return totals
}
