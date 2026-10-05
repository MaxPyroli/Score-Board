package com.panagames.session

import com.panagames.core.Player
import com.panagames.core.StoredMatch
import kotlin.random.Random
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

class SessionTest {
    private fun match(rounds: Int = 2) = StoredMatch(
        id = "m1",
        moduleId = "tarot",
        players = listOf(Player("p1", "Léo"), Player("p2", "Chloé"), Player("p3", "Émile")),
        rounds = List(rounds) { """{"joueurs":["p1","p2","p3"],"pointsRealises":${50 + it % 40}.5}""" },
        settings = mapOf("demiPoints" to "true", "target" to "100.0"),
        createdAt = 1_700_000_000_000,
    )

    // --- Code de session ---

    @Test
    fun `code genere de 4 caracteres de l'alphabet, reproductible avec une graine`() {
        val code = SessionCode.generate(Random(42))
        assertEquals(4, code.length)
        assertTrue(code.all { it in SessionCode.ALPHABET })
        assertEquals(code, SessionCode.generate(Random(42)))
        assertTrue(SessionCode.ALPHABET.none { it in "01OI" })
    }

    @Test
    fun `codes generes tous valides`() {
        val random = Random(7)
        repeat(500) {
            val code = SessionCode.generate(random)
            assertEquals(code, SessionCode.normalize(code))
        }
    }

    @Test
    fun `saisie du code  majuscules, espaces et tirets tolerés`() {
        assertEquals("K7F2", SessionCode.normalize("k7f2"))
        assertEquals("K7F2", SessionCode.normalize(" k7-f2 "))
        assertNull(SessionCode.normalize("K7F"))
        assertNull(SessionCode.normalize("K7F22"))
        assertNull(SessionCode.normalize("K7F0"))
        assertNull(SessionCode.normalize("K7FO"))
        assertNull(SessionCode.normalize(""))
    }

    @Test
    fun `qr code aller-retour, et qr etranger refuse`() {
        assertEquals("K7F2", SessionCode.fromQrText(SessionCode.toQrText("K7F2")))
        assertNull(SessionCode.fromQrText("https://example.com"))
        assertNull(SessionCode.fromQrText("K7F2"))
        assertNull(SessionCode.fromQrText("PANAGAMES:zzzzzz"))
    }

    // --- Format d'échange ---

    @Test
    fun `une partie survit a l'encodage`() {
        val m = match()
        assertEquals(SyncDecode.Ok(m), SyncCodec.decode(SyncCodec.encode(m)))
    }

    @Test
    fun `partie vide`() {
        val m = match(rounds = 0)
        assertEquals(SyncDecode.Ok(m), SyncCodec.decode(SyncCodec.encode(m)))
    }

    @Test
    fun `octets quelconques refuses sans planter`() {
        assertEquals(SyncDecode.Invalid, SyncCodec.decode(ByteArray(0)))
        assertEquals(SyncDecode.Invalid, SyncCodec.decode(byteArrayOf(1, 2, 3, 4)))
        assertEquals(SyncDecode.Invalid, SyncCodec.decode(gzip("pas du json")))
        assertEquals(SyncDecode.Invalid, SyncCodec.decode(gzip("[1,2,3]")))
        assertEquals(SyncDecode.Invalid, SyncCodec.decode(gzip("""{"v":1}""")))
        assertEquals(SyncDecode.Invalid, SyncCodec.decode(gzip("""{"v":"x","match":{}}""")))
    }

    @Test
    fun `version plus recente signalee`() {
        val future = """{"v":99,"match":{"id":"m","moduleId":"x","players":[],"rounds":[],"createdAt":0},"autre":1}"""
        assertEquals(SyncDecode.UpdateRequired, SyncCodec.decode(gzip(future)))
    }

    @Test
    fun `champs inconnus ignores`() {
        val text = """{"v":1,"nouveau":true,"match":{"id":"m","moduleId":"tarot","players":[{"id":"a","name":"A","x":1}],"rounds":[],"createdAt":5,"y":2}}"""
        val decoded = SyncCodec.decode(gzip(text))
        assertIs<SyncDecode.Ok>(decoded)
        assertEquals("A", decoded.match.players.single().name)
    }

