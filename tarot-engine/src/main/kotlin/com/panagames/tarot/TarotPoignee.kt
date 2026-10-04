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
}
