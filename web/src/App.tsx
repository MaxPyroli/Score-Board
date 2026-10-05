import { useCallback, useEffect, useRef, useState } from "react";
import { matchWithRound, matchWithRoundReplaced, matchWithoutRound } from "./core";
import { gameById } from "./games/registry";
import { useMatches } from "./store";
import { HomeScreen, MatchScreen, NewMatchScreen } from "./ui/screens";
import { JoinScreen, ShareDialog } from "./ui/share";
import { codeFromHash, HostSession, SpectatorSession, type HostStatus, type JoinState } from "./session";

type Screen =
  | { kind: "home" }
  | { kind: "new"; gameId: string }
  | { kind: "match"; matchId: string }
  | { kind: "round"; matchId: string; index: number | null }
  | { kind: "join" };

/** Pile d'écrans reliée à l'historique du navigateur : le bouton « retour » du téléphone fonctionne. */
function useNav() {
  const [stack, setStack] = useState<Screen[]>([{ kind: "home" }]);

  useEffect(() => {
    history.replaceState({ depth: 0 }, "");
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

export default function App() {
  const { matches, save, remove } = useMatches();
  const nav = useNav();
  const { screen } = nav;

  // --- Partage (hôte) ---
  const hostRef = useRef<HostSession | null>(null);
  const [host, setHost] = useState<{ matchId: string; status: HostStatus; code: string; viewers: number } | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const startSharing = (matchId: string) => {
    const m = matches.find((x) => x.id === matchId);
    if (!m) return;
    hostRef.current?.stop();
    hostRef.current = new HostSession(m, (st) => setHost({ matchId, ...st }));
  };
  const stopSharing = () => { hostRef.current?.stop(); hostRef.current = null; setHost(null); };
  // Chaque modification de la partie partagée est renvoyée aux spectateurs ; partie supprimée = partage arrêté.
  useEffect(() => {
    if (!host) return;
    const m = matches.find((x) => x.id === host.matchId);
    if (m) hostRef.current?.update(m);
    else stopSharing();
  }, [matches]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => hostRef.current?.stop(), []);

  // --- Rejoindre (spectateur) ---
  const spectatorRef = useRef<SpectatorSession | null>(null);
  const [join, setJoin] = useState<JoinState>({ kind: "idle" });
  const [initialCode, setInitialCode] = useState<string | undefined>();
  const startJoin = (code: string) => {
    spectatorRef.current?.stop();
    spectatorRef.current = new SpectatorSession(code, setJoin);
  };
  const leaveJoin = useCallback(() => {
    spectatorRef.current?.stop();
    spectatorRef.current = null;
    setJoin({ kind: "idle" });
  }, []);
  useEffect(() => { if (screen.kind !== "join") leaveJoin(); }, [screen.kind, leaveJoin]);

  // Lien du QR code (#join=CODE) : ouvre directement l'écran « rejoindre ».
  const hashHandled = useRef(false);
  useEffect(() => {
    if (hashHandled.current) return;
    hashHandled.current = true;
    const code = codeFromHash(location.hash);
    if (!code) return;
    history.replaceState({ depth: 0 }, "", location.pathname + location.search);
    setInitialCode(code);
    nav.push({ kind: "join" });
    startJoin(code);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  if (screen.kind === "home")
    return (
      <HomeScreen
        matches={matches}
        onNew={(g) => nav.push({ kind: "new", gameId: g.id })}
        onOpen={(m) => nav.push({ kind: "match", matchId: m.id })}
        onDelete={(m) => { if (host?.matchId === m.id) stopSharing(); remove(m.id); }}
        onJoin={() => nav.push({ kind: "join" })}
      />
    );

  if (screen.kind === "join") {
    const live = join.kind === "live" ? join : null;
    const liveGame = live && gameById(live.match.moduleId);
    if (live && liveGame)
      return (
        <MatchScreen
          match={live.match} game={liveGame} readOnly title={`${liveGame.displayName} · lecture seule`}
          onBack={nav.back} onNewRound={() => {}} onEditRound={() => {}} onChange={() => {}} onDelete={() => {}}
          note={!live.connected && (
            <p className="note-lost">Connexion perdue : reconnexion automatique dès que la connexion revient.</p>
          )}
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
        onDelete={() => { nav.back(); if (host?.matchId === match.id) stopSharing(); remove(match.id); }}
        sharing={host?.matchId === match.id && host.status === "sharing" ? { code: host.code, viewers: host.viewers } : null}
        onShare={() => setShareOpen(true)}
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
      onSave={(raw) => { save(index === null ? matchWithRound(match, raw) : matchWithRoundReplaced(match, index, raw)); nav.back(); }}
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
