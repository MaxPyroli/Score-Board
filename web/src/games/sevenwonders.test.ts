import { describe, expect, it } from "vitest";
import { bestScience, breakdown, buildWonders, emptyDraft, emptySheet, scienceOf, sevenWondersModule } from "./sevenwonders";
import { totals, type StoredMatch } from "../core";
import { gameById } from "./registry";
import { rulesFor } from "./rules";

describe("7 Wonders : décompte", () => {
  it("sciences : carré de chaque sorte + 7 par série de trois symboles différents", () => {
    expect([scienceOf(1, 0, 0), scienceOf(3, 0, 0), scienceOf(2, 2, 1), scienceOf(1, 1, 1), scienceOf(0, 0, 0)]).toEqual([1, 9, 16, 10, 0]);
  });
  it("jokers : placés là où ils rapportent le plus", () => {
    expect(bestScience({ compass: 2, gears: 2, tablets: 0, wild: 1 })).toBe(16); // le joker devient une tablette
    expect(bestScience({ compass: 3, gears: 0, tablets: 0, wild: 1 })).toBe(16); // un quatrième compas : 16
    expect(bestScience({ compass: 0, gears: 0, tablets: 0, wild: 2 })).toBe(4);
    expect(bestScience({ compass: 1, gears: 1, tablets: 0, wild: 1 })).toBe(10);
  });
  it("militaire = victoires − défaites ; pièces : 1 point pour 3 (reste ignoré)", () => {
    const b = breakdown({ ...emptySheet(), victories: 9, defeats: 3, coins: 14 });
    expect([b.military, b.coins, b.total]).toEqual([6, 4, 10]);
    expect(breakdown({ ...emptySheet(), defeats: 2 }).total).toBe(-2);
  });
  it("total : toutes les catégories s'additionnent", () => {
    const b = breakdown({ victories: 6, defeats: 1, coins: 7, wonder: 10, civil: 17, commercial: 4, guilds: 8, compass: 2, gears: 1, tablets: 1, wild: 0 });
    // militaire 5 + pièces 2 + merveille 10 + civils 17 + commerce 4 + guildes 8 + sciences (4+1+1+7=13)
    expect(b.total).toBe(5 + 2 + 10 + 17 + 4 + 8 + 13);
  });
});

describe("7 Wonders : saisie et partie", () => {
  const names = (id: string) => id;
  it("champ vide = 0 ; refus d'un nombre négatif ou décimal, en nommant le joueur", () => {
    expect(buildWonders({}, ["A", "B"], names).round?.sheets.A).toEqual(emptySheet());
    expect(buildWonders({ A: { ...emptyDraft(), civil: "-3" } }, ["A"], names).error).toMatch(/^A · Civils/);
    expect(buildWonders({ A: { ...emptyDraft(), coins: "2,5" } }, ["A"], names).error).toMatch(/^A · Pièces/);
    expect(buildWonders({ A: { ...emptyDraft(), wild: "99" } }, ["A"], names).error).toMatch(/Jokers/);
  });
  it("encodage aller-retour, totaux de la partie, jeu enregistré avec ses règles", () => {
    const r = buildWonders({ A: { ...emptyDraft(), victories: "5", coins: "9" }, B: { ...emptyDraft(), civil: "12" } }, ["A", "B"], names).round!;
    expect(sevenWondersModule.decodeRound(sevenWondersModule.encodeRound(r))).toEqual(r);
    const m: StoredMatch = { id: "m", moduleId: "sevenwonders", createdAt: 0, settings: {}, rounds: [sevenWondersModule.encodeRound(r)], players: [{ id: "A", name: "Ana" }, { id: "B", name: "Bob" }] };
    expect(totals(sevenWondersModule, m)).toEqual({ A: 8, B: 12 });
    const g = gameById("sevenwonders")!;
    expect(g.canAddRound?.(m)).toBe(false);
    expect(g.canFinish(m)).toBe(true);
    expect(rulesFor("sevenwonders")?.sections.some((s) => s.id === "decompte")).toBe(true);
  });
  it("une saisie absurde est refusée au décodage", () => {
    expect(() => sevenWondersModule.decodeRound('{"sheets":{"A":{"civil":-1}}}')).toThrow();
  });
});
