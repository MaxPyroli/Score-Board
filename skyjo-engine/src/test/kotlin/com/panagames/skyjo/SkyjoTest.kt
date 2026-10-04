package com.panagames.skyjo

import com.panagames.core.Player
import com.panagames.core.StoredMatch
import com.panagames.core.totals
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class SkyjoTest {
    private val ids = listOf("a", "b", "c")
    private val name = { id: String -> id.uppercase() }

    private fun round(a: Int, b: Int, c: Int, finisher: String = "a") =
        SkyjoRound(mapOf("a" to a, "b" to b, "c" to c), finisher)

    @Test
    fun `celui qui termine avec le score le plus bas ne double pas`() {
        val r = SkyjoScoring.calculer(round(10, 14, 20))
        assertFalse(r.finisherDoubled)
        assertEquals(mapOf("a" to 10, "b" to 14, "c" to 20), r.points)
    }

    @Test
    fun `celui qui termine sans etre le plus bas double ses points`() {
        val r = SkyjoScoring.calculer(round(15, 9, 20))
        assertTrue(r.finisherDoubled)
        assertEquals(mapOf("a" to 30, "b" to 9, "c" to 20), r.points)
    }

    @Test
    fun `egalite pour le plus bas, les points sont doubles`() {
        val r = SkyjoScoring.calculer(round(12, 12, 30))
        assertTrue(r.finisherDoubled)
        assertEquals(24, r.points["a"])
    }

    @Test
    fun `un score nul ou negatif n'est jamais double`() {
        assertFalse(SkyjoScoring.calculer(round(0, -2, 5)).finisherDoubled)
        assertEquals(-4, SkyjoScoring.calculer(round(-4, -6, 5)).points["a"])
        assertFalse(SkyjoScoring.calculer(round(-4, -6, 5)).finisherDoubled)
    }

    @Test
    fun `un autre joueur qui n'a pas fini n'est jamais double`() {
        val r = SkyjoScoring.calculer(round(3, 40, 41, finisher = "a"))
        assertEquals(40, r.points["b"])
    }

    @Test
    fun `manche invalide refusee`() {
        assertFailsWith<IllegalArgumentException> { round(200, 1, 1) }
        assertFailsWith<IllegalArgumentException> { round(-25, 1, 1) }
        assertFailsWith<IllegalArgumentException> { round(1, 1, 1, finisher = "z") }
        assertFailsWith<IllegalArgumentException> { SkyjoRound(emptyMap(), "a") }
    }

    @Test
    fun `totaux de partie avec doublement`() {
        val players = ids.map { Player(it, it.uppercase()) }
        val m = StoredMatch("m", "skyjo", players, createdAt = 0)
            .withRound(SkyjoGameModule.encodeRound(round(10, 14, 20)))
            .withRound(SkyjoGameModule.encodeRound(round(15, 9, 20)))
        assertEquals(mapOf("a" to 40.0, "b" to 23.0, "c" to 40.0), SkyjoGameModule.totals(m))
    }

    @Test
    fun `encodage puis decodage`() {
        val r = round(15, 9, 20, finisher = "b")
        assertEquals(r, SkyjoGameModule.decodeRound(SkyjoGameModule.encodeRound(r)))
    }

    @Test
    fun `brouillon complet`() {
        val d = SkyjoRoundDraft(ids).withText("a", "15").withText("b", "9").withText("c", "20").withFinisher("a")
        assertEquals(round(15, 9, 20), d.build(name).getOrThrow())
    }

    @Test
    fun `brouillon avec score negatif`() {
        val d = SkyjoRoundDraft(ids).withText("a", "4").withNegative("a", true)
            .withText("b", "9").withText("c", "20").withFinisher("a")
        assertEquals(-4, d.build(name).getOrThrow().scores["a"])
    }

    @Test
    fun `brouillon incomplet ou invalide`() {
        val base = SkyjoRoundDraft(ids).withText("a", "15").withText("b", "9").withText("c", "20")
        assertEquals("Indique qui a terminé la manche.", base.build(name).exceptionOrNull()?.message)
        assertEquals("Saisis le score de C.", SkyjoRoundDraft(ids).withText("a", "1").withText("b", "2")
            .withFinisher("a").build(name).exceptionOrNull()?.message)
        assertEquals("Le score de A doit être un nombre entier.", base.withText("a", "2,5").withFinisher("a")
            .build(name).exceptionOrNull()?.message)
        assertEquals("Nombre invalide pour A.", base.withText("a", "x").withFinisher("a")
            .build(name).exceptionOrNull()?.message)
    }

    @Test
    fun `aller-retour manche vers brouillon`() {
        val r = round(-4, 9, 20, finisher = "b")
        assertEquals(r, SkyjoRoundDraft.from(r, ids).build(name).getOrThrow())
    }

    @Test
    fun `resume`() {
        assertEquals("A a terminé la manche" to "", SkyjoRoundSummarizer.summarize(round(10, 14, 20), name))
        assertEquals(
            "A a terminé la manche" to "points de A doublés (30 au lieu de 15)",
            SkyjoRoundSummarizer.summarize(round(15, 9, 20), name),
        )
    }
}
