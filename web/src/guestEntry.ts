import type { Claim } from "./backend";
import type { StoredMatch } from "./core";
import type { GameDefinition } from "./games/registry";

/** Saisie d'un joueur pour la manche en cours : son score (texte, signe compris) et, au Skyjo, « j'ai terminé ». */
export interface Entry {
  score: string;
  finisher: boolean;
}

export type Entries = Record<string, Entry>;

/**
 * Saisies envoyées par les appareils connectés pour la manche `roundIndex` (celles visant une autre manche
 * sont périmées et ignorées). Si deux appareils représentent le même joueur, le dernier par identifiant l'emporte.
 */
export function entriesFromClaims(claims: Claim[], match: StoredMatch, roundIndex: number): Entries {
  const ids = new Set(match.players.map((p) => p.id));
  const out: Entries = {};
  for (const c of [...claims].sort((a, b) => a.uid.localeCompare(b.uid))) {
    if (!c.p || !ids.has(c.p) || c.r !== roundIndex || typeof c.s !== "string" || c.s.trim() === "") continue;
    out[c.p] = { score: c.s.trim(), finisher: c.f === true };
  }
  return out;
}

export type RoundAttempt = { raw: string } | { waiting: string[] } | { error: string };

/** Manche prête à être ajoutée ? Tous les joueurs doivent avoir un score ; sinon on dit qui on attend. */
export function tryBuildRound(game: GameDefinition, match: StoredMatch, entries: Entries): RoundAttempt {
  const config = game.guestEntry?.(match);
  if (!config) return { error: "Ce jeu ne permet pas la saisie par les joueurs." };
  const waiting = match.players.filter((p) => !entries[p.id]).map((p) => p.name);
  if (waiting.length > 0) return { waiting };
  return config.build(match, entries);
}

/**
 * Joueurs « pris » : représentés par un autre appareil actuellement connecté. Un appareil déconnecté n'a plus
 * de signature, donc sa place redevient libre ; cet appareil-ci (`myUid`) ne bloque jamais son propre choix.
 */
export function takenPlayers(claims: Claim[], myUid: string): string[] {
  return [...new Set(claims.filter((c) => c.p && c.uid !== myUid).map((c) => c.p))];
}

/**
 * Saisies « collantes » : une saisie déjà reçue n'est oubliée que si son auteur la retire (sa signature est là,
 * mais sans saisie pour cette manche). Si l'appareil se déconnecte, sa signature disparaît du serveur : on garde
 * alors la saisie, qui revient telle quelle à la reconnexion. Sans cela, un score validé « disparaissait » le temps d'une coupure.
 */
export function mergeStickyEntries(prev: Entries, claims: Claim[], match: StoredMatch, roundIndex: number): Entries {
  const fresh = entriesFromClaims(claims, match, roundIndex);
  const out: Entries = { ...prev };
  for (const c of claims) if (c.p && !(c.p in fresh)) delete out[c.p];
  return { ...out, ...fresh };
}
