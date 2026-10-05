import { useCallback, useEffect, useState } from "react";
import { matchWithRound, matchWithRoundReplaced, matchWithoutRound } from "./core";
import { gameById } from "./games/registry";
import { useMatches } from "./store";
import { HomeScreen, MatchScreen, NewMatchScreen } from "./ui/screens";

type Screen =
  | { kind: "home" }
  | { kind: "new"; gameId: string }
  | { kind: "match"; matchId: string }
  | { kind: "round"; matchId: string; index: number | null };

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

  if (screen.kind === "home")
    return (
      <HomeScreen
        matches={matches}
        onNew={(g) => nav.push({ kind: "new", gameId: g.id })}
        onOpen={(m) => nav.push({ kind: "match", matchId: m.id })}
        onDelete={(m) => remove(m.id)}
      />
    );

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
      <MatchScreen
        match={match}
        game={game}
        onBack={nav.back}
        onNewRound={() => nav.push({ kind: "round", matchId: match.id, index: null })}
        onEditRound={(i) => nav.push({ kind: "round", matchId: match.id, index: i })}
        onChange={save}
        onDelete={() => { nav.back(); remove(match.id); }}
      />
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
