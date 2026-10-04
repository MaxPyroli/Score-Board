package com.panagames.freecounter

import com.panagames.core.Player
import com.panagames.core.StoredMatch
import com.panagames.core.totals
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class FreeCounterTest {
    private val ids = listOf("a", "b", "c")
    private val name = { id: String -> id.uppercase() }

    @Test
    fun `encodage puis decodage d'une manche`() {
        val round = FreeRound(mapOf("a" to 12.0, "b" to -3.5, "c" to 0.0))
        val module = FreeCounterGameModule.FREE
        assertEquals(round, module.decodeRound(module.encodeRound(round)))
    }

    @Test
    fun `totaux sur plusieurs manches, 6 qui prend`() {
        val module = FreeCounterGameModule.SIX_QUI_PREND
        val players = ids.map { Player(it, it.uppercase()) }
        val match = StoredMatch("m", module.id, players, createdAt = 0)
            .withRound(module.encodeRound(FreeRound(mapOf("a" to 5.0, "b" to 0.0, "c" to 12.0))))
            .withRound(module.encodeRound(FreeRound(mapOf("a" to 3.0, "b" to 7.0, "c" to 0.0))))
        assertEquals(mapOf("a" to 8.0, "b" to 7.0, "c" to 12.0), module.totals(match))
    }

    @Test
    fun `champs vides comptent zero`() {
        val round = FreeRoundDraft(ids).withText("a", "5").build(name).getOrThrow()
        assertEquals(mapOf("a" to 5.0, "b" to 0.0, "c" to 0.0), round.points)
    }

    @Test
    fun `aucune saisie refusee`() {
        val r = FreeRoundDraft(ids).build(name)
        assertTrue(r.isFailure)
        assertEquals("Saisis au moins un score.", r.exceptionOrNull()?.message)
        assertTrue(FreeRoundDraft(ids).withText("a", "  ").build(name).isFailure)
    }

    @Test
    fun `saisie invalide nomme le joueur`() {
        val r = FreeRoundDraft(ids).withText("b", "abc").build(name)
        assertEquals("Nombre invalide pour B.", r.exceptionOrNull()?.message)
    }

    @Test
    fun `signe moins, virgule decimale`() {
        val round = FreeRoundDraft(ids).withText("a", "2,5").withText("b", "4").withNegative("b", true)
            .build(name).getOrThrow()
        assertEquals(2.5, round.points["a"])
        assertEquals(-4.0, round.points["b"])
        val back = FreeRoundDraft(ids).withText("b", "4").withNegative("b", true).withNegative("b", false)
        assertEquals(4.0, back.build(name).getOrThrow().points["b"])
    }

    @Test
    fun `negatifs refuses quand le jeu les interdit`() {
        val d = FreeRoundDraft(ids).withText("a", "4").withNegative("a", true)
        assertEquals("Score négatif impossible pour A.", d.build(name, allowNegative = false).exceptionOrNull()?.message)
        assertTrue(d.build(name, allowNegative = true).isSuccess)
    }

    @Test
    fun `aller-retour manche vers brouillon`() {
        val round = FreeRound(mapOf("a" to 12.5, "b" to -3.0, "c" to 0.0))
        assertEquals(round, FreeRoundDraft.from(round, ids).build(name).getOrThrow())
    }
}
