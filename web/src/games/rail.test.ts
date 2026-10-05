import { describe, expect, it } from "vitest";
import {
  applyBonuses, buildRail, draftFromSheet, editionDefaults, emptyDraftSheet, emptySheet, railConfig, railModule, routesPoints, sheetTotal,
  type RailDraftSheet, type RailRound, type RailSheet,
} from "./rail";
import { totals, type StoredMatch } from "../core";

const sheet = (o: Partial<RailSheet> = {}): RailSheet => ({ ...emptySheet(), ...o });

describe("Aventuriers du Rail : décompte", () => {
  it("points des routes selon leur longueur", () => {
    expect(routesPoints({ 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 })).toBe(1 + 2 + 4 + 7 + 10 + 15);
    expect(routesPoints({ 8: 1 })).toBe(21);
    expect(routesPoints({ 3: 4, 6: 2 })).toBe(16 + 30);
    expect(routesPoints({})).toBe(0);
  });
  it("total d'un joueur : routes + billets réussis − billets ratés + bonus + gares", () => {
    expect(sheetTotal(sheet({ routes: 85, ticketsDone: 40, ticketsFailed: 12 }))).toBe(113);
    expect(sheetTotal(sheet({ routes: 50, longest: true }))).toBe(60);
    expect(sheetTotal(sheet({ routes: 50, globetrotter: true }))).toBe(65);
    expect(sheetTotal(sheet({ routes: 50, stations: 3 }))).toBe(62);
    expect(sheetTotal(sheet({ routes: 100, ticketsDone: 20, ticketsFailed: 30, longest: true, globetrotter: true, stations: 2 }))).toBe(100 + 20 - 30 + 10 + 15 + 8);
    expect(sheetTotal(sheet({ ticketsFailed: 20 }))).toBe(-20); // un joueur peut finir en négatif
  });
});

describe("Aventuriers du Rail : manche et partie", () => {
  const round: RailRound = { sheets: { A: sheet({ routes: 90, ticketsDone: 30, longest: true }), B: sheet({ routes: 100, ticketsFailed: 8, stations: 3 }) } };
  it("encodage JSON aller-retour, points de la manche", () => {
    const raw = railModule.encodeRound(round);
    expect(railModule.decodeRound(raw)).toEqual(round);
    expect(railModule.scoreRound(round)).toEqual({ A: 130, B: 104 });
  });
  it("une fiche incomplète se décode avec des valeurs par défaut ; une fiche absurde est refusée", () => {
    expect(railModule.decodeRound('{"sheets":{"A":{"routes":12}}}').sheets.A).toEqual(sheet({ routes: 12 }));
    expect(() => railModule.decodeRound('{"sheets":{"A":{"routes":-4}}}')).toThrow();
    expect(() => railModule.decodeRound('{"sheets":{"A":{"stations":9}}}')).toThrow();
  });
  it("totaux d'une partie", () => {
    const m: StoredMatch = {
      id: "m", moduleId: "rail", createdAt: 0, settings: {}, rounds: [railModule.encodeRound(round)],
      players: [{ id: "A", name: "Ana" }, { id: "B", name: "Bob" }, { id: "C", name: "Chloé" }],
    };
    expect(totals(railModule, m)).toEqual({ A: 130, B: 104, C: 0 });
  });
});

describe("Aventuriers du Rail : saisie", () => {
  const names = (id: string) => id;
  it("un champ vide compte 0, le signe des billets ratés est ignoré", () => {
    const d: Record<string, RailDraftSheet> = { A: { ...emptyDraftSheet(), routes: "85", ticketsFailed: "-12" } };
    const r = buildRail(d, ["A", "B"], names, railConfig({})).round!;
    expect(r.sheets.A).toEqual(sheet({ routes: 85, ticketsFailed: 12 }));
    expect(r.sheets.B).toEqual(sheet());
  });
  it("refuse un nombre invalide en nommant le joueur", () => {
    const d = { A: { ...emptyDraftSheet(), routes: "abc" } };
    expect(buildRail(d, ["A"], names, railConfig({})).error).toMatch(/^A · Routes/);
    expect(buildRail({ A: { ...emptyDraftSheet(), ticketsDone: "2,5" } }, ["A"], names, railConfig({})).error).toMatch(/entier/);
  });
  it("une fiche existante se remet dans le formulaire", () => {
    const s = sheet({ routes: 70, longestLength: 12, longest: true, stations: 2 });
    const back = buildRail({ A: draftFromSheet(s) }, ["A"], names, railConfig({})).round!;
    expect(back.sheets.A).toEqual(s);
  });
});

describe("Aventuriers du Rail : éditions", () => {
  it("base : plus long chemin seulement ; Europe : gares en plus et routes de 8", () => {
    expect(railConfig({})).toEqual({ longest: true, globetrotter: false, stations: false, length8: false });
    expect(railConfig({ edition: "europe" })).toEqual({ longest: true, globetrotter: false, stations: true, length8: true });
  });
  it("les réglages cochés à la création l'emportent sur l'édition", () => {
    expect(railConfig({ edition: "europe", stations: "false", globetrotter: "true", longest: "false" })).toEqual({
      longest: false, globetrotter: true, stations: false, length8: true,
    });
    expect(editionDefaults("base").stations).toBe(false);
  });
});

describe("Aventuriers du Rail : bonus attribués par comparaison", () => {
  const cfg = { longest: true, globetrotter: true, stations: false, length8: false };
  const sheets = {
    A: sheet({ longestLength: 14, ticketsCount: 5 }),
    B: sheet({ longestLength: 17, ticketsCount: 5 }),
    C: sheet({ longestLength: 9, ticketsCount: 3 }),
  };
  it("le plus long chemin va au plus grand ; le globe-trotter au plus de billets, égalité : tous", () => {
    const r = applyBonuses(sheets, cfg);
    expect(Object.values(r).map((s) => s.longest)).toEqual([false, true, false]);
    expect(Object.values(r).map((s) => s.globetrotter)).toEqual([true, true, false]);
  });
  it("égalité sur le plus long chemin : tous les ex æquo reçoivent le bonus", () => {
    const r = applyBonuses({ A: sheet({ longestLength: 15 }), B: sheet({ longestLength: 15 }), C: sheet({ longestLength: 8 }) }, cfg);
    expect([r.A.longest, r.B.longest, r.C.longest]).toEqual([true, true, false]);
  });
  it("personne n'a indiqué de valeur : aucun bonus ; bonus désactivés par l'édition : aucun bonus", () => {
    expect(Object.values(applyBonuses({ A: sheet(), B: sheet() }, cfg)).some((s) => s.longest || s.globetrotter)).toBe(false);
    const off = applyBonuses(sheets, { ...cfg, longest: false, globetrotter: false });
    expect(Object.values(off).some((s) => s.longest || s.globetrotter)).toBe(false);
  });
  it("le bonus compte dans le total", () => {
    const r = applyBonuses({ A: sheet({ routes: 80, longestLength: 12 }), B: sheet({ routes: 85, longestLength: 7 }) }, cfg);
    expect(sheetTotal(r.A)).toBe(90);
    expect(sheetTotal(r.B)).toBe(85);
  });
});
