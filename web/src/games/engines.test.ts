import { describe, expect, it } from "vitest";
import {
  buildRound, calculer, atoutsRequis, draftFromRound, initialDraft, seuilRequis, summarize, tarotModule,
  validateRound, withChelem, withPoints, withPointsDelta, pointsDefense, type TarotRound,
} from "./tarot";
import { buildSkyjo, calculerSkyjo, emptySkyjoDraft, skyjoModule } from "./skyjo";
import { buildFree, emptyFreeDraft, FREE } from "./counter";
import {
  describeTarget, matchWithoutLastRound, matchWithRound, parseScore, plain, signed, totals, type StoredMatch,
} from "../core";

const round = (o: Partial<TarotRound> = {}): TarotRound => ({
  joueurs: ["A", "B", "C", "D"], preneurId: "A", appeleId: null, contract: "GARDE", bouts: 1, pointsRealises: 56,
  poignee: null, poigneeCamp: null, petitAuBoutCamp: null, chelem: null, ...o,
});
const somme = (p: Record<string, number>) => Object.values(p).reduce((a, b) => a + b, 0);

describe("Tarot : barème", () => {
  it("seuils selon les bouts", () => {
    expect([0, 1, 2, 3].map(seuilRequis)).toEqual([56, 51, 41, 36]);
    expect(() => seuilRequis(4)).toThrow();
    expect(() => seuilRequis(-1)).toThrow();
  });

  it("4 joueurs, contrat réussi : 3X / −X", () => {
    const r = calculer(round());
    expect(r.ecart).toBe(5);
    expect(r.scoreContrat).toBe(60);
    expect(r.points).toEqual({ A: 180, B: -60, C: -60, D: -60 });
  });

  it("4 joueurs, contrat chuté de peu", () => {
    const r = calculer(round({ contract: "PETITE", pointsRealises: 45 }));
    expect(r.contratReussi).toBe(false);
    expect(r.scoreContrat).toBe(-31);
    expect(r.points).toEqual({ A: -93, B: 31, C: 31, D: 31 });
  });

  it("3 joueurs : le preneur touche 2X", () => {
    const r = calculer(round({ joueurs: ["A", "B", "C"], contract: "PETITE", bouts: 2, pointsRealises: 41 }));
    expect(r.points).toEqual({ A: 50, B: -25, C: -25 });
  });

  it("5 joueurs : preneur 2X, appelé X, défenseurs −X", () => {
    const r = calculer(round({ joueurs: ["A", "B", "C", "D", "E"], appeleId: "B", contract: "PETITE", bouts: 3, pointsRealises: 36 }));
    expect(r.points).toEqual({ A: 50, B: 25, C: -25, D: -25, E: -25 });
  });

  it("5 joueurs, appelé à soi-même : 4X contre 4 défenseurs", () => {
    const r = calculer(round({ joueurs: ["A", "B", "C", "D", "E"], appeleId: "A", contract: "PETITE", bouts: 3, pointsRealises: 36 }));
    expect(r.points).toEqual({ A: 100, B: -25, C: -25, D: -25, E: -25 });
  });

  it("poignée simple attaque +20, triple défense −40 (non multipliées)", () => {
    expect(calculer(round({ poignee: "SIMPLE", poigneeCamp: "ATTAQUE" })).scoreAttaque).toBe(80);
    expect(calculer(round({ poignee: "TRIPLE", poigneeCamp: "DEFENSE" })).scoreAttaque).toBe(20);
  });

  it("petit au bout multiplié par le contrat, pas poignée ni chelem", () => {
    const r = calculer(round({
      contract: "GARDE_CONTRE", petitAuBoutCamp: "ATTAQUE", poignee: "SIMPLE", poigneeCamp: "ATTAQUE",
      chelem: { annonce: true, reussi: true }, pointsRealises: 91, bouts: 3,
    }));
    expect(r.bonusPetitAuBout).toBe(60);
    expect(r.bonusPoignee).toBe(20);
    expect(r.bonusChelem).toBe(400);
    expect(calculer(round({ contract: "GARDE_CONTRE", petitAuBoutCamp: "DEFENSE" })).bonusPetitAuBout).toBe(-60);
  });

  it("atouts requis pour une poignée", () => {
    expect(atoutsRequis("SIMPLE", 3)).toBe(13);
    expect(atoutsRequis("TRIPLE", 4)).toBe(15);
    expect(atoutsRequis("DOUBLE", 5)).toBe(10);
  });

  it("chelem : annoncé réussi 400, non annoncé 200, annoncé raté −200", () => {
    expect(calculer(round({ pointsRealises: 91, chelem: { annonce: true, reussi: true } })).bonusChelem).toBe(400);
    expect(calculer(round({ pointsRealises: 91, chelem: { annonce: false, reussi: true } })).bonusChelem).toBe(200);
    expect(calculer(round({ chelem: { annonce: true, reussi: false } })).bonusChelem).toBe(-200);
  });

  it("demi-points acceptés, somme toujours nulle", () => {
    const r = calculer(round({ pointsRealises: 56.5, poignee: "DOUBLE", poigneeCamp: "DEFENSE", petitAuBoutCamp: "ATTAQUE" }));
    expect(r.ecart).toBe(5.5);
    expect(somme(r.points)).toBeCloseTo(0);
  });

  it("rejette les manches incohérentes", () => {
    expect(() => validateRound(round({ joueurs: ["A", "B"], preneurId: "A" }))).toThrow();
    expect(() => validateRound(round({ joueurs: ["A", "A", "B", "C"] }))).toThrow();
    expect(() => validateRound(round({ preneurId: "Z" }))).toThrow();
    expect(() => validateRound(round({ appeleId: "B" }))).toThrow();
    expect(() => validateRound(round({ joueurs: ["A", "B", "C", "D", "E"] }))).toThrow();
    expect(() => validateRound(round({ bouts: 4 }))).toThrow();
    expect(() => validateRound(round({ pointsRealises: 92 }))).toThrow();
    expect(() => validateRound(round({ pointsRealises: 56.3 }))).toThrow();
    expect(() => validateRound(round({ poignee: "SIMPLE" }))).toThrow();
    expect(() => validateRound(round({ chelem: { annonce: true, reussi: true }, pointsRealises: 90 }))).toThrow();
  });
});

