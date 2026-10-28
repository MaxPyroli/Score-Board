import type { GameModule, Scores } from "../core";
import { parseScore } from "../core";

// 7 Wonders : un seul décompte, à la fin des trois âges, avec une fiche par joueur.
// Chaque catégorie donne des points ; les conflits militaires se règlent à la fin de chaque âge
// (jetons de victoire 1 / 3 / 5 points, jetons de défaite −1 point).

export const COINS_PER_POINT = 3;
export const SCIENCE_SET_BONUS = 7;

export interface WonderSheet {
  /** Total des jetons de victoire militaire (1 point à l'âge I, 3 à l'âge II, 5 à l'âge III). */
  victories: number;
  /** Nombre de jetons de défaite (−1 point chacun). */
  defeats: number;
  /** Pièces restantes : 1 point pour 3 pièces. */
  coins: number;
  /** Points des étapes de merveille construites. */
  wonder: number;
  /** Points des bâtiments civils (cartes bleues). */
  civil: number;
  /** Points des bâtiments commerciaux (cartes jaunes). */
  commercial: number;
  /** Points des guildes (cartes violettes). */
  guilds: number;
  /** Symboles scientifiques (cartes vertes) : compas, roues, tablettes, et jokers (au choix du joueur). */
  compass: number;
  gears: number;
  tablets: number;
  wild: number;
}

export interface WondersRound {
  sheets: Record<string, WonderSheet>;
}

export const emptySheet = (): WonderSheet => ({
  victories: 0, defeats: 0, coins: 0, wonder: 0, civil: 0, commercial: 0, guilds: 0, compass: 0, gears: 0, tablets: 0, wild: 0,
});

/** Points d'un ensemble de symboles : carré de chaque sorte, plus 7 par série de trois symboles différents. */
export function scienceOf(compass: number, gears: number, tablets: number): number {
  return compass * compass + gears * gears + tablets * tablets + SCIENCE_SET_BONUS * Math.min(compass, gears, tablets);
}

/** Meilleur total de sciences : chaque joker devient le symbole qui rapporte le plus. */
export function bestScience(s: Pick<WonderSheet, "compass" | "gears" | "tablets" | "wild">): number {
  let best = 0;
  for (let a = 0; a <= s.wild; a++)
    for (let b = 0; a + b <= s.wild; b++) best = Math.max(best, scienceOf(s.compass + a, s.gears + b, s.tablets + (s.wild - a - b)));
  return best;
}

export const militaryOf = (s: WonderSheet): number => s.victories - s.defeats;

export interface WonderBreakdown { military: number; coins: number; wonder: number; civil: number; commercial: number; guilds: number; science: number; total: number }

export function breakdown(s: WonderSheet): WonderBreakdown {
  const military = militaryOf(s);
  const coins = Math.floor(s.coins / COINS_PER_POINT);
  const science = bestScience(s);
  return { military, coins, wonder: s.wonder, civil: s.civil, commercial: s.commercial, guilds: s.guilds, science, total: military + coins + s.wonder + s.civil + s.commercial + s.guilds + science };
}

export const sheetTotal = (s: WonderSheet): number => breakdown(s).total;

const LIMITS: Record<keyof WonderSheet, number> = {
  victories: 99, defeats: 20, coins: 999, wonder: 99, civil: 199, commercial: 99, guilds: 99, compass: 20, gears: 20, tablets: 20, wild: 10,
};

export function validateSheet(s: WonderSheet): void {
  for (const k of Object.keys(LIMITS) as (keyof WonderSheet)[]) {
    const v = s[k];
    if (!Number.isInteger(v) || v < 0 || v > LIMITS[k]) throw new Error(`Valeur impossible : ${k} = ${v}`);
  }
}

export const sevenWondersModule: GameModule<WondersRound> = {
  id: "sevenwonders",
  displayName: "7 Wonders",
  minPlayers: 2,
  maxPlayers: 7,
  scoreRound(round): Scores {
    return Object.fromEntries(Object.entries(round.sheets).map(([id, s]) => [id, sheetTotal(s)]));
  },
  encodeRound: (r) => JSON.stringify(r),
  decodeRound(raw) {
    const o = JSON.parse(raw);
    const sheets: Record<string, WonderSheet> = {};
    for (const [id, s] of Object.entries((o.sheets ?? {}) as Record<string, Partial<WonderSheet>>)) {
      sheets[id] = { ...emptySheet(), ...s };
      validateSheet(sheets[id]);
    }
    return { sheets };
  },
};

/** Saisie de l'écran : un texte par champ. */
export type WonderDraft = Record<keyof WonderSheet, string>;

export const emptyDraft = (): WonderDraft => Object.fromEntries(Object.keys(emptySheet()).map((k) => [k, ""])) as WonderDraft;

export const draftFromSheet = (s: WonderSheet): WonderDraft =>
  Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v ? String(v) : ""])) as WonderDraft;

export const FIELD_LABELS: Record<keyof WonderSheet, string> = {
  victories: "Victoires (points)", defeats: "Défaites (jetons)", coins: "Pièces", wonder: "Merveille", civil: "Civils (bleus)",
  commercial: "Commerce (jaunes)", guilds: "Guildes (violets)", compass: "Compas", gears: "Roues", tablets: "Tablettes", wild: "Jokers",
};

/** Un champ vide compte 0 ; seuls des nombres entiers positifs sont acceptés. */
export function sheetFromDraft(d: WonderDraft): WonderSheet {
  const s = emptySheet();
  for (const k of Object.keys(s) as (keyof WonderSheet)[]) {
    const text = d[k]?.trim() ?? "";
    if (text === "") continue;
    const v = parseScore(text);
    if (v === null || !Number.isInteger(v) || v < 0) throw new Error(`${FIELD_LABELS[k]} : un nombre entier positif est attendu.`);
    if (v > LIMITS[k]) throw new Error(`${FIELD_LABELS[k]} : ${LIMITS[k]} au maximum.`);
    s[k] = v;
  }
  return s;
}

export function buildWonders(
  drafts: Record<string, WonderDraft>, ids: string[], nameOf: (id: string) => string,
): { round?: WondersRound; error?: string } {
  try {
    const sheets: Record<string, WonderSheet> = {};
    for (const id of ids) {
      try {
        sheets[id] = sheetFromDraft(drafts[id] ?? emptyDraft());
      } catch (e) {
        throw new Error(`${nameOf(id)} · ${(e as Error).message}`);
      }
    }
    return { round: { sheets } };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
