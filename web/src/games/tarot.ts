import type { GameModule, Scores } from "../core";
import { plain } from "../core";

export type TarotContract = "PETITE" | "GARDE" | "GARDE_SANS" | "GARDE_CONTRE";
export type TarotPoignee = "SIMPLE" | "DOUBLE" | "TRIPLE";
export type TarotCamp = "ATTAQUE" | "DEFENSE";

export const CONTRACTS: { id: TarotContract; multiplier: number; label: string }[] = [
  { id: "PETITE", multiplier: 1, label: "Petite" },
  { id: "GARDE", multiplier: 2, label: "Garde" },
  { id: "GARDE_SANS", multiplier: 4, label: "Garde sans" },
  { id: "GARDE_CONTRE", multiplier: 6, label: "Garde contre" },
];
export const contractInfo = (c: TarotContract) => CONTRACTS.find((x) => x.id === c)!;

export const POIGNEES: { id: TarotPoignee; bonus: number; label: string }[] = [
  { id: "SIMPLE", bonus: 20, label: "simple" },
  { id: "DOUBLE", bonus: 30, label: "double" },
  { id: "TRIPLE", bonus: 40, label: "triple" },
];
export const poigneeInfo = (p: TarotPoignee) => POIGNEES.find((x) => x.id === p)!;

const ATOUTS: Record<number, Record<TarotPoignee, number>> = {
  3: { SIMPLE: 13, DOUBLE: 15, TRIPLE: 18 },
  4: { SIMPLE: 10, DOUBLE: 13, TRIPLE: 15 },
  5: { SIMPLE: 8, DOUBLE: 10, TRIPLE: 13 },
};

/** Atouts (Excuse comprise) nécessaires pour une poignée selon le nombre de joueurs. */
export function atoutsRequis(p: TarotPoignee, joueurs: number): number {
  const row = ATOUTS[joueurs];
  if (!row) throw new Error(`Le Tarot se joue à 3, 4 ou 5 joueurs (reçu : ${joueurs}).`);
  return row[p];
}

export interface TarotChelem {
  annonce: boolean;
  reussi: boolean;
}

/** Mêmes noms de champs que le Kotlin (compatibilité future des parties). */
export interface TarotRound {
  joueurs: string[];
  preneurId: string;
  appeleId: string | null;
  contract: TarotContract;
  bouts: number;
  pointsRealises: number;
  poignee: TarotPoignee | null;
  poigneeCamp: TarotCamp | null;
  petitAuBoutCamp: TarotCamp | null;
  chelem: TarotChelem | null;
}

/** Vérifie la cohérence d'une manche ; lève une erreur au message lisible sinon. */
export function validateRound(r: TarotRound): void {
  const n = r.joueurs.length;
  if (n < 3 || n > 5) throw new Error(`Le Tarot se joue à 3, 4 ou 5 joueurs (reçu : ${n}).`);
  if (new Set(r.joueurs).size !== n) throw new Error("Les identifiants de joueurs doivent être uniques.");
  if (!r.joueurs.includes(r.preneurId)) throw new Error("Le preneur doit faire partie des joueurs de la table.");
  if (!Number.isInteger(r.bouts) || r.bouts < 0 || r.bouts > 3)
    throw new Error(`Le nombre de bouts doit être compris entre 0 et 3 (reçu : ${r.bouts}).`);
  if (!(r.pointsRealises >= 0 && r.pointsRealises <= 91))
    throw new Error(`Les points réalisés doivent être compris entre 0 et 91 (reçu : ${r.pointsRealises}).`);
  if (!Number.isInteger(r.pointsRealises * 2))
    throw new Error(`Les points réalisés doivent être exprimés par pas de 0,5 (reçu : ${r.pointsRealises}).`);
  if (n === 5) {
    if (r.appeleId === null) throw new Error("L'appelé est obligatoire à 5 joueurs.");
    if (!r.joueurs.includes(r.appeleId)) throw new Error("L'appelé doit faire partie des joueurs de la table.");
  } else if (r.appeleId !== null) {
    throw new Error("L'appelé n'existe qu'à 5 joueurs.");
  }
  if (r.poignee !== null && r.poigneeCamp === null) throw new Error("Le camp de la poignée doit être précisé.");
  if (r.chelem?.reussi && r.pointsRealises !== 91)
    throw new Error("Un chelem réussi implique que le camp d'attaque a fait tous les plis (91 points).");
}

export const appeleASoiMeme = (r: TarotRound) => r.joueurs.length === 5 && r.appeleId === r.preneurId;
export const defenseurs = (r: TarotRound) =>
  r.joueurs.filter((j) => j !== r.preneurId && (r.appeleId === null || j !== r.appeleId));

export interface TarotRoundResult {
  seuil: number;
  ecart: number;
  contratReussi: boolean;
  scoreContrat: number;
  bonusPoignee: number;
  bonusPetitAuBout: number;
  bonusChelem: number;
  scoreAttaque: number;
  points: Scores;
}

