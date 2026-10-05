import { describe, expect, it } from "vitest";
import { rulesFor } from "./rules";
import { GAMES } from "./registry";

describe("règles des jeux", () => {
  it("chaque jeu de l'appli a ses règles, avec un résumé et des sections non vides", () => {
    for (const g of GAMES) {
      const doc = rulesFor(g.id);
      expect(doc, g.id).toBeDefined();
      expect(doc!.summary.length).toBeGreaterThan(40);
      expect(doc!.sections.length).toBeGreaterThan(0);
      for (const s of doc!.sections) {
        expect(s.paragraphs || s.bullets || s.table, `${g.id}/${s.id}`).toBeTruthy();
      }
      expect(new Set(doc!.sections.map((s) => s.id)).size).toBe(doc!.sections.length);
    }
  });
  it("les tableaux du Tarot viennent du moteur de calcul", () => {
    const doc = rulesFor("tarot")!;
    const seuils = doc.sections.find((s) => s.id === "bouts")!.table!.rows;
    expect(seuils).toEqual([["0", "56"], ["1", "51"], ["2", "41"], ["3", "36"]]);
    const contrats = doc.sections.find((s) => s.id === "contrats")!.table!.rows;
    expect(contrats.map((r) => r[1])).toEqual(["× 1", "× 2", "× 4", "× 6"]);
    const poignees = doc.sections.find((s) => s.id === "poignees")!.table!.rows;
    expect(poignees[0]).toEqual(["Simple", "+20", "13", "10", "8"]);
    expect(poignees[2]).toEqual(["Triple", "+40", "18", "15", "13"]);
  });
  it("le Compteur libre décrit chacun de ses modes", () => {
    const ids = rulesFor("free")!.sections.map((s) => s.id);
    for (const mode of ["points", "wins", "live", "lives", "countdown"]) expect(ids).toContain(`mode-${mode}`);
  });
  it("jeu inconnu : pas de règles", () => {
    expect(rulesFor("inconnu")).toBeUndefined();
  });
});
