import type { GameModule, Scores } from "../core";
import { parseScore, plain } from "../core";

export const SKYJO_MIN = -24;
export const SKYJO_MAX = 144;
export const SKYJO_DEFAULT_TARGET = 100;

export interface SkyjoRound {
  scores: Record<string, number>;
  finisherId: string;
}

export function validateSkyjo(r: SkyjoRound): void {
  const ids = Object.keys(r.scores);
  if (ids.length === 0) throw new Error("Aucun score saisi.");
  if (!ids.includes(r.finisherId)) throw new Error("Le joueur qui a terminé la manche doit faire partie de la table.");
  for (const id of ids) {
    const s = r.scores[id];
    if (!Number.isInteger(s) || s < SKYJO_MIN || s > SKYJO_MAX)
      throw new Error(`Score impossible : ${s} (entre ${SKYJO_MIN} et ${SKYJO_MAX}).`);
  }
}

/** Celui qui termine doit avoir le score strictement le plus bas : sinon, s'il est positif, il est doublé. */
export function calculerSkyjo(r: SkyjoRound): { points: Scores; finisherDoubled: boolean } {
  const fs = r.scores[r.finisherId];
  const notStrictlyLowest = Object.entries(r.scores).some(([id, s]) => id !== r.finisherId && s <= fs);
  const doubled = fs > 0 && notStrictlyLowest;
  return { points: doubled ? { ...r.scores, [r.finisherId]: fs * 2 } : { ...r.scores }, finisherDoubled: doubled };
}

export const skyjoModule: GameModule<SkyjoRound> = {
  id: "skyjo",
  displayName: "Skyjo",
  minPlayers: 2,
  maxPlayers: 8,
  scoreRound: (r) => calculerSkyjo(r).points,
  encodeRound: (r) => JSON.stringify(r),
  decodeRound(raw) {
    const o = JSON.parse(raw);
    return { scores: o.scores, finisherId: o.finisherId };
  },
};

export function summarizeSkyjo(r: SkyjoRound, nameOf: (id: string) => string): { headline: string; detail: string } {
  const res = calculerSkyjo(r);
  const f = nameOf(r.finisherId);
  const detail = res.finisherDoubled
    ? `points de ${f} doublés (${res.points[r.finisherId]} au lieu de ${r.scores[r.finisherId]})`
    : "";
  return { headline: `${f} a terminé la manche`, detail };
}

export interface SkyjoDraft {
  players: string[];
  texts: Record<string, string>;
  negatives: string[];
  finisherId: string | null;
}

export const emptySkyjoDraft = (players: string[]): SkyjoDraft => ({ players, texts: {}, negatives: [], finisherId: null });

export function skyjoDraftFrom(r: SkyjoRound, players: string[]): SkyjoDraft {
  return {
    players,
    texts: Object.fromEntries(players.map((p) => [p, plain(Math.abs(r.scores[p] ?? 0))])),
    negatives: players.filter((p) => (r.scores[p] ?? 0) < 0),
    finisherId: r.finisherId,
  };
}

export function buildSkyjo(d: SkyjoDraft, nameOf: (id: string) => string): { round?: SkyjoRound; error?: string } {
  try {
    const scores: Record<string, number> = {};
    for (const id of d.players) {
      const text = d.texts[id] ?? "";
      if (text.trim() === "") throw new Error(`Saisis le score de ${nameOf(id)}.`);
      const v = parseScore(text, d.negatives.includes(id));
      if (v === null) throw new Error(`Nombre invalide pour ${nameOf(id)}.`);
      if (!Number.isInteger(v)) throw new Error(`Le score de ${nameOf(id)} doit être un nombre entier.`);
      scores[id] = v;
    }
    if (d.finisherId === null) throw new Error("Indique qui a terminé la manche.");
    const round = { scores, finisherId: d.finisherId };
    validateSkyjo(round);
    return { round };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
