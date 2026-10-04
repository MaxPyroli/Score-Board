package com.panagames.skyjo

import kotlinx.serialization.Serializable

/**
 * Une manche de Skyjo : le total des cartes de chaque joueur (clé = id) et le
 * joueur qui a terminé la manche (le premier à avoir révélé toutes ses cartes).
 */
@Serializable
data class SkyjoRound(
    val scores: Map<String, Int>,
    val finisherId: String,
) {
    init {
        require(scores.isNotEmpty()) { "Aucun score saisi." }
        require(finisherId in scores) { "Le joueur qui a terminé la manche doit faire partie de la table." }
        scores.forEach { (_, score) ->
            // 12 cartes de −2 à 12 : de −24 à 144.
            require(score in MIN_SCORE..MAX_SCORE) { "Score impossible : $score (entre $MIN_SCORE et $MAX_SCORE)." }
        }
    }

    companion object {
        const val MIN_SCORE = -24
        const val MAX_SCORE = 144
    }
}
