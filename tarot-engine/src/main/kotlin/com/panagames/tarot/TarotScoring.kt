package com.panagames.tarot

import kotlin.math.abs

/**
 * Calcule le résultat d'une manche de Tarot : détail du score et points de
 * chaque joueur, à partir du barème officiel de la Fédération Française de
 * Tarot.
 */
object TarotScoring {

    /** Points requis par le camp d'attaque selon le nombre de bouts réalisés. */
    fun seuilRequis(bouts: Int): Int = when (bouts) {
        0 -> 56
        1 -> 51
        2 -> 41
        3 -> 36
        else -> throw IllegalArgumentException("Le nombre de bouts doit être compris entre 0 et 3 (reçu : $bouts).")
    }

    fun calculer(round: TarotRound): TarotRoundResult {
        val seuil = seuilRequis(round.bouts)
        val ecart = round.pointsRealises - seuil
        val contratReussi = ecart >= 0.0

        val baseScore = 25.0 + abs(ecart)
        val scoreContrat = baseScore * round.contract.multiplier * if (contratReussi) 1 else -1

        val bonusPoignee = when {
            round.poignee == null -> 0
            round.poigneeCamp == TarotCamp.ATTAQUE -> round.poignee.bonus
            else -> -round.poignee.bonus
        }

        // Seul le petit au bout est multiplié par le coefficient du contrat
        // (poignée et chelem s'ajoutent après).
        val bonusPetitAuBout = when (round.petitAuBoutCamp) {
            TarotCamp.ATTAQUE -> 10 * round.contract.multiplier
            TarotCamp.DEFENSE -> -10 * round.contract.multiplier
            null -> 0
        }

        val bonusChelem = when {
            round.chelem == null -> 0
            round.chelem.reussi && round.chelem.annonce -> 400
            round.chelem.reussi && !round.chelem.annonce -> 200
            !round.chelem.reussi && round.chelem.annonce -> -200
            else -> 0
        }

        val scoreAttaque = scoreContrat + bonusPoignee + bonusPetitAuBout + bonusChelem

        val points = repartirPoints(round, scoreAttaque)

        return TarotRoundResult(
            seuil = seuil,
            ecart = ecart,
            contratReussi = contratReussi,
            scoreContrat = scoreContrat,
            bonusPoignee = bonusPoignee,
            bonusPetitAuBout = bonusPetitAuBout,
            bonusChelem = bonusChelem,
            scoreAttaque = scoreAttaque,
            points = points,
        )
    }

    /**
     * Répartit le score d'attaque `x` entre tous les joueurs de la table :
     * chaque défenseur paie/reçoit `x`, et le camp d'attaque se partage le
     * total inverse (à 5 joueurs, le preneur touche le double de l'appelé,
     * sauf appel à soi-même où le preneur joue seul contre les 4 autres).
     */
    private fun repartirPoints(round: TarotRound, x: Double): Map<String, Double> {
        val points = mutableMapOf<String, Double>()

        when {
            round.nombreDeJoueurs == 5 && !round.appeleASoiMeme -> {
                val defenseurs = round.defenseurs
                defenseurs.forEach { points[it] = -x }
                points[round.preneurId] = 2 * x
                points[round.appeleId!!] = x
            }
            else -> {
                // 3 ou 4 joueurs, ou "appelé à soi-même" à 5 joueurs : le
                // preneur joue seul contre tous les autres.
                val defenseurs = round.joueurs.filter { it != round.preneurId }
                defenseurs.forEach { points[it] = -x }
                points[round.preneurId] = defenseurs.size * x
            }
        }

        return points
    }
}
