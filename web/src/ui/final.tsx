import { useMemo, useState } from "react";
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

const CONFETTI_COLORS = ["#ff5a5f", "#ffb400", "#2ec4b6", "#4d8cff", "#b46bff", "#7bd957", "#ff8fb1"];
const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Confettis qui tombent (victoire). */
function Confetti() {
  const pieces = useMemo(
    () => Array.from({ length: 70 }, (_, i) => ({
      left: (i * 37 + Math.random() * 40) % 100, delay: Math.random() * 2.2, duration: 3.2 + Math.random() * 2.4,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length], w: 6 + Math.random() * 6, h: 9 + Math.random() * 8, dx: (Math.random() - 0.5) * 160, round: i % 4 === 0,
    })),
    [],
  );
  if (reducedMotion()) return null;
  return (
    <div className="fx confetti" aria-hidden="true">
      {pieces.map((c, i) => (
        <span key={i} style={{ left: `${c.left}%`, background: c.color, width: c.w, height: c.h, borderRadius: c.round ? "50%" : "2px", animationDelay: `${c.delay}s`, animationDuration: `${c.duration}s`, ["--dx" as string]: `${c.dx}px` }} />
      ))}
    </div>
  );
}

/** Pluie (défaite). */
function Rain() {
  const drops = useMemo(
    () => Array.from({ length: 90 }, (_, i) => ({ left: (i * 23 + Math.random() * 30) % 100, delay: Math.random() * 1.6, duration: 0.7 + Math.random() * 0.6, h: 18 + Math.random() * 22 })),
    [],
  );
  if (reducedMotion()) return null;
  return (
    <div className="fx rain" aria-hidden="true">
      {drops.map((d, i) => (
        <span key={i} style={{ left: `${d.left}%`, height: d.h, animationDelay: `${d.delay}s`, animationDuration: `${d.duration}s` }} />
      ))}
    </div>
  );
}

/** « Partie terminée » : suspense avant les résultats ; l'hôte appuie sur « Afficher les résultats ». */
export function EndedScreen({ onReveal, onResume }: { onReveal?: () => void; onResume?: () => void }) {
  return (
    <div className="final ended" role="dialog" aria-label="Partie terminée">
      <div className="final-inner center-all">
        <div className="drum" aria-hidden="true">🥁</div>
        <div className="stamp-end big" aria-hidden="true">Partie terminée</div>
        <p className="detail">{onReveal ? "Les scores sont prêts. Prépare le suspense…" : "L'hôte va dévoiler les résultats…"}</p>
        {onReveal ? (
          <button className="btn big-btn" onClick={onReveal}>Afficher les résultats</button>
        ) : (
          <div className="waiting" aria-hidden="true"><span /><span /><span /></div>
        )}
        {onResume && <button className="link" onClick={onResume}>Ce n'est pas fini : reprendre la partie</button>}
      </div>
    </div>
  );
}

/** Résultats : classement, résultat personnel (si on a choisi son joueur) ; confettis pour une victoire, pluie pour une défaite. */
export function FinalScreen({ ranked, meId, onClose, onHome, onResume, onReplay, onChangeMe }: {
  ranked: RankedPlayer[];
  meId: string | null;
  onClose(): void;
  /** Quitter la partie terminée (retour à l'accueil). */
  onHome(): void;
  onResume?: () => void;
  /** Nouvelle partie avec les mêmes joueurs et réglages (hôte). */
  onReplay?: () => void;
  /** Choisir son joueur (partage en direct seulement). */
  onChangeMe?: () => void;
}) {
  const { headline, detail } = finalMessage(ranked, meId);
  const mine = ranked.find((r) => r.player.id === meId);
  const won = mine ? mine.rank === 1 : true;
  return (
    <div className="final" role="dialog" aria-label="Résultats de la partie">
      {won ? <Confetti /> : <Rain />}
      <div className="final-inner">
        <div className="trophy" aria-hidden="true">{won ? "🏆" : "🌧️"}</div>
        <div className="stamp-end" aria-hidden="true">Partie terminée</div>
        <h2 className={`headline ${won ? "" : "lost"}`}>{headline}</h2>
        {detail && <p className="detail">{detail}</p>}
        {ranked.map((r) => (
          <div key={r.player.id} className={`rank-row ${r.player.id === meId ? "me" : ""}`}>
            <span className="pos">{ordinal(r.rank)}</span>
            <span className="who">
              <span className="who-name">{r.player.name}{r.player.id === meId ? " (toi)" : ""}</span>
              {r.rank === 1 && <span className="stamp-win">Vainqueur</span>}
            </span>
            <strong className="token">{plain(r.total)}</strong>
          </div>
        ))}
        <div className="final-actions">
          {onReplay && <button className="btn big-btn" onClick={onReplay}>Rejouer avec les mêmes joueurs</button>}
          <div className="buttons final-row">
            <button className="btn outline" onClick={onClose}>Voir le détail</button>
            <button className="btn outline" onClick={onHome}>Quitter</button>
          </div>
          {(onChangeMe || onResume) && (
            <div className="final-links">
              {onChangeMe && <button className="link" onClick={onChangeMe}>{meId ? "Ce n'est pas moi" : "Qui suis-je ?"}</button>}
              {onResume && <button className="link" onClick={onResume}>Pas fini ? Reprendre la partie</button>}
            </div>
          )}
        </div>
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
