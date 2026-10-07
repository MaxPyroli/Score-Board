// Partage de partie en direct : l'hôte publie la partie sous un code à 4 caractères, les invités la suivent
// en lecture seule (Firebase Realtime Database, voir backend.ts et docs/firebase.md).
import type { StoredMatch } from "./core";
import { gameById } from "./games/registry";
import { ClaimsGrace, CONNECTION_GRACE_MS } from "./claimsGrace";
import { getBackend, type Backend, type Claim, type ClaimData } from "./backend";

export const CODE_LENGTH = 4;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O ni 1/I, comme sur Android

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
    // En salle d'attente, il peut manquer des joueurs : les invités arrivent peu à peu.
    const lobby = (m.settings as Record<string, unknown> | undefined)?.lobby === "true";
    if (!Array.isArray(m.players) || m.players.length < (lobby ? 1 : game.minPlayers) || m.players.length > game.maxPlayers) return null;
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

const wrap = (match: StoredMatch) => JSON.stringify(match);

/** Contenu reçu → partie valide, ou `null`. */
function parsePayload(payload: string): StoredMatch | null {
  try {
    return validateReceived({ v: 1, type: "snapshot", match: JSON.parse(payload) });
  } catch {
    return null;
  }
}

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

export type HostStatus = "starting" | "sharing" | "error";

export interface HostInfo {
  status: HostStatus;
  code: string;
  /** Identifiant anonyme de l'appareil de l'hôte. */
  ownUid: string;
  /** Appareils connectés autres que celui de l'hôte. */
  viewers: number;
  /** Joueurs actuellement connectés. */
  online: string[];
  /** Signatures de tous les appareils connectés (changements de nom demandés inclus). */
  claims: Claim[];
}

/** Côté hôte : publie la partie à chaque changement et compte les spectateurs. */
export class HostSession {
  code: string;
  private backend: Backend | null = null;
  private latest: StoredMatch;
  private stopped = false;
  private claims: Claim[] = [];
  private grace = new ClaimsGrace();
  private graceTimer: ReturnType<typeof setTimeout> | undefined;
  private ownUid = "";
  private offClaims: (() => void) | null = null;
  private announcer: ReturnType<Backend["announce"]> | null = null;
  private identity: ClaimData | null = null;
  private wakeLock: { release(): Promise<void> } | null = null;
  private onVisible = () => { if (document.visibilityState === "visible" && !this.stopped) void this.keepAwake(); };

  constructor(
    match: StoredMatch,
    private onChange: (s: HostInfo) => void,
    /** Code à reprendre après une actualisation de la page (les invités restent connectés). */
    resumeCode?: string,
  ) {
    this.code = resumeCode && normalizeCode(resumeCode) ? resumeCode : generateCode();
    this.latest = match;
    void this.keepAwake();
    document.addEventListener("visibilitychange", this.onVisible);
    void this.start();
  }

  private emit(status: HostStatus) {
    this.onChange({
      status,
      code: this.code,
      ownUid: this.ownUid,
      viewers: this.claims.filter((c) => c.uid !== this.ownUid).length,
      online: this.claims.filter((c) => c.p).map((c) => c.p),
      claims: this.claims,
    });
  }

  /** Garde l'écran allumé pendant le partage : un téléphone en veille coupe la connexion. */
  private async keepAwake() {
    try {
      this.wakeLock = (await (navigator as unknown as { wakeLock?: { request(t: string): Promise<{ release(): Promise<void> }> } }).wakeLock?.request("screen")) ?? null;
    } catch { /* non supporté ou refusé : sans importance */ }
  }

  private async start() {
    this.emit("starting");
    try {
      const backend = await getBackend();
      if (!backend) return this.emit("error");
      this.backend = backend;
      for (let attempt = 0; attempt < 6; attempt++) {
        const result = await withTimeout(backend.publish(this.code, wrap(this.latest)), 15000);
        if (this.stopped) return void backend.remove(this.code).catch(() => {});
        if (result === "ok") {
          this.ownUid = await backend.uid();
          this.announcer = backend.announce(this.code);
          if (this.identity) this.announcer.set(this.identity);
          this.offClaims = backend.watchClaims(this.code, (claims) => {
            this.claims = this.grace.update(claims);
            this.emit("sharing");
            // Les signatures en sursis (appareil coupé il y a peu) sont retirées à l'échéance, sans attendre un autre événement.
            clearTimeout(this.graceTimer);
            const left = this.grace.nextExpiryIn(new Set(claims.map((c) => c.uid)));
            if (left !== null) this.graceTimer = setTimeout(() => { if (!this.stopped) { this.claims = this.grace.current(); this.emit("sharing"); } }, left + 50);
          });
          return this.emit("sharing");
        }
        this.code = generateCode(); // code déjà pris : on en tire un autre
      }
      this.emit("error");
    } catch {
      if (!this.stopped) this.emit("error");
    }
  }

