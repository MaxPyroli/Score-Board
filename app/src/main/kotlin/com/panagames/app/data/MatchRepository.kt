package com.panagames.app.data

import com.panagames.core.Player
import com.panagames.core.StoredMatch
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json

@Serializable
private data class PlayerDto(val id: String, val name: String)

class MatchRepository(private val dao: MatchDao) {
    private val json = Json { ignoreUnknownKeys = true }
    private val playersSerializer = ListSerializer(PlayerDto.serializer())
    private val roundsSerializer = ListSerializer(String.serializer())
    private val settingsSerializer = MapSerializer(String.serializer(), String.serializer())

    suspend fun loadAll(): List<StoredMatch> = dao.getAll().map { it.toMatch() }

    suspend fun save(match: StoredMatch, updatedAt: Long) = dao.upsert(match.toEntity(updatedAt))

    suspend fun delete(id: String) = dao.delete(id)

    private fun MatchEntity.toMatch() = StoredMatch(
        id = id,
        moduleId = moduleId,
        players = json.decodeFromString(playersSerializer, playersJson).map { Player(it.id, it.name) },
        rounds = json.decodeFromString(roundsSerializer, roundsJson),
        settings = json.decodeFromString(settingsSerializer, settingsJson),
        createdAt = createdAt,
    )

    private fun StoredMatch.toEntity(updatedAt: Long) = MatchEntity(
        id = id,
        moduleId = moduleId,
        playersJson = json.encodeToString(playersSerializer, players.map { PlayerDto(it.id, it.name) }),
        roundsJson = json.encodeToString(roundsSerializer, rounds),
        settingsJson = json.encodeToString(settingsSerializer, settings),
        createdAt = createdAt,
        updatedAt = updatedAt,
    )
}
