package com.panagames.tarot

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class TarotRoundDraftTest {
    private val quatre = listOf("a", "b", "c", "d")
    private val cinq = listOf("a", "b", "c", "d", "e")

    @Test
    fun `brouillon initial valide a 3, 4 et 5 joueurs`() {
        listOf(quatre.take(3), quatre, cinq).forEach { table ->
            val draft = TarotRoundDraft.initial(table, demiPoints = false)
            assertTrue(draft.build().isSuccess, "table de ${table.size}")
            assertEquals(table.first(), draft.preneurId)
        }
        assertEquals("b", TarotRoundDraft.initial(cinq, false).appeleId)
        assertNull(TarotRoundDraft.initial(quatre, false).appeleId)
    }

    @Test
    fun `points defense complementaires`() {
        val d = TarotRoundDraft.initial(quatre, false).withPoints(56.0)
        assertEquals(35.0, d.pointsDefense)
    }

    @Test
    fun `curseur par pas de 1 sans demi-points, arrondi et borne`() {
        val d = TarotRoundDraft.initial(quatre, demiPoints = false)
        assertEquals(57.0, d.withPoints(56.6).pointsRealises)
        assertEquals(0.0, d.withPoints(-5.0).pointsRealises)
        assertEquals(91.0, d.withPoints(200.0).pointsRealises)
        assertEquals(57.0, d.withPointsDelta(1).pointsRealises)
        assertEquals(55.0, d.withPointsDelta(-1).pointsRealises)
    }

    @Test
    fun `curseur par pas de 0,5 avec demi-points`() {
        val d = TarotRoundDraft.initial(quatre, demiPoints = true)
        assertEquals(56.5, d.withPoints(56.4).pointsRealises)
        assertEquals(56.5, d.withPointsDelta(1).pointsRealises - 0.0)
        assertEquals(55.5, d.withPointsDelta(-1).pointsRealises)
    }

    @Test
    fun `desactiver les demi-points arrondit la valeur courante`() {
        val d = TarotRoundDraft.initial(quatre, true).withPoints(56.5).withDemiPoints(false)
        assertEquals(57.0, d.pointsRealises)
        assertFalse(d.demiPoints)
        assertTrue(d.build().isSuccess)
    }

    @Test
    fun `chelem reussi verrouille les points a 91`() {
        val d = TarotRoundDraft.initial(quatre, false).withChelem(TarotChelemChoice.ANNONCE_REUSSI)
        assertEquals(91.0, d.pointsRealises)
        assertTrue(d.pointsVerrouilles)
        assertEquals(91.0, d.withPoints(40.0).pointsRealises)
        assertTrue(d.build().isSuccess)
        assertEquals(400, TarotScoring.calculer(d.build().getOrThrow()).bonusChelem)
    }

    @Test
    fun `chelem rate ne peut pas avoir 91 points`() {
        val d = TarotRoundDraft.initial(quatre, false)
            .withChelem(TarotChelemChoice.REUSSI_NON_ANNONCE)
            .withChelem(TarotChelemChoice.ANNONCE_RATE)
        assertEquals(90.0, d.pointsRealises)
        assertFalse(d.pointsVerrouilles)
    }

    @Test
    fun `poignee sans camp saisi utilise l'attaque par defaut`() {
        val d = TarotRoundDraft.initial(quatre, false).copy(poignee = TarotPoignee.DOUBLE)
        val round = d.build().getOrThrow()
        assertEquals(TarotCamp.ATTAQUE, round.poigneeCamp)
    }

    @Test
    fun `sans poignee le camp est ignore`() {
        val round = TarotRoundDraft.initial(quatre, false).copy(poigneeCamp = TarotCamp.DEFENSE).build().getOrThrow()
        assertNull(round.poigneeCamp)
    }

    @Test
    fun `appele ignore a 4 joueurs`() {
        val round = TarotRoundDraft.initial(quatre, false).withAppele("b").build().getOrThrow()
        assertNull(round.appeleId)
    }

    @Test
    fun `appele a soi-meme a 5 joueurs`() {
        val round = TarotRoundDraft.initial(cinq, false).withAppele("a").build().getOrThrow()
        assertTrue(round.appeleASoiMeme)
    }

    @Test
    fun `aller-retour manche vers brouillon`() {
        val round = TarotRound(
            joueurs = cinq, preneurId = "c", appeleId = "e",
            contract = TarotContract.GARDE_SANS, bouts = 2, pointsRealises = 47.5,
            poignee = TarotPoignee.TRIPLE, poigneeCamp = TarotCamp.DEFENSE,
            petitAuBoutCamp = TarotCamp.ATTAQUE,
        )
        val draft = TarotRoundDraft.from(round, demiPoints = false)
        assertTrue(draft.demiPoints, "une manche en demi-points reste modifiable avec")
        assertEquals(round, draft.build().getOrThrow())
    }

    @Test
    fun `aller-retour avec chelem`() {
        val round = TarotRound(
            joueurs = quatre, preneurId = "a", contract = TarotContract.GARDE, bouts = 3,
            pointsRealises = 91.0, chelem = TarotChelem(annonce = false, reussi = true),
        )
        assertEquals(round, TarotRoundDraft.from(round, false).build().getOrThrow())
    }
}
