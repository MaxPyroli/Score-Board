import { describe, expect, it } from "vitest";
import { finalMessage, isFinished, ranking, withSetting, type Player, type StoredMatch } from "./index";

const players: Player[] = ["Ana", "Bob", "Chloé", "Dan"].map((name) => ({ id: name[0], name }));

describe("classement", () => {
  it("le plus haut score gagne par défaut", () => {
    const r = ranking(players, { A: 10, B: 30, C: 20, D: -5 }, false);
    expect(r.map((x) => [x.player.name, x.rank])).toEqual([["Bob", 1], ["Chloé", 2], ["Ana", 3], ["Dan", 4]]);
  });
  it("le plus petit score gagne si demandé", () => {
    const r = ranking(players, { A: 10, B: 30, C: 20, D: -5 }, true);
    expect(r.map((x) => x.player.name)).toEqual(["Dan", "Ana", "Chloé", "Bob"]);
  });
  it("les ex æquo partagent le rang, le suivant saute", () => {
    const r = ranking(players, { A: 10, B: 30, C: 30, D: 5 }, false);
    expect(r.map((x) => x.rank)).toEqual([1, 1, 3, 4]);
  });
});

describe("message de fin", () => {
  const ranked = ranking(players, { A: 10, B: 30, C: 20, D: 5 }, false);
  it("vainqueur", () => {
    expect(finalMessage(ranked, "B")).toEqual({ headline: "Tu as gagné !", detail: "Tu finis 1er avec 30 points." });
  });
  it("perdant", () => {
    expect(finalMessage(ranked, "A")).toEqual({ headline: "Tu as perdu", detail: "Bob gagne · tu finis 3e sur 4 avec 10 points." });
  });
  it("sans choix de joueur : résultat général", () => {
    expect(finalMessage(ranked, null).headline).toBe("Bob gagne la partie !");
  });
  it("égalité en tête", () => {
    const tie = ranking(players, { A: 30, B: 30, C: 1, D: 0 }, false);
    expect(finalMessage(tie, "A").headline).toBe("Victoire à égalité !");
    expect(finalMessage(tie, "C").detail).toBe("Ana et Bob gagnent à égalité · tu finis 3e sur 4 avec 1 point.");
    expect(finalMessage(tie, null).headline).toBe("Ana et Bob gagnent à égalité !");
  });
  it("réglage de fin de partie", () => {
    const m: StoredMatch = { id: "m", moduleId: "free", players, rounds: [], settings: {}, createdAt: 0 };
    expect(isFinished(m)).toBe(false);
    expect(isFinished(withSetting(m, "finished", "true"))).toBe(true);
  });
});
