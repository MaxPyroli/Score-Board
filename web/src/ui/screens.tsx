import { useEffect, useRef, useState, type ReactNode } from "react";
import { Dialog, PlayerGrid, Score, Section, Stepper, TopBar } from "./components";
import { isFinished, matchWithoutLastRound, plain, ranking, renamePlayer, SETTING_FINISHED, targetOf, validName, withSetting, type Player, type StoredMatch } from "../core";
import { GAMES, type GameDefinition } from "../games/registry";
import { loadGroups, newId, rememberGroup } from "../store";
import { CONTACT_URL, versionLabel } from "../version";
import { useMe } from "../me";
import { FinalScreen, RenameDialog, WhoAreYou } from "./final";

// ---------------------------------------------------------------- Accueil

const dateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function HomeScreen({ matches, onNew, onOpen, onDelete, onJoin, onReplay }: {
  matches: StoredMatch[];
  onNew(game: GameDefinition): void;
  onOpen(m: StoredMatch): void;
  onDelete(m: StoredMatch): void;
  onJoin(): void;
  /** Nouvelle partie avec le même jeu, les mêmes joueurs et les mêmes réglages. */
  onReplay(m: StoredMatch): void;
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
                  <button className="btn outline small" onClick={() => onReplay(m)} aria-label={`Rejouer ${game.displayName} avec les mêmes joueurs`}>Rejouer</button>
                  <button className="icon" aria-label="Supprimer la partie" onClick={() => setToDelete(m)}>🗑</button>
                </div>
              );
            })}
          </div>
        </Section>
      </main>
      <footer className="footer">
        <span>{versionLabel}</span>
        <a href={CONTACT_URL} target="_blank" rel="noreferrer">Contact / signaler un problème</a>
      </footer>
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

  const groups = loadGroups();
  const useGroup = (group: string[]) => {
    setCount(Math.min(game.maxPlayers, Math.max(game.minPlayers, group.length)));
    setNames(group.slice(0, game.maxPlayers));
  };
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
    rememberGroup(players.map((p) => p.name));
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
        {groups.length > 0 && (
          <Section title="Joueurs récents">
            <div className="chips">
              {groups.map((g) => (
                <button key={g.join("|")} type="button" className="chip" onClick={() => useGroup(g)}>{g.join(", ")}</button>
              ))}
            </div>
          </Section>
        )}
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

