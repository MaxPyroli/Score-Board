import { describe, expect, it } from "vitest";
import { GRACE_MS, recentlyGone, updateGone } from "./presence";

describe("départs récents", () => {
  it("un joueur qui disparaît est noté ; un joueur déjà noté garde son heure de départ", () => {
    let g = updateGone({}, ["B", "C"], ["C"], 1000);
    expect(g).toEqual({ B: 1000 });
    g = updateGone(g, ["C"], ["C"], 5000);
    expect(g).toEqual({ B: 1000 });
  });
  it("un joueur revenu est retiré", () => {
    expect(updateGone({ B: 1000 }, ["C"], ["B", "C"], 2000)).toEqual({});
  });
  it("la réservation expire après la période de grâce", () => {
    const g = { B: 1000 };
    expect(recentlyGone(g, 1000 + GRACE_MS - 1)).toEqual(["B"]);
    expect(recentlyGone(g, 1000 + GRACE_MS)).toEqual([]);
  });
  it("personne au départ : rien de réservé", () => {
    expect(updateGone({}, [], ["A"], 1)).toEqual({});
  });
});
