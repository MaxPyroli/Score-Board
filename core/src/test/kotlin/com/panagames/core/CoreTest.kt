package com.panagames.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

/** Jeu factice : une manche = "idJoueur:points". */
private object FakeGame : GameModule<Pair<String, Double>> {
    override val id = "fake"
    override val displayName = "Fake"
    override val minPlayers = 2
    override val maxPlayers = 4
    override fun scoreRound(round: Pair<String, Double>) = mapOf(round.first to round.second)
    override fun encodeRound(round: Pair<String, Double>) = "${round.first}:${round.second}"
    override fun decodeRound(raw: String) = raw.substringBefore(':') to raw.substringAfter(':').toDouble()
}

class CoreTest {
    private val players = listOf(Player("a", "Alice"), Player("b", "Bob"))
    private fun match() = StoredMatch("m1", "fake", players, createdAt = 0)

    @Test
    fun `totaux vides au depart, tous les joueurs presents`() {
        assertEquals(mapOf("a" to 0.0, "b" to 0.0), FakeGame.totals(match()))
    }

    @Test
    fun `totaux deduits des manches`() {
        val m = match().withRound("a:10.0").withRound("b:5.0").withRound("a:-3.0")
        assertEquals(mapOf("a" to 7.0, "b" to 5.0), FakeGame.totals(m))
    }

    @Test
    fun `scores par manche completes pour tous les joueurs`() {
        val m = match().withRound("a:10.0")
        assertEquals(listOf(mapOf("a" to 10.0, "b" to 0.0)), FakeGame.roundScores(m))
    }

    @Test
    fun `annuler la derniere manche`() {
        val m = match().withRound("a:10.0").withRound("b:5.0").withoutLastRound()
        assertEquals(listOf("a:10.0"), m.rounds)
        assertEquals(m, m.copy(rounds = emptyList()).withRound("a:10.0"))
    }

    @Test
    fun `annuler sur une partie vide ne fait rien`() {
        assertEquals(match(), match().withoutLastRound())
    }

    @Test
    fun `remplacer et supprimer une manche au milieu`() {
        val m = match().withRound("a:1.0").withRound("a:2.0").withRound("a:3.0")
        assertEquals(listOf("a:1.0", "b:9.0", "a:3.0"), m.withRoundReplaced(1, "b:9.0").rounds)
        assertEquals(listOf("a:1.0", "a:3.0"), m.withoutRound(1).rounds)
        assertFailsWith<IllegalArgumentException> { m.withoutRound(3) }
        assertFailsWith<IllegalArgumentException> { m.withRoundReplaced(-1, "a:0.0") }
    }

    @Test
    fun `reglages booleens`() {
        val m = match().copy(settings = mapOf("demi" to "true", "x" to "false"))
        assertTrue(m.flag("demi"))
        assertEquals(false, m.flag("x"))
        assertEquals(false, m.flag("absent"))
    }

    @Test
    fun `format des scores`() {
        assertEquals("56", ScoreFormat.plain(56.0))
        assertEquals("56,5", ScoreFormat.plain(56.5))
        assertEquals("0", ScoreFormat.plain(-0.0))
        assertEquals("+60", ScoreFormat.signed(60.0))
        assertEquals("−31", ScoreFormat.signed(-31.0))
        assertEquals("−0,5", ScoreFormat.signed(-0.5))
        assertEquals("0", ScoreFormat.signed(0.0))
    }
}
