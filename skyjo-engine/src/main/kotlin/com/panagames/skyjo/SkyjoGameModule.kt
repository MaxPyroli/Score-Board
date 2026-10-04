package com.panagames.skyjo

import com.panagames.core.GameModule
import kotlinx.serialization.json.Json

/** Skyjo : le plus petit score gagne ; la partie s'arrête quand un joueur atteint 100 (objectif réglable). */
object SkyjoGameModule : GameModule<SkyjoRound> {
    const val DEFAULT_TARGET = 100

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    override val id = "skyjo"
    override val displayName = "Skyjo"
    override val minPlayers = 2
    override val maxPlayers = 8

    override fun scoreRound(round: SkyjoRound): Map<String, Double> =
        SkyjoScoring.calculer(round).points.mapValues { it.value.toDouble() }

    override fun encodeRound(round: SkyjoRound): String = json.encodeToString(SkyjoRound.serializer(), round)

    override fun decodeRound(raw: String): SkyjoRound = json.decodeFromString(SkyjoRound.serializer(), raw)
}