export function MatchScreen({ match, game, onBack, onNewRound, onEditRound, onChange, onDelete, readOnly, title, note, sharing, onShare, askWho, online, onClaim }: {
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
  /** Invité : demande « Qui es-tu ? » à l'arrivée. */
  askWho?: boolean;
  /** Joueurs actuellement connectés ; `null` hors partage (pas de pastilles). */
  online?: string[] | null;
  /** Signale à la session quel joueur est cet appareil et, s'il vient de changer de nom, le nouveau nom. */
  onClaim?: (playerId: string, requestedName?: string) => void;
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

  // « Qui suis-je ? » et fin de partie
  const [me, setMe] = useMe(match);
  const [pickerOpen, setPickerOpen] = useState(false);
  const finished = isFinished(match);
  const [hideFinal, setHideFinal] = useState(false);
  useEffect(() => setHideFinal(false), [finished]);
  const ranked = ranking(match.players, totals, game.lowestWins(match));
  const showPicker = pickerOpen || (!!askWho && me === undefined);
  const target = targetOf(match);
  const [renameOpen, setRenameOpen] = useState(false);
  const [pendingName, setPendingName] = useState<string | undefined>();
  const myName = match.players.find((p) => p.id === me)?.name;
  // Signature de cet appareil dans la session (qui je suis, nom demandé s'il y en a un).
  useEffect(() => { if (me !== undefined) onClaim?.(me ?? "", pendingName); }, [me, pendingName]); // eslint-disable-line react-hooks/exhaustive-deps
  // Invité : la demande de nom est terminée quand l'hôte l'a appliquée (ou après 8 s si elle n'a pas abouti).
  useEffect(() => {
    if (pendingName === undefined) return;
    if (myName === pendingName) return setPendingName(undefined);
    const t = window.setTimeout(() => setPendingName(undefined), 8000);
    return () => window.clearTimeout(t);
  }, [pendingName, myName]);
  // L'hôte qui lance le partage dit d'abord quel joueur il est (pour apparaître connecté).
  useEffect(() => { if (sharing && !readOnly && me === undefined) setPickerOpen(true); }, [!!sharing]); // eslint-disable-line react-hooks/exhaustive-deps
  const submitName = (raw: string) => {
    if (me === undefined || me === null) return;
    const name = validName(match, me, raw);
    if (name === null) return;
    if (readOnly) setPendingName(name);
    else { const renamed = renamePlayer(match, me, name); if (renamed) onChange(renamed); }
    setRenameOpen(false);
  };
  const reached = !finished && !readOnly && target !== null && match.players.some((p) => (totals[p.id] ?? 0) >= target);

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
                <button disabled={match.rounds.length === 0 || finished} onClick={() => onChange(withSetting(match, SETTING_FINISHED, "true"))}>Terminer la partie</button>
                <button onClick={() => setPickerOpen(true)}>Qui suis-je ?</button>
                <button onClick={() => setConfirmDelete(true)}>Supprimer la partie</button>
              </div>
            )}
          </div>
          </>
        )}
      />
      <main className="content">
        <div className={`card board ${compact ? "compact" : match.players.length > 4 ? "mid" : ""}`}>
          <PlayerGrid players={match.players}>
            {(p) => (
              <span className="name">
                {online && <span className={`dot ${online.includes(p.id) ? "on" : "off"}`} role="img" aria-label={online.includes(p.id) ? "connecté" : "hors ligne"} />}
                {p.name}
              </span>
            )}
          </PlayerGrid>
          <PlayerGrid players={match.players}>
            {(p) => <Score value={totals[p.id] ?? 0} big leader={p.id === lead} />}
          </PlayerGrid>
        </div>
        {note}
        {sharing && (
          <p className="hint share-note">
            Partage actif · code {sharing.code} · {sharing.viewers} appareil{sharing.viewers > 1 ? "s" : ""} connecté{sharing.viewers > 1 ? "s" : ""}
          </p>
        )}
        {status && <p className="status">{status}</p>}
        {reached && <button className="btn small" onClick={() => onChange(withSetting(match, SETTING_FINISHED, "true"))}>Terminer la partie</button>}
        {(me !== undefined && me !== null) && (
          <p className="hint me-note">
            Tu joues : <strong>{pendingName ?? myName}</strong>
            <button onClick={() => setRenameOpen(true)}>changer mon nom</button>
            <button onClick={() => setPickerOpen(true)}>ce n'est pas moi</button>
          </p>
        )}
        {online && <p className="hint me-note"><span className="dot on" /> connecté · <span className="dot off" /> hors ligne</p>}
        {finished && hideFinal && <button className="btn small" onClick={() => setHideFinal(false)}>Voir le résultat</button>}

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
      {renameOpen && myName !== undefined && (
        <RenameDialog current={pendingName ?? myName} validate={(raw) => (me ? validName(match, me, raw) : null)} onSubmit={submitName} onClose={() => setRenameOpen(false)} />
      )}
      {showPicker && (
        <WhoAreYou
          match={match} current={me}
          onPick={(id) => { setMe(id); setPickerOpen(false); }}
          onClose={askWho && me === undefined ? undefined : () => setPickerOpen(false)}
        />
      )}
      {finished && !hideFinal && (
        <FinalScreen
          ranked={ranked} meId={me ?? null}
          onClose={() => setHideFinal(true)}
          onChangeMe={() => setPickerOpen(true)}
          onResume={readOnly ? undefined : () => onChange(withSetting(match, SETTING_FINISHED, "false"))}
        />
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

