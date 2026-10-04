package com.panagames.app.session

import android.content.Context
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.AdvertisingOptions
import com.google.android.gms.nearby.connection.ConnectionInfo
import com.google.android.gms.nearby.connection.ConnectionLifecycleCallback
import com.google.android.gms.nearby.connection.ConnectionResolution
import com.google.android.gms.nearby.connection.ConnectionsClient
import com.google.android.gms.nearby.connection.ConnectionsStatusCodes
import com.google.android.gms.nearby.connection.DiscoveredEndpointInfo
import com.google.android.gms.nearby.connection.DiscoveryOptions
import com.google.android.gms.nearby.connection.EndpointDiscoveryCallback
import com.google.android.gms.nearby.connection.Payload
import com.google.android.gms.nearby.connection.PayloadCallback
import com.google.android.gms.nearby.connection.PayloadTransferUpdate
import com.google.android.gms.nearby.connection.Strategy
import com.panagames.core.StoredMatch
import com.panagames.session.PayloadChunks
import com.panagames.session.SessionCode
import com.panagames.session.SyncCodec
import com.panagames.session.SyncDecode
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Partage d'une partie entre téléphones proches, sans internet (Nearby Connections).
 * L'hôte annonce un code court ; les autres le recherchent, se connectent et
 * reçoivent la partie en direct, en lecture seule. L'hôte garde la version de
 * référence : chaque modification est renvoyée en entier à tous les spectateurs.
 *
 * Un appareil est hôte OU spectateur, jamais les deux à la fois.
 */
