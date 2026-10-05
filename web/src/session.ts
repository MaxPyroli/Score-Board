// Partage de partie en direct, de pair à pair (WebRTC via PeerJS). L'annuaire public de PeerJS ne sert
// qu'à mettre deux appareils en relation ; les scores passent ensuite directement d'un appareil à l'autre.
import Peer, { type DataConnection } from "peerjs";
import type { StoredMatch } from "./core";
import { gameById } from "./games/registry";

export const CODE_LENGTH = 4;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O ni 1/I, comme sur Android
const PEER_PREFIX = "scoreboard-";

export const generateCode = (): string =>
  Array.from({ length: CODE_LENGTH }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");

/** Code saisi à la main : majuscules, espaces et tirets ignorés. `null` s'il est invalide. */
export function normalizeCode(input: string): string | null {
  const cleaned = input.toUpperCase().replace(/[\s-]/g, "");
  return cleaned.length === CODE_LENGTH && [...cleaned].every((c) => ALPHABET.includes(c)) ? cleaned : null;
}

/** Lien contenu dans le QR code : ouvre l'appli directement sur « rejoindre ». */
export const joinUrl = (code: string, base = location.href.split("#")[0]) => `${base}#join=${code}`;

export function codeFromHash(hash: string): string | null {
  const m = /^#join=(.+)$/.exec(hash);
  return m ? normalizeCode(m[1]) : null;
}

const MAX_ROUNDS = 1000;

/**
 * Données reçues d'un autre appareil : on ne les affiche que si elles sont complètes et cohérentes
 * (jeu connu, joueurs valides, chaque manche lisible et calculable). `null` sinon.
 */
export function validateReceived(data: unknown): StoredMatch | null {
  try {
    const msg = data as { v?: unknown; type?: unknown; match?: Record<string, unknown> };
    if (!msg || msg.v !== 1 || msg.type !== "snapshot" || typeof msg.match !== "object" || msg.match === null) return null;
    const m = msg.match;
    if (typeof m.id !== "string" || typeof m.moduleId !== "string" || typeof m.createdAt !== "number") return null;
    const game = gameById(m.moduleId);
    if (!game) return null;
    if (!Array.isArray(m.players) || m.players.length < game.minPlayers || m.players.length > game.maxPlayers) return null;
    const players = m.players.map((p: { id?: unknown; name?: unknown }) => {
      if (typeof p?.id !== "string" || typeof p?.name !== "string" || p.id.length > 64 || p.name.length > 40) throw new Error();
      return { id: p.id, name: p.name };
    });
    if (new Set(players.map((p) => p.id)).size !== players.length) return null;
    if (!Array.isArray(m.rounds) || m.rounds.length > MAX_ROUNDS) return null;
    if (!m.rounds.every((r) => typeof r === "string" && r.length < 4000)) return null;
    const settings: Record<string, string> = {};
    if (m.settings && typeof m.settings === "object") {
      for (const [k, v] of Object.entries(m.settings as Record<string, unknown>)) if (typeof v === "string" && v.length < 40) settings[k] = v;
    }
    const match: StoredMatch = { id: m.id, moduleId: m.moduleId, players, rounds: m.rounds as string[], settings, createdAt: m.createdAt };
    game.roundScores(match); // lève une erreur si une manche est illisible
    for (let i = 0; i < match.rounds.length; i++) game.describeRound(match, i);
    return match;
  } catch {
    return null;
  }
}

/** Serveurs d'aide à la connexion : plusieurs STUN, et le relais gratuit de PeerJS en dernier recours. */
const ICE_SERVERS = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:stun.cloudflare.com:3478"] },
  { urls: ["turn:eu-0.turn.peerjs.com:3478", "turn:us-0.turn.peerjs.com:3478"], username: "peerjs", credential: "peerjsp" },
];

/** Annuaire par défaut : celui de PeerJS. `VITE_PEER_SERVER=hote:port` (tests, annuaire maison) le remplace. */
function peerOptions() {
  const custom = import.meta.env.VITE_PEER_SERVER as string | undefined;
  const base = { config: { iceServers: ICE_SERVERS, sdpSemantics: "unified-plan" } };
  if (!custom) return base;
  const [host, port] = custom.split(":");
  return { ...base, host, port: Number(port), path: "/", secure: false };
}

