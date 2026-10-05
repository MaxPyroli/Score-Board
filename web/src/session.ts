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

/** Annuaire par défaut : celui de PeerJS. `VITE_PEER_SERVER=hote:port` (tests, annuaire maison) le remplace. */
function peerOptions() {
  const custom = import.meta.env.VITE_PEER_SERVER as string | undefined;
  if (!custom) return undefined;
  const [host, port] = custom.split(":");
  return { host, port: Number(port), path: "/", secure: false };
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

  constructor(
    match: StoredMatch,
    private onChange: (s: { status: HostStatus; code: string; viewers: number }) => void,
  ) {
    this.latest = match;
    this.open(0);
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
    this.peer?.destroy();
    this.conns.clear();
  }
}

export type JoinState =
  | { kind: "idle" }
  | { kind: "connecting" }
  | { kind: "notFound" }
  | { kind: "live"; match: StoredMatch; connected: boolean };

const ATTEMPT_MS = 5000;
const FIRST_GIVE_UP_MS = 15000;
const RECONNECT_GIVE_UP_MS = 10 * 60 * 1000;

/** Côté invité : suit la partie en lecture seule et se reconnecte tout seul si le lien se coupe. */
export class SpectatorSession {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopped = false;
  private match: StoredMatch | null = null;
  private lostAt = 0;
  private startedAt = Date.now();

  constructor(private code: string, private onChange: (s: JoinState) => void) {
    onChange({ kind: "connecting" });
    const opts = peerOptions();
    this.peer = opts ? new Peer(opts) : new Peer();
    this.peer.on("open", () => this.attempt());
    this.peer.on("error", (err) => {
      if (!this.stopped && (err as { type?: string }).type !== "peer-unavailable") this.scheduleRetry();
    });
    this.peer.on("disconnected", () => { if (!this.stopped && !this.peer?.destroyed) this.peer?.reconnect(); });
  }

  private attempt() {
    if (this.stopped || !this.peer || this.peer.disconnected) return this.scheduleRetry();
    this.conn?.close();
    const conn = this.peer.connect(PEER_PREFIX + this.code, { reliable: true });
    this.conn = conn;
    conn.on("data", (data) => {
      const match = validateReceived(data);
      if (!match) return;
      this.match = match;
      this.onChange({ kind: "live", match, connected: true });
    });
    conn.on("close", () => this.lost());
    conn.on("error", () => this.lost());
    this.scheduleRetry(); // vérifie plus tard que la connexion a bien abouti
  }

  private lost() {
    if (this.stopped) return;
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
      if (this.conn?.open) { this.lostAt = 0; return; }
      if (!this.match) {
        if (Date.now() - this.startedAt > FIRST_GIVE_UP_MS) return this.giveUp();
      } else {
        if (!this.lostAt) this.lostAt = Date.now();
        if (Date.now() - this.lostAt > RECONNECT_GIVE_UP_MS) return this.giveUp();
      }
      this.attempt();
    }, ATTEMPT_MS);
  }

  private giveUp() {
    this.stop();
    this.onChange(this.match ? { kind: "live", match: this.match, connected: false } : { kind: "notFound" });
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.conn?.close();
    this.peer?.destroy();
  }
}