  /** L'hôte dit quel joueur il est (`""` = aucun) : il apparaît alors comme connecté. */
  claim(data: ClaimData) {
    this.identity = data;
    this.announcer?.set(data);
  }

  update(match: StoredMatch) {
    this.latest = match;
    // Hors connexion, l'envoi est mis en attente et part au retour du réseau.
    void this.backend?.publish(this.code, wrap(match)).catch(() => {});
  }

  stop() {
    this.stopped = true;
    document.removeEventListener("visibilitychange", this.onVisible);
    void this.wakeLock?.release().catch(() => {});
    clearTimeout(this.graceTimer);
    this.offClaims?.();
    this.announcer?.stop();
    void this.backend?.remove(this.code).catch(() => {});
  }
}

export type FailReason = "unknown" | "unreachable" | "invalid";

export type JoinState =
  | { kind: "idle" }
  | { kind: "connecting" }
  | { kind: "failed"; reason: FailReason }
  | { kind: "live"; match: StoredMatch; connected: boolean; ended: boolean; online: string[]; claims: Claim[]; myUid: string };

const FIRST_ANSWER_MS = 20000;

/** Côté invité : suit la partie en lecture seule ; Firebase se reconnecte tout seul si le lien se coupe. */
export class SpectatorSession {
  private stopFns: (() => void)[] = [];
  private stopped = false;
  private match: StoredMatch | null = null;
  private connected = true;
  private ended = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private announcer: ReturnType<Backend["announce"]> | null = null;
  private identity: ClaimData | null = null;
  private online: string[] = [];
  private claims: Claim[] = [];
  private grace = new ClaimsGrace();
  private graceTimer: ReturnType<typeof setTimeout> | undefined;
  private downTimer: ReturnType<typeof setTimeout> | undefined;
  private myUid = "";

  constructor(private code: string, private onChange: (s: JoinState) => void) {
    onChange({ kind: "connecting" });
    void this.start();
  }

  private fail(reason: FailReason) {
    if (this.stopped) return;
    this.stop();
    this.onChange({ kind: "failed", reason });
  }

  private emitLive() {
    if (this.match) this.onChange({ kind: "live", match: this.match, connected: this.connected, ended: this.ended, online: this.online, claims: this.claims, myUid: this.myUid });
  }

  private async start() {
    const backend = await getBackend().catch(() => null);
    if (this.stopped) return;
    if (!backend) return this.fail("unreachable");
    this.timer = setTimeout(() => { if (!this.match) this.fail("unreachable"); }, FIRST_ANSWER_MS);
    this.stopFns.push(
      backend.watch(
        this.code,
        (r) => {
          if (this.stopped) return;
          clearTimeout(this.timer);
          if (!r.exists) {
            if (!this.match) return this.fail("unknown");
            this.ended = true; // l'hôte a arrêté le partage ; on garde la dernière version
            return this.emitLive();
          }
          const match = parsePayload(r.payload);
          if (!match) return this.match ? undefined : this.fail("invalid");
          this.match = match;
          this.ended = false;
          if (!this.announcer) {
            void backend.uid().then((u) => { this.myUid = u; this.emitLive(); });
            this.announcer = backend.announce(this.code);
            this.stopFns.push(() => this.announcer?.stop());
            if (this.identity) this.announcer.set(this.identity);
            this.stopFns.push(backend.watchClaims(this.code, (claims) => {
              this.claims = this.grace.update(claims);
              this.online = this.claims.filter((c) => c.p).map((c) => c.p);
              this.emitLive();
              clearTimeout(this.graceTimer);
              const left = this.grace.nextExpiryIn(new Set(claims.map((c) => c.uid)));
              if (left !== null) this.graceTimer = setTimeout(() => {
                if (this.stopped) return;
                this.claims = this.grace.current();
                this.online = this.claims.filter((c) => c.p).map((c) => c.p);
                this.emitLive();
              }, left + 50);
            }));
          }
          this.emitLive();
        },
        (up) => {
          // Retour de la connexion : tout de suite. Perte : seulement si elle dure, pour ne pas faire clignoter le bandeau.
          clearTimeout(this.downTimer);
          if (up) { this.connected = true; this.emitLive(); }
          else this.downTimer = setTimeout(() => { if (!this.stopped) { this.connected = false; this.emitLive(); } }, CONNECTION_GRACE_MS);
        },
        () => this.fail("unreachable"),
      ),
    );
  }

  /** Cet appareil dit quel joueur il est (`""` = regarde seulement) et, éventuellement, son nouveau nom. */
  claim(data: ClaimData) {
    this.identity = data;
    this.announcer?.set(data);
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    clearTimeout(this.graceTimer);
    clearTimeout(this.downTimer);
    for (const f of this.stopFns) f();
    this.stopFns = [];
  }
}
