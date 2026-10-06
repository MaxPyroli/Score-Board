// Cœur générique : joueurs, partie (liste de manches), formats. Même modèle que le Kotlin.

export interface Player {
  id: string;
  name: string;
}

/** Une partie : joueurs + liste ordonnée de manches (texte JSON opaque, propre à chaque jeu). */
export interface StoredMatch {
  id: string;
  moduleId: string;
  players: Player[];
  rounds: string[];
  settings: Record<string, string>;
  createdAt: number;
}

export const matchWithRound = (m: StoredMatch, raw: string): StoredMatch => ({ ...m, rounds: [...m.rounds, raw] });

export function matchWithRoundReplaced(m: StoredMatch, index: number, raw: string): StoredMatch {
  if (index < 0 || index >= m.rounds.length) throw new Error(`Manche inexistante : ${index}`);
  return { ...m, rounds: m.rounds.map((r, i) => (i === index ? raw : r)) };
}

export function matchWithoutRound(m: StoredMatch, index: number): StoredMatch {
  if (index < 0 || index >= m.rounds.length) throw new Error(`Manche inexistante : ${index}`);
  return { ...m, rounds: m.rounds.filter((_, i) => i !== index) };
}

export const matchWithoutLastRound = (m: StoredMatch): StoredMatch =>
  m.rounds.length === 0 ? m : matchWithoutRound(m, m.rounds.length - 1);

export const flag = (m: StoredMatch, key: string): boolean => m.settings[key] === "true";

export type Scores = Record<string, number>;

/** Un jeu = un module : calcul des points d'une manche et (dé)codage. */
export interface GameModule<R> {
  id: string;
  displayName: string;
  minPlayers: number;
  maxPlayers: number;
  scoreRound(round: R): Scores;
  encodeRound(round: R): string;
  decodeRound(raw: string): R;
}

/** Points de chaque manche, dans l'ordre. Tous les joueurs de la partie sont présents. */
export function roundScores<R>(mod: GameModule<R>, match: StoredMatch): Scores[] {
  return match.rounds.map((raw) => {
    const scores = mod.scoreRound(mod.decodeRound(raw));
    return Object.fromEntries(match.players.map((p) => [p.id, scores[p.id] ?? 0]));
  });
}

/** Total de chaque joueur, déduit de la liste des manches. */
export function totals<R>(mod: GameModule<R>, match: StoredMatch): Scores {
  const result: Scores = Object.fromEntries(match.players.map((p) => [p.id, 0]));
  for (const round of roundScores(mod, match)) {
    for (const [id, delta] of Object.entries(round)) result[id] = (result[id] ?? 0) + delta;
  }
  return result;
}

/** "56", "56,5" — virgule décimale, sans zéro inutile. */
export function plain(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const s = Number.isInteger(rounded) ? String(rounded) : String(rounded);
  return s.replace(".", ",").replace(/^-0$/, "0");
}

/** "+60", "−31" (vrai signe moins), "0". */
export function signed(value: number): string {
  const body = plain(Math.abs(value));
  if (body === "0") return "0";
  return value > 0 ? `+${body}` : `−${body}`;
}

const NUMBER = /^-?\d+([.,]\d+)?$/;

/** Lecture d'un nombre saisi (virgule ou point). `null` si ce n'est pas un nombre. */
export function parseScore(text: string, negative = false): number | null {
  const trimmed = text.trim();
  if (!NUMBER.test(trimmed)) return null;
  const value = Number(trimmed.replace(",", "."));
  return negative || trimmed.startsWith("-") ? -Math.abs(value) : value;
}

export const SETTING_TARGET = "target";
export const SETTING_LOWEST_WINS = "lowestWins";

export function targetOf(m: StoredMatch): number | null {
  const raw = m.settings[SETTING_TARGET];
  return raw === undefined ? null : parseScore(raw);
}

/** Meilleur joueur selon le sens du jeu ; en cas d'égalité, le premier de la table. */
export function leader(players: Player[], t: Scores, lowestWins: boolean): Player | null {
  let best: Player | null = null;
  for (const p of players) {
    if (!(p.id in t)) continue;
    if (best === null || (lowestWins ? t[p.id] < t[best.id] : t[p.id] > t[best.id])) best = p;
  }
  return best;
}

/** Phrase d'état sous le tableau (objectif atteint…), ou `null` sans objectif. */
export function describeTarget(players: Player[], t: Scores, target: number | null, lowestWins: boolean): string | null {
  if (target === null) return null;
  const reached = players.filter((p) => (t[p.id] ?? 0) >= target);
  const goal = plain(target);
  if (reached.length === 0) return `Objectif : ${goal} points`;
  const lead = leader(players, t, lowestWins);
  const leadText = lead ? ` En tête : ${lead.name} (${plain(t[lead.id])}).` : "";
  return `Objectif de ${goal} atteint par ${reached.map((p) => p.name).join(", ")}.${leadText}`;
}

