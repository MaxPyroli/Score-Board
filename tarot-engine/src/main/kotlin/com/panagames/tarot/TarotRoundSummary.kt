package com.panagames.tarot

import com.panagames.core.ScoreFormat

/** Texte d'une manche pour l'historique. */
data class TarotRoundSummary(
    val headline: String,
    val detail: String,
    val contratReussi: Boolean,
)

object TarotRoundSummarizer {
    fun summarize(round: TarotRound, nameOf: (String) -> String): TarotRoundSummary {
        val result = TarotScoring.calculer(round)
        val preneur = nameOf(round.preneurId)

        val headline = buildString {
            append(preneur).append(" · ").append(round.contract.label)
            if (round.nombreDeJoueurs == 5) {
                if (round.appeleASoiMeme) append(" (appelé à soi-même)")
                else append(" (avec ").append(nameOf(round.appeleId!!)).append(")")
            }
        }

        val bouts = if (round.bouts > 1) "${round.bouts} bouts" else "${round.bouts} bout"
        val issue = if (result.contratReussi) {
            "contrat réussi de ${ScoreFormat.plain(result.ecart)}"
        } else {
            "contrat chuté de ${ScoreFormat.plain(-result.ecart)}"
        }
        val extras = buildList {
            round.poignee?.let {
                add("poignée ${it.label} (${if (round.poigneeCamp == TarotCamp.ATTAQUE) "attaque" else "défense"})")
            }
            round.petitAuBoutCamp?.let {
                add("petit au bout (${if (it == TarotCamp.ATTAQUE) "attaque" else "défense"})")
            }
            round.chelem?.takeIf { it.annonce || it.reussi }?.let {
                add("chelem ${TarotChelemChoice.from(it).label.lowercase()}")
            }
        }
        val detail = (listOf("$bouts", "${ScoreFormat.plain(round.pointsRealises)} pts", issue) + extras)
            .joinToString(" · ")

        return TarotRoundSummary(headline, detail, result.contratReussi)
    }
}