describe("Tarot : formulaire", () => {
  it("brouillon initial valide à 3, 4 et 5 joueurs", () => {
    for (const n of [3, 4, 5]) {
      const ids = ["A", "B", "C", "D", "E"].slice(0, n);
      expect(buildRound(initialDraft(ids, false)).error).toBeUndefined();
    }
  });

  it("points : pas de 1 ou 0,5, arrondi et bornes, défense complémentaire", () => {
    let d = initialDraft(["A", "B", "C", "D"], false);
    expect(pointsDefense(d)).toBe(35);
    d = withPoints(d, 60.4);
    expect(d.pointsRealises).toBe(60);
    expect(withPoints(d, 200).pointsRealises).toBe(91);
    expect(withPoints(d, -5).pointsRealises).toBe(0);
    expect(withPointsDelta(d, 3).pointsRealises).toBe(63);
    const demi = withPoints(initialDraft(["A", "B", "C", "D"], true), 60.3);
    expect(demi.pointsRealises).toBe(60.5);
  });

  it("chelem réussi verrouille à 91 ; raté ne peut pas avoir 91", () => {
    let d = withChelem(initialDraft(["A", "B", "C", "D"], false), "ANNONCE_REUSSI");
    expect(d.pointsRealises).toBe(91);
    expect(withPoints(d, 10).pointsRealises).toBe(91);
    d = withChelem(d, "ANNONCE_RATE");
    expect(d.pointsRealises).toBe(90);
  });

  it("aller-retour manche → brouillon → manche", () => {
    const r = round({ poignee: "DOUBLE", poigneeCamp: "DEFENSE", petitAuBoutCamp: "ATTAQUE", pointsRealises: 60.5 });
    const d = draftFromRound(r, false);
    expect(d.demiPoints).toBe(true);
    expect(buildRound(d).round).toEqual(r);
  });

  it("encodage JSON et totaux d'une partie", () => {
    const raw = tarotModule.encodeRound(round({ poignee: "SIMPLE", poigneeCamp: "ATTAQUE" }));
    expect(tarotModule.decodeRound(raw)).toEqual(round({ poignee: "SIMPLE", poigneeCamp: "ATTAQUE" }));
    // Une manche écrite par l'appli Android (champs facultatifs absents) se décode aussi.
    const minimal = '{"joueurs":["A","B","C","D"],"preneurId":"A","contract":"PETITE","bouts":0,"pointsRealises":56.0}';
    expect(tarotModule.decodeRound(minimal).poignee).toBeNull();

    const base: StoredMatch = { id: "m", moduleId: "tarot", players: ["A", "B", "C", "D"].map((id) => ({ id, name: id })), rounds: [], settings: {}, createdAt: 0 };
    const m1 = matchWithRound(matchWithRound(base, tarotModule.encodeRound(round({ contract: "PETITE" }))), tarotModule.encodeRound(round({ preneurId: "B" })));
    const t = totals(tarotModule, m1);
    expect(somme(t)).toBeCloseTo(0);
    expect(totals(tarotModule, matchWithoutLastRound(m1)).A).toBe(90);
  });

  it("résumé de manche", () => {
    const s = summarize(round({ poignee: "SIMPLE", poigneeCamp: "ATTAQUE" }), (id) => `J${id}`);
    expect(s.headline).toBe("JA · Garde");
    expect(s.detail).toBe("1 bout · 56 pts · contrat réussi de 5 · poignée simple (attaque)");
  });
});