// ---------- Fin de partie et classement ----------

/** Réglage de partie (texte, comme les autres) : « true » une fois la partie terminée par l'hôte. */
export const SETTING_FINISHED = "finished";
export const isFinished = (m: StoredMatch): boolean => flag(m, SETTING_FINISHED);
export const withSetting = (m: StoredMatch, key: string, value: string): StoredMatch => ({ ...m, settings: { ...m.settings, [key]: value } });

/**
 * Suspense : une partie qui vient de se terminer affiche d'abord « Partie terminée » ; l'hôte dévoile ensuite les résultats.
 * Réglage « pending » (les parties déjà terminées avant cette fonction n'en ont pas : leurs résultats s'affichent directement).
 */
export const SETTING_PENDING = "pending";
export const isPending = (m: StoredMatch): boolean => isFinished(m) && flag(m, SETTING_PENDING);
/** Termine la partie : écran « Partie terminée », résultats pas encore dévoilés. */
export const finishMatch = (m: StoredMatch): StoredMatch => withSetting(withSetting(m, SETTING_FINISHED, "true"), SETTING_PENDING, "true");
/** Dévoile les résultats. */
export const revealResults = (m: StoredMatch): StoredMatch => withSetting(m, SETTING_PENDING, "false");
/** Reprend une partie terminée. */
export const resumeMatch = (m: StoredMatch): StoredMatch => withSetting(withSetting(m, SETTING_FINISHED, "false"), SETTING_PENDING, "false");

export interface RankedPlayer {
  player: Player;
  total: number;
  /** 1 = vainqueur ; les ex æquo partagent le même rang. */
  rank: number;
}

/** Classement du meilleur au moins bon, selon le sens du jeu ; égalité = même rang, ordre de la table conservé. */
export function ranking(players: Player[], t: Scores, lowestWins: boolean): RankedPlayer[] {
  const value = (p: Player) => t[p.id] ?? 0;
  const sorted = [...players].sort((a, b) => (lowestWins ? value(a) - value(b) : value(b) - value(a)));
  let rank = 0;
  let previous: number | null = null;
  return sorted.map((player, i) => {
    const total = value(player);
    if (previous === null || total !== previous) { rank = i + 1; previous = total; }
    return { player, total, rank };
  });
}

export const ordinal = (rank: number): string => (rank === 1 ? "1er" : `${rank}e`);

/** Texte de l'écran de fin : personnel si `meId` est un joueur de la partie, sinon général. */
export function finalMessage(ranked: RankedPlayer[], meId: string | null): { headline: string; detail: string } {
  const winners = ranked.filter((r) => r.rank === 1);
  const winnerNames = winners.map((w) => w.player.name).join(" et ");
  const winnerText = winners.length === 1 ? `${winnerNames} gagne` : `${winnerNames} gagnent à égalité`;
  const me = meId === null ? undefined : ranked.find((r) => r.player.id === meId);
  if (!me) return { headline: winners.length === 1 ? `${winnerNames} gagne la partie !` : `${winnerNames} gagnent à égalité !`, detail: "" };
  const score = `${plain(me.total)} point${Math.abs(me.total) > 1 ? "s" : ""}`;
  if (me.rank === 1) {
    return {
      headline: winners.length === 1 ? "Tu as gagné !" : "Victoire à égalité !",
      detail: `Tu finis ${ordinal(1)} avec ${score}.`,
    };
  }
  return { headline: "Tu as perdu", detail: `${winnerText} · tu finis ${ordinal(me.rank)} sur ${ranked.length} avec ${score}.` };
}

// ---------- Noms des joueurs ----------

export const MAX_NAME_LENGTH = 20;

/** Nom nettoyé s'il est utilisable pour ce joueur (1 à 20 caractères, pas déjà pris par un autre), sinon `null`. */
export function validName(m: StoredMatch, playerId: string, raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > MAX_NAME_LENGTH) return null;
  const taken = m.players.some((p) => p.id !== playerId && p.name.toLowerCase() === name.toLowerCase());
  return taken ? null : name;
}

/** Partie avec le joueur renommé ; `null` si le nom est invalide, déjà pris ou inchangé. */
export function renamePlayer(m: StoredMatch, playerId: string, raw: string): StoredMatch | null {
  const name = validName(m, playerId, raw);
  const current = m.players.find((p) => p.id === playerId);
  if (name === null || !current || current.name === name) return null;
  return { ...m, players: m.players.map((p) => (p.id === playerId ? { ...p, name } : p)) };
}
