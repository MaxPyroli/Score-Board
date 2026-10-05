import type { GameModule, Scores } from "../core";
import { parseScore } from "../core";

// Les Aventuriers du Rail : un décompte final, une fiche par joueur. Les valeurs de bonus sont fixes
// (plus long chemin 10, globe-trotter 15, gare 4) ; les réglages de la partie décident lesquels sont proposés.

export const LONGEST_BONUS = 10;
export const GLOBETROTTER_BONUS = 15;
export const STATION_VALUE = 4;
export const MAX_STATIONS = 3;

/** Points d'une route selon sa longueur en wagons (la longueur 8 existe sur la carte Europe). */
export const ROUTE_POINTS: { length: number; points: number }[] = [
  { length: 1, points: 1 },
  { length: 2, points: 2 },
  { length: 3, points: 4 },
  { length: 4, points: 7 },
  { length: 5, points: 10 },
  { length: 6, points: 15 },
  { length: 8, points: 21 },
];

/** Fiche de décompte d'un joueur. */
export interface RailSheet {
  /** Points des routes posées (déjà comptés sur le plateau, ou calculés avec l'aide). */
  routes: number;
  /** Total des billets destination réussis. */
  ticketsDone: number;
  /** Total des billets destination ratés (nombre positif, retiré du score). */
  ticketsFailed: number;
  /** Longueur (en wagons) de son plus long chemin continu, 0 si non indiquée. */
  longestLength: number;
  /** Nombre de billets destination réussis, 0 si non indiqué. */
  ticketsCount: number;
  /** A le bonus du plus long chemin : attribué automatiquement au plus long chemin (égalité : tous les ex æquo). */
  longest: boolean;
  /** A le bonus globe-trotter : attribué automatiquement à celui qui a réussi le plus de billets (égalité : tous). */
  globetrotter: boolean;
  /** Gares non utilisées. */
  stations: number;
}

export interface RailRound {
  sheets: Record<string, RailSheet>;
}

export const emptySheet = (): RailSheet => ({ routes: 0, ticketsDone: 0, ticketsFailed: 0, longestLength: 0, ticketsCount: 0, longest: false, globetrotter: false, stations: 0 });

export function sheetTotal(s: RailSheet): number {
  return (
    s.routes + s.ticketsDone - s.ticketsFailed +
    (s.longest ? LONGEST_BONUS : 0) + (s.globetrotter ? GLOBETROTTER_BONUS : 0) + s.stations * STATION_VALUE
  );
}

/** Points d'un ensemble de routes : `counts[longueur]` = nombre de routes de cette longueur. */
export function routesPoints(counts: Record<number, number>): number {
  return ROUTE_POINTS.reduce((sum, r) => sum + (counts[r.length] ?? 0) * r.points, 0);
}

export function validateSheet(s: RailSheet): void {
  const whole = (n: number, max: number, label: string) => {
    if (!Number.isInteger(n) || n < 0 || n > max) throw new Error(`${label} : un nombre entier entre 0 et ${max} est attendu.`);
  };
  whole(s.routes, 500, "Routes");
  whole(s.ticketsDone, 500, "Billets réussis");
  whole(s.ticketsFailed, 500, "Billets ratés");
  whole(s.longestLength, 200, "Plus long chemin");
  whole(s.ticketsCount, 60, "Nombre de billets réussis");
  whole(s.stations, MAX_STATIONS, "Gares restantes");
}

/** Réglages d'une partie : quels bonus sont en jeu (varient selon l'édition). */
export interface RailConfig {
  longest: boolean;
  globetrotter: boolean;
  stations: boolean;
  /** La carte a des routes de 8 wagons (Europe). */
  length8: boolean;
}

export const SETTING_EDITION = "edition";
export const SETTING_LONGEST = "longest";
export const SETTING_GLOBETROTTER = "globetrotter";
export const SETTING_STATIONS = "stations";

export type RailEdition = "base" | "europe";
export const editionOf = (s: Record<string, string>): RailEdition => (s[SETTING_EDITION] === "europe" ? "europe" : "base");

/** Valeurs par défaut des bonus selon l'édition ; l'utilisateur peut les cocher ou décocher. */
export const editionDefaults = (e: RailEdition) => ({ longest: true, globetrotter: false, stations: e === "europe" });

