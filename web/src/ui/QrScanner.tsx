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

type NativeZoom = { min: number; max: number; step: number };
type FocusCaps = MediaTrackCapabilities & { focusMode?: string[]; zoom?: NativeZoom };
const asAdvanced = (c: Record<string, unknown>) => ({ advanced: [c] }) as MediaTrackConstraints;

/** Un objectif de l'appareil. `nominal` : grossissement estimé par rapport à l'objectif principal (0,5× grand-angle, 1× principal, 2× et plus : télé). */
export interface Lens { device: MediaDeviceInfo; nominal: number; zoom?: NativeZoom; /** le nom de l'objectif dit s'il est grand-angle ou télé */ hint: boolean }

const isBack = (d: MediaDeviceInfo) => /back|rear|arri|environment/i.test(d.label);
const isWide = (d: MediaDeviceInfo) => /ultra|wide|large|0[.,]5/i.test(d.label);
const isTele = (d: MediaDeviceInfo) => /tele|télé|zoom|periscop|périscop/i.test(d.label);
const isUseless = (d: MediaDeviceInfo) => /macro|depth|profondeur|tof|mono|infrared|ir\b/i.test(d.label);
const nativeZoomOf = (d: MediaDeviceInfo): NativeZoom | undefined => {
  try { return ((d as unknown as { getCapabilities?: () => FocusCaps }).getCapabilities?.() ?? {}).zoom; } catch { return undefined; }
};

/**
 * Objectifs arrière utiles, du plus large au plus long. Le navigateur n'annonce pas leur focale : on la devine d'après leur nom
 * (grand-angle = 0,5×, principal = 1×) puis leur ordre (les suivants sont des télé : 2×, 5×, 10×). Si aucun nom ne donne d'indice,
 * ces grossissements ne sont que des suppositions : l'interface ne les affiche pas (voir `hinted`).
 */
export function buildLenses(devices: MediaDeviceInfo[]): Lens[] {
  const backs = devices.filter(isBack);
  const usable = (backs.length > 0 ? backs : devices).filter((d) => !isUseless(d));
  const wides = usable.filter(isWide);
  const rest = usable.filter((d) => !isWide(d));
  const mains = rest.filter((d) => !isTele(d));
  const main = mains[0] ?? rest[0];
  const teles = rest.filter((d) => d !== main);
  const teleNominals = [2, 5, 10];
  return [
    ...wides.slice(0, 1).map((d) => ({ device: d, nominal: 0.5, zoom: nativeZoomOf(d), hint: true })),
    ...(main ? [{ device: main, nominal: 1, zoom: nativeZoomOf(main), hint: false }] : []),
    ...teles.slice(0, 3).map((d, i) => ({ device: d, nominal: teleNominals[i], zoom: nativeZoomOf(d), hint: isTele(d) })),
  ];
}

