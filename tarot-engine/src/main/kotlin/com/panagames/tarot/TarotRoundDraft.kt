package com.panagames.tarot

/** Choix de chelem tel que présenté dans le formulaire de saisie. */
enum class TarotChelemChoice(val label: String) {
    AUCUN("Aucun"),
    ANNONCE_REUSSI("Annoncé et réussi"),
    REUSSI_NON_ANNONCE("Réussi non annoncé"),
    ANNONCE_RATE("Annoncé et raté"),
    ;

    val reussi: Boolean get() = this == ANNONCE_REUSSI || this == REUSSI_NON_ANNONCE

    fun toChelem(): TarotChelem? = when (this) {
        AUCUN -> null
        ANNONCE_REUSSI -> TarotChelem(annonce = true, reussi = true)
        REUSSI_NON_ANNONCE -> TarotChelem(annonce = false, reussi = true)
        ANNONCE_RATE -> TarotChelem(annonce = true, reussi = false)
    }

    companion object {
        fun from(chelem: TarotChelem?): TarotChelemChoice = when {
            chelem == null -> AUCUN
            chelem.reussi && chelem.annonce -> ANNONCE_REUSSI
            chelem.reussi -> REUSSI_NON_ANNONCE
            chelem.annonce -> ANNONCE_RATE
            else -> AUCUN
        }
    }
}

/**
 * État du formulaire de saisie d'une manche : toute la logique du formulaire
 * (valeurs par défaut, curseur de points, règles de cohérence) vit ici, en
 * Kotlin pur, pour être testée sans Android. L'écran ne fait que l'afficher.
 */
data class TarotRoundDraft(
    val joueurs: List<String>,
    val preneurId: String,
    val appeleId: String?,
    val contract: TarotContract = TarotContract.GARDE,
    val bouts: Int = 0,
    val pointsRealises: Double = 56.0,
    val poignee: TarotPoignee? = null,
    val poigneeCamp: TarotCamp = TarotCamp.ATTAQUE,
    val petitAuBoutCamp: TarotCamp? = null,
    val chelem: TarotChelemChoice = TarotChelemChoice.AUCUN,
    val demiPoints: Boolean = false,
) {
    val step: Double get() = if (demiPoints) 0.5 else 1.0

    val pointsDefense: Double get() = TOTAL_POINTS - pointsRealises

    /** Le curseur est verrouillé à 91 quand un chelem est réussi. */
    val pointsVerrouilles: Boolean get() = chelem.reussi

    fun withPreneur(id: String): TarotRoundDraft = copy(preneurId = id)

    fun withAppele(id: String): TarotRoundDraft = copy(appeleId = id)

    fun withPoints(value: Double): TarotRoundDraft {
        if (pointsVerrouilles) return this
        return copy(pointsRealises = snap(value))
    }

    fun withPointsDelta(steps: Int): TarotRoundDraft = withPoints(pointsRealises + steps * step)

    fun withChelem(choice: TarotChelemChoice): TarotRoundDraft {
        val points = when {
            choice.reussi -> TOTAL_POINTS
            // Un chelem raté ne peut pas avoir fait tous les points.
            choice == TarotChelemChoice.ANNONCE_RATE && pointsRealises >= TOTAL_POINTS -> TOTAL_POINTS - step
            else -> pointsRealises
        }
        return copy(chelem = choice, pointsRealises = points)
    }

    fun withDemiPoints(enabled: Boolean): TarotRoundDraft =
        copy(demiPoints = enabled).let { it.copy(pointsRealises = it.snap(pointsRealises)) }

    fun build(): Result<TarotRound> = runCatching {
        TarotRound(
            joueurs = joueurs,
            preneurId = preneurId,
            appeleId = appeleId.takeIf { joueurs.size == 5 },
            contract = contract,
            bouts = bouts,
            pointsRealises = pointsRealises,
            poignee = poignee,
            poigneeCamp = poigneeCamp.takeIf { poignee != null },
            petitAuBoutCamp = petitAuBoutCamp,
            chelem = chelem.toChelem(),
        )
    }

    private fun snap(value: Double): Double {
        val clamped = value.coerceIn(0.0, TOTAL_POINTS)
        return Math.round(clamped / step) * step
    }

    companion object {
        const val TOTAL_POINTS = 91.0

        /** Formulaire vide pour une nouvelle manche : le premier joueur prend, le suivant est appelé. */
        fun initial(joueurs: List<String>, demiPoints: Boolean): TarotRoundDraft = TarotRoundDraft(
            joueurs = joueurs,
            preneurId = joueurs.first(),
            appeleId = if (joueurs.size == 5) joueurs[1] else null,
            demiPoints = demiPoints,
        )

        /** Formulaire prérempli depuis une manche existante (modification). */
        fun from(round: TarotRound, demiPoints: Boolean): TarotRoundDraft = TarotRoundDraft(
            joueurs = round.joueurs,
            preneurId = round.preneurId,
            appeleId = round.appeleId,
            contract = round.contract,
            bouts = round.bouts,
            pointsRealises = round.pointsRealises,
            poignee = round.poignee,
            poigneeCamp = round.poigneeCamp ?: TarotCamp.ATTAQUE,
            petitAuBoutCamp = round.petitAuBoutCamp,
            chelem = TarotChelemChoice.from(round.chelem),
            // Une manche déjà saisie avec des demi-points reste modifiable avec.
            demiPoints = demiPoints || round.pointsRealises % 1.0 != 0.0,
        )
    }
}
