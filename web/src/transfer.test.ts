import { describe, expect, it } from "vitest";
import { collect, decodeTransfer, encodeTransfer, mergeIncoming, TRANSFER_PREFIX } from "./transfer";

describe("migration vers la nouvelle adresse", () => {
  it("collecte les clés de la bêta (préfixe retiré), sans l'état de navigation", () => {
    const raw = { "beta:scoreboard.matches.v1": "[]", "beta:scoreboard.resume": "{}", "scoreboard.matches.v1": "[1]", "beta:scoreboard.lastNames": '["A"]' };
    expect(collect(raw, "beta:")).toEqual({ "scoreboard.matches.v1": "[]", "scoreboard.lastNames": '["A"]' });
  });
  it("sans préfixe (version publique), ignore les clés de la bêta", () => {
    expect(collect({ "scoreboard.matches.v1": "[1]", "beta:scoreboard.matches.v1": "[2]" }, "")).toEqual({ "scoreboard.matches.v1": "[1]" });
  });
  it("aller-retour avec accents et emojis", () => {
    const data = { "scoreboard.lastNames": JSON.stringify(["Léo", "Zoé 🦄"]) };
    expect(decodeTransfer(TRANSFER_PREFIX + encodeTransfer(data))).toEqual(data);
    expect(decodeTransfer("#join=ABCD")).toBeNull();
    expect(decodeTransfer(TRANSFER_PREFIX + "%%%")).toBeNull();
  });
  it("fusion : les parties s'ajoutent sans doublon, le reste n'écrase rien", () => {
    const existing = { "scoreboard.matches.v1": JSON.stringify([{ id: "a" }]), "scoreboard.lastNames": '["X"]' };
    const incoming = { "scoreboard.matches.v1": JSON.stringify([{ id: "a" }, { id: "b" }]), "scoreboard.lastNames": '["Y"]', "scoreboard.recentGroups": "[]" };
    const out = mergeIncoming(existing, incoming);
    expect(JSON.parse(out["scoreboard.matches.v1"]).map((m: { id: string }) => m.id)).toEqual(["a", "b"]);
    expect(out["scoreboard.lastNames"]).toBeUndefined();
    expect(out["scoreboard.recentGroups"]).toBe("[]");
  });
});
