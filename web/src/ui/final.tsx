import { Dialog } from "./components";
import { finalMessage, ordinal, plain, type RankedPlayer, type StoredMatch } from "../core";

/** « Qui es-tu ? » : choisir son joueur dans la partie (ou regarder seulement). */
export function WhoAreYou({ match, current, onPick, onClose }: {
  match: StoredMatch;
  current: string | null | undefined;
  onPick(id: string | null): void;
  onClose?: () => void;
}) {
  return (
    <Dialog title="Qui es-tu ?" onClose={onClose ?? (() => onPick(null))}>
      <p className="hint">Choisis ton nom : à la fin de la partie, tu verras si tu as gagné.</p>
      <div className="pick">
        {match.players.map((p) => (
          <button key={p.id} className={`btn ${current === p.id ? "" : "outline"}`} onClick={() => onPick(p.id)}>{p.name}</button>
        ))}
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
        <h2 className={`headline ${won ? "" : "lost"}`}>{headline}</h2>
        {detail && <p className="detail">{detail}</p>}
        {ranked.map((r) => (
          <div key={r.player.id} className={`rank-row ${r.player.id === meId ? "me" : ""}`}>
            <span className="pos">{ordinal(r.rank)}</span>
            <span className="who">{r.player.name}{r.player.id === meId ? " (toi)" : ""}</span>
            <strong>{plain(r.total)}</strong>
          </div>
        ))}
        <button className="btn" onClick={onClose}>Voir la partie</button>
        {onChangeMe && <button className="btn outline" onClick={onChangeMe}>{meId ? "Ce n'est pas moi" : "Qui suis-je ?"}</button>}
        {onResume && <button className="btn outline" onClick={onResume}>Reprendre la partie</button>}
      </div>
    </div>
  );
}
