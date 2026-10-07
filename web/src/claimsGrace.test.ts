import { describe, expect, it } from "vitest";
import { ClaimsGrace } from "./claimsGrace";
import { codeFromScanned, pickMainCamera } from "./ui/QrScanner";

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

describe("objectif de l'appareil photo", () => {
  const dev = (label: string) => ({ deviceId: label, label, kind: "videoinput" }) as MediaDeviceInfo;
  it("prend l'objectif principal arrière, pas le grand-angle ni la caméra avant", () => {
    expect(pickMainCamera([dev("Back Ultra Wide Camera"), dev("Front Camera"), dev("Back Triple Camera")])?.label).toBe("Back Triple Camera");
    expect(pickMainCamera([dev("camera2 1, facing front"), dev("camera2 0, facing back"), dev("camera2 2, facing back")])?.label).toBe("camera2 0, facing back");
  });
  it("écarte macro et profondeur ; sans indice, prend ce qu'il y a", () => {
    expect(pickMainCamera([dev("camera2 2, facing back macro"), dev("camera2 0, facing back")])?.label).toBe("camera2 0, facing back");
    expect(pickMainCamera([dev("camera")])?.label).toBe("camera");
    expect(pickMainCamera([])).toBeUndefined();
  });
});
