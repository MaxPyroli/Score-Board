package com.panagames.tarot

/**
 * Une poignée (main composée d'un certain nombre d'atouts, dont l'Excuse)
 * annoncée et montrée par un camp. Le bonus est indépendant du multiplicateur
 * du contrat.
 */
enum class TarotPoignee(val bonus: Int) {
    SIMPLE(20),
    DOUBLE(30),
    TRIPLE(40),
}
