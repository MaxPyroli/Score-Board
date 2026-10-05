import { describe, expect, it } from "vitest";
import { codeFromHash, generateCode, joinUrl, normalizeCode, validateReceived } from "./session";
import { tarotModule } from "./games/tarot";
import { matchWithRound, type StoredMatch } from "./core";

const base: StoredMatch = {
  id: "m1", moduleId: "tarot", createdAt: 1, settings: {}, rounds: [],
  players: ["A", "B", "C", "D"].map((id) => ({ id, name: `Joueur ${id}` })),
};
const round = tarotModule.encodeRound({
  joueurs: ["A", "B", "C", "D"], preneurId: "A", appeleId: null, contract: "PETITE", bouts: 1, pointsRealises: 56,
  poignee: null, poigneeCamp: null, petitAuBoutCamp: null, chelem: null,
});
const msg = (match: unknown) => ({ v: 1, type: "snapshot", match });

describe("code de session", () => {
  it("génère 4 caractères valides", () => {
    for (let i = 0; i < 50; i++) expect(normalizeCode(generateCode())).not.toBeNull();
  });
  it("normalise la saisie et refuse les codes invalides", () => {
    expect(normalizeCode(" k7-f2 ")).toBe("K7F2");
    expect(normalizeCode("K7F")).toBeNull();
    expect(normalizeCode("K7F0")).toBeNull(); // 0 et O exclus
    expect(normalizeCode("K7F22")).toBeNull();
  });
  it("lien du QR code aller-retour", () => {
    const url = joinUrl("K7F2", "https://exemple.fr/app/");
    expect(url).toBe("https://exemple.fr/app/#join=K7F2");
    expect(codeFromHash("#join=k7f2")).toBe("K7F2");
    expect(codeFromHash("#join=zzz")).toBeNull();
    expect(codeFromHash("")).toBeNull();
  });
});

describe("validation des données reçues", () => {
  it("accepte une partie correcte, avec manches", () => {
    const m = matchWithRound(base, round);
    expect(validateReceived(msg(m))).toEqual(m);
  });
  it("refuse tout ce qui est incomplet ou incohérent", () => {
    expect(validateReceived(null)).toBeNull();
    expect(validateReceived({ v: 2, type: "snapshot", match: base })).toBeNull();
    expect(validateReceived(msg({ ...base, moduleId: "inconnu" }))).toBeNull();
    expect(validateReceived(msg({ ...base, players: base.players.slice(0, 2) }))).toBeNull(); // Tarot : 3 minimum
    expect(validateReceived(msg({ ...base, players: [base.players[0], base.players[0], base.players[1]] }))).toBeNull();
    expect(validateReceived(msg({ ...base, rounds: ["pas du json"] }))).toBeNull();
    expect(validateReceived(msg({ ...base, rounds: [123] }))).toBeNull();
    expect(validateReceived(msg({ ...base, rounds: Array(1001).fill(round) }))).toBeNull();
    expect(validateReceived(msg({ ...base, players: [{ id: "A", name: "x".repeat(100) }, base.players[1], base.players[2]] }))).toBeNull();
  });
});
