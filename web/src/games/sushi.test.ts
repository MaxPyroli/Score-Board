import { describe, expect, it } from "vitest";
import { buildSushi, fieldsFor, scoreSushi, sushiConfig, sushiModule, type SushiRound, type SushiSheet } from "./sushi";
import { totals, type StoredMatch } from "../core";

const round = (sheets: Record<string, SushiSheet>, dessert = false): SushiRound => ({ dessert, sheets });
const solo = (s: SushiSheet, fruit = false) => scoreSushi({ ...round({ A: s, B: {} }), fruit }).A;

describe("Sushi Go Party ! : cartes individuelles", () => {
  it("nigiri, avec ou sans wasabi", () => {
    expect(solo({ egg: 1, salmon: 1, squid: 1 })).toBe(6);
    expect(solo({ squid: 2, squidW: 1 })).toBe(3 + 9);
    expect(solo({ egg: 1, eggW: 1 })).toBe(3);
  });
  it("tempura, sashimi, gyoza", () => {
    expect(solo({ tempura: 5 })).toBe(10);
    expect(solo({ sashimi: 2 })).toBe(0);
    expect(solo({ sashimi: 7 })).toBe(20);
    expect([0, 1, 2, 3, 4, 5, 7].map((n) => solo({ dumpling: n }))).toEqual([0, 1, 3, 6, 10, 15, 15]);
  });
  it("anguille, tofu, miso, boîte à emporter, thé", () => {
    expect([0, 1, 2, 3].map((n) => solo({ eel: n }))).toEqual([0, -3, 7, 7]);
    expect([0, 1, 2, 3].map((n) => solo({ tofu: n }))).toEqual([0, 2, 6, 0]);
    expect(solo({ miso: 2 })).toBe(6);
    expect(solo({ takeout: 3 })).toBe(6);
    expect(solo({ tea: 2, teaSet: 4 })).toBe(8);
  });
  it("onigiri : les plus grands ensembles de formes différentes d'abord", () => {
    expect(solo({ onigiri1: 1 })).toBe(1);
    expect(solo({ onigiri1: 1, onigiri2: 1, onigiri3: 1, onigiri4: 1 })).toBe(16);
    expect(solo({ onigiri1: 2, onigiri2: 1 })).toBe(4 + 1);
    expect(solo({ onigiri1: 2, onigiri2: 2, onigiri3: 1 })).toBe(9 + 4);
  });
  it("California : 8 puis 6 points à 10 symboles, 2 points au plus de symboles en fin de manche", () => {
    expect(solo({ californiaFirst: 1 })).toBe(8);
    expect(solo({ californiaSecond: 1 })).toBe(6);
    expect(solo({ californiaFirst: 1, californiaSecond: 1 })).toBe(14);
    const r = scoreSushi(round({ A: { california: 4 }, B: { california: 4, californiaFirst: 1 }, C: { california: 1 } }));
    expect(r).toEqual({ A: 2, B: 10, C: 0 });
  });
  it("desserts : glace au thé vert, fruits", () => {
    expect([3, 4, 9].map((n) => solo({ icecream: n }))).toEqual([0, 12, 24]);
    expect([0, 1, 2, 3, 4, 5, 8].map((n) => solo({ melon: n, orange: 1, pineapple: 1 }, true))).toEqual([-2, 0, 1, 3, 6, 10, 10]);
    expect(solo({ melon: 2, orange: 3 }, true)).toBe(1 + 3 + -2);
  });
});

