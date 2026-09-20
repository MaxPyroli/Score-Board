package com.panagames.tarot

/**
 * Déclaration de chelem (faire tous les plis) pour le camp d'attaque.
 *
 * - [annonce] : le chelem a été annoncé avant le début de la donne.
 * - [reussi] : le camp d'attaque a effectivement fait tous les plis.
 */
data class TarotChelem(
    val annonce: Boolean,
    val reussi: Boolean,
)

/**
 * Description complète d'une manche de Tarot, indépendante de toute UI ou
 * stockage : uniquement les informations nécessaires au calcul des points.
 *
 * @param joueurs identifiants de tous les joueurs de la table (3, 4 ou 5).
 * @param preneurId identifiant du preneur.
 * @param appeleId à 5 joueurs, identifiant du joueur dont le roi a été appelé.
 *   Si ce joueur est le preneur lui-même ("appelé à soi-même"), le preneur
 *   joue seul contre les 4 autres. `null` à 3 ou 4 joueurs.
 * @param contract contrat annoncé par le preneur.
 * @param bouts nombre de bouts (0 à 3) dans la levée du camp d'attaque.
 * @param pointsRealises total des points (cartes) réalisés par le camp
 *   d'attaque, de 0.0 à 91.0 par pas de 0.5.
 * @param poignee poignée montrée pendant la donne, ou `null` si aucune.
 * @param poigneeCamp camp ayant réalisé la poignée (ignoré si [poignee] est `null`).
 * @param petitAuBoutCamp camp ayant fait le petit au bout (dernier pli avec le
 *   Petit), ou `null` si le petit n'a pas été joué au dernier pli.
 * @param chelem déclaration de chelem, ou `null` si aucun chelem n'a eu lieu.
 */
data class TarotRound(
    val joueurs: List<String>,
    val preneurId: String,
    val appeleId: String? = null,
    val contract: TarotContract,
    val bouts: Int,
    val pointsRealises: Double,
    val poignee: TarotPoignee? = null,
    val poigneeCamp: TarotCamp? = null,
    val petitAuBoutCamp: TarotCamp? = null,
    val chelem: TarotChelem? = null,
) {
    init {
        require(joueurs.size in 3..5) {
            "Le Tarot se joue à 3, 4 ou 5 joueurs (reçu : ${joueurs.size})."
        }
        require(joueurs.toSet().size == joueurs.size) {
            "Les identifiants de joueurs doivent être uniques."
        }
        require(preneurId in joueurs) {
            "Le preneur doit faire partie des joueurs de la table."
        }
        require(bouts in 0..3) {
            "Le nombre de bouts doit être compris entre 0 et 3 (reçu : $bouts)."
        }
        require(pointsRealises in 0.0..91.0) {
            "Les points réalisés doivent être compris entre 0 et 91 (reçu : $pointsRealises)."
        }
        require((pointsRealises * 2).let { it == Math.floor(it) }) {
            "Les points réalisés doivent être exprimés par pas de 0.5 (reçu : $pointsRealises)."
        }
        if (joueurs.size == 5) {
            requireNotNull(appeleId) { "L'appelé est obligatoire à 5 joueurs." }
            require(appeleId in joueurs) {
                "L'appelé doit faire partie des joueurs de la table."
            }
        } else {
            require(appeleId == null) {
                "L'appelé n'existe qu'à 5 joueurs."
            }
        }
        if (poignee != null) {
            requireNotNull(poigneeCamp) { "Le camp de la poignée doit être précisé." }
        }
        chelem?.let {
            if (it.reussi) {
                require(pointsRealises == 91.0) {
                    "Un chelem réussi implique que le camp d'attaque a fait tous les plis (91 points)."
                }
            }
        }
    }

    /** Nombre de joueurs à cette table (3, 4 ou 5). */
    val nombreDeJoueurs: Int get() = joueurs.size

    /**
     * `true` si l'appelé est le preneur lui-même : à 5 joueurs, le preneur a
     * appelé un roi qu'il possédait déjà et joue donc seul contre les 4 autres.
     */
    val appeleASoiMeme: Boolean get() = joueurs.size == 5 && appeleId == preneurId

    /** Identifiants des joueurs du camp de défense. */
    val defenseurs: List<String>
        get() = joueurs.filter { it != preneurId && (appeleId == null || it != appeleId) }
}
