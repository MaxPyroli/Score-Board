package com.panagames.tarot

import kotlinx.serialization.Serializable

/**
 * Une poignée (main composée d'un certain nombre d'atouts, dont l'Excuse)
 * annoncée et montrée par un camp. Le bonus est indépendant du multiplicateur
 * du contrat.
 */
@Serializable
enum class TarotPoignee(val bonus: Int, val label: String) {
    SIMPLE(20, "simple"),
    DOUBLE(30, "double"),
    TRIPLE(40, "triple"),
    ;

    /** Nombre d'atouts (Excuse comprise) nécessaire pour cette poignée selon le nombre de joueurs. */
    fun atouts(joueurs: Int): Int = when (joueurs) {
        3 -> when (this) { SIMPLE -> 13; DOUBLE -> 15; TRIPLE -> 18 }
        4 -> when (this) { SIMPLE -> 10; DOUBLE -> 13; TRIPLE -> 15 }
        5 -> when (this) { SIMPLE -> 8; DOUBLE -> 10; TRIPLE -> 13 }
        else -> throw IllegalArgumentException("Le Tarot se joue à 3, 4 ou 5 joueurs (reçu : $joueurs).")
    }
}
