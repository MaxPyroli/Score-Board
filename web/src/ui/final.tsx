import { useState } from "react";
import { Dialog } from "./components";
import { MAX_NAME_LENGTH, finalMessage, ordinal, plain, type RankedPlayer, type StoredMatch } from "../core";

/** « Qui es-tu ? » : choisir son joueur dans la partie (ou regarder seulement). */
export function WhoAreYou({ match, current, taken = [], recent = [], onPick, onClose }: {
  match: StoredMatch;
  current: string | null | undefined;
  /** Joueurs déjà pris par un autre appareil connecté (la place se libère à sa déconnexion). */
  taken?: string[];
  /** Joueurs dont l'appareil s'est déconnecté depuis peu : place encore réservée. */
  recent?: string[];
  onPick(id: string | null): void;
  onClose?: () => void;
}) {
  return (
    <Dialog title="Qui es-tu ?" onClose={onClose ?? (() => onPick(null))}>
      <p className="hint">Choisis ton nom : à la fin de la partie, tu verras si tu as gagné.{(taken.length > 0 || recent.length > 0) && " La place d'un joueur déconnecté reste réservée quelques minutes, puis se libère."}</p>
      <div className="pick">
        {match.players.map((p) => {
          const busy = taken.includes(p.id) && current !== p.id;
          const held = !busy && recent.includes(p.id) && current !== p.id;
          return busy || held ? (
            <div key={p.id} className="pick-taken">
              <button className="btn outline" disabled>{p.name} · {busy ? "déjà pris" : "déconnecté depuis peu"}</button>
              <button className="link" onClick={() => onPick(p.id)}>{busy ? "Reprendre quand même" : "Reprendre sa place"}</button>
            </div>
          ) : (
            <button key={p.id} className={`btn ${current === p.id ? "" : "outline"}`} onClick={() => onPick(p.id)}>{p.name}</button>
          );
        })}
        <button className="link" onClick={() => onPick(null)}>Je regarde seulement</button>
      </div>
    </Dialog>
  );
}

/** Écran de fin de partie : résultat personnel (si on a choisi son joueur) et classement. */
export function FinalScreen({ ranked, meId, onClose, onResume, onChangeMe }: {
  ranked: RankedPlayer[];
  meId: string | null;
  onClose(): void;
  onResume?: () => void;
  onChangeMe?: () => void;
}) {
  const { headline, detail } = finalMessage(ranked, meId);
  const mine = ranked.find((r) => r.player.id === meId);
  const won = mine ? mine.rank === 1 : true;
  return (
    <div className="final" role="dialog" aria-label="Fin de la partie">
      <div className="final-inner">
        <div className="trophy" aria-hidden="true">{won ? "🏆" : "🎲"}</div>
        <div className="stamp-end" aria-hidden="true">Partie terminée</div>
        <h2 className={`headline ${won ? "" : "lost"}`}>{headline}</h2>
        {detail && <p className="detail">{detail}</p>}
        {ranked.map((r) => (
          <div key={r.player.id} className={`rank-row ${r.player.id === meId ? "me" : ""}`}>
            <span className="pos">{ordinal(r.rank)}</span>
            <span className="who">{r.player.name}{r.player.id === meId ? " (toi)" : ""}{r.rank === 1 && <span className="stamp-win">Vainqueur</span>}</span>
            <strong className="token">{plain(r.total)}</strong>
          </div>
        ))}
        <button className="btn" onClick={onClose}>Voir la partie</button>
        {onChangeMe && <button className="btn outline" onClick={onChangeMe}>{meId ? "Ce n'est pas moi" : "Qui suis-je ?"}</button>}
        {onResume && <button className="btn outline" onClick={onResume}>Reprendre la partie</button>}
      </div>
    </div>
  );
}

/** Changer son nom de joueur, à tout moment. */
export function RenameDialog({ current, validate, onSubmit, onClose }: {
  current: string;
  validate(raw: string): string | null;
  onSubmit(raw: string): void;
  onClose(): void;
}) {
  const [text, setText] = useState(current);
  const ok = validate(text) !== null;
  return (
    <Dialog title="Changer mon nom" onClose={onClose}>
      <input
        className="field wide" autoFocus value={text} maxLength={MAX_NAME_LENGTH} aria-label="Mon nom"
        onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && ok) onSubmit(text); }}
      />
      {!ok && text.trim() !== "" && <p className="error">Ce nom est déjà pris par un autre joueur.</p>}
      <div className="buttons">
        <button className="btn outline" onClick={onClose}>Annuler</button>
        <button className="btn" disabled={!ok} onClick={() => onSubmit(text)}>Valider</button>
      </div>
    </Dialog>
  );
}
