import { describe, expect, it } from "vitest";
import { ClaimsGrace } from "./claimsGrace";
import { buildLenses, codeFromScanned } from "./ui/QrScanner";

describe("lissage des signatures (anti-clignotement)", () => {
  it("une signature disparue reste affichée pendant le délai, puis s'efface", () => {
    let now = 0;
    const g = new ClaimsGrace(6000, () => now);
    const a = { uid: "a", p: "A" };
    expect(g.update([a])).toEqual([a]);
    now = 2000;
    expect(g.update([])).toEqual([a]); // coupure brève : on garde
    expect(g.nextExpiryIn(new Set())).toBe(4000);
    now = 6500;
    expect(g.update([])).toEqual([]);
  });
  it("une signature qui revient (ou change) remplace l'ancienne et repart de zéro", () => {
    let now = 0;
    const g = new ClaimsGrace(6000, () => now);
    g.update([{ uid: "a", p: "A" }]);
    now = 5000;
    expect(g.update([{ uid: "a", p: "B" }])).toEqual([{ uid: "a", p: "B" }]);
    now = 9000;
    expect(g.update([])).toEqual([{ uid: "a", p: "B" }]);
  });
});

describe("QR code lu", () => {
  it("accepte le lien de la partie ou le code seul, refuse le reste", () => {
    expect(codeFromScanned("https://exemple.fr/Score-Board/beta/#join=K7F2")).toBe("K7F2");
    expect(codeFromScanned("k7f2")).toBe("K7F2");
    expect(codeFromScanned("https://exemple.fr/")).toBeNull();
    expect(codeFromScanned("bonjour")).toBeNull();
  });
});

describe("objectifs de l'appareil photo", () => {
  const dev = (label: string) => ({ deviceId: label, label, kind: "videoinput" }) as MediaDeviceInfo;
  it("repère grand-angle, principal et télé d'après leurs noms, du plus large au plus long", () => {
    const l = buildLenses([dev("Back Triple Camera"), dev("Back Ultra Wide Camera"), dev("Back Telephoto Camera"), dev("Front Camera")]);
    expect(l.map((x) => [x.device.label, x.nominal])).toEqual([["Back Ultra Wide Camera", 0.5], ["Back Triple Camera", 1], ["Back Telephoto Camera", 2]]);
    expect(l.some((x) => x.hint)).toBe(true);
  });
  it("écarte les objectifs inutiles (macro, profondeur) et la caméra avant", () => {
    const l = buildLenses([dev("camera2 0, facing back"), dev("camera2 1, facing front"), dev("camera2 2, facing back macro"), dev("camera2 3, facing back")]);
    expect(l.map((x) => x.device.label)).toEqual(["camera2 0, facing back", "camera2 3, facing back"]);
    expect(l.some((x) => x.hint)).toBe(false); // aucun indice : les grossissements ne seront pas affichés
  });
});
