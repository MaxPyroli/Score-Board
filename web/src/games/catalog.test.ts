import { describe, expect, it } from "vitest";
import { CATALOG, catalogTagline } from "./catalog";
import { GAMES } from "./registry";
import { rulesFor } from "./rules";

describe("Catalogue de jeux", () => {
  it("identifiants uniques, joueurs cohérents", () => {
    const ids = GAMES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const g of CATALOG) expect(g.min >= 1 && g.min <= g.max, g.name).toBe(true);
  });
  it("chaque jeu du catalogue est dans la liste, avec ses règles d'appli et son sens de jeu", () => {
    for (const c of CATALOG) {
      const def = GAMES.find((g) => g.id === c.id);
      expect(def, c.name).toBeDefined();
      expect(def!.displayName).toBe(c.name);
      expect(def!.tagline).toBe(catalogTagline(c));
      expect(rulesFor(c.id), c.name).toBeDefined();
      expect(def!.fixedSettings.lowestWins ?? "false").toBe(String(!!c.lowest));
    }
  });
});
