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

export const FREE = counterModule("free", "Compteur libre", 2, 6);
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

/** Un champ vide compte 0 ; au moins un champ doit être rempli. */
export function buildFree(d: FreeDraft, nameOf: (id: string) => string, allowNegative = true): { round?: FreeRound; error?: string } {
  try {
    if (!d.players.some((p) => (d.texts[p] ?? "").trim() !== "")) throw new Error("Saisis au moins un score.");
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