export function railConfig(s: Record<string, string>): RailConfig {
  const e = editionOf(s);
  const d = editionDefaults(e);
  const flag = (key: string, fallback: boolean) => (s[key] === undefined ? fallback : s[key] === "true");
  return {
    longest: flag(SETTING_LONGEST, d.longest),
    globetrotter: flag(SETTING_GLOBETROTTER, d.globetrotter),
    stations: flag(SETTING_STATIONS, d.stations),
    length8: e === "europe",
  };
}

/**
 * Attribue les bonus par comparaison : le plus long chemin (10) et, si l'édition l'utilise, le globe-trotter (15)
 * vont à celui qui a la plus grande valeur indiquée ; en cas d'égalité, à tous les ex æquo. Une valeur 0 ne gagne rien.
 */
export function applyBonuses(sheets: Record<string, RailSheet>, config: RailConfig): Record<string, RailSheet> {
  const entries = Object.entries(sheets);
  const maxOf = (pick: (s: RailSheet) => number) => Math.max(0, ...entries.map(([, s]) => pick(s)));
  const bestLength = maxOf((s) => s.longestLength);
  const bestTickets = maxOf((s) => s.ticketsCount);
  return Object.fromEntries(
    entries.map(([id, s]) => [id, {
      ...s,
      longest: config.longest && s.longestLength > 0 && s.longestLength === bestLength,
      globetrotter: config.globetrotter && s.ticketsCount > 0 && s.ticketsCount === bestTickets,
    }]),
  );
}

export const railModule: GameModule<RailRound> = {
  id: "rail",
  displayName: "Les Aventuriers du Rail",
  minPlayers: 2,
  maxPlayers: 5,
  scoreRound(round): Scores {
    return Object.fromEntries(Object.entries(round.sheets).map(([id, s]) => [id, sheetTotal(s)]));
  },
  encodeRound: (r) => JSON.stringify(r),
  decodeRound(raw) {
    const o = JSON.parse(raw);
    const sheets: Record<string, RailSheet> = {};
    for (const [id, s] of Object.entries((o.sheets ?? {}) as Record<string, Partial<RailSheet>>)) {
      sheets[id] = { ...emptySheet(), ...s };
      validateSheet(sheets[id]);
    }
    return { sheets };
  },
};

/** Saisie de l'écran : un texte par champ. */
export interface RailDraftSheet {
  routes: string;
  ticketsDone: string;
  ticketsFailed: string;
  longestLength: string;
  ticketsCount: string;
  stations: number;
}

export const emptyDraftSheet = (): RailDraftSheet => ({ routes: "", ticketsDone: "", ticketsFailed: "", longestLength: "", ticketsCount: "", stations: 0 });

export const draftFromSheet = (s: RailSheet): RailDraftSheet => ({
  routes: s.routes ? String(s.routes) : "",
  ticketsDone: s.ticketsDone ? String(s.ticketsDone) : "",
  ticketsFailed: s.ticketsFailed ? String(s.ticketsFailed) : "",
  longestLength: s.longestLength ? String(s.longestLength) : "",
  ticketsCount: s.ticketsCount ? String(s.ticketsCount) : "",
  stations: s.stations,
});

/** Un champ vide compte 0 ; le signe est ignoré pour les billets ratés (« −12 » et « 12 » donnent la même chose). */
function numberOf(text: string, label: string): number {
  if (text.trim() === "") return 0;
  const v = parseScore(text);
  if (v === null || !Number.isInteger(v)) throw new Error(`${label} : un nombre entier est attendu.`);
  return Math.abs(v);
}

export function sheetFromDraft(d: RailDraftSheet): RailSheet {
  const s: RailSheet = {
    routes: numberOf(d.routes, "Routes"),
    ticketsDone: numberOf(d.ticketsDone, "Billets réussis"),
    ticketsFailed: numberOf(d.ticketsFailed, "Billets ratés"),
    longestLength: numberOf(d.longestLength, "Plus long chemin"),
    ticketsCount: numberOf(d.ticketsCount, "Nombre de billets réussis"),
    longest: false,
    globetrotter: false,
    stations: d.stations,
  };
  validateSheet(s);
  return s;
}

export function buildRail(
  drafts: Record<string, RailDraftSheet>, ids: string[], nameOf: (id: string) => string, config: RailConfig,
): { round?: RailRound; error?: string } {
  try {
    const sheets: Record<string, RailSheet> = {};
    for (const id of ids) {
      try {
        sheets[id] = sheetFromDraft(drafts[id] ?? emptyDraftSheet());
      } catch (e) {
        throw new Error(`${nameOf(id)} · ${(e as Error).message}`);
      }
    }
    return { round: { sheets: applyBonuses(sheets, config) } };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
