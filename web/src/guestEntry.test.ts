import { describe, expect, it } from "vitest";
import { entriesFromClaims, takenPlayers, tryBuildRound } from "./guestEntry";
import { gameById } from "./games/registry";
import type { StoredMatch } from "./core";

const players = ["A", "B", "C"].map((id) => ({ id, name: `J${id}` }));
const match = (moduleId: string, rounds: string[] = []): StoredMatch => ({ id: "m", moduleId, players, rounds, settings: {}, createdAt: 0 });
const claim = (uid: string, p: string, r: number, s: string, f = false) => ({ uid, p, r, s, ...(f ? { f } : {}) });

describe("saisies des joueurs", () => {
  it("garde les saisies de la manche en cours, ignore les périmées et les inconnues", () => {
    const m = match("free", ["x", "y"]);
    const e = entriesFromClaims(
      [claim("u1", "A", 2, "5"), claim("u2", "B", 1, "9"), claim("u3", "Z", 2, "1"), { uid: "u4", p: "C", r: 2, s: "  " }, { uid: "u5", p: "" , r: 2, s: "3" }],
      m, 2,
    );
    expect(e).toEqual({ A: { score: "5", finisher: false } });
  });
  it("deux appareils pour un même joueur : le dernier identifiant l'emporte", () => {
    expect(entriesFromClaims([claim("b", "A", 0, "2"), claim("a", "A", 0, "1")], match("free"), 0).A.score).toBe("2");
  });
});

describe("manche prête ?", () => {
  it("compteur libre : on attend ceux qui n'ont rien saisi, puis la manche se construit", () => {
    const game = gameById("free")!;
    expect(tryBuildRound(game, match("free"), { A: { score: "5", finisher: false } })).toEqual({ waiting: ["JB", "JC"] });
    const ok = tryBuildRound(game, match("free"), { A: { score: "5", finisher: false }, B: { score: "-3", finisher: false }, C: { score: "0", finisher: false } });
    expect(ok).toHaveProperty("raw");
    expect(JSON.parse((ok as { raw: string }).raw).points).toEqual({ A: 5, B: -3, C: 0 });
  });
  it("6 qui prend ! refuse un score négatif", () => {
    const game = gameById("sixquiprend")!;
    const r = tryBuildRound(game, match("sixquiprend"), { A: { score: "5", finisher: false }, B: { score: "-3", finisher: false }, C: { score: "1", finisher: false } });
    expect(r).toHaveProperty("error");
  });
  it("Skyjo : exactement une personne a terminé", () => {
    const game = gameById("skyjo")!;
    const e = (fa: boolean, fb: boolean) => ({ A: { score: "20", finisher: fa }, B: { score: "15", finisher: fb }, C: { score: "30", finisher: false } });
    expect(tryBuildRound(game, match("skyjo"), e(false, false))).toHaveProperty("error");
    expect(tryBuildRound(game, match("skyjo"), e(true, true))).toHaveProperty("error");
    const ok = tryBuildRound(game, match("skyjo"), e(true, false)) as { raw: string };
    expect(JSON.parse(ok.raw)).toEqual({ scores: { A: 20, B: 15, C: 30 }, finisherId: "A" });
  });
  it("Tarot : pas de saisie par les joueurs", () => {
    expect(tryBuildRound(gameById("tarot")!, match("tarot"), {})).toHaveProperty("error");
  });
});

describe("places prises", () => {
  it("un joueur est pris par un autre appareil connecté, jamais par soi-même ni par un simple spectateur", () => {
    const claims = [{ uid: "me", p: "A" }, { uid: "u2", p: "B" }, { uid: "u3", p: "" }, { uid: "u4", p: "B" }, { uid: "u5", p: "C", r: 1, s: "4" }];
    expect(takenPlayers(claims, "me")).toEqual(["B", "C"]);
    expect(takenPlayers([], "me")).toEqual([]);
  });
});
