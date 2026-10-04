package com.panagames.freecounter

import kotlinx.serialization.Serializable

/** Une manche de compteur : les points saisis pour chaque joueur (clé = id). */
@Serializable
data class FreeRound(val points: Map<String, Double>)
