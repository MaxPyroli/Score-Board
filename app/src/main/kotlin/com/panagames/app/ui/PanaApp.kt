package com.panagames.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import com.panagames.app.AppViewModel
import com.panagames.app.Screen
import com.panagames.app.games.Games
import com.panagames.app.session.SessionManager
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun PanaApp(vm: AppViewModel) {
    val stack by vm.stack.collectAsState()
    val matches by vm.matches.collectAsState()
    val screen = stack.last()
    val hostState by vm.session.hostState.collectAsState()
    var shareOpen by remember { mutableStateOf(false) }

    BackHandler(enabled = stack.size > 1) { vm.back() }

    when (screen) {
        Screen.Home -> HomeScreen(
            matches = matches,
            onNewMatch = { vm.navigate(Screen.NewMatch(it.id)) },
            onOpenMatch = { vm.navigate(Screen.Match(it.id)) },
            onDeleteMatch = { vm.delete(it.id) },
            onJoin = { vm.navigate(Screen.Join) },
        )

        Screen.Join -> {
            val join by vm.session.joinState.collectAsState()
            val live = join as? SessionManager.JoinState.Live
            val liveMatch = live?.match
            val liveGame = liveMatch?.let { Games.byId(it.moduleId) }
            if (live != null && liveMatch != null && liveGame != null) {
                MatchScreen(
                    match = liveMatch,
                    game = liveGame,
                    onBack = vm::back,
                    onNewRound = {},
                    onEditRound = {},
                    onChange = {},
                    onDelete = {},
                    readOnly = true,
                    title = "${liveGame.displayName} · lecture seule",
                    note = {
                        if (!live.connected) {
                            Row(
                                Modifier.padding(horizontal = 24.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text(
                                    "Connexion perdue : reconnexion automatique dès que tu es à proximité de l'hôte.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.error,
                                    modifier = Modifier.weight(1f),
                                )
                                TextButton(onClick = vm::back) { Text("Quitter") }
                            }
                        }
                    },
                )
            } else {
                JoinScreen(
                    state = join,
                    onJoin = vm.session::join,
                    onCancel = vm.session::leave,
                    onBack = vm::back,
                )
            }
        }

        is Screen.NewMatch -> {
            val game = Games.byId(screen.gameId)
            if (game == null) LaunchedEffect(screen) { vm.back() }
            else NewMatchScreen(
                game = game,
                onBack = vm::back,
                onStart = { players, settings -> vm.createMatch(game.id, players, settings) },
            )
        }

        is Screen.Match -> {
            val match = matches?.firstOrNull { it.id == screen.matchId }
            val game = match?.let { Games.byId(it.moduleId) }
            if (matches != null && (match == null || game == null)) LaunchedEffect(screen) { vm.back() }
            else if (match != null && game != null) MatchScreen(
                match = match,
                game = game,
                onBack = vm::back,
                onNewRound = { vm.navigate(Screen.RoundEditor(match.id, null)) },
                onEditRound = { vm.navigate(Screen.RoundEditor(match.id, it)) },
                onChange = vm::save,
                onDelete = { vm.back(); vm.delete(match.id) },
                sharing = (hostState as? SessionManager.HostState.Sharing)
                    ?.takeIf { it.matchId == match.id }
                    ?.let { SharingInfo(it.code, it.viewers) },
                onShare = { shareOpen = true },
            )
            if (shareOpen && match != null) {
                ShareDialog(
                    match = match,
                    hostState = hostState,
                    onStart = { vm.session.startHosting(match) },
                    onStop = vm.session::stopHosting,
                    onDismiss = { shareOpen = false },
                )
            }
        }

        is Screen.RoundEditor -> {
            val match = matches?.firstOrNull { it.id == screen.matchId }
            val game = match?.let { Games.byId(it.moduleId) }
            if (matches != null && (match == null || game == null)) LaunchedEffect(screen) { vm.back() }
            else if (match != null && game != null) {
                val index = screen.roundIndex
                game.RoundEditor(
                    match = match,
                    roundIndex = index,
                    onSave = { raw ->
                        vm.save(if (index == null) match.withRound(raw) else match.withRoundReplaced(index, raw))
                        vm.back()
                    },
                    onDelete = index?.let { i ->
                        {
                            vm.save(match.withoutRound(i))
                            vm.back()
                        }
                    },
                    onCancel = vm::back,
                )
            }
        }
    }
}
