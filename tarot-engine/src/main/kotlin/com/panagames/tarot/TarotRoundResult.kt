package com.panagames.tarot

/**
 * Détail du calcul d'une manche, en plus des points attribués à chaque
 * joueur : utile pour l'affichage ("feuille de marque") et pour les tests.
 *
 * @param seuil points requis par le camp d'attaque selon le nombre de bouts.
 * @param ecart pointsRealises - seuil (peut être négatif si le contrat échoue).
 * @param contratReussi `true` si pointsRealises >= seuil.
 * @param scoreContrat (25 + |ecart|) * multiplicateur du contrat, signé selon
 *   la réussite ou l'échec du contrat.
 * @param bonusPoignee delta signé (positif pour l'attaque) dû à la poignée.
 * @param bonusPetitAuBout delta signé (positif pour l'attaque) dû au petit au bout.
 * @param bonusChelem delta signé (positif pour l'attaque) dû au chelem.
 * @param scoreAttaque somme de tous les bonus ci-dessus : c'est le montant "X"
 *   à partir duquel les points de chaque joueur sont dérivés.
 * @param points score de chaque joueur pour cette manche, indexé par
 *   identifiant de joueur. La somme de toutes les valeurs vaut toujours 0.
 */
data class TarotRoundResult(
    val seuil: Int,
    val ecart: Double,
    val contratReussi: Boolean,
    val scoreContrat: Double,
    val bonusPoignee: Int,
    val bonusPetitAuBout: Int,
    val bonusChelem: Int,
    val scoreAttaque: Double,
    val points: Map<String, Double>,
)