/** Compteurs de diagnostic d'une connexion directe : types de chemins trouvés et état final. */
export interface Diag { ice: string; host: number; srflx: number; relay: number }

function watchDiag(conn: DataConnection, diag: Diag) {
  const pc = (conn as unknown as { peerConnection?: RTCPeerConnection }).peerConnection;
  if (!pc) return;
  diag.ice = pc.iceConnectionState;
  pc.addEventListener("iceconnectionstatechange", () => { diag.ice = pc.iceConnectionState; });
  pc.addEventListener("icecandidate", (e) => {
    const t = /typ (host|srflx|relay)/.exec(e.candidate?.candidate ?? "")?.[1] as "host" | "srflx" | "relay" | undefined;
    if (t) diag[t]++;
  });
}

const snapshot = (match: StoredMatch) => ({ v: 1, type: "snapshot", match });

export type HostStatus = "starting" | "sharing" | "error";

/** Côté hôte : garde la partie de référence et la renvoie en entier à chaque changement. */
export class HostSession {
  private peer: Peer | null = null;
  private conns = new Set<DataConnection>();
  private latest: StoredMatch;
  private stopped = false;
  code = generateCode();
  private wakeLock: { release(): Promise<void> } | null = null;
  private onVisible = () => { if (document.visibilityState === "visible" && !this.stopped) void this.keepAwake(); };

  /** Garde l'écran allumé pendant le partage : un téléphone en veille coupe la connexion. */
  private async keepAwake() {
    try {
      this.wakeLock = (await (navigator as unknown as { wakeLock?: { request(t: string): Promise<{ release(): Promise<void> }> } }).wakeLock?.request("screen")) ?? null;
    } catch { /* non supporté ou refusé : sans importance */ }
  }

  constructor(
    match: StoredMatch,
    private onChange: (s: { status: HostStatus; code: string; viewers: number }) => void,
  ) {
    this.latest = match;
    this.open(0);
    void this.keepAwake();
    document.addEventListener("visibilitychange", this.onVisible);
  }

  private emit(status: HostStatus) {
    this.onChange({ status, code: this.code, viewers: this.conns.size });
  }

  private open(attempt: number) {
    this.emit("starting");
    const peer = new Peer(PEER_PREFIX + this.code, peerOptions());
    this.peer = peer;
    peer.on("open", () => this.emit("sharing"));
    peer.on("connection", (conn) => {
      conn.on("open", () => {
        this.conns.add(conn);
        conn.send(snapshot(this.latest));
        this.emit("sharing");
      });
      const drop = () => { this.conns.delete(conn); if (!this.stopped) this.emit("sharing"); };
      conn.on("close", drop);
      conn.on("error", drop);
    });
    // L'annuaire a coupé la liaison : on la rétablit, les connexions directes restent actives.
    peer.on("disconnected", () => { if (!this.stopped && !peer.destroyed) setTimeout(() => peer.reconnect(), 3000); });
    peer.on("error", (err) => {
      if (this.stopped) return;
      if ((err as { type?: string }).type === "unavailable-id" && attempt < 5) {
        peer.destroy();
        this.code = generateCode();
        this.open(attempt + 1);
      } else if ((err as { type?: string }).type !== "peer-unavailable") {
        this.emit("error");
      }
    });
  }

  update(match: StoredMatch) {
    this.latest = match;
    for (const c of this.conns) if (c.open) c.send(snapshot(match));
  }

  stop() {
    this.stopped = true;
    document.removeEventListener("visibilitychange", this.onVisible);
    void this.wakeLock?.release().catch(() => {});
    this.peer?.destroy();
    this.conns.clear();
  }
}

export type FailReason = "unknown" | "unreachable" | "blocked";

export type JoinState =
  | { kind: "idle" }
  | { kind: "connecting" }
  | { kind: "failed"; reason: FailReason; diag?: Diag }
  | { kind: "live"; match: StoredMatch; connected: boolean };

