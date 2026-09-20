package com.panagames.tarot

/**
 * Les quatre contrats du Tarot, avec leur multiplicateur de score.
 */
enum class TarotContract(val multiplier: Int) {
    PETITE(1),
    GARDE(2),
    GARDE_SANS(4),
    GARDE_CONTRE(6),
}