    @Test
    fun `parties incoherentes refusees`() {
        fun wire(players: String, rounds: String = "[]", id: String = "m") =
            gzip("""{"v":1,"match":{"id":"$id","moduleId":"tarot","players":$players,"rounds":$rounds,"createdAt":0}}""")
        assertEquals(SyncDecode.Invalid, SyncCodec.decode(wire("[]")))
        assertEquals(SyncDecode.Invalid, SyncCodec.decode(wire("""[{"id":"a","name":"A"},{"id":"a","name":"B"}]""")))
        assertEquals(SyncDecode.Invalid, SyncCodec.decode(wire("""[{"id":"a","name":"A"}]""", id = "")))
        assertEquals(SyncDecode.Invalid, SyncCodec.decode(wire("""[{"id":"a","name":"${"x".repeat(500)}"}]""")))
        val tooMany = (1..17).joinToString(",", "[", "]") { """{"id":"p$it","name":"N"}""" }
        assertEquals(SyncDecode.Invalid, SyncCodec.decode(wire(tooMany)))
    }

    @Test
    fun `bombe de decompression refusee`() {
        val bomb = gzip("a".repeat(SyncCodec.MAX_DECOMPRESSED_BYTES + 1000))
        assertTrue(bomb.size < 10_000)
        assertEquals(SyncDecode.Invalid, SyncCodec.decode(bomb))
    }

    // --- Decoupage des gros envois ---

    @Test
    fun `petit message en un seul morceau`() {
        val chunks = PayloadChunks.split(1, byteArrayOf(1, 2, 3))
        assertEquals(1, chunks.size)
        assertContentEquals(byteArrayOf(1, 2, 3), PayloadChunks.Reassembler().accept(chunks.single()))
    }

    @Test
    fun `message vide`() {
        val chunk = PayloadChunks.split(1, ByteArray(0)).single()
        assertContentEquals(ByteArray(0), PayloadChunks.Reassembler().accept(chunk))
    }

    @Test
    fun `gros message decoupe sous la limite puis recolle, meme dans le desordre`() {
        val data = Random(1).nextBytes(100_000)
        val chunks = PayloadChunks.split(7, data)
        assertTrue(chunks.size > 1)
        assertTrue(chunks.all { it.size <= PayloadChunks.MAX_CHUNK_BYTES })

        val reassembler = PayloadChunks.Reassembler()
        val results = chunks.reversed().map { reassembler.accept(it) }
        assertTrue(results.dropLast(1).all { it == null })
        assertContentEquals(data, results.last())
    }

    @Test
    fun `un message plus recent annule le precedent incomplet`() {
        val a = PayloadChunks.split(1, Random(2).nextBytes(70_000))
        val b = PayloadChunks.split(2, byteArrayOf(9, 9))
        val r = PayloadChunks.Reassembler()
        assertNull(r.accept(a[0]))
        assertContentEquals(byteArrayOf(9, 9), r.accept(b.single()))
    }

    @Test
    fun `morceaux invalides ignores`() {
        val r = PayloadChunks.Reassembler()
        assertNull(r.accept(ByteArray(3)))
        assertNull(r.accept(java.nio.ByteBuffer.allocate(8).putInt(1).putShort(5).putShort(2).array()))
        assertNull(r.accept(java.nio.ByteBuffer.allocate(8).putInt(1).putShort(0).putShort(0).array()))
        assertNull(r.accept(java.nio.ByteBuffer.allocate(8).putInt(1).putShort(0).putShort(30000).array()))
    }

    @Test
    fun `une grosse partie passe de bout en bout`() {
        val m = match(rounds = 3000)
        val wire = SyncCodec.encode(m)
        val reassembler = PayloadChunks.Reassembler()
        val full = PayloadChunks.split(3, wire).mapNotNull { reassembler.accept(it) }.single()
        assertEquals(SyncDecode.Ok(m), SyncCodec.decode(full))
    }

    // --- Permissions ---

    @Test
    fun `permissions selon la version d'Android`() {
        assertEquals(listOf("android.permission.ACCESS_FINE_LOCATION"), SessionPermissions.required(30))
        assertTrue("android.permission.BLUETOOTH_SCAN" in SessionPermissions.required(31))
        assertTrue("android.permission.ACCESS_FINE_LOCATION" in SessionPermissions.required(32))
        assertTrue("android.permission.NEARBY_WIFI_DEVICES" in SessionPermissions.required(33))
        assertTrue("android.permission.ACCESS_FINE_LOCATION" !in SessionPermissions.required(34))
    }

    private fun gzip(text: String): ByteArray {
        val out = java.io.ByteArrayOutputStream()
        java.util.zip.GZIPOutputStream(out).use { it.write(text.toByteArray()) }
        return out.toByteArray()
    }
}
