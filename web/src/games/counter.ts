import type { GameModule } from "../core";
import { parseScore, plain } from "../core";

export interface FreeRound {
  points: Record<string, number>;
}

export function counterModule(id: string, displayName: string, minPlayers: number, maxPlayers: number): GameModule<FreeRound> {
  return {
    id, displayName, minPlayers, maxPlayers,
    scoreRound: (r) => ({ ...r.points }),
    encodeRound: (r) => JSON.stringify(r),
    decodeRound: (raw) => ({ points: JSON.parse(raw).points }),
  };
}

export const FREE = counterModule("free", "Compteur libre", 2, 20);
export const SIX_QUI_PREND = counterModule("sixquiprend", "6 qui prend !", 2, 10);

export interface FreeDraft {
  players: string[];
  texts: Record<string, string>;
  negatives: string[];
}

export const emptyFreeDraft = (players: string[]): FreeDraft => ({ players, texts: {}, negatives: [] });

export function freeDraftFrom(r: FreeRound, players: string[]): FreeDraft {
  return {
    players,
    texts: Object.fromEntries(players.map((p) => [p, plain(Math.abs(r.points[p] ?? 0))])),
    negatives: players.filter((p) => (r.points[p] ?? 0) < 0),
  };
}

/** Un champ vide compte 0 (une manche où tout le monde fait 0 est valable, au 6 qui prend par exemple). */
export function buildFree(d: FreeDraft, nameOf: (id: string) => string, allowNegative = true): { round?: FreeRound; error?: string } {
  try {
    const points: Record<string, number> = {};
    for (const id of d.players) {
      const text = d.texts[id] ?? "";
      if (text.trim() === "") { points[id] = 0; continue; }
      const v = parseScore(text, d.negatives.includes(id));
      if (v === null) throw new Error(`Nombre invalide pour ${nameOf(id)}.`);
      if (!allowNegative && v < 0) throw new Error(`Score négatif impossible pour ${nameOf(id)}.`);
      points[id] = v;
    }
    return { round: { points } };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ---------- Modes du Compteur libre ----------
// Tous les modes enregistrent des variations de score (une « manche » = une liste de variations par joueur),
// ce qui garde le format de partie unique : annulation, historique et partage marchent pareil.

export type CounterMode = "points" | "wins" | "live" | "lives" | "countdown";

export const SETTING_MODE = "mode";
export const SETTING_START = "start";
export const SETTING_ROUNDS = "rounds";

export const COUNTER_MODES: { id: CounterMode; label: string; description: string }[] = [
  { id: "points", label: "Points par manche", description: "Chacun marque des points à chaque manche ; on additionne." },
  { id: "wins", label: "Manches gagnées", description: "À chaque manche, on indique qui a gagné. Le score est le nombre de manches gagnées." },
  { id: "live", label: "Compteur direct (+ / −)", description: "Des boutons +1, −1, +5… sur chaque joueur, sans notion de manche." },
  { id: "lives", label: "Vies / élimination", description: "Chacun démarre avec des vies ; à 0 il est éliminé. Le dernier en vie gagne." },
  { id: "countdown", label: "Décompte vers zéro", description: "Chacun démarre à un total (301, 501…) et descend vers 0 (fléchettes…)." },
];

export function modeOf(settings: Record<string, string>): CounterMode {
  const m = settings[SETTING_MODE];
  return COUNTER_MODES.some((x) => x.id === m) ? (m as CounterMode) : "points";
}

export const DEFAULT_START: Partial<Record<CounterMode, number>> = { lives: 3, countdown: 301 };

/** Score de départ de chaque joueur (vies, décompte) ; 0 pour les autres modes. */
export function startOf(settings: Record<string, string>): number {
  const mode = modeOf(settings);
  const raw = settings[SETTING_START];
  const n = raw === undefined ? null : parseScore(raw);
  return n !== null && n > 0 && (mode === "lives" || mode === "countdown") ? n : (DEFAULT_START[mode] ?? 0);
}

/** Le plus petit total gagne-t-il ? Imposé par certains modes, réglable pour les autres. */
export function lowestWinsFor(settings: Record<string, string>): boolean {
  const mode = modeOf(settings);
  if (mode === "countdown") return true;
  if (mode === "wins" || mode === "lives") return false;
  return settings["lowestWins"] === "true";
}

/** Manche « décompte » : les points marqués sont retirés du total. */
export const negateRound = (r: FreeRound): FreeRound => ({ points: Object.fromEntries(Object.entries(r.points).map(([k, v]) => [k, v === 0 ? 0 : -v])) });

/** Manche « gagnée » : +1 pour chaque gagnant (égalité possible), 0 pour les autres. */
export const winnerRound = (players: string[], winners: string[]): FreeRound => ({
  points: Object.fromEntries(players.map((id) => [id, winners.includes(id) ? 1 : 0])),
});

/** Variation unique pour un joueur (compteur direct, vies). */
export const adjustRound = (players: string[], playerId: string, delta: number): FreeRound => ({
  points: Object.fromEntries(players.map((id) => [id, id === playerId ? delta : 0])),
});

/** Variations non nulles d'une manche, dans l'ordre de la table. */
export const changesOf = (round: FreeRound, players: string[]): { id: string; delta: number }[] =>
  players.filter((id) => (round.points[id] ?? 0) !== 0).map((id) => ({ id, delta: round.points[id] }));
