package com.panagames.tarot

import kotlinx.serialization.Serializable

/**
 * Camp d'attaque (preneur, et éventuellement appelé) ou camp de défense.
 * Utilisé pour attribuer poignée, petit au bout et chelem au bon camp,
 * indépendamment du résultat du contrat.
 */
@Serializable
enum class TarotCamp {
    ATTAQUE,
    DEFENSE,
}