export function seuilRequis(bouts: number): number {
  const seuils = [56, 51, 41, 36];
  if (!Number.isInteger(bouts) || bouts < 0 || bouts > 3)
    throw new Error(`Le nombre de bouts doit être compris entre 0 et 3 (reçu : ${bouts}).`);
  return seuils[bouts];
}

/** Barème FFT : (25 + |écart|) × coef ; petit au bout ±10 × coef ; poignée et chelem non multipliés. */
export function calculer(round: TarotRound): TarotRoundResult {
  const seuil = seuilRequis(round.bouts);
  const ecart = round.pointsRealises - seuil;
  const contratReussi = ecart >= 0;
  const coef = contractInfo(round.contract).multiplier;
  const scoreContrat = (25 + Math.abs(ecart)) * coef * (contratReussi ? 1 : -1);

  let bonusPoignee = 0;
  if (round.poignee !== null) {
    const b = poigneeInfo(round.poignee).bonus;
    bonusPoignee = round.poigneeCamp === "ATTAQUE" ? b : -b;
  }
  const bonusPetitAuBout =
    round.petitAuBoutCamp === "ATTAQUE" ? 10 * coef : round.petitAuBoutCamp === "DEFENSE" ? -10 * coef : 0;

  let bonusChelem = 0;
  if (round.chelem) {
    if (round.chelem.reussi) bonusChelem = round.chelem.annonce ? 400 : 200;
    else if (round.chelem.annonce) bonusChelem = -200;
  }

  const scoreAttaque = scoreContrat + bonusPoignee + bonusPetitAuBout + bonusChelem;
  return {
    seuil, ecart, contratReussi, scoreContrat, bonusPoignee, bonusPetitAuBout, bonusChelem, scoreAttaque,
    points: repartir(round, scoreAttaque),
  };
}

function repartir(round: TarotRound, x: number): Scores {
  const points: Scores = {};
  if (round.joueurs.length === 5 && !appeleASoiMeme(round)) {
    for (const d of defenseurs(round)) points[d] = -x;
    points[round.preneurId] = 2 * x;
    points[round.appeleId!] = x;
  } else {
    const autres = round.joueurs.filter((j) => j !== round.preneurId);
    for (const d of autres) points[d] = -x;
    points[round.preneurId] = autres.length * x;
  }
  return points;
}

export const tarotModule: GameModule<TarotRound> & { SETTING_DEMI_POINTS: string } = {
  id: "tarot",
  displayName: "Tarot",
  minPlayers: 3,
  maxPlayers: 5,
  SETTING_DEMI_POINTS: "demiPoints",
  scoreRound: (r) => calculer(r).points,
  encodeRound: (r) => JSON.stringify(r),
  decodeRound(raw) {
    const o = JSON.parse(raw);
    return {
      joueurs: o.joueurs, preneurId: o.preneurId, appeleId: o.appeleId ?? null, contract: o.contract,
      bouts: o.bouts, pointsRealises: o.pointsRealises, poignee: o.poignee ?? null,
      poigneeCamp: o.poigneeCamp ?? null, petitAuBoutCamp: o.petitAuBoutCamp ?? null, chelem: o.chelem ?? null,
    };
  },
};

// ---------- Brouillon (logique du formulaire) ----------

export type ChelemChoice = "AUCUN" | "ANNONCE_REUSSI" | "REUSSI_NON_ANNONCE" | "ANNONCE_RATE";
export const CHELEM_CHOICES: { id: ChelemChoice; label: string }[] = [
  { id: "AUCUN", label: "Aucun" },
  { id: "ANNONCE_REUSSI", label: "Annoncé et réussi" },
  { id: "REUSSI_NON_ANNONCE", label: "Réussi non annoncé" },
  { id: "ANNONCE_RATE", label: "Annoncé et raté" },
];
export const chelemLabel = (c: ChelemChoice) => CHELEM_CHOICES.find((x) => x.id === c)!.label;
const chelemReussi = (c: ChelemChoice) => c === "ANNONCE_REUSSI" || c === "REUSSI_NON_ANNONCE";

export function chelemFromChoice(c: ChelemChoice): TarotChelem | null {
  switch (c) {
    case "AUCUN": return null;
    case "ANNONCE_REUSSI": return { annonce: true, reussi: true };
    case "REUSSI_NON_ANNONCE": return { annonce: false, reussi: true };
    case "ANNONCE_RATE": return { annonce: true, reussi: false };
  }
}
export function choiceFromChelem(c: TarotChelem | null): ChelemChoice {
  if (!c) return "AUCUN";
  if (c.reussi && c.annonce) return "ANNONCE_REUSSI";
  if (c.reussi) return "REUSSI_NON_ANNONCE";
  return c.annonce ? "ANNONCE_RATE" : "AUCUN";
}

