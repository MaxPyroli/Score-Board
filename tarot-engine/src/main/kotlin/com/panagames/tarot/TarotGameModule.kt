package com.panagames.tarot

import com.panagames.core.GameModule
import kotlinx.serialization.json.Json

object TarotGameModule : GameModule<TarotRound> {
    /** Réglage de partie : la table compte les demi-points (désactivé par défaut). */
    const val SETTING_DEMI_POINTS = "demiPoints"

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    override val id = "tarot"
    override val displayName = "Tarot"
    override val minPlayers = 3
    override val maxPlayers = 5

    override fun scoreRound(round: TarotRound): Map<String, Double> =
        TarotScoring.calculer(round).points

    override fun encodeRound(round: TarotRound): String = json.encodeToString(TarotRound.serializer(), round)

    override fun decodeRound(raw: String): TarotRound = json.decodeFromString(TarotRound.serializer(), raw)
}