describe("Skyjo", () => {
  it("score doublé si le finisseur n'est pas strictement le plus bas", () => {
    expect(calculerSkyjo({ scores: { A: 20, B: 15 }, finisherId: "A" }).points).toEqual({ A: 40, B: 15 });
    expect(calculerSkyjo({ scores: { A: 15, B: 15 }, finisherId: "A" }).points).toEqual({ A: 30, B: 15 });
    expect(calculerSkyjo({ scores: { A: 10, B: 15 }, finisherId: "A" }).points).toEqual({ A: 10, B: 15 });
    expect(calculerSkyjo({ scores: { A: -3, B: -5 }, finisherId: "A" }).points).toEqual({ A: -3, B: -5 });
    expect(calculerSkyjo({ scores: { A: 0, B: 0 }, finisherId: "A" }).points).toEqual({ A: 0, B: 0 });
  });

  it("formulaire : saisie complète, signe moins, bornes", () => {
    const names = (id: string) => id;
    let d = emptySkyjoDraft(["A", "B"]);
    expect(buildSkyjo(d, names).error).toMatch(/terminé/); // champs vides = 0, il manque juste qui a fini
    expect(buildSkyjo({ ...d, finisherId: "A" }, names).round).toEqual({ scores: { A: 0, B: 0 }, finisherId: "A" });
    d = { ...d, texts: { A: "5", B: "3" }, negatives: ["B"] };
    expect(buildSkyjo(d, names).error).toMatch(/terminé/);
    d = { ...d, finisherId: "B" };
    expect(buildSkyjo(d, names).round).toEqual({ scores: { A: 5, B: -3 }, finisherId: "B" });
    expect(buildSkyjo({ ...d, texts: { A: "200", B: "3" } }, names).error).toMatch(/impossible/);
    expect(buildSkyjo({ ...d, texts: { A: "2,5", B: "3" } }, names).error).toMatch(/entier/);
  });

  it("module : encodage et totaux", () => {
    const raw = skyjoModule.encodeRound({ scores: { A: 1, B: 2 }, finisherId: "A" });
    expect(skyjoModule.decodeRound(raw)).toEqual({ scores: { A: 1, B: 2 }, finisherId: "A" });
  });
});

