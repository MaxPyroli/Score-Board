import { useCallback, useEffect, useRef, useState } from "react";
import { entriesFromClaims, takenPlayers, tryBuildRound, type Entry } from "./guestEntry";
import { SETTING_FINISHED, finishMatch, type StoredMatch, isFinished, matchWithRound, matchWithRoundReplaced, matchWithoutRound, renamePlayer } from "./core";
import { gameById } from "./games/registry";
import { newId, useMatches } from "./store";
import { loadResume, patchResume } from "./resume";
import { UpdateBanner, useAppUpdate } from "./pwa";
import { HistoryScreen, HomeScreen, MatchScreen, NewMatchScreen } from "./ui/screens";
import { JoinScreen, ShareDialog } from "./ui/share";
import type { ClaimData } from "./backend";
import { codeFromHash, HostSession, SpectatorSession, type HostInfo, type JoinState } from "./session";

type Screen =
  | { kind: "home" }
  | { kind: "new"; gameId: string }
  | { kind: "match"; matchId: string }
  | { kind: "round"; matchId: string; index: number | null }
  | { kind: "join" }
  | { kind: "history" };

/**
 * Après l'ajout d'une manche : si la partie devient terminable (objectif atteint, dernière manche jouée…), elle se termine toute seule
 * (écran « Partie terminée »). Seul le passage de « pas terminable » à « terminable » compte : après « Reprendre la partie »,
 * on peut continuer à jouer au-delà de l'objectif sans être arrêté à chaque manche.
 */
function endIfReached(before: StoredMatch, after: StoredMatch): StoredMatch {
  const game = gameById(after.moduleId);
  if (!game || isFinished(after) || after.rounds.length <= before.rounds.length) return after;
  return game.canFinish(after) && !game.canFinish(before) ? finishMatch(after) : after;
}

