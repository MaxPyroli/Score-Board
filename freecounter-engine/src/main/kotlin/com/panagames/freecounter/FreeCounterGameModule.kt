package com.panagames.freecounter

import com.panagames.core.GameModule
import kotlinx.serialization.json.Json

/**
 * Jeu « à points saisis à la main » : chaque manche, on entre les points de
 * chaque joueur. Sert de compteur libre et de base à des jeux simples
 * (réglages prêts à l'emploi ci-dessous).
 */
class FreeCounterGameModule(
    override val id: String,
    override val displayName: String,
    override val minPlayers: Int,
    override val maxPlayers: Int,
) : GameModule<FreeRound> {

    override fun scoreRound(round: FreeRound): Map<String, Double> = round.points

    override fun encodeRound(round: FreeRound): String = json.encodeToString(FreeRound.serializer(), round)

    override fun decodeRound(raw: String): FreeRound = json.decodeFromString(FreeRound.serializer(), raw)

    companion object {
        private val json = Json {
            ignoreUnknownKeys = true
            encodeDefaults = true
        }

        val FREE = FreeCounterGameModule("free", "Compteur libre", minPlayers = 2, maxPlayers = 6)

        /** 6 qui prend ! : on additionne les têtes de bœuf, fin à 66, le plus petit score gagne. */
        val SIX_QUI_PREND = FreeCounterGameModule("sixquiprend", "6 qui prend !", minPlayers = 2, maxPlayers = 10)
    }
}