describe("Compteur libre et cœur", () => {
  it("champ vide = 0 (même si tout est vide), négatif refusé si interdit", () => {
    const n = (id: string) => id;
    expect(buildFree(emptyFreeDraft(["A", "B"]), n).round).toEqual({ points: { A: 0, B: 0 } });
    expect(buildFree({ players: ["A", "B"], texts: { A: "12,5" }, negatives: [] }, n).round).toEqual({ points: { A: 12.5, B: 0 } });
    expect(buildFree({ players: ["A"], texts: { A: "4" }, negatives: ["A"] }, n, false).error).toMatch(/négatif/);
    expect(FREE.decodeRound(FREE.encodeRound({ points: { A: 1 } }))).toEqual({ points: { A: 1 } });
  });

  it("formats et lecture de nombres", () => {
    expect(plain(56)).toBe("56");
    expect(plain(56.5)).toBe("56,5");
    expect(signed(60)).toBe("+60");
    expect(signed(-31)).toBe("−31");
    expect(signed(0)).toBe("0");
    expect(parseScore("12,5")).toBe(12.5);
    expect(parseScore("-4")).toBe(-4);
    expect(parseScore("4", true)).toBe(-4);
    expect(parseScore("abc")).toBeNull();
    expect(parseScore("")).toBeNull();
  });

  it("objectif de points", () => {
    const players = [{ id: "A", name: "Ana" }, { id: "B", name: "Bob" }];
    expect(describeTarget(players, { A: 10, B: 20 }, null, true)).toBeNull();
    expect(describeTarget(players, { A: 10, B: 20 }, 100, true)).toBe("Objectif : 100 points");
    expect(describeTarget(players, { A: 10, B: 20 }, 66, true, true)).toBe("Le premier à 66 a perdu")
    expect(describeTarget(players, { A: 10, B: 70 }, 66, true, true)).toBe("Bob a atteint 66 : fin de partie. En tête : Ana (10).");
    expect(describeTarget(players, { A: 50, B: 101 }, 100, true)).toBe("Objectif de 100 atteint par Bob. En tête : Ana (50).");
  });
});

import { adjustRound, changesOf, lowestWinsFor, modeOf, negateRound, startOf, winnerRound } from "./counter";

describe("Compteur libre : modes", () => {
  it("mode par défaut : points par manche ; modes inconnus ignorés", () => {
    expect(modeOf({})).toBe("points");
    expect(modeOf({ mode: "wins" })).toBe("wins");
    expect(modeOf({ mode: "n'importe quoi" })).toBe("points");
  });
  it("points de départ : vies 3, décompte 301, sinon 0 ; réglable", () => {
    expect(startOf({})).toBe(0);
    expect(startOf({ mode: "lives" })).toBe(3);
    expect(startOf({ mode: "countdown" })).toBe(301);
    expect(startOf({ mode: "countdown", start: "501" })).toBe(501);
    expect(startOf({ mode: "points", start: "50" })).toBe(0);
    expect(startOf({ mode: "lives", start: "-2" })).toBe(3);
  });
  it("sens du jeu selon le mode", () => {
    expect(lowestWinsFor({ mode: "countdown" })).toBe(true);
    expect(lowestWinsFor({ mode: "wins", lowestWins: "true" })).toBe(false);
    expect(lowestWinsFor({ mode: "lives" })).toBe(false);
    expect(lowestWinsFor({ mode: "points", lowestWins: "true" })).toBe(true);
    expect(lowestWinsFor({})).toBe(false);
  });
  it("manches de chaque mode", () => {
    const ids = ["A", "B", "C"];
    expect(winnerRound(ids, ["B"]).points).toEqual({ A: 0, B: 1, C: 0 });
    expect(winnerRound(ids, ["A", "C"]).points).toEqual({ A: 1, B: 0, C: 1 });
    expect(adjustRound(ids, "C", -1).points).toEqual({ A: 0, B: 0, C: -1 });
    expect(negateRound({ points: { A: 60, B: 0, C: -5 } }).points).toEqual({ A: -60, B: 0, C: 5 });
    expect(changesOf(adjustRound(ids, "B", 5), ids)).toEqual([{ id: "B", delta: 5 }]);
  });
});
