package com.panagames.app.games

import androidx.compose.runtime.Composable
import com.panagames.core.StoredMatch
import com.panagames.core.TargetStatus
import com.panagames.core.roundScores
import com.panagames.core.totals
import com.panagames.freecounter.FreeCounterGameModule
import com.panagames.skyjo.SkyjoGameModule
import com.panagames.skyjo.SkyjoRoundSummarizer

private val targetOption = NumberOption(
    key = TargetStatus.SETTING_TARGET,
    label = "Objectif de points (facultatif)",
    description = "Un message s'affiche quand un joueur l'atteint.",
)

/** Jeux à points saisis à la main (compteur libre, 6 qui prend !). */
open class CounterGame(
    private val module: FreeCounterGameModule,
    override val tagline: String,
    /** `null` : réglable à la création ; sinon imposé par le jeu. */
    private val lowestWins: Boolean?,
    private val defaultTarget: String?,
    private val allowNegative: Boolean,
) : GameDefinition {
    override val id = module.id
    override val displayName = module.displayName
    override val minPlayers = module.minPlayers
    override val maxPlayers = module.maxPlayers

    override val options = if (lowestWins == null) {
        listOf(
            GameOption(
                key = TargetStatus.SETTING_LOWEST_WINS,
                label = "Le plus petit score gagne",
                description = "À activer pour les jeux où il faut marquer le moins de points.",
                default = false,
            ),
        )
    } else emptyList()

    override val numberOptions = listOf(targetOption.copy(default = defaultTarget))

    override val fixedSettings =
        if (lowestWins == null) emptyMap() else mapOf(TargetStatus.SETTING_LOWEST_WINS to lowestWins.toString())

    override fun totals(match: StoredMatch) = module.totals(match)

    override fun roundScores(match: StoredMatch) = module.roundScores(match)

    override fun describeRound(match: StoredMatch, index: Int) = RoundDescription("", "")

    override fun status(match: StoredMatch) = TargetStatus.describe(
        match.players, totals(match), TargetStatus.target(match), match.flag(TargetStatus.SETTING_LOWEST_WINS),
    )

    override fun leaderId(match: StoredMatch) =
        TargetStatus.leader(match.players, totals(match), match.flag(TargetStatus.SETTING_LOWEST_WINS))?.id

    @Composable
    override fun RoundEditor(
        match: StoredMatch,
        roundIndex: Int?,
        onSave: (String) -> Unit,
        onDelete: (() -> Unit)?,
        onCancel: () -> Unit,
    ) = CounterRoundEditor(match, roundIndex, module, allowNegative, onSave, onDelete, onCancel)
}

object FreeCounterGame : CounterGame(
    module = FreeCounterGameModule.FREE,
    tagline = "2 à 6 joueurs · points saisis à la main, objectif facultatif",
    lowestWins = null,
    defaultTarget = null,
    allowNegative = true,
)

object SixQuiPrendGame : CounterGame(
    module = FreeCounterGameModule.SIX_QUI_PREND,
    tagline = "2 à 10 joueurs · têtes de bœuf additionnées, fin à 66, le plus petit score gagne",
    lowestWins = true,
    defaultTarget = "66",
    allowNegative = false,
)

object SkyjoGame : GameDefinition {
    override val id = SkyjoGameModule.id
    override val displayName = SkyjoGameModule.displayName
    override val tagline = "2 à 8 joueurs · le plus petit score gagne, points doublés si on termine sans être le plus bas"
    override val minPlayers = SkyjoGameModule.minPlayers
    override val maxPlayers = SkyjoGameModule.maxPlayers
    override val options = emptyList<GameOption>()

    override val numberOptions = listOf(targetOption.copy(default = SkyjoGameModule.DEFAULT_TARGET.toString()))

    override val fixedSettings = mapOf(TargetStatus.SETTING_LOWEST_WINS to "true")

    override fun totals(match: StoredMatch) = SkyjoGameModule.totals(match)

    override fun roundScores(match: StoredMatch) = SkyjoGameModule.roundScores(match)

    override fun describeRound(match: StoredMatch, index: Int): RoundDescription {
        val names = match.players.associate { it.id to it.name }
        val round = SkyjoGameModule.decodeRound(match.rounds[index])
        val (headline, detail) = SkyjoRoundSummarizer.summarize(round) { names[it] ?: it }
        return RoundDescription(headline, detail)
    }

    override fun status(match: StoredMatch) =
        TargetStatus.describe(match.players, totals(match), TargetStatus.target(match), lowestWins = true)

    override fun leaderId(match: StoredMatch) =
        TargetStatus.leader(match.players, totals(match), lowestWins = true)?.id

    @Composable
    override fun RoundEditor(
        match: StoredMatch,
        roundIndex: Int?,
        onSave: (String) -> Unit,
        onDelete: (() -> Unit)?,
        onCancel: () -> Unit,
    ) = SkyjoRoundEditor(match, roundIndex, onSave, onDelete, onCancel)
}
