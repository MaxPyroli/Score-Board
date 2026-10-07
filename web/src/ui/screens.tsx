import { useEffect, useRef, useState, type ReactNode } from "react";
import { Dialog, PlayerGrid, RulesButton, Score, Section, Stepper, TopBar } from "./components";
import { finishMatch, isFinished, isLobby, SETTING_LOBBY, isPending, matchWithRound, matchWithoutLastRound, plain, ranking, renamePlayer, resumeMatch, revealResults, validName, type Player, type StoredMatch } from "../core";
import { sharingConfigured } from "../backend";
import { GAMES, type GameDefinition, type Values } from "../games/registry";
import { loadGroups, newId, rememberGroup } from "../store";
import { Meeple } from "./Meeple";
import { Crown, MoreIcon, ShareIcon } from "./PlusMinus";
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

const MAX_TICKET_SCORES = 8;

/** Fiche de partie : une « tranche » colorée aux couleurs du jeu, les scores en jetons, un pointillé avant la corbeille. */
function MatchTicket({ match, game, status, scores, onOpen, onDelete }: {
  match: StoredMatch; game: GameDefinition; status: string;
  scores: { name: string; total: string; lead: boolean }[];
  onOpen(): void; onDelete(): void;
}) {
  return (
    <div className="card ticket" data-game={match.moduleId}>
      <button className="ticket-main" onClick={onOpen}>
        <span className="ticket-spine" aria-hidden="true"><span>{status}</span></span>
        <span className="ticket-body">
          <strong>{game.displayName}</strong>
          <span className="hint">{dateFormat.format(match.createdAt)} · {match.rounds.length} manche{match.rounds.length > 1 ? "s" : ""}</span>
          <span className="ticket-scores">
            {scores.slice(0, MAX_TICKET_SCORES).map((sc, i) => (
              <span key={i} className={`ticket-score ${sc.lead ? "lead" : ""}`}>
                {sc.lead && <span aria-label="en tête">★</span>}<span className="ticket-name">{sc.name}</span> <b>{sc.total}</b>
              </span>
            ))}
            {scores.length > MAX_TICKET_SCORES && <span className="ticket-score more">+{scores.length - MAX_TICKET_SCORES}</span>}
          </span>
        </span>
      </button>
      <button className="ticket-trash" aria-label="Supprimer la partie" onClick={onDelete}>🗑</button>
    </div>
  );
}

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
                <MatchTicket
                  key={m.id} match={m} game={game} status={isLobby(m) ? "En attente" : "En cours"} onOpen={() => onOpen(m)} onDelete={() => setToDelete(m)}
                  scores={m.players.map((p) => ({ name: p.name, total: plain(totals[p.id] ?? 0), lead: p.id === lead }))}
                />
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
          {/* Emplacement réservé : comme s'il manquait une carte. Hors de la grille des jeux, pour ne pas en changer la hauteur. */}
          <div className="slot-soon">
            <strong>D'autres jeux arrivent</strong>
            <span className="hint">L'appli grandit à chaque version : nouveaux jeux et nouvelles fonctions.</span>
            <a href={`${CONTACT_URL}/new?title=${encodeURIComponent("Idée de jeu : ")}`} target="_blank" rel="noreferrer">Proposer un jeu</a>
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
            return (
              <MatchTicket
                key={m.id} match={m} game={game} status="Terminée" onOpen={() => onOpen(m)} onDelete={() => setToDelete(m)}
                scores={ranked.map((r) => ({ name: r.player.name, total: plain(r.total), lead: r.rank === 1 }))}
              />
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

export function NewMatchScreen({ game, onBack, onStart, onInvite }: {
  game: GameDefinition;
  onBack(): void;
  onStart(m: StoredMatch): void;
  /** Crée la partie en salle d'attente et la partage tout de suite : les invités ajoutent eux-mêmes leur pseudo. */
  onInvite(m: StoredMatch): void;
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

  const build = (): StoredMatch => {
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
    return { id: newId(), moduleId: game.id, players, rounds: [], settings, createdAt: Date.now() };
  };
  const start = () => onStart(build());
  const invite = () => {
    const m = build();
    onInvite({ ...m, settings: { ...m.settings, [SETTING_LOBBY]: "true" } });
  };

  return (
    <div className="screen" data-game={game.id}>
      <TopBar
        title={game.displayName}
        onBack={onBack}
        actions={<RulesButton onClick={() => setRulesOpen(true)} />}
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
          {sharingConfigured && <p className="hint">Chacun veut jouer sur son téléphone ? Touche « Inviter » : tu partages un code et chaque invité tape son pseudo lui-même.</p>}
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
        {setupProblem && <p className="error bottom-info">{setupProblem}</p>}
        {sharingConfigured ? (
          <div className="buttons">
            <button className="btn outline" disabled={duplicates || badNumber || !!setupProblem} onClick={invite}>Inviter</button>
            <button className="btn" disabled={duplicates || badNumber || !!setupProblem} onClick={start}>Commencer</button>
          </div>
        ) : (
          <button className="btn" disabled={duplicates || badNumber || !!setupProblem} onClick={start}>Commencer la partie</button>
        )}
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------- Partie

export function MatchScreen({ match, game, onBack, onNewRound, onEditRound, onChange, onDelete, onReplay, readOnly, title, note, sharing, onShare, askWho, online, onClaim, entries, onHostEntries, taken, ended }: {
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
  onHostEntries?: (entries: Record<string, Entry>) => void;
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
  // Elle est aussi gardée dans le téléphone : si la page se recharge ou se ferme, la saisie déjà envoyée n'est pas perdue.
  const entryKey = `entry:${match.id}:${me ?? ""}`;
  const [myEntry, setMyEntryState] = useState<{ r: number; entry: Entry } | null>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(entryKey) ?? "null");
      return v && typeof v.r === "number" && typeof v.entry?.score === "string" ? v : null;
    } catch { return null; }
  });
  const setMyEntry = (v: { r: number; entry: Entry } | null) => {
    setMyEntryState(v);
    try { v ? localStorage.setItem(entryKey, JSON.stringify(v)) : localStorage.removeItem(entryKey); } catch { /* stockage indisponible */ }
  };
  useEffect(() => { if (myEntry && myEntry.r !== match.rounds.length) setMyEntry(null); }, [match.rounds.length, myEntry]); // eslint-disable-line react-hooks/exhaustive-deps
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
  // Partage actif : les scores se saisissent dans le panneau « scores » (un seul bouton Valider), pas besoin du bouton « Nouvelle manche ».
  const hostEntryShown = !readOnly && !!game.guestEntry?.(match) && !!sharing && !finished && !!onHostEntries;

  return (
    <div className="screen" data-game={game.id}>
      <TopBar
        title={title ?? game.displayName}
        onBack={onBack}
        actions={(
          <>
            <RulesButton onClick={() => setRulesOpen(true)} />
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
                {lead && <span className="crown-slot" aria-hidden={p.id !== lead}>{p.id === lead && <Crown />}</span>}
                <span className="name">
                  {online && (() => {
                    // Point vert qui respire = connecté ; point vide = déconnecté depuis peu ; rien = personne n'est associé à ce joueur.
                    const state = online.includes(p.id) ? "on" : recent.includes(p.id) ? "recent" : null;
                    return state && <span className={`dot ${state}`} role="img" aria-label={state === "on" ? "connecté" : "déconnecté depuis peu"} />;
                  })()}
                  <span className="name-text">{p.name}</span>
                </span>
                <Score value={totals[p.id] ?? 0} big leader={p.id === lead} />
              </>
            )}
          </PlayerGrid>
        </div>
        {note}
        <div className="board-info">
        {sharing && (
          <p className="hint share-note">
            Partage actif · code {sharing.code} · {sharing.viewers} appareil{sharing.viewers > 1 ? "s" : ""} connecté{sharing.viewers > 1 ? "s" : ""}
          </p>
        )}
        {status && <p className="status">{status}</p>}
        {(me !== undefined && me !== null) && (
          <p className="hint me-note">
            <span>Tu joues : <strong>{pendingName ?? myName}</strong></span>
            <button onClick={() => setRenameOpen(true)}>changer mon nom</button>
            <button onClick={() => setPickerOpen(true)}>ce n'est pas moi</button>
          </p>
        )}
        </div>
        {readOnly && game.guestEntry?.(match) && me && !finished && !ended && (
          <GuestEntryCard
            match={match} game={game} meId={me} entries={entries ?? {}} mine={myEntry?.entry ?? null}
            onSubmit={(entry) => setMyEntry({ r: match.rounds.length, entry })} onWithdraw={() => setMyEntry(null)}
          />
        )}
        {hostEntryShown && (
          <HostEntryPanel match={match} game={game} entries={entries ?? {}} online={online ?? null} onEntries={onHostEntries} />
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
          <p className="hint empty">{game.id === "rail" ? "Pas encore de décompte." : "Aucune manche pour l'instant."}{!readOnly && !hostEntryShown && <><br />Appuie sur « {game.id === "rail" ? "Nouveau décompte" : "Nouvelle manche"} » pour commencer.</>}</p>
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

      {!readOnly && !quickSteps && !hostEntryShown && (game.canAddRound?.(match) ?? true) && <button className="fab" onClick={onNewRound}>{game.id === "rail" ? "+ Décompte final" : "+ Nouvelle manche"}</button>}

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

