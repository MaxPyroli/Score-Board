package com.panagames.session

import java.nio.ByteBuffer

/**
 * Nearby n'accepte que ~32 Ko par envoi : un message plus gros est découpé en
 * morceaux numérotés (en-tête de 8 octets : id du message, numéro, total) puis
 * recollé à l'arrivée.
 */
object PayloadChunks {
    const val HEADER_BYTES = 8
    const val MAX_CHUNK_BYTES = 30_000
    private const val MAX_CHUNKS = 200

    fun split(messageId: Int, data: ByteArray, maxChunkBytes: Int = MAX_CHUNK_BYTES): List<ByteArray> {
        require(maxChunkBytes > HEADER_BYTES) { "Taille de morceau trop petite." }
        val body = maxChunkBytes - HEADER_BYTES
        val count = maxOf(1, (data.size + body - 1) / body)
        require(count <= 65_535) { "Message trop gros." }
        return (0 until count).map { index ->
            val from = index * body
            val to = minOf(data.size, from + body)
            ByteBuffer.allocate(HEADER_BYTES + (to - from))
                .putInt(messageId)
                .putShort(index.toShort())
                .putShort(count.toShort())
                .put(data, from, to - from)
                .array()
        }
    }

    /** Recolle les morceaux reçus ; un message plus récent annule celui en cours. */
    class Reassembler {
        private var messageId: Int? = null
        private var parts: Array<ByteArray?> = emptyArray()
        private var received = 0

        /** Le message complet quand le dernier morceau arrive, sinon `null` (aussi pour un morceau invalide). */
        fun accept(chunk: ByteArray): ByteArray? {
            if (chunk.size < HEADER_BYTES) return null
            val buffer = ByteBuffer.wrap(chunk)
            val id = buffer.getInt()
            val index = buffer.getShort().toInt() and 0xFFFF
            val count = buffer.getShort().toInt() and 0xFFFF
            if (count == 0 || count > MAX_CHUNKS || index >= count) return null

            if (id != messageId || parts.size != count) {
                messageId = id
                parts = arrayOfNulls(count)
                received = 0
            }
            if (parts[index] == null) {
                parts[index] = chunk.copyOfRange(HEADER_BYTES, chunk.size)
                received++
            }
            if (received < count) return null

            val out = java.io.ByteArrayOutputStream()
            parts.forEach { out.write(it!!) }
            messageId = null
            parts = emptyArray()
            received = 0
            return out.toByteArray()
        }
    }
}
