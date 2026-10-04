package com.panagames.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedIconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.panagames.app.games.GameDefinition
import com.panagames.core.Player
import com.panagames.core.ScoreInput

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NewMatchScreen(
    game: GameDefinition,
    onBack: () -> Unit,
    onStart: (players: List<Player>, settings: Map<String, String>) -> Unit,
) {
    var playerCount by remember { mutableStateOf(game.minPlayers.coerceAtLeast(4).coerceAtMost(game.maxPlayers)) }
    val names = remember { mutableStateListOf(*Array(game.maxPlayers) { "" }) }
    val options = remember { mutableStateMapOf<String, Boolean>().also { map -> game.options.forEach { map[it.key] = it.default } } }

    val numbers = remember {
        mutableStateMapOf<String, String>().also { map ->
            game.numberOptions.forEach { option -> option.default?.let { map[option.key] = it } }
        }
    }
    val badNumber = game.numberOptions.any {
        val text = numbers[it.key].orEmpty()
        text.isNotBlank() && ScoreInput.parse(text) == null
    }

    val finalNames = (0 until playerCount).map { names[it].trim().ifEmpty { "Joueur ${it + 1}" } }
    val hasDuplicates = finalNames.map { it.lowercase() }.toSet().size != finalNames.size

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Nouvelle partie de ${game.displayName}") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour")
                    }
                },
            )
        },
    ) { padding ->
        Column(
            Modifier
                .padding(padding)
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 8.dp),
        ) {
            SectionTitle("Nombre de joueurs", Modifier.padding(top = 4.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
            ) {
                OutlinedIconButton(
                    onClick = { playerCount-- },
                    enabled = playerCount > game.minPlayers,
                ) { Text("−", style = MaterialTheme.typography.titleLarge) }
                Text(
                    text = "$playerCount joueurs",
                    style = MaterialTheme.typography.titleLarge,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.width(150.dp),
                )
                OutlinedIconButton(
                    onClick = { playerCount++ },
                    enabled = playerCount < game.maxPlayers,
                ) { Text("+", style = MaterialTheme.typography.titleLarge) }
            }

            SectionTitle("Joueurs")
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                for (i in 0 until playerCount) {
                    OutlinedTextField(
                        value = names[i],
                        onValueChange = { names[i] = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Joueur ${i + 1}") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(
                            capitalization = KeyboardCapitalization.Words,
                            imeAction = if (i == playerCount - 1) ImeAction.Done else ImeAction.Next,
                        ),
                    )
                }
            }
            if (hasDuplicates) {
                Text(
                    "Deux joueurs ont le même nom.",
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(top = 6.dp),
                )
            }

            if (game.options.isNotEmpty() || game.numberOptions.isNotEmpty()) {
                SectionTitle("Réglages")
                game.options.forEach { option ->
                    Row(
                        Modifier.fillMaxWidth().padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(option.label, style = MaterialTheme.typography.bodyLarge)
                            Text(
                                option.description,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        Switch(
                            checked = options[option.key] == true,
                            onCheckedChange = { options[option.key] = it },
                        )
                    }
                }
            }

            game.numberOptions.forEach { option ->
                OutlinedTextField(
                    value = numbers[option.key].orEmpty(),
                    onValueChange = { numbers[option.key] = it },
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    label = { Text(option.label) },
                    supportingText = { Text(option.description) },
                    isError = ScoreInput.parse(numbers[option.key].orEmpty()) == null &&
                        numbers[option.key].orEmpty().isNotBlank(),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                )
            }

            Button(
                onClick = {
                    val players = finalNames.mapIndexed { i, name -> Player("p${i + 1}", name) }
                    val numberSettings = game.numberOptions.mapNotNull { option ->
                        ScoreInput.parse(numbers[option.key].orEmpty())?.let { option.key to it.toString() }
                    }.toMap()
                    onStart(players, options.mapValues { it.value.toString() } + game.fixedSettings + numberSettings)
                },
                enabled = !hasDuplicates && !badNumber,
                modifier = Modifier.fillMaxWidth().padding(top = 24.dp, bottom = 16.dp),
            ) { Text("Commencer la partie") }
        }
    }
}
