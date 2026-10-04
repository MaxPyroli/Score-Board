package com.panagames.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.panagames.core.Player
import com.panagames.core.ScoreFormat

@Composable
fun scoreColor(value: Double): Color = when {
    value > 0 -> MaterialTheme.colorScheme.primary
    value < 0 -> MaterialTheme.colorScheme.error
    else -> MaterialTheme.colorScheme.onSurfaceVariant
}

@Composable
fun SectionTitle(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text.uppercase(),
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = modifier.padding(top = 20.dp, bottom = 8.dp),
    )
}

/**
 * Une ligne de valeurs, une colonne par joueur. Les colonnes ont toutes la
 * même largeur : l'en-tête du tableau et les lignes de l'historique restent alignés.
 */
@Composable
fun PlayerColumns(
    players: List<Player>,
    modifier: Modifier = Modifier,
    content: @Composable (Player) -> Unit,
) {
    Row(modifier = modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        players.forEach { player ->
            Column(
                modifier = Modifier.weight(1f),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) { content(player) }
        }
    }
}

@Composable
fun ScoreCell(value: Double, signed: Boolean, size: TextUnit = 16.sp, bold: Boolean = false) {
    Text(
        text = if (signed) ScoreFormat.signed(value) else ScoreFormat.plain(value),
        color = scoreColor(value),
        fontSize = size,
        fontWeight = if (bold) FontWeight.Bold else FontWeight.Medium,
        textAlign = TextAlign.Center,
        maxLines = 1,
    )
}

@Composable
fun PlayerNameCell(name: String, compact: Boolean = false) {
    Text(
        text = name,
        style = if (compact) MaterialTheme.typography.labelSmall else MaterialTheme.typography.labelLarge,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        textAlign = TextAlign.Center,
    )
}
