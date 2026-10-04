package com.panagames.session

import com.panagames.core.Player
import com.panagames.core.StoredMatch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.ByteArrayOutputStream
import java.util.zip.GZIPInputStream
import java.util.zip.GZIPOutputStream

@Serializable
private data class WirePlayer(val id: String, val name: String)

@Serializable
private data class WireMatch(
    val id: String,
    val moduleId: String,
    val players: List<WirePlayer>,
    val rounds: List<String>,
    val settings: Map<String, String> = emptyMap(),
    val createdAt: Long,
)

@Serializable
private data class WireMessage(val v: Int, val match: WireMatch)

sealed interface SyncDecode {
    data class Ok(val match: StoredMatch) : SyncDecode

    /** Message d'une version plus récente de l'appli que celle-ci. */
    data object UpdateRequired : SyncDecode

    /** Octets illisibles ou hors limites (les données viennent d'un appareil voisin : jamais de confiance). */
    data object Invalid : SyncDecode
}

/** Format d'échange d'une partie entre appareils : JSON compressé en GZIP. */
object SyncCodec {
    const val PROTOCOL_VERSION = 1
    const val MAX_DECOMPRESSED_BYTES = 2_000_000
    private const val MAX_PLAYERS = 16
    private const val MAX_ROUNDS = 5_000
    private const val MAX_TEXT = 200

    private val json = Json { ignoreUnknownKeys = true }

    fun encode(match: StoredMatch): ByteArray {
        val message = WireMessage(
            v = PROTOCOL_VERSION,
            match = WireMatch(
                id = match.id,
                moduleId = match.moduleId,
                players = match.players.map { WirePlayer(it.id, it.name) },
                rounds = match.rounds,
                settings = match.settings,
                createdAt = match.createdAt,
            ),
        )
        val text = json.encodeToString(WireMessage.serializer(), message)
        val out = ByteArrayOutputStream()
        GZIPOutputStream(out).use { it.write(text.toByteArray(Charsets.UTF_8)) }
        return out.toByteArray()
    }

    fun decode(bytes: ByteArray): SyncDecode = try {
        val text = gunzipLimited(bytes) ?: return SyncDecode.Invalid
        val version = json.parseToJsonElementVersion(text)
        when {
            version == null -> SyncDecode.Invalid
            version > PROTOCOL_VERSION -> SyncDecode.UpdateRequired
            else -> toMatch(json.decodeFromString(WireMessage.serializer(), text))
        }
    } catch (e: Exception) {
        SyncDecode.Invalid
    }

    private fun Json.parseToJsonElementVersion(text: String): Int? =
        (parseToJsonElement(text) as? kotlinx.serialization.json.JsonObject)
            ?.get("v")?.let { (it as? kotlinx.serialization.json.JsonPrimitive)?.content?.toIntOrNull() }

    private fun toMatch(message: WireMessage): SyncDecode {
        val m = message.match
        val valid = m.players.size in 1..MAX_PLAYERS &&
            m.players.map { it.id }.toSet().size == m.players.size &&
            m.rounds.size <= MAX_ROUNDS &&
            listOf(m.id, m.moduleId).all { it.isNotBlank() && it.length <= MAX_TEXT } &&
            m.players.all { it.id.isNotBlank() && it.id.length <= MAX_TEXT && it.name.length <= MAX_TEXT }
        return if (!valid) SyncDecode.Invalid else SyncDecode.Ok(
            StoredMatch(
                id = m.id,
                moduleId = m.moduleId,
                players = m.players.map { Player(it.id, it.name) },
                rounds = m.rounds,
                settings = m.settings,
                createdAt = m.createdAt,
            ),
        )
    }

    private fun gunzipLimited(bytes: ByteArray): String? {
        val out = ByteArrayOutputStream()
        GZIPInputStream(bytes.inputStream()).use { input ->
            val buffer = ByteArray(8192)
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                if (out.size() + read > MAX_DECOMPRESSED_BYTES) return null
                out.write(buffer, 0, read)
            }
        }
        return out.toString(Charsets.UTF_8)
    }
}
