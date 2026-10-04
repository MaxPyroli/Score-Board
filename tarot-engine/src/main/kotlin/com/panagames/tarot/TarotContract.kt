package com.panagames.tarot

import kotlinx.serialization.Serializable

/**
 * Les quatre contrats du Tarot, avec leur multiplicateur de score.
 */
@Serializable
enum class TarotContract(val multiplier: Int, val label: String) {
    PETITE(1, "Petite"),
    GARDE(2, "Garde"),
    GARDE_SANS(4, "Garde sans"),
    GARDE_CONTRE(6, "Garde contre"),
}