const ATTEMPT_MS = 5000;
/** Une connexion en cours d'établissement n'est pas relancée avant ce délai (le relais peut être lent). */
const NEGOTIATION_MS = 25000;
const FIRST_GIVE_UP_MS = 30000;
/** Si l'annuaire répond « code inconnu » à chaque essai, inutile d'attendre plus longtemps. */
const UNKNOWN_GIVE_UP_MS = 12000;
const RECONNECT_GIVE_UP_MS = 10 * 60 * 1000;

/** Côté invité : suit la partie en lecture seule et se reconnecte tout seul si le lien se coupe. */
export class SpectatorSession {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private connStartedAt = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopped = false;
  private match: StoredMatch | null = null;
  private lostAt = 0;
  private startedAt = Date.now();
  private brokerOpened = false;
  private lastPeerUnavailable = 0;
  private diag: Diag = { ice: "—", host: 0, srflx: 0, relay: 0 };

  constructor(private code: string, private onChange: (s: JoinState) => void) {
    onChange({ kind: "connecting" });
    this.peer = new Peer(peerOptions());
    this.peer.on("open", () => { this.brokerOpened = true; this.attempt(); });
    this.peer.on("error", (err) => {
      if (this.stopped) return;
      if ((err as { type?: string }).type === "peer-unavailable") {
        this.lastPeerUnavailable = Date.now();
        // La tentative est terminée (hôte introuvable) : on libère pour pouvoir la relancer.
        this.conn?.close();
        this.conn = null;
      }
      this.scheduleRetry();
    });
    this.peer.on("disconnected", () => { if (!this.stopped && !this.peer?.destroyed) this.peer?.reconnect(); });
    this.scheduleRetry();
  }

  private attempt() {
    if (this.stopped || !this.peer || this.peer.disconnected) return this.scheduleRetry();
    // Ne pas casser une connexion en cours d'établissement.
    if (this.conn && !this.conn.open && Date.now() - this.connStartedAt < NEGOTIATION_MS) return this.scheduleRetry();
    this.conn?.close();
    const conn = this.peer.connect(PEER_PREFIX + this.code, { reliable: true });
    this.conn = conn;
    this.connStartedAt = Date.now();
    this.diag = { ice: "—", host: 0, srflx: 0, relay: 0 };
    watchDiag(conn, this.diag);
    conn.on("data", (data) => {
      const match = validateReceived(data);
      if (!match) return;
      this.match = match;
      this.lostAt = 0;
      this.onChange({ kind: "live", match, connected: true });
    });
    conn.on("close", () => this.lost(conn));
    conn.on("error", () => this.lost(conn));
    this.scheduleRetry(); // vérifie plus tard que la connexion a bien abouti
  }

  private lost(conn: DataConnection) {
    if (this.stopped || conn !== this.conn) return;
    if (this.match) {
      if (!this.lostAt) this.lostAt = Date.now();
      this.onChange({ kind: "live", match: this.match, connected: false });
    }
    this.scheduleRetry();
  }

  private scheduleRetry() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (this.stopped) return;
      if (this.conn?.open && this.match) { this.lostAt = 0; return; }
      const now = Date.now();
      if (!this.match) {
        if (this.failReason(now)) return this.giveUp();
      } else {
        if (!this.lostAt) this.lostAt = now;
        if (now - this.lostAt > RECONNECT_GIVE_UP_MS) return this.giveUp();
      }
      this.attempt();
    }, ATTEMPT_MS);
  }

  /** Pourquoi la première connexion échoue, une fois le délai écoulé ; `null` = patienter encore. */
  private failReason(now: number): FailReason | null {
    const elapsed = now - this.startedAt;
    if (this.lastPeerUnavailable && now - this.lastPeerUnavailable < ATTEMPT_MS * 2 && elapsed > UNKNOWN_GIVE_UP_MS) return "unknown";
    if (elapsed <= FIRST_GIVE_UP_MS) return null;
    if (!this.brokerOpened) return "unreachable";
    return this.lastPeerUnavailable ? "unknown" : "blocked";
  }

  private giveUp() {
    const reason = this.failReason(Date.now()) ?? "blocked";
    const match = this.match;
    this.stop();
    this.onChange(match ? { kind: "live", match, connected: false } : { kind: "failed", reason, diag: this.diag });
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.conn?.close();
    this.peer?.destroy();
  }
}
