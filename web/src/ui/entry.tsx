import { useState } from "react";
import { parseScore, type StoredMatch } from "../core";
import type { GameDefinition } from "../games/registry";
import { tryBuildRound, type Entries, type Entry } from "../guestEntry";

/** Champ « mon score » avec bouton « − » : renvoie le texte signé (« -3 »). */
function ScoreField({ onSubmit, withFinisher, allowNegative, submitLabel, compact }: {
  onSubmit(entry: Entry): void;
  withFinisher: boolean;
  allowNegative: boolean;
  submitLabel: string;
  compact?: boolean;
}) {
  const [text, setText] = useState("");
  const [neg, setNeg] = useState(false);
  const [finisher, setFinisher] = useState(false);
  const signed = (neg ? "-" : "") + text.trim();
  const valid = text.trim() !== "" && parseScore(signed) !== null;
  return (
    <div className={`entry-field ${compact ? "compact" : ""}`}>
      {allowNegative && (
        <button type="button" className={`chip sign ${neg ? "on" : ""}`} aria-pressed={neg} aria-label="Score négatif" onClick={() => setNeg(!neg)}>−</button>
      )}
      <input
        className="field" inputMode="decimal" autoComplete="off" placeholder="0" aria-label="Score" value={text}
        onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && valid) onSubmit({ score: signed, finisher }); }}
      />
      {withFinisher && (
        <button type="button" className={`chip ${finisher ? "on" : ""}`} aria-pressed={finisher} onClick={() => setFinisher(!finisher)}>
          A terminé
        </button>
      )}
      <button type="button" className="btn small" disabled={!valid} onClick={() => onSubmit({ score: signed, finisher })}>{submitLabel}</button>
    </div>
  );
}

const waitingText = (match: StoredMatch, entries: Entries) => {
  const waiting = match.players.filter((p) => !entries[p.id]).map((p) => p.name);
  return waiting.length === 0 ? null : `On attend : ${waiting.join(", ")}.`;
};

/** Côté invité : « ma saisie » pour la manche en cours. */
export function GuestEntryCard({ match, game, meId, entries, mine, onSubmit, onWithdraw }: {
  match: StoredMatch;
  game: GameDefinition;
  meId: string;
  entries: Entries;
  mine: Entry | null;
  onSubmit(entry: Entry): void;
  onWithdraw(): void;
}) {
  const cfg = game.guestEntry!;
  const name = match.players.find((p) => p.id === meId)?.name ?? "";
  return (
    <div className="card entry-card">
      <strong>Ta saisie · manche {match.rounds.length + 1}</strong>
      <span className="hint">{name} : tape ton score de la manche{cfg.finisher ? " et indique si c'est toi qui as terminé" : ""}.</span>
      {mine ? (
        <div className="entry-sent">
          <span>Envoyé : <strong>{mine.score}</strong>{mine.finisher ? " · tu as terminé" : ""} ✓</span>
          <button type="button" className="link" onClick={onWithdraw}>Modifier</button>
        </div>
      ) : (
        <ScoreField onSubmit={onSubmit} withFinisher={cfg.finisher} allowNegative={cfg.allowNegative} submitLabel="Envoyer" />
      )}
      <span className="hint">{waitingText(match, entries) ?? "Tout le monde a saisi : la manche va s'ajouter."}</span>
    </div>
  );
}

/** Côté hôte : où en est la saisie de la manche, avec saisie pour les joueurs sans l'appli. */
export function HostEntryPanel({ match, game, entries, onEntry }: {
  match: StoredMatch;
  game: GameDefinition;
  entries: Entries;
  onEntry(playerId: string, entry: Entry): void;
}) {
  const cfg = game.guestEntry!;
  const attempt = tryBuildRound(game, match, entries);
  return (
    <div className="card entry-card">
      <strong>Manche {match.rounds.length + 1} · saisie des joueurs</strong>
      <span className="hint">Chacun envoie son score ; la manche s'ajoute toute seule quand tout le monde a saisi. Saisis toi-même pour ceux qui n'ont pas l'appli.</span>
      {match.players.map((p) => {
        const e = entries[p.id];
        return (
          <div key={p.id} className={`entry-row ${e ? "" : "edit"}`}>
            <span className="name">{p.name}</span>
            {e ? (
              <span className="entry-value">✓ {e.score}{e.finisher ? " · a terminé" : ""}</span>
            ) : (
              <ScoreField compact onSubmit={(entry) => onEntry(p.id, entry)} withFinisher={cfg.finisher} allowNegative={cfg.allowNegative} submitLabel="OK" />
            )}
          </div>
        );
      })}
      {"error" in attempt && <span className="error">{attempt.error}</span>}
      {"waiting" in attempt && <span className="hint">On attend : {attempt.waiting.join(", ")}.</span>}
    </div>
  );
}
