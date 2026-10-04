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

class ScoreInputAndTargetTest {
    private val players = listOf(Player("a", "Alice"), Player("b", "Bob"), Player("c", "Chloé"))

    @Test
    fun `lecture d'un nombre saisi`() {
        assertEquals(12.0, ScoreInput.parse("12"))
        assertEquals(12.5, ScoreInput.parse(" 12,5 "))
        assertEquals(-3.0, ScoreInput.parse("-3"))
        assertEquals(-3.0, ScoreInput.parse("3", negative = true))
        assertEquals(-3.0, ScoreInput.parse("-3", negative = true))
        assertEquals(null, ScoreInput.parse(""))
        assertEquals(null, ScoreInput.parse("abc"))
        assertEquals(null, ScoreInput.parse("Infinity"))
        assertEquals(null, ScoreInput.parse("1e5"))
        assertEquals(null, ScoreInput.parse("5."))
    }

    @Test
    fun `meneur selon le sens du jeu, premier de la table en cas d'egalite`() {
        val totals = mapOf("a" to 10.0, "b" to 30.0, "c" to 10.0)
        assertEquals("b", TargetStatus.leader(players, totals, lowestWins = false)?.id)
        assertEquals("a", TargetStatus.leader(players, totals, lowestWins = true)?.id)
    }

    @Test
    fun `sans objectif, pas de message`() {
        assertEquals(null, TargetStatus.describe(players, mapOf("a" to 5.0), null, false))
    }

    @Test
    fun `objectif pas encore atteint`() {
        val totals = mapOf("a" to 40.0, "b" to 99.0, "c" to 10.0)
        assertEquals("Objectif : 100 points", TargetStatus.describe(players, totals, 100.0, true))
    }

    @Test
    fun `objectif atteint, le plus petit score gagne`() {
        val totals = mapOf("a" to 104.0, "b" to 60.0, "c" to 100.0)
        assertEquals(
            "Objectif de 100 atteint par Alice, Chloé. En tête : Bob (60).",
            TargetStatus.describe(players, totals, 100.0, lowestWins = true),
        )
    }

    @Test
    fun `objectif lu dans les reglages de la partie`() {
        val m = StoredMatch("m", "x", players, settings = mapOf("target" to "66.0"), createdAt = 0)
        assertEquals(66.0, TargetStatus.target(m))
        assertEquals(null, TargetStatus.target(m.copy(settings = emptyMap())))
        assertEquals(null, TargetStatus.target(m.copy(settings = mapOf("target" to "oups"))))
    }
}
