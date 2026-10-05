package com.panagames.app

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.panagames.app.data.AppDatabase
import com.panagames.app.data.MatchRepository
import com.panagames.app.games.Games
import com.panagames.app.session.SessionManager
import com.panagames.core.Player
import com.panagames.core.StoredMatch
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.util.UUID

sealed interface Screen {
    data object Home : Screen
    data class NewMatch(val gameId: String) : Screen
    data class Match(val matchId: String) : Screen
    data class RoundEditor(val matchId: String, val roundIndex: Int?) : Screen
    data object Join : Screen
}

/**
 * Source de vérité en mémoire (l'interface réagit immédiatement), avec
 * écriture dans Room en arrière-plan, dans l'ordre des modifications.
 */
class AppViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = MatchRepository(AppDatabase.create(application).matchDao())
    private val writeLock = Mutex()

    /** Partage Nearby : hôte (partie partagée) ou spectateur (partie suivie en lecture seule). */
    val session = SessionManager(application, viewModelScope, ::validateReceived)

    private val _matches = MutableStateFlow<List<StoredMatch>?>(null)
    /** `null` tant que les parties n'ont pas été chargées depuis le stockage. */
    val matches: StateFlow<List<StoredMatch>?> = _matches.asStateFlow()

    private val _stack = MutableStateFlow<List<Screen>>(listOf(Screen.Home))
    val stack: StateFlow<List<Screen>> = _stack.asStateFlow()

    init {
        viewModelScope.launch { _matches.value = repository.loadAll() }
    }

    fun navigate(screen: Screen) {
        _stack.value = _stack.value + screen
    }

    fun back() {
        if (_stack.value.last() is Screen.Join) session.leave()
        if (_stack.value.size > 1) _stack.value = _stack.value.dropLast(1)
    }

    /** Crée la partie et remplace l'écran « nouvelle partie » par la partie elle-même. */
    fun createMatch(gameId: String, players: List<Player>, settings: Map<String, String>): String {
        val match = StoredMatch(
            id = UUID.randomUUID().toString(),
            moduleId = gameId,
            players = players,
            settings = settings,
            createdAt = System.currentTimeMillis(),
        )
        persist(match)
        _stack.value = _stack.value.dropLast(1) + Screen.Match(match.id)
        return match.id
    }

    fun save(match: StoredMatch) = persist(match)

    fun delete(id: String) {
        if ((session.hostState.value as? SessionManager.HostState.Sharing)?.matchId == id) session.stopHosting()
        _matches.value = _matches.value?.filterNot { it.id == id }
        viewModelScope.launch { writeLock.withLock { repository.delete(id) } }
    }

    private fun persist(match: StoredMatch) {
        val now = System.currentTimeMillis()
        val current = _matches.value.orEmpty()
        _matches.value = if (current.any { it.id == match.id }) {
            current.map { if (it.id == match.id) match else it }
        } else {
            listOf(match) + current
        }
        viewModelScope.launch { writeLock.withLock { repository.save(match, now) } }
        session.hostUpdate(match)
    }

    /** Une partie reçue d'un autre téléphone est affichée telle quelle : on vérifie qu'on sait la lire. */
    private fun validateReceived(match: StoredMatch): String? {
        val game = Games.byId(match.moduleId)
            ?: return "Ce jeu n'existe pas dans ta version de l'appli. Mets-la à jour."
        val readable = runCatching {
            game.totals(match)
            game.roundScores(match)
            match.rounds.indices.forEach { game.describeRound(match, it) }
            game.status(match)
        }.isSuccess
        return if (readable) null else "Les données reçues sont illisibles."
    }

    override fun onCleared() {
        session.shutdown()
    }
}
