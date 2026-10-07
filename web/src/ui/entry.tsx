import { PlusMinus } from "./PlusMinus";
import { useState } from "react";
import { parseScore, type StoredMatch } from "../core";
import type { GameDefinition } from "../games/registry";
import { tryBuildRound, type Entries, type Entry } from "../guestEntry";

/** Champ « mon score » avec bouton de signe (+ par défaut, − au toucher) : renvoie le texte signé (« -3 »). */
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
  const empty = text.trim() === ""; // champ vide = 0 (le « 0 » grisé est une vraie valeur)
  const signed = empty ? "0" : (neg ? "-" : "") + text.trim();
  const valid = parseScore(signed) !== null;
  return (
    <div className={`entry-field ${compact ? "compact" : ""}`}>
      {allowNegative && (
        <button type="button" className={`chip sign ${neg ? "on" : ""}`} aria-pressed={neg} aria-label={`Signe du score : ${neg ? "négatif" : "positif"} (toucher pour changer)`} onClick={() => setNeg(!neg)}><PlusMinus plus={!neg} /></button>
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
  const cfg = game.guestEntry!(match)!;
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

type Draft = { text: string; neg: boolean; finisher: boolean };
const draftValue = (d: Draft | undefined): string => (d && d.text.trim() !== "" ? (d.neg ? "-" : "") + d.text.trim() : "0");

/**
 * Côté hôte : où en est la saisie de la manche. L'hôte tape les scores de ceux qui n'ont pas l'appli, puis valide tout
 * d'un coup. Un champ laissé vide compte 0, sauf pour un joueur connecté avec l'appli : on attend sa propre saisie.
 */
export function HostEntryPanel({ match, game, entries, online, onEntries }: {
  match: StoredMatch;
  game: GameDefinition;
  entries: Entries;
  online: string[] | null;
  onEntries(entries: Record<string, Entry>): void;
}) {
  const cfg = game.guestEntry!(match)!;
  const attempt = tryBuildRound(game, match, entries);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const set = (id: string, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [id]: { ...(d[id] ?? { text: "", neg: false, finisher: false }), ...patch } }));
  const open = match.players.filter((p) => !entries[p.id]);
  // Joueurs dont la saisie sera envoyée : ceux qui ont tapé quelque chose, et ceux qui n'ont pas l'appli (champ vide = 0).
  const toSend = open.filter((p) => (drafts[p.id]?.text ?? "").trim() !== "" || drafts[p.id]?.finisher || !(online ?? []).includes(p.id));
  const invalid = toSend.some((p) => parseScore(draftValue(drafts[p.id])) === null);
  const validate = () => {
    onEntries(Object.fromEntries(toSend.map((p) => [p.id, { score: draftValue(drafts[p.id]), finisher: drafts[p.id]?.finisher ?? false }])));
    setDrafts({});
  };
  return (
    <div className="card entry-card">
      <strong>Manche {match.rounds.length + 1} · scores</strong>
      {match.players.map((p) => {
        const e = entries[p.id];
        const d = drafts[p.id];
        const waitsForGuest = (online ?? []).includes(p.id);
        return (
          <div key={p.id} className="entry-row">
            <span className="name">{p.name}</span>
            {e ? (
              <span className="entry-value">✓ {e.score}{e.finisher ? " · a terminé" : ""}</span>
            ) : (
              <span className="entry-field compact">
                {cfg.allowNegative && (
                  <button type="button" className={`chip sign ${d?.neg ? "on" : ""}`} aria-pressed={!!d?.neg} aria-label={`Signe du score de ${p.name}`} onClick={() => set(p.id, { neg: !d?.neg })}><PlusMinus plus={!d?.neg} /></button>
                )}
                <input
                  className="field" inputMode="decimal" autoComplete="off" placeholder={waitsForGuest ? "attend" : "0"} aria-label={`Score de ${p.name}`}
                  value={d?.text ?? ""} onChange={(ev) => set(p.id, { text: ev.target.value })}
                />
                {cfg.finisher && (
                  <button type="button" className={`chip ${d?.finisher ? "on" : ""}`} aria-pressed={!!d?.finisher} onClick={() => set(p.id, { finisher: !d?.finisher })}>A terminé</button>
                )}
              </span>
            )}
          </div>
        );
      })}
      {open.length > 0 && (
        <button type="button" className="btn full" disabled={toSend.length === 0 || invalid} onClick={validate}>Valider les scores</button>
      )}
      {"error" in attempt && <span className="error">{attempt.error}</span>}
      {"waiting" in attempt && <span className="hint">On attend : {attempt.waiting.join(", ")}.</span>}
    </div>
  );
}
