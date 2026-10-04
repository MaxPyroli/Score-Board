package com.panagames.tarot

import com.panagames.core.Player
import com.panagames.core.StoredMatch
import com.panagames.core.roundScores
import com.panagames.core.totals
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class TarotGameModuleTest {
    private val ids = listOf("a", "b", "c", "d")
    private val players = ids.map { Player(it, it.uppercase()) }

    private fun round(preneur: String, points: Double, contract: TarotContract = TarotContract.PETITE) = TarotRound(
        joueurs = ids, preneurId = preneur, contract = contract, bouts = 0, pointsRealises = points,
    )

    @Test
    fun `encodage puis decodage restitue la manche`() {
        val round = TarotRound(
            joueurs = listOf("a", "b", "c", "d", "e"), preneurId = "a", appeleId = "b",
            contract = TarotContract.GARDE_CONTRE, bouts = 3, pointsRealises = 91.0,
            poignee = TarotPoignee.SIMPLE, poigneeCamp = TarotCamp.ATTAQUE,
            petitAuBoutCamp = TarotCamp.DEFENSE, chelem = TarotChelem(annonce = true, reussi = true),
        )
        assertEquals(round, TarotGameModule.decodeRound(TarotGameModule.encodeRound(round)))
    }

    @Test
    fun `une manche minimale se decode aussi`() {
        val round = round("a", 56.0)
        assertEquals(round, TarotGameModule.decodeRound(TarotGameModule.encodeRound(round)))
    }

    @Test
    fun `totaux d'une partie sur plusieurs manches`() {
        val match = StoredMatch("m", "tarot", players, createdAt = 0)
            .withRound(TarotGameModule.encodeRound(round("a", 56.0))) // X = 25 : a +75, autres -25
            .withRound(TarotGameModule.encodeRound(round("b", 56.0))) // b +75, autres -25

        val totals = TarotGameModule.totals(match)
        assertEquals(mapOf("a" to 50.0, "b" to 50.0, "c" to -50.0, "d" to -50.0), totals)
        assertEquals(0.0, totals.values.sum())
        assertEquals(2, TarotGameModule.roundScores(match).size)
    }

    @Test
    fun `annuler la derniere manche restaure les totaux`() {
        val one = StoredMatch("m", "tarot", players, createdAt = 0)
            .withRound(TarotGameModule.encodeRound(round("a", 56.0)))
        val two = one.withRound(TarotGameModule.encodeRound(round("b", 30.0)))
        assertEquals(TarotGameModule.totals(one), TarotGameModule.totals(two.withoutLastRound()))
    }

    @Test
    fun `resume d'une manche reussie a 4 joueurs`() {
        val s = TarotRoundSummarizer.summarize(round("a", 61.0, TarotContract.GARDE).copy(bouts = 1)) { it.uppercase() }
        assertTrue(s.contratReussi)
        assertEquals("A · Garde", s.headline)
        assertEquals("1 bout · 61 pts · contrat réussi de 10", s.detail)
    }

    @Test
    fun `resume d'une manche chutee a 5 joueurs avec bonus`() {
        val r = TarotRound(
            joueurs = listOf("a", "b", "c", "d", "e"), preneurId = "a", appeleId = "a",
            contract = TarotContract.GARDE_SANS, bouts = 2, pointsRealises = 35.5,
            poignee = TarotPoignee.DOUBLE, poigneeCamp = TarotCamp.DEFENSE,
            petitAuBoutCamp = TarotCamp.ATTAQUE,
        )
        val s = TarotRoundSummarizer.summarize(r) { it.uppercase() }
        assertEquals(false, s.contratReussi)
        assertEquals("A · Garde sans (appelé à soi-même)", s.headline)
        assertEquals(
            "2 bouts · 35,5 pts · contrat chuté de 5,5 · poignée double (défense) · petit au bout (attaque)",
            s.detail,
        )
    }
}
