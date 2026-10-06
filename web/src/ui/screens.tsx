import { useEffect, useRef, useState, type ReactNode } from "react";
import { Dialog, PlayerGrid, Score, Section, Stepper, TopBar } from "./components";
import { finishMatch, isFinished, isPending, matchWithRound, matchWithoutLastRound, plain, ranking, renamePlayer, resumeMatch, revealResults, validName, type Player, type StoredMatch } from "../core";
import { GAMES, type GameDefinition, type Values } from "../games/registry";
import { loadGroups, newId, rememberGroup } from "../store";
import { Meeple } from "./Meeple";
import { MoreIcon, ShareIcon } from "./PlusMinus";
import { ChangelogSheet } from "./ChangelogSheet";
import { setAssistantEnabled, useAssistant } from "../assistant";
import { IS_BETA, PUBLIC_URL } from "../channel";
import { CONTACT_URL, versionLabel } from "../version";
import { useMe } from "../me";
import { useRecentlyGone } from "../presence";
import { EndedScreen, FinalScreen, RenameDialog, WhoAreYou } from "./final";
import { GameArt } from "./GameArt";
import { gameImage } from "../games/themes";
import { modeOf } from "../games/counter";
import { RulesSheet } from "./RulesSheet";
import { GuestEntryCard, HostEntryPanel } from "./entry";
import type { ClaimData } from "../backend";
import type { Entries, Entry } from "../guestEntry";

// ---------------------------------------------------------------- Accueil

const dateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function HomeScreen({ matches, onNew, onOpen, onDelete, onJoin, onHistory }: {
  matches: StoredMatch[];
  onNew(game: GameDefinition): void;
  onOpen(m: StoredMatch): void;
  onDelete(m: StoredMatch): void;
  onJoin(): void;
  /** Ouvre l'historique (parties terminées). */
  onHistory(): void;
}) {
  const [toDelete, setToDelete] = useState<StoredMatch | null>(null);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const assistant = useAssistant();
  // Les parties terminées vont dans l'historique ; l'accueil ne montre que celles en cours.
  const ongoing = matches.filter((m) => !isFinished(m));
  const finishedCount = matches.length - ongoing.length;
  return (
    <div className="screen">
      <TopBar title={<><Meeple />Score Board</>} actions={<button className="btn outline small" onClick={onJoin}>Rejoindre</button>} />
      <main className="content">
        {ongoing.length > 0 && (
        <Section title="Parties en cours">
          <div className="list">
            {ongoing.map((m) => {
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
        )}
        {finishedCount > 0 && (
          <button className="btn outline history-btn" onClick={onHistory}>
            <span aria-hidden="true">📜</span> Historique · {finishedCount} partie{finishedCount > 1 ? "s" : ""} terminée{finishedCount > 1 ? "s" : ""}
          </button>
        )}
        <Section title="Nouvelle partie">
          <div className="games">
            {GAMES.map((g) => {
              const bg = gameImage(g.id, "bg");
              const logo = gameImage(g.id, "logo");
              return (
                <button
                  key={g.id} className={`card game ${bg ? "has-bg" : ""} ${g.assistant && assistant ? "assist-on" : ""}`} data-game={g.id} onClick={() => onNew(g)}
                  style={bg ? ({ "--bg-url": `url("${bg}")` } as React.CSSProperties) : undefined}
                >
                  <span className="box-frame" aria-hidden="true" />
                  {g.assistant && assistant && <span className="shine" aria-hidden="true" />}
                  {!bg && !logo && <GameArt gameId={g.id} />}
                  {logo && <img className="game-logo" src={logo} alt="" aria-hidden="true" />}
                  <strong>{g.displayName}</strong>
                  <span className="hint">{g.tagline}</span>
                  {g.assistant && assistant && (
                    <span className="assistant-stamp on" title="Mode assistant activé">
                      <span>Compatible</span><span>mode assistant</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Section>
      </main>
      <footer className="footer">
        <span>{versionLabel} · <button className="link-small" onClick={() => setChangelogOpen(true)}>Notes de version</button></span>
        {IS_BETA && (
          <label className="assistant-toggle" title="Ajoute des aides aux jeux compatibles, marqués d'un tampon (menus, choix par catégories…)">
            <input type="checkbox" checked={assistant} onChange={(e) => setAssistantEnabled(e.target.checked)} />
            <span>Mode assistant</span>
          </label>
        )}
        {IS_BETA && <span>Version de test · <a href={PUBLIC_URL}>Version publique</a></span>}
        <a href={CONTACT_URL} target="_blank" rel="noreferrer">Contact / signaler un problème</a>
      </footer>
      {changelogOpen && <ChangelogSheet onClose={() => setChangelogOpen(false)} />}
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

// ---------------------------------------------------------------- Historique

/** Parties terminées, les plus récentes d'abord : on peut les rouvrir (et les rejouer de l'intérieur) ou les supprimer. */
export function HistoryScreen({ matches, onOpen, onDelete, onBack }: {
  matches: StoredMatch[];
  onOpen(m: StoredMatch): void;
  onDelete(m: StoredMatch): void;
  onBack(): void;
}) {
  const [toDelete, setToDelete] = useState<StoredMatch | null>(null);
  const finished = matches.filter(isFinished);
  return (
    <div className="screen">
      <TopBar title="Historique" onBack={onBack} />
      <main className="content">
        {finished.length === 0 && <p className="hint empty">Aucune partie terminée pour l'instant.<br />Une partie terminée apparaît ici.</p>}
        <div className="list">
          {finished.map((m) => {
            const game = GAMES.find((g) => g.id === m.moduleId);
            if (!game) return null;
            const ranked = ranking(m.players, game.totals(m), game.lowestWins(m));
            const winners = ranked.filter((r) => r.rank === 1).map((r) => r.player.name);
            return (
              <div key={m.id} className="card row" data-game={m.moduleId}>
                <button className="row-main" onClick={() => onOpen(m)}>
                  <strong>{game.displayName}</strong>
                  <span className="hint">{dateFormat.format(m.createdAt)} · {m.rounds.length} manche{m.rounds.length > 1 ? "s" : ""}</span>
                  <span className="hint">🏆 {winners.join(" et ") || "—"} · {ranked.map((r) => `${r.player.name} ${plain(r.total)}`).join(" · ")}</span>
                </button>
                <button className="icon" aria-label="Supprimer la partie" onClick={() => setToDelete(m)}>🗑</button>
              </div>
            );
          })}
        </div>
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
  const [rulesOpen, setRulesOpen] = useState(false);
  const [count, setCount] = useState(Math.max(game.minPlayers, Math.min(4, game.maxPlayers)));
  const [names, setNames] = useState<string[]>(loadNames);
  // Tous les réglages sont gardés en texte (« true »/« false », nombres, choix), comme dans la partie.
  const [values, setValues] = useState<Values>(() => ({
    ...Object.fromEntries(game.choiceOptions?.map((c) => [c.key, c.default]) ?? []),
    ...Object.fromEntries(game.options.map((o) => [o.key, String(o.default)])),
    ...Object.fromEntries(game.numberOptions.map((o) => [o.key, o.default ?? ""])),
    ...game.setup?.defaults(),
  }));
  const setupProblem = game.setup?.problem(values, count) ?? null;
  const isVisible = (o: { visibleWhen?: (v: Values) => boolean }) => o.visibleWhen?.(values) ?? true;
  /** Change un réglage ; les valeurs par défaut qui en dépendent (ex. total de départ selon le mode) sont recalculées. */
  const setValue = (key: string, value: string) =>
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      // Seul un changement de choix (ex. mode, édition) réapplique les valeurs par défaut qui en dépendent :
      // taper soi-même une valeur ne doit jamais être écrasé.
      if (game.choiceOptions?.some((c) => c.key === key)) {
        for (const o of game.numberOptions) if (o.defaultFor) next[o.key] = o.defaultFor(next) ?? "";
        for (const o of game.options) if (o.defaultFor) next[o.key] = String(o.defaultFor(next) ?? o.default);
      }
      return next;
    });

  const groups = loadGroups();
  const useGroup = (group: string[]) => {
    setCount(Math.min(game.maxPlayers, Math.max(game.minPlayers, group.length)));
    setNames(group.slice(0, game.maxPlayers));
  };
  const nameAt = (i: number) => names[i] ?? "";
  const effective = (i: number) => nameAt(i).trim() || `Joueur ${i + 1}`;
  const duplicates = new Set(Array.from({ length: count }, (_, i) => effective(i).toLowerCase())).size !== count;
  const badNumber = game.numberOptions.some((o) => {
    if (!isVisible(o)) return false;
    const t = (values[o.key] ?? "").trim();
    return t !== "" && !(Number(t.replace(",", ".")) > 0);
  });

  const start = () => {
    const players: Player[] = Array.from({ length: count }, (_, i) => ({ id: newId(), name: effective(i) }));
    try {
      localStorage.setItem(NAMES_KEY, JSON.stringify(players.map((p) => p.name)));
    } catch { /* sans importance */ }
    rememberGroup(players.map((p) => p.name));
    const settings: Record<string, string> = { ...game.fixedSettings };
    for (const c of game.choiceOptions ?? []) settings[c.key] = values[c.key];
    for (const o of game.options) if (isVisible(o)) settings[o.key] = values[o.key];
    for (const k of Object.keys(game.setup?.defaults() ?? {})) settings[k] = values[k];
    for (const o of game.numberOptions) {
      const t = (values[o.key] ?? "").trim();
      if (isVisible(o) && t !== "") settings[o.key] = t.replace(",", ".");
    }
    onStart({ id: newId(), moduleId: game.id, players, rounds: [], settings, createdAt: Date.now() });
  };

  return (
    <div className="screen" data-game={game.id}>
      <TopBar
        title={game.displayName}
        onBack={onBack}
        actions={<button className="btn outline small" onClick={() => setRulesOpen(true)}>Règles</button>}
      />
      {rulesOpen && <RulesSheet gameId={game.id} onClose={() => setRulesOpen(false)} />}
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
        {game.setup && <game.setup.Component values={values} setMany={(patch) => setValues((prev) => ({ ...prev, ...patch }))} players={count} />}
        {(game.choiceOptions?.length ?? 0) > 0 && game.choiceOptions!.map((c) => (
          <Section key={c.key} title={c.label}>
            <div className="choices">
              {c.choices.map((ch) => (
                <button
                  key={ch.value} type="button" className={`card choice ${values[c.key] === ch.value ? "on" : ""}`}
                  aria-pressed={values[c.key] === ch.value} onClick={() => setValue(c.key, ch.value)}
                >
                  <strong>{ch.label}</strong>
                  <span className="hint">{ch.description}</span>
                </button>
              ))}
            </div>
          </Section>
        ))}
        {(game.options.some(isVisible) || game.numberOptions.some(isVisible)) && (
          <Section title="Réglages">
            {game.options.filter(isVisible).map((o) => (
              <label key={o.key} className="switch-row">
                <span>
                  <strong>{o.label}</strong>
                  <span className="hint block">{o.description}</span>
                </span>
                <input type="checkbox" checked={values[o.key] === "true"} onChange={(e) => setValue(o.key, String(e.target.checked))} />
              </label>
            ))}
            {game.numberOptions.filter(isVisible).map((o) => (
              <label key={o.key} className="switch-row">
                <span>
                  <strong>{o.labelFor?.(values) ?? o.label}</strong>
                  <span className="hint block">{o.description}</span>
                </span>
                <input
                  className="field" inputMode="decimal" value={values[o.key] ?? ""} placeholder="—"
                  onChange={(e) => setValue(o.key, e.target.value)}
                />
              </label>
            ))}
            {badNumber && <p className="error">Les valeurs doivent être des nombres positifs.</p>}
          </Section>
        )}
      </main>
      <footer className="bottom">
        {setupProblem && <p className="error">{setupProblem}</p>}
        <button className="btn" disabled={duplicates || badNumber || !!setupProblem} onClick={start}>Commencer la partie</button>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------- Partie

export function MatchScreen({ match, game, onBack, onNewRound, onEditRound, onChange, onDelete, onReplay, readOnly, title, note, sharing, onShare, askWho, online, onClaim, entries, onHostEntry, taken, ended }: {
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
  onClaim?: (data: ClaimData) => void;
  /** Saisies des joueurs pour la manche en cours (invités et hôte réunis). */
  entries?: Entries;
  /** Hôte : saisie faite par l'hôte pour un joueur sans l'appli. */
  onHostEntry?: (playerId: string, entry: Entry) => void;
  /** Joueurs déjà pris par un autre appareil connecté. */
  taken?: string[];
  /** Invité : l'hôte a arrêté le partage (plus de saisie possible). */
  ended?: boolean;
  /** Nouvelle partie avec le même jeu, les mêmes joueurs et les mêmes réglages (partie terminée, hôte seulement). */
  onReplay?: () => void;
}) {
  const totals = game.totals(match);
  const roundScores = game.roundScores(match);
  const status = game.status(match);
  const lead = match.rounds.length > 0 ? game.leaderId(match) : null;
  const [menu, setMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
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
  const recent = useRecentlyGone(taken ?? []);
  const [pickerOpen, setPickerOpen] = useState(false);
  const finished = isFinished(match);
  const pending = isPending(match); // « Partie terminée » affiché, résultats pas encore dévoilés
  const [hideFinal, setHideFinal] = useState(false);
  useEffect(() => setHideFinal(false), [finished, pending]);
  const ranked = ranking(match.players, totals, game.lowestWins(match));
  const showPicker = pickerOpen || (!!askWho && me === undefined);
  const [renameOpen, setRenameOpen] = useState(false);
  const [pendingName, setPendingName] = useState<string | undefined>();
  const myName = match.players.find((p) => p.id === me)?.name;
  // Signature de cet appareil dans la session (qui je suis, nom demandé s'il y en a un).
  // Ma saisie de la manche en cours (invité) ; elle est abandonnée dès qu'une manche est ajoutée.
  const [myEntry, setMyEntry] = useState<{ r: number; entry: Entry } | null>(null);
  useEffect(() => { if (myEntry && myEntry.r !== match.rounds.length) setMyEntry(null); }, [match.rounds.length, myEntry]);
  useEffect(() => {
    if (me === undefined) return;
    onClaim?.({
      p: me ?? "",
      ...(pendingName ? { n: pendingName } : {}),
      ...(myEntry ? { r: myEntry.r, s: myEntry.entry.score, ...(myEntry.entry.finisher ? { f: true } : {}) } : {}),
    });
  }, [me, pendingName, myEntry]); // eslint-disable-line react-hooks/exhaustive-deps
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
  const quickSteps = game.quickSteps(match);

  return (
    <div className="screen" data-game={game.id}>
      <TopBar
        title={title ?? game.displayName}
        onBack={onBack}
        actions={(
          <>
            <button className="btn outline small" onClick={() => setRulesOpen(true)}>Règles</button>
            {readOnly ? null : <>
            {onShare && <button className="icon round plain" aria-label="Partager la partie" onClick={onShare}><ShareIcon /></button>}
          <div className="menu-wrap">
            <button className="icon round plain" aria-label="Plus d'actions" onClick={() => setMenu((v) => !v)}><MoreIcon /></button>
            {menu && (
              <div className="menu" onClick={() => setMenu(false)}>
                <button disabled={match.rounds.length === 0} onClick={undo}>Annuler la dernière manche</button>
                <button disabled={match.rounds.length === 0 || finished} onClick={() => onChange(finishMatch(match))}>Terminer la partie</button>
                <button onClick={() => setPickerOpen(true)}>Qui suis-je ?</button>
                <button onClick={() => setConfirmDelete(true)}>Supprimer la partie</button>
              </div>
            )}
          </div>
            </>}
          </>
        )}
      />
      {rulesOpen && <RulesSheet gameId={game.id} focus={game.id === "free" ? `mode-${modeOf(match.settings)}` : undefined} onClose={() => setRulesOpen(false)} />}
      <main className="content">
        <div
          className={`card board ${compact ? "compact" : match.players.length > 4 ? "mid" : ""} ${gameImage(game.id, "bg") ? "has-bg" : ""}`}
          style={gameImage(game.id, "bg") ? ({ "--bg-url": `url("${gameImage(game.id, "bg")}")` } as React.CSSProperties) : undefined}
        >
          {!gameImage(game.id, "bg") && <GameArt gameId={game.id} className="board-art" />}
          {/* Un seul tableau (nom au-dessus du score) : à beaucoup de joueurs, il passe sur plusieurs lignes sans décaler noms et scores. */}
          <PlayerGrid players={match.players} className={match.players.length > 6 ? "many" : ""}>
            {(p) => (
              <>
                <span className="name">
                  {online && (() => {
                    const state = online.includes(p.id) ? "on" : recent.includes(p.id) ? "recent" : "off";
                    return <span className={`dot ${state}`} role="img" aria-label={state === "on" ? "connecté" : state === "recent" ? "déconnecté depuis peu" : "hors ligne"} />;
                  })()}
                  {p.name}
                </span>
                <Score value={totals[p.id] ?? 0} big leader={p.id === lead} />
              </>
            )}
          </PlayerGrid>
        </div>
        {note}
        {sharing && (
          <p className="hint share-note">
            Partage actif · code {sharing.code} · {sharing.viewers} appareil{sharing.viewers > 1 ? "s" : ""} connecté{sharing.viewers > 1 ? "s" : ""}
          </p>
        )}
        {status && <p className="status">{status}</p>}
        {(me !== undefined && me !== null) && (
          <p className="hint me-note">
            Tu joues : <strong>{pendingName ?? myName}</strong>
            <button onClick={() => setRenameOpen(true)}>changer mon nom</button>
            <button onClick={() => setPickerOpen(true)}>ce n'est pas moi</button>
          </p>
        )}
        {online && <p className="hint me-note"><span className="dot on" /> connecté · <span className="dot recent" /> déconnecté depuis peu · <span className="dot off" /> hors ligne</p>}
        {readOnly && game.guestEntry?.(match) && me && !finished && !ended && (
          <GuestEntryCard
            match={match} game={game} meId={me} entries={entries ?? {}} mine={myEntry?.entry ?? null}
            onSubmit={(entry) => setMyEntry({ r: match.rounds.length, entry })} onWithdraw={() => setMyEntry(null)}
          />
        )}
        {!readOnly && game.guestEntry?.(match) && sharing && !finished && onHostEntry && (
          <HostEntryPanel match={match} game={game} entries={entries ?? {}} onEntry={onHostEntry} />
        )}
        {quickSteps && !readOnly && !finished && (
          <div className="card entry-card">
            <strong>{game.displayName}</strong>
            {match.players.map((p) => (
              <div key={p.id} className="entry-row quick">
                <span className="name">{p.name}</span>
                <span className="quick-total">{plain(totals[p.id] ?? 0)}</span>
                <div className="quick-btns">
                  {quickSteps.map((d) => (
                    <button
                      key={d} type="button" className="btn outline small" aria-label={`${p.name} ${d > 0 ? "+" : "−"}${Math.abs(d)}`}
                      onClick={() => onChange(matchWithRound(match, game.encodeAdjust?.(match, p.id, d) ?? ""))}
                    >{d > 0 ? "+" : "−"}{Math.abs(d)}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {finished && !pending && hideFinal && (
          <div className="buttons">
            <button className="btn small" onClick={() => setHideFinal(false)}>Voir le résultat</button>
            {onReplay && !readOnly && <button className="btn outline small" onClick={onReplay}>Rejouer</button>}
          </div>
        )}

        {match.rounds.length === 0 ? (
          <p className="hint empty">{game.id === "rail" ? "Pas encore de décompte." : "Aucune manche pour l'instant."}{!readOnly && <><br />Appuie sur « {game.id === "rail" ? "Nouveau décompte" : "Nouvelle manche"} » pour commencer.</>}</p>
        ) : (
          <div className="list">
            {match.rounds.map((_, i) => match.rounds.length - 1 - i).map((index) => {
              const d = game.describeRound(match, index);
              const badges = game.roundBadges?.(match, index) ?? {};
              return (
                <button key={index} className="card round" disabled={readOnly} onClick={() => onEditRound(index)}>
                  <strong>{d.headline ? `${index + 1}. ${d.headline}` : `Manche ${index + 1}`}</strong>
                  {d.detail && <span className="hint">{d.detail}</span>}
                  <PlayerGrid players={match.players} className={`divided ${match.players.length > 6 ? "many" : ""}`}>
                    {(p) => (
                      <>
                        {match.players.length > 6 && <span className="name">{p.name}</span>}
                        <span className="with-badge">
                          <Score value={roundScores[index][p.id] ?? 0} withSign />
                          {badges[p.id] && <span className="x2" title="Points doublés">{badges[p.id]}</span>}
                        </span>
                      </>
                    )}
                  </PlayerGrid>
                </button>
              );
            })}
          </div>
        )}
        <div className="spacer big" />
      </main>

      {!readOnly && !quickSteps && (game.canAddRound?.(match) ?? true) && <button className="fab" onClick={onNewRound}>{game.id === "rail" ? "+ Décompte final" : "+ Nouvelle manche"}</button>}

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
          match={match} current={me} taken={taken} recent={recent}
          onPick={(id) => { setMe(id); setPickerOpen(false); }}
          onClose={askWho && me === undefined ? undefined : () => setPickerOpen(false)}
        />
      )}
      {finished && pending && (
        <EndedScreen
          onReveal={readOnly ? undefined : () => onChange(revealResults(match))}
          onResume={readOnly ? undefined : () => onChange(resumeMatch(match))}
        />
      )}
      {finished && !pending && !hideFinal && (
        <FinalScreen
          ranked={ranked} meId={me ?? null}
          onClose={() => setHideFinal(true)}
          onChangeMe={readOnly || sharing ? () => setPickerOpen(true) : undefined}
          onResume={readOnly ? undefined : () => onChange(resumeMatch(match))}
          onReplay={readOnly ? undefined : onReplay}
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