const fmt = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function QrScanner({ onCode, onClose }: { onCode(code: string): void; onClose(): void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [lenses, setLenses] = useState<Lens[]>([]);
  const [lensIndex, setLensIndex] = useState<number | null>(null); // null : choix automatique au démarrage
  const [z, setZ] = useState(1); // grossissement affiché, tous objectifs confondus
  const zRef = useRef(1);
  const [soloZoom, setSoloZoom] = useState<(NativeZoom & { value: number }) | null>(null); // zoom de l'appareil quand on ne connaît qu'un objectif
  const [label, setLabel] = useState("");
  const [focusAt, setFocusAt] = useState<{ x: number; y: number; k: number } | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const caps = useRef<FocusCaps>({});

  /** Zoom propre à l'objectif en cours pour atteindre le grossissement `target`. */
  const applyZoom = (track: MediaStreamTrack, lens: Lens, target: number) => {
    const c = (track.getCapabilities?.() ?? {}) as FocusCaps;
    if (!c.zoom) return;
    const value = clamp(c.zoom.min * (target / lens.nominal), c.zoom.min, c.zoom.max);
    void track.applyConstraints(asAdvanced({ zoom: value })).catch(() => {});
  };

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer = 0;
    const canvas = document.createElement("canvas");

    const open = (deviceId?: string): Promise<MediaStream> =>
      navigator.mediaDevices.getUserMedia({
        video: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: "environment" } }),
          width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 },
        },
        audio: false,
      });

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setProblem("Ce navigateur ne permet pas d'utiliser l'appareil photo ici.");
      const lens = lensIndex !== null ? lenses[lensIndex] : undefined;
      const hinted = lenses.length > 1 && lenses.some((l) => l.hint);
      try {
        stream = await open(lens?.device.deviceId);
      } catch {
        return setProblem("Impossible d'utiliser l'appareil photo : vérifie que tu l'as autorisé pour ce site.");
      }
      if (stopped) return stream.getTracks().forEach((t) => t.stop());

      // Premier démarrage : les noms des objectifs sont maintenant connus ; on repart sur l'objectif principal (pas le grand-angle, souvent flou).
      if (lensIndex === null) {
        try {
          const list = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
          const built = buildLenses(list);
          const mainIdx = built.findIndex((l) => l.nominal === 1);
          if (built.length > 0 && mainIdx >= 0 && !stopped) {
            stream.getTracks().forEach((t) => t.stop());
            setLenses(built);
            setLensIndex(mainIdx);
            return; // le changement d'état relance ce démarrage avec le bon objectif
          }
        } catch { /* liste indisponible : on garde l'objectif obtenu */ }
        if (stopped) return stream?.getTracks().forEach((t) => t.stop());
      }

      const track = stream.getVideoTracks()[0];
      trackRef.current = track;
      const c = (track.getCapabilities?.() ?? {}) as FocusCaps;
      caps.current = c;
      setLabel(track.label);
      // Mise au point automatique en continu.
      if (c.focusMode?.includes("continuous")) await track.applyConstraints(asAdvanced({ focusMode: "continuous" })).catch(() => {});
      if (lens && hinted) {
        applyZoom(track, lens, zRef.current);
        // On retient la plage de zoom réelle de cet objectif (pour la glissière).
        if (c.zoom && !lens.zoom) setLenses((ls) => ls.map((l) => (l === lens ? { ...l, zoom: c.zoom } : l)));
      } else if (c.zoom) {
        setSoloZoom({ min: c.zoom.min, max: Math.min(c.zoom.max, 8), step: c.zoom.step || 0.1, value: (track.getSettings() as { zoom?: number }).zoom ?? c.zoom.min });
      }

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
  }, [lensIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Glissière de zoom : change d'objectif toute seule quand on passe la limite de l'objectif en cours. */
  const changeZoom = (value: number) => {
    setZ(value); zRef.current = value;
    let target = 0;
    lenses.forEach((l, i) => { if (l.nominal <= value + 0.001) target = i; });
    if (target !== lensIndex) return setLensIndex(target);
    const lens = lenses[target], track = trackRef.current;
    if (lens && track) applyZoom(track, lens, value);
  };
  const jumpTo = (i: number) => changeZoom(lenses[i].nominal);

  const changeSoloZoom = (value: number) => {
    setSoloZoom((s) => (s ? { ...s, value } : s));
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

  // Les grossissements (0,5× / 1× / 2×…) ne sont affichés que si les noms des objectifs permettent de les deviner.
  const hinted = lenses.length > 1 && lenses.some((l) => l.hint);
  const last = lenses[lenses.length - 1];
  const zMax = last ? last.nominal * (last.zoom ? clamp(last.zoom.max / last.zoom.min, 1, 3) : 1) : 1;

  return (
    <div className="scanner" role="dialog" aria-modal="true" aria-label="Scanner le QR code">
      <video ref={video} className="scanner-video" playsInline muted onPointerDown={refocus} />
      <div className="scanner-frame" aria-hidden="true" />
      {focusAt && <span key={focusAt.k} className="focus-ring" style={{ left: focusAt.x, top: focusAt.y }} aria-hidden="true" />}
      <div className="scanner-bar">
        <p>{problem ?? hint ?? "Vise le QR code affiché sur le téléphone de l'hôte. Touche l'image pour refaire la mise au point."}</p>
        {lenses.length > 1 && (
          <div className="lens-chips" role="group" aria-label="Objectif">
            {lenses.map((l, i) => (
              <button key={l.device.deviceId} type="button" className={`chip ${i === lensIndex ? "on" : ""}`} aria-pressed={i === lensIndex} onClick={() => (hinted ? jumpTo(i) : setLensIndex(i))}>
                {hinted ? `${fmt(l.nominal)}×` : `Objectif ${i + 1}`}
              </button>
            ))}
          </div>
        )}
        {hinted ? (
          <>
            <label className="scanner-zoom">
              <span>{fmt(z)}×</span>
              <input type="range" min={lenses[0].nominal} max={zMax} step={0.1} value={clamp(z, lenses[0].nominal, zMax)} onChange={(e) => changeZoom(Number(e.target.value))} aria-label="Zoom" />
            </label>
          </>
        ) : soloZoom && soloZoom.max > soloZoom.min ? (
          <label className="scanner-zoom">
            <span>Zoom</span>
            <input type="range" min={soloZoom.min} max={soloZoom.max} step={soloZoom.step} value={soloZoom.value} onChange={(e) => changeSoloZoom(Number(e.target.value))} aria-label="Zoom" />
          </label>
        ) : null}
        {label && <small className="scanner-lens">Objectif : {label}</small>}
        <button className="btn full" onClick={onClose}>Fermer</button>
      </div>
    </div>
  );
}
