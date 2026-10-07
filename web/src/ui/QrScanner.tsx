import { useEffect, useRef, useState } from "react";
import { codeFromHash, normalizeCode } from "../session";

/** Le texte lu dans un QR code : le lien de la partie (…#join=CODE) ou directement le code à 4 caractères. */
export function codeFromScanned(text: string): string | null {
  const direct = normalizeCode(text.trim());
  if (direct) return direct;
  const i = text.indexOf("#");
  return i >= 0 ? codeFromHash(text.slice(i)) : null;
}

type Detect = (video: HTMLVideoElement, canvas: HTMLCanvasElement) => Promise<string | null>;

/** Lecteur de QR code : celui du navigateur s'il existe (rapide), sinon jsQR (chargé seulement à ce moment-là). */
async function makeDetector(): Promise<Detect> {
  const Native = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect(v: HTMLVideoElement): Promise<{ rawValue: string }[]> } }).BarcodeDetector;
  if (Native) {
    try {
      const d = new Native({ formats: ["qr_code"] });
      return async (video) => (await d.detect(video))[0]?.rawValue ?? null;
    } catch { /* format non géré : on passe à jsQR */ }
  }
  const jsQR = (await import("jsqr")).default;
  return async (video, canvas) => {
    const w = 480, h = Math.round((video.videoHeight / video.videoWidth) * w) || 360;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    return jsQR(ctx.getImageData(0, 0, w, h).data, w, h)?.data ?? null;
  };
}

export function QrScanner({ onCode, onClose }: { onCode(code: string): void; onClose(): void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer = 0;
    const canvas = document.createElement("canvas");
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setProblem("Ce navigateur ne permet pas d'utiliser l'appareil photo ici.");
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch {
        return setProblem("Impossible d'utiliser l'appareil photo : vérifie que tu l'as autorisé pour ce site.");
      }
      if (stopped) return stream.getTracks().forEach((t) => t.stop());
      const v = video.current;
      if (!v) return;
      v.srcObject = stream;
      await v.play().catch(() => {});
      const detect = await makeDetector().catch(() => null);
      if (!detect) return setProblem("Le lecteur de QR code n'a pas pu se charger. Saisis le code à la main.");
      const tick = async () => {
        if (stopped) return;
        if (v.readyState >= 2 && v.videoWidth > 0) {
          const text = await detect(v, canvas).catch(() => null);
          if (text && !stopped) {
            const code = codeFromScanned(text);
            if (code) { stopped = true; return onCode(code); }
            setHint("Ce QR code n'est pas celui d'une partie.");
          }
        }
        timer = window.setTimeout(tick, 150);
      };
      void tick();
    })();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="scanner" role="dialog" aria-modal="true" aria-label="Scanner le QR code">
      <video ref={video} className="scanner-video" playsInline muted />
      <div className="scanner-frame" aria-hidden="true" />
      <div className="scanner-bar">
        <p>{problem ?? hint ?? "Vise le QR code affiché sur le téléphone de l'hôte."}</p>
        <button className="btn full" onClick={onClose}>Fermer</button>
      </div>
    </div>
  );
}
