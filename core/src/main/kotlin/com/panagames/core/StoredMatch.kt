package com.panagames.core

/**
 * Une partie : joueurs + liste ordonnée de manches. Les manches sont stockées
 * sous forme de texte opaque (chaque jeu sait les encoder/décoder), ce qui
 * garde le cœur indépendant de la forme d'une manche propre à chaque jeu.
 * Les scores totaux se déduisent toujours de cette liste.
 */
data class StoredMatch(
    val id: String,
    val moduleId: String,
    val players: List<Player>,
    val rounds: List<String> = emptyList(),
    val settings: Map<String, String> = emptyMap(),
    val createdAt: Long,
) {
    fun withRound(raw: String): StoredMatch = copy(rounds = rounds + raw)

    fun withRoundReplaced(index: Int, raw: String): StoredMatch {
        require(index in rounds.indices) { "Manche inexistante : $index" }
        return copy(rounds = rounds.toMutableList().also { it[index] = raw })
    }

    fun withoutRound(index: Int): StoredMatch {
        require(index in rounds.indices) { "Manche inexistante : $index" }
        return copy(rounds = rounds.toMutableList().also { it.removeAt(index) })
    }

    fun withoutLastRound(): StoredMatch = if (rounds.isEmpty()) this else withoutRound(rounds.lastIndex)

    fun flag(key: String): Boolean = settings[key] == "true"
}