describe("Sushi Go Party ! : comparaisons entre joueurs", () => {
  const three = (key: string, a: number, b: number, c: number) => scoreSushi(round({ A: { [key]: a }, B: { [key]: b }, C: { [key]: c } }));
  it("maki : 6 au plus, 3 au deuxième ; il en faut au moins un", () => {
    expect(three("maki", 5, 3, 0)).toEqual({ A: 6, B: 3, C: 0 });
  });
  it("maki : égalité en tête, tous reçoivent 6 et il n'y a pas de deuxième", () => {
    expect(three("maki", 4, 4, 1)).toEqual({ A: 6, B: 6, C: 0 });
  });
  it("maki : égalité pour la deuxième place, tous reçoivent 3", () => {
    expect(three("maki", 6, 2, 2)).toEqual({ A: 6, B: 3, C: 3 });
  });
  it("maki à 6 joueurs ou plus : 6, 4 et 2", () => {
    const ids = ["A", "B", "C", "D", "E", "F"];
    const r = scoreSushi(round(Object.fromEntries(ids.map((id, i) => [id, { maki: 6 - i }]))));
    expect(ids.map((id) => r[id])).toEqual([6, 4, 2, 0, 0, 0]);
  });
  it("temaki : +4 au plus, −4 au moins, égalités pour tous ; tout le monde à égalité : rien", () => {
    expect(three("temaki", 3, 1, 2)).toEqual({ A: 4, B: -4, C: 0 });
    expect(three("temaki", 3, 3, 0)).toEqual({ A: 4, B: 4, C: -4 });
    expect(three("temaki", 2, 2, 2)).toEqual({ A: 0, B: 0, C: 0 });
    expect(scoreSushi(round({ A: { temaki: 2 }, B: { temaki: 2 } }))).toEqual({ A: 4, B: 4 });
  });
  it("flan : +6 / −6, sans malus à deux joueurs", () => {
    expect(three("flan", 4, 2, 0)).toEqual({ A: 6, B: 0, C: -6 });
    expect(scoreSushi(round({ A: { flan: 3 }, B: { flan: 1 } }))).toEqual({ A: 6, B: 0 });
    expect(scoreSushi(round({ A: { flan: 2 }, B: { flan: 2 } }, true))).toEqual({ A: 6, B: 6 });
  });
  it("edamame : 1 point par adversaire qui en a, 4 par carte au maximum", () => {
    expect(three("edamame", 2, 1, 0)).toEqual({ A: 2, B: 1, C: 0 });
    const five = scoreSushi(round(Object.fromEntries(["A", "B", "C", "D", "E", "F"].map((id) => [id, { edamame: 1 }]))));
    expect(five.A).toBe(4);
  });
  it("sauce soja : 4 points par carte pour le plus de couleurs, égalité pour tous", () => {
    const r = scoreSushi(round({ A: { soy: 2, colors: 5 }, B: { soy: 1, colors: 4 }, C: { soy: 1, colors: 5 } }));
    expect(r).toEqual({ A: 8, B: 0, C: 4 });
  });
});

describe("Sushi Go Party ! : menu, saisie, partie", () => {
  it("le menu décide des champs proposés ; les manches et les desserts sont séparés", () => {
    const cfg = sushiConfig({ roll: "temaki", dessert: "fruit", tempura: "false", soy: "true", wasabi: "false" });
    const keys = fieldsFor(cfg, false).map((f) => f.key);
    expect(keys).toContain("temaki");
    expect(keys).not.toContain("maki");
    expect(keys).not.toContain("tempura");
    expect(keys).toContain("colors");
    expect(keys).not.toContain("eggW"); // pas de wasabi dans ce menu
    expect(fieldsFor(sushiConfig({ wasabi: "true" }), false).map((f) => f.key)).toContain("eggW");
    expect(fieldsFor(cfg, true).map((f) => f.key)).toEqual(["melon", "orange", "pineapple"]);
  });
  it("menu par défaut : maki, flan, tempura, sashimi, gyoza", () => {
    const cfg = sushiConfig({});
    expect(cfg.roll).toBe("maki");
    expect(cfg.dessert).toBe("flan");
    expect([...cfg.cards].sort()).toEqual(["dumpling", "sashimi", "tempura", "wasabi"]);
  });
  it("saisie : champ vide = 0, refus d'un nombre invalide ou d'un wasabi en trop", () => {
    const fields = fieldsFor(sushiConfig({}), false);
    const names = (id: string) => id;
    expect(buildSushi({ A: { tempura: "4", maki: "" } }, ["A", "B"], names, fields, false).round).toEqual({ dessert: false, sheets: { A: { tempura: 4 }, B: {} } });
    expect(buildSushi({ A: { tempura: "x" } }, ["A"], names, fields, false).error).toMatch(/^A · Tempuras/);
    expect(buildSushi({ A: { egg: "1", eggW: "2" } }, ["A"], names, fields, false).error).toMatch(/wasabi/);
  });
  it("encodage aller-retour et totaux de la partie : 3 manches + desserts", () => {
    const r1 = round({ A: { tempura: 2 }, B: { sashimi: 3 } });
    const r2 = round({ A: { dumpling: 3 }, B: {} });
    const d = round({ A: { flan: 1 }, B: { flan: 3 } }, true);
    expect(sushiModule.decodeRound(sushiModule.encodeRound(r1))).toEqual(r1);
    const m: StoredMatch = {
      id: "m", moduleId: "sushi", createdAt: 0, settings: {}, rounds: [r1, r2, d].map((r) => sushiModule.encodeRound(r)),
      players: [{ id: "A", name: "Ana" }, { id: "B", name: "Bob" }],
    };
    expect(totals(sushiModule, m)).toEqual({ A: 5 + 6 + 0, B: 10 + 0 + 6 });
  });
  it("une saisie absurde est refusée au décodage", () => {
    expect(() => sushiModule.decodeRound('{"sheets":{"A":{"egg":-1}}}')).toThrow();
    expect(() => sushiModule.decodeRound('{"sheets":{"A":{"egg":1,"eggW":2}}}')).toThrow();
  });
});
