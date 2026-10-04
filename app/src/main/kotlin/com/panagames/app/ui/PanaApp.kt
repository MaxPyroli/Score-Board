package com.panagames.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import com.panagames.app.AppViewModel
import com.panagames.app.Screen
import com.panagames.app.games.Games

@Composable
fun PanaApp(vm: AppViewModel) {
    val stack by vm.stack.collectAsState()
    val matches by vm.matches.collectAsState()
    val screen = stack.last()

    BackHandler(enabled = stack.size > 1) { vm.back() }

    when (screen) {
        Screen.Home -> HomeScreen(
            matches = matches,
            onNewMatch = { vm.navigate(Screen.NewMatch(it.id)) },
            onOpenMatch = { vm.navigate(Screen.Match(it.id)) },
            onDeleteMatch = { vm.delete(it.id) },
        )

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
            )
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
