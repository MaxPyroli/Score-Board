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
    const w = Math.min(video.videoWidth, 1000), h = Math.round((video.videoHeight / video.videoWidth) * w) || 360;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    return jsQR(ctx.getImageData(0, 0, w, h).data, w, h)?.data ?? null;
  };
}

type ZoomRange = { min: number; max: number; step: number; value: number };
type FocusCaps = MediaTrackCapabilities & { focusMode?: string[]; zoom?: { min: number; max: number; step: number } };
const asAdvanced = (c: Record<string, unknown>) => ({ advanced: [c] }) as MediaTrackConstraints;

/** Appareils photo « arrière » classiques ; on évite le grand-angle, qui n'a souvent pas de mise au point (image floue). */
const isBack = (d: MediaDeviceInfo) => /back|rear|arri|environment|facing back/i.test(d.label);
const isWide = (d: MediaDeviceInfo) => /ultra|wide|large|0[.,]5/i.test(d.label);

export function QrScanner({ onCode, onClose }: { onCode(code: string): void; onClose(): void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [zoom, setZoom] = useState<ZoomRange | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraIndex, setCameraIndex] = useState<number | null>(null); // null : choix automatique au démarrage
  const [focusAt, setFocusAt] = useState<{ x: number; y: number; k: number } | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const caps = useRef<FocusCaps>({});

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer = 0;
    const canvas = document.createElement("canvas");

    const open = async (deviceId?: string): Promise<MediaStream> =>
      navigator.mediaDevices.getUserMedia({
        video: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: "environment" } }),
          width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 },
        },
        audio: false,
      });

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setProblem("Ce navigateur ne permet pas d'utiliser l'appareil photo ici.");
      try {
        stream = await open(cameraIndex !== null ? cameras[cameraIndex]?.deviceId : undefined);
      } catch {
        return setProblem("Impossible d'utiliser l'appareil photo : vérifie que tu l'as autorisé pour ce site.");
      }
      if (stopped) return stream.getTracks().forEach((t) => t.stop());

      // Premier démarrage : les noms des objectifs sont maintenant connus. Si on est tombé sur le grand-angle, on prend l'objectif principal.
      if (cameraIndex === null) {
        try {
          const list = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
          const backs = list.filter(isBack);
          const ordered = backs.length > 0 ? [...backs.filter((d) => !isWide(d)), ...backs.filter(isWide)] : list;
          if (!stopped) setCameras(ordered);
          const currentId = stream.getVideoTracks()[0]?.getSettings().deviceId;
          const current = list.find((d) => d.deviceId === currentId);
          if (current && isWide(current) && ordered.length > 1 && ordered[0].deviceId !== currentId) {
            stream.getTracks().forEach((t) => t.stop());
            stream = await open(ordered[0].deviceId);
            if (!stopped) setCameraIndex(0);
          }
        } catch { /* liste indisponible : on garde l'objectif obtenu */ }
        if (stopped) return stream?.getTracks().forEach((t) => t.stop());
      }

      const track = stream!.getVideoTracks()[0];
      trackRef.current = track;
      const c = (track.getCapabilities?.() ?? {}) as FocusCaps;
      caps.current = c;
      // Mise au point automatique en continu, et zoom réglable si l'appareil le permet.
      if (c.focusMode?.includes("continuous")) await track.applyConstraints(asAdvanced({ focusMode: "continuous" })).catch(() => {});
      if (c.zoom) setZoom({ min: c.zoom.min, max: Math.min(c.zoom.max, 8), step: c.zoom.step || 0.1, value: (track.getSettings() as { zoom?: number }).zoom ?? c.zoom.min });

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
        timer = window.setTimeout(tick, 120);
      };
      void tick();
    })();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      trackRef.current = null;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [cameraIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeZoom = (value: number) => {
    setZoom((z) => (z ? { ...z, value } : z));
    void trackRef.current?.applyConstraints(asAdvanced({ zoom: value })).catch(() => {});
  };

  /** Toucher l'image : relance la mise au point (puis remet l'automatique). */
  const refocus = (e: React.PointerEvent<HTMLVideoElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setFocusAt({ x: e.clientX - r.left, y: e.clientY - r.top, k: Date.now() });
    const track = trackRef.current;
    const modes = caps.current.focusMode ?? [];
    if (!track || !modes.includes("single-shot")) return;
    void track.applyConstraints(asAdvanced({ focusMode: "single-shot" })).catch(() => {});
    if (modes.includes("continuous")) window.setTimeout(() => { void track.applyConstraints(asAdvanced({ focusMode: "continuous" })).catch(() => {}); }, 1500);
  };

  const nextCamera = () => setCameraIndex((i) => (cameras.length ? ((i ?? 0) + 1) % cameras.length : i));

  return (
    <div className="scanner" role="dialog" aria-modal="true" aria-label="Scanner le QR code">
      <video ref={video} className="scanner-video" playsInline muted onPointerDown={refocus} />
      <div className="scanner-frame" aria-hidden="true" />
      {focusAt && <span key={focusAt.k} className="focus-ring" style={{ left: focusAt.x, top: focusAt.y }} aria-hidden="true" />}
      <div className="scanner-bar">
        <p>{problem ?? hint ?? "Vise le QR code affiché sur le téléphone de l'hôte. Touche l'image pour refaire la mise au point."}</p>
        {zoom && zoom.max > zoom.min && (
          <label className="scanner-zoom">
            <span>Zoom</span>
            <input type="range" min={zoom.min} max={zoom.max} step={zoom.step} value={zoom.value} onChange={(e) => changeZoom(Number(e.target.value))} aria-label="Zoom" />
          </label>
        )}
        <div className="buttons">
          {cameras.length > 1 && <button className="btn outline" onClick={nextCamera}>Changer d'objectif</button>}
          <button className="btn" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}