export const TOTAL_POINTS = 91;

export interface TarotDraft {
  joueurs: string[];
  preneurId: string;
  appeleId: string | null;
  contract: TarotContract;
  bouts: number;
  pointsRealises: number;
  poignee: TarotPoignee | null;
  poigneeCamp: TarotCamp;
  petitAuBoutCamp: TarotCamp | null;
  chelem: ChelemChoice;
  demiPoints: boolean;
}

export const draftStep = (d: TarotDraft) => (d.demiPoints ? 0.5 : 1);
export const pointsDefense = (d: TarotDraft) => TOTAL_POINTS - d.pointsRealises;
export const pointsVerrouilles = (d: TarotDraft) => chelemReussi(d.chelem);

function snap(d: TarotDraft, value: number): number {
  const clamped = Math.min(TOTAL_POINTS, Math.max(0, value));
  const step = draftStep(d);
  return Math.round(clamped / step) * step;
}

export function initialDraft(joueurs: string[], demiPoints: boolean): TarotDraft {
  return {
    joueurs, preneurId: joueurs[0], appeleId: joueurs.length === 5 ? joueurs[1] : null,
    contract: "GARDE", bouts: 0, pointsRealises: 56, poignee: null, poigneeCamp: "ATTAQUE",
    petitAuBoutCamp: null, chelem: "AUCUN", demiPoints,
  };
}

export function draftFromRound(r: TarotRound, demiPoints: boolean): TarotDraft {
  return {
    joueurs: r.joueurs, preneurId: r.preneurId, appeleId: r.appeleId, contract: r.contract, bouts: r.bouts,
    pointsRealises: r.pointsRealises, poignee: r.poignee, poigneeCamp: r.poigneeCamp ?? "ATTAQUE",
    petitAuBoutCamp: r.petitAuBoutCamp, chelem: choiceFromChelem(r.chelem),
    // Une manche saisie avec des demi-points reste modifiable avec.
    demiPoints: demiPoints || r.pointsRealises % 1 !== 0,
  };
}

export function withPoints(d: TarotDraft, value: number): TarotDraft {
  return pointsVerrouilles(d) ? d : { ...d, pointsRealises: snap(d, value) };
}
export const withPointsDelta = (d: TarotDraft, steps: number) => withPoints(d, d.pointsRealises + steps * draftStep(d));

export function withChelem(d: TarotDraft, choice: ChelemChoice): TarotDraft {
  let points = d.pointsRealises;
  if (chelemReussi(choice)) points = TOTAL_POINTS;
  // Un chelem raté ne peut pas avoir fait tous les points.
  else if (choice === "ANNONCE_RATE" && points >= TOTAL_POINTS) points = TOTAL_POINTS - draftStep(d);
  return { ...d, chelem: choice, pointsRealises: points };
}

export function buildRound(d: TarotDraft): { round?: TarotRound; error?: string } {
  try {
    const round: TarotRound = {
      joueurs: d.joueurs, preneurId: d.preneurId, appeleId: d.joueurs.length === 5 ? d.appeleId : null,
      contract: d.contract, bouts: d.bouts, pointsRealises: d.pointsRealises, poignee: d.poignee,
      poigneeCamp: d.poignee ? d.poigneeCamp : null, petitAuBoutCamp: d.petitAuBoutCamp,
      chelem: chelemFromChoice(d.chelem),
    };
    validateRound(round);
    return { round };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ---------- Résumé pour l'historique ----------

export function summarize(round: TarotRound, nameOf: (id: string) => string): { headline: string; detail: string } {
  const result = calculer(round);
  let headline = `${nameOf(round.preneurId)} · ${contractInfo(round.contract).label}`;
  if (round.joueurs.length === 5) {
    headline += appeleASoiMeme(round) ? " (appelé à soi-même)" : ` (avec ${nameOf(round.appeleId!)})`;
  }
  const bouts = round.bouts > 1 ? `${round.bouts} bouts` : `${round.bouts} bout`;
  const issue = result.contratReussi
    ? `contrat réussi de ${plain(result.ecart)}`
    : `contrat chuté de ${plain(-result.ecart)}`;
  const camp = (c: TarotCamp | null) => (c === "ATTAQUE" ? "attaque" : "défense");
  const extras: string[] = [];
  if (round.poignee) extras.push(`poignée ${poigneeInfo(round.poignee).label} (${camp(round.poigneeCamp)})`);
  if (round.petitAuBoutCamp) extras.push(`petit au bout (${camp(round.petitAuBoutCamp)})`);
  if (round.chelem && (round.chelem.annonce || round.chelem.reussi))
    extras.push(`chelem ${chelemLabel(choiceFromChelem(round.chelem)).toLowerCase()}`);
  return { headline, detail: [bouts, `${plain(round.pointsRealises)} pts`, issue, ...extras].join(" · ") };
}
