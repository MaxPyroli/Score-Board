import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Dialog } from "./components";
import { CODE_LENGTH, joinUrl, normalizeCode, type HostStatus, type JoinState } from "../session";
import { sharingConfigured } from "../backend";

export function ShareDialog({ host, onStart, onStop, onClose }: {
  host: { status: HostStatus; code: string; viewers: number } | null;
  onStart(): void;
  onStop(): void;
  onClose(): void;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const code = host?.code;
  useEffect(() => {
    if (!code) { setQr(null); return; }
    QRCode.toDataURL(joinUrl(code), { margin: 1, width: 220 }).then(setQr, () => setQr(null));
  }, [code]);

  return (
    <Dialog title="Partager la partie" onClose={onClose}>
      {!sharingConfigured ? (
        <>
          <p className="error">Le partage en direct n'est pas encore activé sur ce site.</p>
          <div className="buttons"><button className="btn outline" onClick={onClose}>Fermer</button></div>
        </>
      ) : !host ? (
        <>
          <p>Les autres joueurs suivront les scores en direct sur leur téléphone, en lecture seule. Il faut une connexion internet pour se rejoindre.</p>
          <div className="buttons">
            <button className="btn outline" onClick={onClose}>Fermer</button>
            <button className="btn" onClick={onStart}>Partager</button>
          </div>
        </>
      ) : host.status === "error" ? (
        <>
          <p className="error">Impossible de joindre le service de partage. Vérifie ta connexion internet.</p>
          <div className="buttons">
            <button className="btn outline" onClick={onClose}>Fermer</button>
            <button className="btn" onClick={onStart}>Réessayer</button>
          </div>
        </>
      ) : (
        <>
          <p className="hint">Sur l'autre téléphone : « Rejoindre » puis ce code, ou scanner le QR code avec l'appareil photo.</p>
          <div className="code">{host.code}</div>
          {qr && <img className="qr" src={qr} alt={`QR code de la partie ${host.code}`} width={220} height={220} />}
          <p className="hint center">
            {host.status === "starting" ? "Connexion…" : `${host.viewers} appareil${host.viewers > 1 ? "s" : ""} connecté${host.viewers > 1 ? "s" : ""}`}
          </p>
          <div className="buttons">
            <button className="btn outline" onClick={onClose}>Fermer</button>
            <button className="btn danger" onClick={onStop}>Arrêter le partage</button>
          </div>
        </>
      )}
    </Dialog>
  );
}

const FAIL_TEXT = {
  unknown: "Code inconnu : vérifie le code, et que l'hôte garde son partage actif.",
  unreachable: "Impossible de joindre le service de partage. Vérifie ta connexion internet.",
  invalid: "Les données reçues sont illisibles (versions de l'appli différentes ?). Recharge la page.",
} as const;

export function JoinScreen({ state, onJoin, onBack, initialCode }: {
  state: JoinState;
  onJoin(code: string): void;
  onBack(): void;
  initialCode?: string;
}) {
  const [text, setText] = useState(initialCode ?? "");
  const code = normalizeCode(text);
  const busy = state.kind === "connecting";
  return (
    <div className="screen">
      <header className="topbar">
        <button className="icon" aria-label="Retour" onClick={onBack}>←</button>
        <h1>Rejoindre une partie</h1>
      </header>
      <main className="content">
        <p className="hint">Saisis le code à {CODE_LENGTH} caractères affiché sur le téléphone de l'hôte.</p>
        <input
          className="field wide code-input" autoFocus autoCapitalize="characters" autoComplete="off" spellCheck={false}
          maxLength={CODE_LENGTH + 1} placeholder="K7F2" aria-label="Code de la partie"
          value={text} onChange={(e) => setText(e.target.value.toUpperCase())}
        />
        {state.kind === "failed" && <p className="error">{FAIL_TEXT[state.reason]}</p>}
        {!sharingConfigured && <p className="error">Le partage en direct n'est pas encore activé sur ce site.</p>}
        <button className="btn full" disabled={!code || busy || !sharingConfigured} onClick={() => code && onJoin(code)}>
          {busy ? "Connexion…" : "Rejoindre"}
        </button>
      </main>
    </div>
  );
}
