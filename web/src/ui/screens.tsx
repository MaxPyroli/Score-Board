import { useEffect, useRef, useState, type ReactNode } from "react";
import { Dialog, PlayerGrid, Score, Section, Stepper, TopBar } from "./components";
import { matchWithoutLastRound, plain, type Player, type StoredMatch } from "../core";
import { GAMES, type GameDefinition } from "../games/registry";
import { newId } from "../store";

// ---------------------------------------------------------------- Accueil

const dateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function HomeScreen({ matches, onNew, onOpen, onDelete, onJoin }: {
  matches: StoredMatch[];
  onNew(game: GameDefinition): void;
  onOpen(m: StoredMatch): void;
  onDelete(m: StoredMatch): void;
  onJoin(): void;
}) {
  const [toDelete, setToDelete] = useState<StoredMatch | null>(null);
  return (
    <div className="screen">
      <TopBar title="Score Board" actions={<button className="btn outline small" onClick={onJoin}>Rejoindre</button>} />
      <main className="content">
        <Section title="Nouvelle partie">
          <div className="games">
            {GAMES.map((g) => (
              <button key={g.id} className="card game" onClick={() => onNew(g)}>
                <strong>{g.displayName}</strong>
                <span className="hint">{g.tagline}</span>
              </button>
            ))}
          </div>
        </Section>
        <Section title="Parties en cours">
          {matches.length === 0 && <p className="hint">Aucune partie pour l'instant.</p>}
          <div className="list">
            {matches.map((m) => {
              const game = GAMES.find((g) => g.id === m.moduleId);
              if (!game) return null;
              const totals = game.totals(m);
              const lead = m.rounds.length > 0 ? game.leaderId(m) : null;
              return (
                <div key={m.id} className="card row">
                  <button className="row-main" onClick={() => onOpen(m)}>
                    <strong>{game.displayName}</strong>
                    <span className="hint">
                      {dateFormat.format(m.createdAt)} · {m.rounds.length} manche{m.rounds.length > 1 ? "s" : ""}
                    </span>
                    <span className="hint">
                      {m.players.map((p) => `${p.name} ${plain(totals[p.id] ?? 0)}${p.id === lead ? " ★" : ""}`).join(" · ")}
                    </span>
                  </button>
                  <button className="icon" aria-label="Supprimer la partie" onClick={() => setToDelete(m)}>🗑</button>
                </div>
              );
            })}
          </div>
        </Section>
      </main>
      {toDelete && (
        <Dialog title="Supprimer la partie ?" onClose={() => setToDelete(null)}>
          <p>Les scores de cette partie seront perdus.</p>
          <div className="buttons">
            <button className="btn outline" onClick={() => setToDelete(null)}>Annuler</button>
            <button className="btn danger" onClick={() => { onDelete(toDelete); setToDelete(null); }}>Supprimer</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Nouvelle partie

const NAMES_KEY = "scoreboard.lastNames";
const loadNames = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(NAMES_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};

export function NewMatchScreen({ game, onBack, onStart }: {
  game: GameDefinition;
  onBack(): void;
  onStart(m: StoredMatch): void;
}) {
  const [count, setCount] = useState(Math.max(game.minPlayers, Math.min(4, game.maxPlayers)));
  const [names, setNames] = useState<string[]>(loadNames);
  const [flags, setFlags] = useState<Record<string, boolean>>(Object.fromEntries(game.options.map((o) => [o.key, o.default])));
  const [numbers, setNumbers] = useState<Record<string, string>>(Object.fromEntries(game.numberOptions.map((o) => [o.key, o.default ?? ""])));

  const nameAt = (i: number) => names[i] ?? "";
  const effective = (i: number) => nameAt(i).trim() || `Joueur ${i + 1}`;
  const duplicates = new Set(Array.from({ length: count }, (_, i) => effective(i).toLowerCase())).size !== count;
  const badNumber = game.numberOptions.some((o) => {
    const t = (numbers[o.key] ?? "").trim();
    return t !== "" && !(Number(t.replace(",", ".")) > 0);
  });

  const start = () => {
    const players: Player[] = Array.from({ length: count }, (_, i) => ({ id: newId(), name: effective(i) }));
    try {
      localStorage.setItem(NAMES_KEY, JSON.stringify(players.map((p) => p.name)));
    } catch { /* sans importance */ }
    const settings: Record<string, string> = { ...game.fixedSettings };
    for (const o of game.options) settings[o.key] = String(flags[o.key]);
    for (const o of game.numberOptions) {
      const t = (numbers[o.key] ?? "").trim();
      if (t !== "") settings[o.key] = t.replace(",", ".");
    }
    onStart({ id: newId(), moduleId: game.id, players, rounds: [], settings, createdAt: Date.now() });
  };

  return (
    <div className="screen">
      <TopBar title={game.displayName} onBack={onBack} />
      <main className="content">
        <Section title="Nombre de joueurs">
          <Stepper value={count} min={game.minPlayers} max={game.maxPlayers} onChange={setCount} label="Nombre de joueurs" />
        </Section>
        <Section title="Joueurs">
          <div className="inputs">
            {Array.from({ length: count }, (_, i) => (
              <input
                key={i} className="field wide" placeholder={`Joueur ${i + 1}`} aria-label={`Nom du joueur ${i + 1}`}
                value={nameAt(i)} maxLength={20}
                onChange={(e) => setNames((all) => { const next = [...all]; next[i] = e.target.value; return next; })}
              />
            ))}
          </div>
          {duplicates && <p className="error">Deux joueurs ont le même nom.</p>}
        </Section>
        {(game.options.length > 0 || game.numberOptions.length > 0) && (
          <Section title="Réglages">
            {game.options.map((o) => (
              <label key={o.key} className="switch-row">
                <span>
                  <strong>{o.label}</strong>
                  <span className="hint block">{o.description}</span>
                </span>
                <input type="checkbox" checked={flags[o.key]} onChange={(e) => setFlags((f) => ({ ...f, [o.key]: e.target.checked }))} />
              </label>
            ))}
            {game.numberOptions.map((o) => (
              <label key={o.key} className="switch-row">
                <span>
                  <strong>{o.label}</strong>
                  <span className="hint block">{o.description}</span>
                </span>
                <input
                  className="field" inputMode="decimal" value={numbers[o.key] ?? ""} placeholder="—"
                  onChange={(e) => setNumbers((n) => ({ ...n, [o.key]: e.target.value }))}
                />
              </label>
            ))}
            {badNumber && <p className="error">L'objectif doit être un nombre positif.</p>}
          </Section>
        )}
      </main>
      <footer className="bottom">
        <button className="btn" disabled={duplicates || badNumber} onClick={start}>Commencer la partie</button>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------- Partie

export function MatchScreen({ match, game, onBack, onNewRound, onEditRound, onChange, onDelete, readOnly, title, note, sharing, onShare }: {
  match: StoredMatch;
  game: GameDefinition;
  onBack(): void;
  onNewRound(): void;
  onEditRound(i: number): void;
  onChange(m: StoredMatch): void;
  onDelete(): void;
  readOnly?: boolean;
  title?: string;
  note?: ReactNode;
  /** Partage en cours de cette partie (code et nombre de spectateurs). */
  sharing?: { code: string; viewers: number } | null;
  onShare?: () => void;
}) {
  const totals = game.totals(match);
  const roundScores = game.roundScores(match);
  const status = game.status(match);
  const lead = match.rounds.length > 0 ? game.leaderId(match) : null;
  const [menu, setMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [undone, setUndone] = useState<StoredMatch | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const undo = () => {
    setMenu(false);
    setUndone(match);
    onChange(matchWithoutLastRound(match));
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setUndone(null), 6000);
  };
  const compact = match.players.length > 6;

  return (
    <div className="screen">
      <TopBar
        title={title ?? game.displayName}
        onBack={onBack}
        actions={readOnly ? undefined : (
          <>
            {onShare && <button className="icon" aria-label="Partager la partie" onClick={onShare}>⇪</button>}
          <div className="menu-wrap">
            <button className="icon" aria-label="Plus d'actions" onClick={() => setMenu((v) => !v)}>⋮</button>
            {menu && (
              <div className="menu" onClick={() => setMenu(false)}>
                <button disabled={match.rounds.length === 0} onClick={undo}>Annuler la dernière manche</button>
                <button onClick={() => setConfirmDelete(true)}>Supprimer la partie</button>
              </div>
            )}
          </div>
          </>
        )}
      />
      <main className="content">
        <div className={`card board ${compact ? "compact" : match.players.length > 4 ? "mid" : ""}`}>
          <PlayerGrid players={match.players}>{(p) => <span className="name">{p.name}</span>}</PlayerGrid>
          <PlayerGrid players={match.players}>
            {(p) => <Score value={totals[p.id] ?? 0} big leader={p.id === lead} />}
          </PlayerGrid>
        </div>
        {note}
        {sharing && (
          <p className="hint share-note">
            Partage actif · code {sharing.code} · {sharing.viewers} spectateur{sharing.viewers > 1 ? "s" : ""}
          </p>
        )}
        {status && <p className="status">{status}</p>}

        {match.rounds.length === 0 ? (
          <p className="hint empty">Aucune manche pour l'instant.{!readOnly && <><br />Appuie sur « Nouvelle manche » pour commencer.</>}</p>
        ) : (
          <div className="list">
            {match.rounds.map((_, i) => match.rounds.length - 1 - i).map((index) => {
              const d = game.describeRound(match, index);
              return (
                <button key={index} className="card round" disabled={readOnly} onClick={() => onEditRound(index)}>
                  <strong>{d.headline ? `${index + 1}. ${d.headline}` : `Manche ${index + 1}`}</strong>
                  {d.detail && <span className="hint">{d.detail}</span>}
                  <PlayerGrid players={match.players} className="divided">
                    {(p) => <Score value={roundScores[index][p.id] ?? 0} withSign />}
                  </PlayerGrid>
                </button>
              );
            })}
          </div>
        )}
        <div className="spacer big" />
      </main>

      {!readOnly && <button className="fab" onClick={onNewRound}>+ Nouvelle manche</button>}

      {undone && (
        <div className="toast" role="status">
          Dernière manche annulée
          <button onClick={() => { onChange(undone); setUndone(null); }}>Rétablir</button>
        </div>
      )}
      {confirmDelete && (
        <Dialog title="Supprimer la partie ?" onClose={() => setConfirmDelete(false)}>
          <p>Les scores de cette partie seront perdus.</p>
          <div className="buttons">
            <button className="btn outline" onClick={() => setConfirmDelete(false)}>Annuler</button>
            <button className="btn danger" onClick={() => { setConfirmDelete(false); onDelete(); }}>Supprimer</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