/** Pile d'écrans reliée à l'historique du navigateur : le bouton « retour » du téléphone fonctionne. */
function useNav(initial?: Screen) {
  const [stack, setStack] = useState<Screen[]>(() => (initial ? [{ kind: "home" }, initial] : [{ kind: "home" }]));

  useEffect(() => {
    // Après une actualisation, le navigateur garde son historique : on ne le recrée que s'il ne correspond pas.
    if ((history.state?.depth as number | undefined) !== stack.length - 1) {
      history.replaceState({ depth: 0 }, "");
      for (let i = 1; i < stack.length; i++) history.pushState({ depth: i }, "");
    }
    const onPop = (e: PopStateEvent) => {
      const depth = (e.state?.depth as number | undefined) ?? 0;
      setStack((s) => s.slice(0, depth + 1));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const push = useCallback((screen: Screen) => {
    setStack((s) => {
      history.pushState({ depth: s.length }, "");
      return [...s, screen];
    });
  }, []);
  const back = useCallback(() => history.back(), []);
  // Remplace l'écran courant (ex. création d'une partie → on ouvre la partie sans pouvoir revenir au formulaire).
  const replace = useCallback((screen: Screen) => setStack((s) => [...s.slice(0, -1), screen]), []);

  return { screen: stack[stack.length - 1], push, back, replace };
}

/** Écrans de l'appli. `onIdle` : vrai à l'accueil (aucune saisie en cours). */
function Screens({ onIdle }: { onIdle(idle: boolean): void }) {
  const { matches, save, remove } = useMatches();
  // Écran à rouvrir après une actualisation (calculé une seule fois, au démarrage).
  const [boot] = useState(() => {
    const resume = loadResume();
    const view = resume.view;
    const screen: Screen | undefined =
      view?.kind === "match" && matches.some((m) => m.id === view.matchId) ? { kind: "match", matchId: view.matchId }
      : view?.kind === "join" && resume.joined ? { kind: "join" }
      : undefined;
    return { resume, screen };
  });
  const nav = useNav(boot.screen);

  useEffect(() => onIdle(nav.screen.kind === "home"), [nav.screen.kind, onIdle]);
  const { screen } = nav;

  // --- Partage (hôte) ---
  const hostRef = useRef<HostSession | null>(null);
  const [host, setHost] = useState<(HostInfo & { matchId: string }) | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  // Joueur que l'hôte dit être : gardé ici car il peut être annoncé avant que le partage (re)démarre.
  const hostClaim = useRef<{ matchId: string; data: ClaimData } | null>(null);
  const startSharing = (matchId: string, resumeCode?: string) => {
    const m = matches.find((x) => x.id === matchId);
    if (!m) return;
    hostRef.current?.stop();
    hostRef.current = new HostSession(m, (st) => {
      setHost({ matchId, ...st });
      if (st.status === "sharing") patchResume({ hosting: { matchId, code: st.code } });
    }, resumeCode);
    const c = hostClaim.current;
    if (c && c.matchId === matchId) hostRef.current.claim(c.data);
  };
  const stopSharing = () => { hostRef.current?.stop(); hostRef.current = null; setHost(null); patchResume({ hosting: undefined }); };
  // Chaque modification de la partie partagée est renvoyée aux spectateurs ; partie supprimée = partage arrêté.
  useEffect(() => {
    if (!host) return;
    const m = matches.find((x) => x.id === host.matchId);
    if (m) hostRef.current?.update(m);
    else stopSharing();
  }, [matches]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => hostRef.current?.stop(), []);
  // Saisies tapées par l'hôte pour des joueurs sans l'appli (valables pour une seule manche).
  const [hostEntries, setHostEntries] = useState<{ matchId: string; round: number; entries: Record<string, Entry> } | null>(null);
  const addedRound = useRef<string>("");
  // Le garde-fou « une seule fois par manche » retombe dès que le nombre de manches change (ajout, annulation).
  const hostRounds = host ? matches.find((x) => x.id === host.matchId)?.rounds.length : undefined;
  useEffect(() => { addedRound.current = ""; }, [hostRounds]);
  // Dès que tous les joueurs ont saisi leur score, l'hôte (version de référence) ajoute la manche.
  useEffect(() => {
    if (!host || host.status !== "sharing") return;
    const m = matches.find((x) => x.id === host.matchId);
    const g = m && gameById(m.moduleId);
    if (!m || !g?.guestEntry?.(m) || m.settings[SETTING_FINISHED] === "true") return;
    const round = m.rounds.length;
    const mine = hostEntries && hostEntries.matchId === m.id && hostEntries.round === round ? hostEntries.entries : {};
    const attempt = tryBuildRound(g, m, { ...mine, ...entriesFromClaims(host.claims, m, round) });
    const key = `${m.id}:${round}`;
    if ("raw" in attempt && addedRound.current !== key) {
      addedRound.current = key; // une seule fois par manche, même si l'effet se redéclenche
      save(endIfReached(m, matchWithRound(m, attempt.raw)));
      setHostEntries(null);
    }
  }, [host?.claims, hostEntries, matches]); // eslint-disable-line react-hooks/exhaustive-deps
  // Un invité a changé de nom : l'hôte (version de référence) l'applique si le nom est valide.
  useEffect(() => {
    if (!host) return;
    const original = matches.find((x) => x.id === host.matchId);
    if (!original) return;
    let current = original;
    for (const c of host.claims) {
      const renamed = c.n && c.p ? renamePlayer(current, c.p, c.n) : null;
      if (renamed) current = renamed;
    }
    if (current !== original) save(current);
  }, [host?.claims]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Rejoindre (spectateur) ---
  const spectatorRef = useRef<SpectatorSession | null>(null);
  const [join, setJoin] = useState<JoinState>({ kind: "idle" });
  const [initialCode, setInitialCode] = useState<string | undefined>();
  const startJoin = (code: string) => {
    spectatorRef.current?.stop();
    spectatorRef.current = new SpectatorSession(code, setJoin);
    patchResume({ joined: { code } });
  };
  const leaveJoin = useCallback(() => {
    spectatorRef.current?.stop();
    spectatorRef.current = null;
    setJoin({ kind: "idle" });
    patchResume({ joined: undefined });
  }, []);
  useEffect(() => { if (screen.kind !== "join") leaveJoin(); }, [screen.kind, leaveJoin]);

  // Mémorise l'écran courant pour le rouvrir après une actualisation.
  useEffect(() => {
    patchResume({
      view: screen.kind === "match" || screen.kind === "round" ? { kind: "match", matchId: screen.matchId }
        : screen.kind === "join" ? { kind: "join" } : undefined,
    });
  }, [screen]);

  // Lien du QR code (#join=CODE) : ouvre directement l'écran « rejoindre », au chargement comme si le site est déjà ouvert.
  const openFromHash = useCallback(() => {
    const code = codeFromHash(location.hash);
    if (!code) return;
    history.replaceState(history.state, "", location.pathname + location.search);
    setInitialCode(code);
    nav.push({ kind: "join" });
    startJoin(code);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const hashHandled = useRef(false);
  useEffect(() => {
    if (!hashHandled.current) {
      hashHandled.current = true;
      openFromHash();
      // Actualisation : on reprend la partie suivie (invité) ou le partage en cours (hôte).
      if (!codeFromHash(location.hash) && boot.screen?.kind === "join" && boot.resume.joined) startJoin(boot.resume.joined.code);
      const h = boot.resume.hosting;
      if (h) startSharing(h.matchId, h.code);
    }
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [openFromHash]);

  if (screen.kind === "home")
    return (
      <HomeScreen
        matches={matches}
        onNew={(g) => nav.push({ kind: "new", gameId: g.id })}
        onOpen={(m) => nav.push({ kind: "match", matchId: m.id })}
        onDelete={(m) => { if (host?.matchId === m.id) stopSharing(); remove(m.id); }}
        onJoin={() => nav.push({ kind: "join" })}
        onHistory={() => nav.push({ kind: "history" })}
      />
    );

  if (screen.kind === "history")
    return (
      <HistoryScreen
        matches={matches}
        onOpen={(m) => nav.push({ kind: "match", matchId: m.id })}
        onDelete={(m) => { if (host?.matchId === m.id) stopSharing(); remove(m.id); }}
        onBack={nav.back}
      />
    );

  if (screen.kind === "join") {
    const live = join.kind === "live" ? join : null;
    const liveGame = live && gameById(live.match.moduleId);
    if (live && liveGame)
      return (
        <MatchScreen
          match={live.match} game={liveGame} readOnly askWho title={`${liveGame.displayName} · lecture seule`}
          online={live.online} onClaim={(d) => spectatorRef.current?.claim(d)} ended={live.ended}
          entries={entriesFromClaims(live.claims, live.match, live.match.rounds.length)}
          taken={takenPlayers(live.claims, live.myUid)}
          onBack={nav.back} onNewRound={() => {}} onEditRound={() => {}} onChange={() => {}} onDelete={() => {}}
          note={live.ended
            ? <p className="note-lost">L'hôte a arrêté le partage : voici la dernière version.</p>
            : !live.connected && <p className="note-lost">Connexion perdue : reconnexion automatique dès que la connexion revient.</p>}
        />
      );
    return <JoinScreen state={join} onJoin={startJoin} onBack={nav.back} initialCode={initialCode} />;
  }

  if (screen.kind === "new") {
    const game = gameById(screen.gameId);
    if (!game) return null;
    return (
      <NewMatchScreen
        game={game}
        onBack={nav.back}
        onStart={(m) => { save(m); nav.replace({ kind: "match", matchId: m.id }); }}
      />
    );
  }

  const match = matches.find((m) => m.id === screen.matchId);
  const game = match && gameById(match.moduleId);
  if (!match || !game) return <Missing onBack={nav.back} />;

  if (screen.kind === "match")
    return (
      <>
      <MatchScreen
        match={match}
        game={game}
        onBack={nav.back}
        onNewRound={() => nav.push({ kind: "round", matchId: match.id, index: null })}
        onEditRound={(i) => nav.push({ kind: "round", matchId: match.id, index: i })}
        onChange={save}
        onReplay={() => {
          // Même jeu, mêmes joueurs et réglages ; la partie terminée reste dans l'historique.
          const settings = { ...match.settings };
          delete settings[SETTING_FINISHED];
          delete settings.pending;
          const m = { ...match, id: newId(), players: match.players.map((p) => ({ ...p, id: newId() })), rounds: [], settings, createdAt: Date.now() };
          save(m);
          nav.replace({ kind: "match", matchId: m.id });
        }}
        onDelete={() => { nav.back(); if (host?.matchId === match.id) stopSharing(); remove(match.id); }}
        sharing={host?.matchId === match.id && host.status === "sharing" ? { code: host.code, viewers: host.viewers } : null}
        onShare={() => setShareOpen(true)}
        online={host?.matchId === match.id && host.status === "sharing" ? host.online : null}
        onClaim={(d) => { hostClaim.current = { matchId: match.id, data: d }; hostRef.current?.claim(d); }}
        entries={(() => {
          const round = match.rounds.length;
          const mine = hostEntries && hostEntries.matchId === match.id && hostEntries.round === round ? hostEntries.entries : {};
          return { ...mine, ...entriesFromClaims(host?.matchId === match.id ? host.claims : [], match, round) };
        })()}
        taken={host?.matchId === match.id ? takenPlayers(host.claims, host.ownUid) : []}
        onHostEntry={(playerId, entry) =>
          setHostEntries((prev) => {
            const round = match.rounds.length;
            const base = prev && prev.matchId === match.id && prev.round === round ? prev.entries : {};
            return { matchId: match.id, round, entries: { ...base, [playerId]: entry } };
          })}
      />
      {shareOpen && (
        <ShareDialog
          host={host?.matchId === match.id ? host : null}
          onStart={() => startSharing(match.id)}
          onStop={() => { stopSharing(); setShareOpen(false); }}
          onClose={() => setShareOpen(false)}
        />
      )}
      </>
    );

  const index = screen.index;
  return (
    <game.Editor
      match={match}
      roundIndex={index}
      onSave={(raw) => { save(index === null ? endIfReached(match, matchWithRound(match, raw)) : matchWithRoundReplaced(match, index, raw)); nav.back(); }}
      onDelete={index === null ? undefined : () => { save(matchWithoutRound(match, index)); nav.back(); }}
      onCancel={nav.back}
    />
  );
}

function Missing({ onBack }: { onBack(): void }) {
  return (
    <div className="screen">
      <main className="content">
        <p>Cette partie n'existe plus.</p>
        <button className="btn" onClick={onBack}>Retour</button>
      </main>
    </div>
  );
}

export default function App() {
  const update = useAppUpdate();
  return (
    <>
      <Screens onIdle={update.setIdle} />
      {update.ready && !update.applying && <UpdateBanner onApply={update.apply} />}
    </>
  );
}
