package com.panagames.tarot

import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class TarotScoringTest {

    // --- Seuils selon le nombre de bouts ---

    @Test
    fun `seuil requis selon le nombre de bouts`() {
        assertEquals(56, TarotScoring.seuilRequis(0))
        assertEquals(51, TarotScoring.seuilRequis(1))
        assertEquals(41, TarotScoring.seuilRequis(2))
        assertEquals(36, TarotScoring.seuilRequis(3))
    }

    @Test
    fun `seuil requis rejette un nombre de bouts invalide`() {
        assertFailsWith<IllegalArgumentException> { TarotScoring.seuilRequis(4) }
        assertFailsWith<IllegalArgumentException> { TarotScoring.seuilRequis(-1) }
    }

    // --- 4 joueurs ---

    @Test
    fun `4 joueurs, contrat reussi, partage 3X un defenseur`() {
        val round = TarotRound(
            joueurs = listOf("A", "B", "C", "D"),
            preneurId = "A",
            contract = TarotContract.GARDE,
            bouts = 1,
            pointsRealises = 56.0, // seuil 51, ecart +5
        )
        val result = TarotScoring.calculer(round)

        assertEquals(51, result.seuil)
        assertEquals(5.0, result.ecart)
        assertTrue(result.contratReussi)
        // base = 25 + 5 = 30, * multiplicateur GARDE (2) = 60
        assertEquals(60.0, result.scoreContrat)
        assertEquals(60.0, result.scoreAttaque)
        assertEquals(180.0, result.points["A"]) // 3X
        assertEquals(-60.0, result.points["B"])
        assertEquals(-60.0, result.points["C"])
        assertEquals(-60.0, result.points["D"])
        assertSommeNulle(result)
    }

    @Test
    fun `4 joueurs, contrat echoue de peu, le preneur perd quand meme`() {
        // Le score de base (25 + |ecart|) peut rester positif meme si le
        // contrat echoue : seul l'ecart (reussite ou non) determine le signe.
        val round = TarotRound(
            joueurs = listOf("A", "B", "C", "D"),
            preneurId = "A",
            contract = TarotContract.PETITE,
            bouts = 1,
            pointsRealises = 45.0, // seuil 51, ecart -6
        )
        val result = TarotScoring.calculer(round)

        assertEquals(-6.0, result.ecart)
        assertTrue(!result.contratReussi)
        // base = 25 + 6 = 31, negatif car echec : -31 * 1
        assertEquals(-31.0, result.scoreContrat)
        assertEquals(-93.0, result.points["A"]) // 3 * -31
        assertEquals(31.0, result.points["B"])
        assertSommeNulle(result)
    }

    // --- 3 joueurs ---

    @Test
    fun `3 joueurs, le preneur touche 2X`() {
        val round = TarotRound(
            joueurs = listOf("A", "B", "C"),
            preneurId = "A",
            contract = TarotContract.GARDE_SANS,
            bouts = 3,
            pointsRealises = 36.0, // seuil 36, ecart 0 -> reussi
        )
        val result = TarotScoring.calculer(round)

        assertTrue(result.contratReussi)
        // base = 25 + 0 = 25, * 4 = 100
        assertEquals(100.0, result.scoreContrat)
        assertEquals(200.0, result.points["A"])
        assertEquals(-100.0, result.points["B"])
        assertEquals(-100.0, result.points["C"])
        assertSommeNulle(result)
    }

    // --- 5 joueurs ---

    @Test
    fun `5 joueurs, appele distinct, preneur touche 2X et appele touche X`() {
        val round = TarotRound(
            joueurs = listOf("A", "B", "C", "D", "E"),
            preneurId = "A",
            appeleId = "B",
            contract = TarotContract.PETITE,
            bouts = 0,
            pointsRealises = 56.0, // seuil 56, ecart 0 -> reussi
        )
        val result = TarotScoring.calculer(round)

        // base = 25, * 1 = 25
        assertEquals(25.0, result.scoreContrat)
        assertEquals(50.0, result.points["A"]) // 2X
        assertEquals(25.0, result.points["B"]) // X
        assertEquals(-25.0, result.points["C"])
        assertEquals(-25.0, result.points["D"])
        assertEquals(-25.0, result.points["E"])
        assertSommeNulle(result)
    }

    @Test
    fun `5 joueurs, appele a soi-meme, le preneur joue seul contre 4`() {
        val round = TarotRound(
            joueurs = listOf("A", "B", "C", "D", "E"),
            preneurId = "A",
            appeleId = "A",
            contract = TarotContract.GARDE_CONTRE,
            bouts = 2,
            pointsRealises = 41.0, // seuil 41, ecart 0 -> reussi
        )
        val result = TarotScoring.calculer(round)

        assertTrue(round.appeleASoiMeme)
        // base = 25, * 6 = 150
        assertEquals(150.0, result.scoreContrat)
        assertEquals(600.0, result.points["A"]) // 4X
        assertEquals(-150.0, result.points["B"])
        assertEquals(-150.0, result.points["C"])
        assertEquals(-150.0, result.points["D"])
        assertEquals(-150.0, result.points["E"])
        assertSommeNulle(result)
    }

    // --- Poignée ---

    @Test
    fun `poignee simple pour l'attaque ajoute 20 points cote attaque`() {
        val round = TarotRound(
            joueurs = listOf("A", "B", "C", "D"),
            preneurId = "A",
            contract = TarotContract.PETITE,
            bouts = 0,
            pointsRealises = 56.0, // ecart 0
            poignee = TarotPoignee.SIMPLE,
            poigneeCamp = TarotCamp.ATTAQUE,
        )
        val result = TarotScoring.calculer(round)

        assertEquals(20, result.bonusPoignee)
        // scoreContrat = 25, + poignee 20 = 45
        assertEquals(45.0, result.scoreAttaque)
        assertSommeNulle(result)
    }

    @Test
    fun `poignee triple pour la defense retire 40 points cote attaque`() {
        val round = TarotRound(
            joueurs = listOf("A", "B", "C", "D"),
            preneurId = "A",
            contract = TarotContract.PETITE,
            bouts = 0,
            pointsRealises = 56.0,
            poignee = TarotPoignee.TRIPLE,
            poigneeCamp = TarotCamp.DEFENSE,
        )
        val result = TarotScoring.calculer(round)

        assertEquals(-40, result.bonusPoignee)
        assertEquals(-15.0, result.scoreAttaque) // 25 - 40
        assertSommeNulle(result)
    }

    // --- Petit au bout ---

    @Test
    fun `petit au bout reussi par l'attaque ajoute 10 points`() {
        val round = TarotRound(
            joueurs = listOf("A", "B", "C", "D"),
            preneurId = "A",
            contract = TarotContract.PETITE,
            bouts = 0,
            pointsRealises = 56.0,
            petitAuBoutCamp = TarotCamp.ATTAQUE,
        )
        val result = TarotScoring.calculer(round)

        assertEquals(10, result.bonusPetitAuBout)
        assertEquals(35.0, result.scoreAttaque)
        assertSommeNulle(result)
    }

    @Test
    fun `petit au bout rate (pris par la defense) retire 10 points cote attaque`() {
        val round = TarotRound(
            joueurs = listOf("A", "B", "C", "D"),
            preneurId = "A",
            contract = TarotContract.PETITE,
            bouts = 0,
            pointsRealises = 56.0,
            petitAuBoutCamp = TarotCamp.DEFENSE,
        )
        val result = TarotScoring.calculer(round)

        assertEquals(-10, result.bonusPetitAuBout)
        assertEquals(15.0, result.scoreAttaque)
        assertSommeNulle(result)
    }

    // --- Chelem ---

    @Test
    fun `chelem annonce et reussi rapporte 400`() {
        val round = TarotRound(
            joueurs = listOf("A", "B", "C", "D"),
            preneurId = "A",
            contract = TarotContract.GARDE,
            bouts = 0,
            pointsRealises = 91.0,
            chelem = TarotChelem(annonce = true, reussi = true),
        )
        val result = TarotScoring.calculer(round)

        assertEquals(400, result.bonusChelem)
        assertSommeNulle(result)
    }

    @Test
    fun `chelem reussi non annonce rapporte 200`() {
        val round = TarotRound(
            joueurs = listOf("A", "B", "C", "D"),
            preneurId = "A",
            contract = TarotContract.GARDE,
            bouts = 0,
            pointsRealises = 91.0,
            chelem = TarotChelem(annonce = false, reussi = true),
        )
        val result = TarotScoring.calculer(round)

        assertEquals(200, result.bonusChelem)
        assertSommeNulle(result)
    }

    @Test
    fun `chelem annonce et rate coute 200`() {
        val round = TarotRound(
            joueurs = listOf("A", "B", "C", "D"),
            preneurId = "A",
            contract = TarotContract.GARDE,
            bouts = 0,
            pointsRealises = 80.0,
            chelem = TarotChelem(annonce = true, reussi = false),
        )
        val result = TarotScoring.calculer(round)

        assertEquals(-200, result.bonusChelem)
        assertSommeNulle(result)
    }

    // --- Cas limites et validation ---

    @Test
    fun `points realises peuvent etre demi-entiers`() {
        val round = TarotRound(
            joueurs = listOf("A", "B", "C", "D"),
            preneurId = "A",
            contract = TarotContract.PETITE,
            bouts = 0,
            pointsRealises = 55.5,
        )
        val result = TarotScoring.calculer(round)

        assertEquals(-0.5, result.ecart)
        assertSommeNulle(result)
    }

    @Test
    fun `rejette un nombre de joueurs invalide`() {
        assertFailsWith<IllegalArgumentException> {
            TarotRound(
                joueurs = listOf("A", "B"),
                preneurId = "A",
                contract = TarotContract.PETITE,
                bouts = 0,
                pointsRealises = 56.0,
            )
        }
    }

    @Test
    fun `rejette des identifiants de joueurs dupliques`() {
        assertFailsWith<IllegalArgumentException> {
            TarotRound(
                joueurs = listOf("A", "A", "C", "D"),
                preneurId = "A",
                contract = TarotContract.PETITE,
                bouts = 0,
                pointsRealises = 56.0,
            )
        }
    }

    @Test
    fun `rejette un preneur absent de la table`() {
        assertFailsWith<IllegalArgumentException> {
            TarotRound(
                joueurs = listOf("A", "B", "C", "D"),
                preneurId = "Z",
                contract = TarotContract.PETITE,
                bouts = 0,
                pointsRealises = 56.0,
            )
        }
    }

    @Test
    fun `rejette un appele absent a 3 ou 4 joueurs`() {
        assertFailsWith<IllegalArgumentException> {
            TarotRound(
                joueurs = listOf("A", "B", "C", "D"),
                preneurId = "A",
                appeleId = "B",
                contract = TarotContract.PETITE,
                bouts = 0,
                pointsRealises = 56.0,
            )
        }
    }

    @Test
    fun `exige un appele a 5 joueurs`() {
        assertFailsWith<IllegalArgumentException> {
            TarotRound(
                joueurs = listOf("A", "B", "C", "D", "E"),
                preneurId = "A",
                contract = TarotContract.PETITE,
                bouts = 0,
                pointsRealises = 56.0,
            )
        }
    }

    @Test
    fun `rejette un nombre de bouts hors limites`() {
        assertFailsWith<IllegalArgumentException> {
            TarotRound(
                joueurs = listOf("A", "B", "C", "D"),
                preneurId = "A",
                contract = TarotContract.PETITE,
                bouts = 4,
                pointsRealises = 56.0,
            )
        }
    }

    @Test
    fun `rejette des points realises hors limites`() {
        assertFailsWith<IllegalArgumentException> {
            TarotRound(
                joueurs = listOf("A", "B", "C", "D"),
                preneurId = "A",
                contract = TarotContract.PETITE,
                bouts = 0,
                pointsRealises = 92.0,
            )
        }
    }

    @Test
    fun `rejette des points realises qui ne sont pas un multiple de 0,5`() {
        assertFailsWith<IllegalArgumentException> {
            TarotRound(
                joueurs = listOf("A", "B", "C", "D"),
                preneurId = "A",
                contract = TarotContract.PETITE,
                bouts = 0,
                pointsRealises = 56.3,
            )
        }
    }

    @Test
    fun `rejette une poignee sans camp precise`() {
        assertFailsWith<IllegalArgumentException> {
            TarotRound(
                joueurs = listOf("A", "B", "C", "D"),
                preneurId = "A",
                contract = TarotContract.PETITE,
                bouts = 0,
                pointsRealises = 56.0,
                poignee = TarotPoignee.SIMPLE,
            )
        }
    }

    @Test
    fun `rejette un chelem reussi sans avoir fait 91 points`() {
        assertFailsWith<IllegalArgumentException> {
            TarotRound(
                joueurs = listOf("A", "B", "C", "D"),
                preneurId = "A",
                contract = TarotContract.PETITE,
                bouts = 0,
                pointsRealises = 80.0,
                chelem = TarotChelem(annonce = false, reussi = true),
            )
        }
    }

    private fun assertSommeNulle(result: TarotRoundResult) {
        val somme = result.points.values.sum()
        assertTrue(abs(somme) < 1e-9, "La somme des points de la manche doit être nulle, obtenue : $somme")
    }
}