class SessionManager(
    context: Context,
    private val scope: CoroutineScope,
    /** Vérifie qu'une partie reçue est utilisable ; renvoie un message d'erreur sinon. */
    private val validate: (StoredMatch) -> String?,
) {
    sealed interface HostState {
        data object Idle : HostState
        data class Sharing(val matchId: String, val code: String, val viewers: Int) : HostState
        data class Failed(val message: String) : HostState
    }

    sealed interface JoinState {
        data object Idle : JoinState
        data class Searching(val code: String) : JoinState
        data class Connecting(val code: String) : JoinState

        /** Connecté ; [match] reste `null` jusqu'à la réception de la première version de la partie. */
        data class Live(val code: String, val match: StoredMatch?, val connected: Boolean) : JoinState
        data class Failed(val message: String) : JoinState
    }

    private val client: ConnectionsClient = Nearby.getConnectionsClient(context.applicationContext)

    private val _hostState = MutableStateFlow<HostState>(HostState.Idle)
    val hostState: StateFlow<HostState> = _hostState.asStateFlow()

    private val _joinState = MutableStateFlow<JoinState>(JoinState.Idle)
    val joinState: StateFlow<JoinState> = _joinState.asStateFlow()

    // --- Hôte ---

    private var hostedMatch: StoredMatch? = null
    private val viewers = mutableSetOf<String>()
    private var nextMessageId = 1

    private val ignoredPayloads = object : PayloadCallback() {
        override fun onPayloadReceived(endpointId: String, payload: Payload) = Unit
        override fun onPayloadTransferUpdate(endpointId: String, update: PayloadTransferUpdate) = Unit
    }

    private val hostCallbacks = object : ConnectionLifecycleCallback() {
        override fun onConnectionInitiated(endpointId: String, info: ConnectionInfo) {
            client.acceptConnection(endpointId, ignoredPayloads)
        }

        override fun onConnectionResult(endpointId: String, result: ConnectionResolution) {
            val match = hostedMatch ?: return
            if (result.status.isSuccess) {
                viewers += endpointId
                publishViewerCount()
                send(listOf(endpointId), match)
            }
        }

        override fun onDisconnected(endpointId: String) {
            viewers -= endpointId
            publishViewerCount()
        }
    }

    fun startHosting(match: StoredMatch) {
        leave()
        stopHosting()
        val code = SessionCode.generate()
        hostedMatch = match
        _hostState.value = HostState.Sharing(match.id, code, viewers = 0)
        val options = AdvertisingOptions.Builder().setStrategy(Strategy.P2P_STAR).build()
        client.startAdvertising(code, SERVICE_ID, hostCallbacks, options)
            .addOnFailureListener { e ->
                hostedMatch = null
                _hostState.value = HostState.Failed(describe("Impossible de démarrer le partage", e))
            }
    }

    /** À appeler à chaque modification de la partie : les spectateurs la reçoivent aussitôt. */
    fun hostUpdate(match: StoredMatch) {
        if (hostedMatch?.id != match.id) return
        hostedMatch = match
        send(viewers.toList(), match)
    }

    fun stopHosting() {
        if (_hostState.value is HostState.Idle && hostedMatch == null) return
        client.stopAdvertising()
        viewers.forEach { client.disconnectFromEndpoint(it) }
        viewers.clear()
        hostedMatch = null
        _hostState.value = HostState.Idle
    }

    private fun publishViewerCount() {
        (_hostState.value as? HostState.Sharing)?.let { _hostState.value = it.copy(viewers = viewers.size) }
    }

    private fun send(endpoints: List<String>, match: StoredMatch) {
        if (endpoints.isEmpty()) return
        val messageId = nextMessageId++
        PayloadChunks.split(messageId, SyncCodec.encode(match)).forEach { chunk ->
            client.sendPayload(endpoints, Payload.fromBytes(chunk))
        }
    }

    // --- Spectateur ---

    private var hostEndpoint: String? = null
    private var searchTimeout: Job? = null
    private var reconnectJob: Job? = null
    private var reassembler = PayloadChunks.Reassembler()

    fun join(rawCode: String) {
        val code = SessionCode.normalize(rawCode)
        if (code == null) {
            _joinState.value = JoinState.Failed("Code invalide : 4 caractères (lettres et chiffres).")
            return
        }
        stopHosting()
        leave()
        reassembler = PayloadChunks.Reassembler()
        _joinState.value = JoinState.Searching(code)

        val options = DiscoveryOptions.Builder().setStrategy(Strategy.P2P_STAR).build()
        client.startDiscovery(SERVICE_ID, discoveryCallback(code), options)
            .addOnFailureListener { e -> failJoin(describe("Impossible de chercher la partie", e)) }

        searchTimeout = scope.launch {
            delay(SEARCH_TIMEOUT_MS)
            if (_joinState.value is JoinState.Searching) {
                client.stopDiscovery()
                failJoin(
                    "Aucune partie trouvée avec le code $code. Les deux téléphones doivent être proches, " +
                        "avec le Bluetooth et le Wi-Fi activés (et la localisation sur Android 11 ou moins).",
                )
            }
        }
    }

    /** Quitte la partie suivie (ou annule la recherche). */
    fun leave() {
        if (_joinState.value is JoinState.Idle && hostEndpoint == null) return
        searchTimeout?.cancel()
        reconnectJob?.cancel()
        client.stopDiscovery()
        hostEndpoint?.let { client.disconnectFromEndpoint(it) }
        hostEndpoint = null
        _joinState.value = JoinState.Idle
    }

    fun shutdown() {
        stopHosting()
        leave()
    }

    private fun discoveryCallback(code: String) = object : EndpointDiscoveryCallback() {
        override fun onEndpointFound(endpointId: String, info: DiscoveredEndpointInfo) {
            val state = _joinState.value
            val searching = state is JoinState.Searching
            val reconnecting = state is JoinState.Live && !state.connected
            if (!(searching || reconnecting) || info.endpointName != code || hostEndpoint != null) return
            client.stopDiscovery()
            if (searching) {
                searchTimeout?.cancel()
                _joinState.value = JoinState.Connecting(code)
            }
            hostEndpoint = endpointId
            client.requestConnection(LOCAL_NAME, endpointId, clientCallbacks(code))
                .addOnFailureListener { e ->
                    if (searching) failJoin(describe("Connexion impossible", e)) else hostEndpoint = null
                }
        }

        override fun onEndpointLost(endpointId: String) = Unit
    }

    private fun clientCallbacks(code: String) = object : ConnectionLifecycleCallback() {
        override fun onConnectionInitiated(endpointId: String, info: ConnectionInfo) {
            client.acceptConnection(endpointId, clientPayloads(code))
        }

        override fun onConnectionResult(endpointId: String, result: ConnectionResolution) {
            if (endpointId != hostEndpoint) return
            val previous = _joinState.value as? JoinState.Live
            if (result.status.isSuccess) {
                reconnectJob?.cancel()
                reassembler = PayloadChunks.Reassembler()
                // L'hôte renvoie la partie complète dès qu'on se (re)connecte.
                _joinState.value = JoinState.Live(code, match = previous?.match, connected = true)
            } else if (previous != null) {
                hostEndpoint = null // la boucle de reconnexion réessaie
            } else {
                failJoin("L'hôte a refusé la connexion ou elle a échoué. Réessaie.")
            }
        }

        override fun onDisconnected(endpointId: String) {
            if (endpointId != hostEndpoint) return
            hostEndpoint = null
            when (val state = _joinState.value) {
                is JoinState.Live -> {
                    _joinState.value = state.copy(connected = false)
                    reconnect(code)
                }
                is JoinState.Connecting -> failJoin("Connexion perdue avant le début de la partie.")
                else -> Unit
            }
        }
    }

    private fun clientPayloads(code: String) = object : PayloadCallback() {
        override fun onPayloadReceived(endpointId: String, payload: Payload) {
            if (endpointId != hostEndpoint) return
            val bytes = payload.asBytes() ?: return
            val full = reassembler.accept(bytes) ?: return
            when (val decoded = SyncCodec.decode(full)) {
                is SyncDecode.Ok -> {
                    val problem = validate(decoded.match)
                    if (problem != null) failJoin(problem)
                    else _joinState.value = JoinState.Live(code, decoded.match, connected = true)
                }
                SyncDecode.UpdateRequired ->
                    failJoin("Cette partie vient d'une version plus récente de l'appli. Mets l'appli à jour.")
                SyncDecode.Invalid -> Unit
            }
        }

        override fun onPayloadTransferUpdate(endpointId: String, update: PayloadTransferUpdate) = Unit
    }

    /**
     * Après une coupure (téléphones trop éloignés…), relance la recherche de l'hôte en
     * boucle jusqu'à le retrouver : la partie se remet à jour toute seule au retour.
     */
    private fun reconnect(code: String) {
        reconnectJob?.cancel()
        val options = DiscoveryOptions.Builder().setStrategy(Strategy.P2P_STAR).build()
        reconnectJob = scope.launch {
            val giveUpAt = System.currentTimeMillis() + RECONNECT_GIVE_UP_MS
            while (true) {
                val state = _joinState.value
                if (state !is JoinState.Live || state.connected) return@launch
                if (System.currentTimeMillis() > giveUpAt) {
                    failJoin("Connexion perdue : l'hôte est introuvable. Rapproche-toi de lui et rejoins à nouveau.")
                    return@launch
                }
                if (hostEndpoint == null) {
                    client.stopDiscovery()
                    client.startDiscovery(SERVICE_ID, discoveryCallback(code), options)
                }
                delay(RECONNECT_ATTEMPT_MS)
            }
        }
    }

    private fun failJoin(message: String) {
        searchTimeout?.cancel()
        reconnectJob?.cancel()
        client.stopDiscovery()
        hostEndpoint?.let { client.disconnectFromEndpoint(it) }
        hostEndpoint = null
        _joinState.value = JoinState.Failed(message)
    }

    private fun describe(prefix: String, e: Exception): String {
        val detail = (e as? ApiException)?.let { ConnectionsStatusCodes.getStatusCodeString(it.statusCode) }
        return "$prefix. Vérifie que le Bluetooth et le Wi-Fi sont activés" +
            (detail?.let { " ($it)" } ?: "") + "."
    }

    private companion object {
        const val SERVICE_ID = "com.panagames.app.session"
        const val LOCAL_NAME = "PanaGames"
        const val SEARCH_TIMEOUT_MS = 30_000L
        const val RECONNECT_ATTEMPT_MS = 10_000L
        const val RECONNECT_GIVE_UP_MS = 10 * 60_000L
    }
}
