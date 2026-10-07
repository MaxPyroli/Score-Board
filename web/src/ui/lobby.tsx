import { useEffect, useState } from "react";
import { guestPlayerId, JOIN_REQUEST, lobbyProblem, MAX_NAME_LENGTH, startLobby, type StoredMatch } from "../core";
import type { GameDefinition } from "../games/registry";
import type { ClaimData } from "../backend";
import type { HostStatus } from "../session";
import { useMe } from "../me";
import { useRecentlyGone } from "../presence";
import { newId } from "../store";
import { Section, TopBar } from "./components";
import { SharePanel } from "./share";

const PSEUDO_KEY = "scoreboard.pseudo";

/** Pastille de connexion d'un joueur : vert qui respire = connecté, vide = déconnecté depuis peu, rien = pas d'appareil. */
const dot = (state: "on" | "recent" | null) =>
  state && <span className={`dot ${state}`} role="img" aria-label={state === "on" ? "connecté" : "déconnecté depuis peu"} />;

/** Côté hôte : la partie est créée, les invités la rejoignent avec leur pseudo, puis l'hôte la lance. */
export function LobbyScreen({ match, game, host, online, onChange, onStart, onBack, onDelete, onRetry }: {
  match: StoredMatch;
  game: GameDefinition;
  host: { status: HostStatus; code: string; viewers: number } | null;
  online: string[];
  onChange(m: StoredMatch): void;
  onStart(m: StoredMatch): void;
  onBack(): void;
  onDelete(): void;
  onRetry(): void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const recent = useRecentlyGone(online);
  const problem = lobbyProblem(match, game.minPlayers, game.maxPlayers);
  const rename = (id: string, name: string) => onChange({ ...match, players: match.players.map((p) => (p.id === id ? { ...p, name: name.slice(0, MAX_NAME_LENGTH) } : p)) });
  const remove = (id: string) => onChange({ ...match, players: match.players.filter((p) => p.id !== id) });
  const add = () => {
    const used = new Set(match.players.map((p) => p.name.toLowerCase()));
    let n = match.players.length + 1;
    while (used.has(`joueur ${n}`)) n++;
    onChange({ ...match, players: [...match.players, { id: newId(), name: `Joueur ${n}` }] });
  };

  return (
    <div className="screen" data-game={game.id}>
      <TopBar title={`${game.displayName} · salle d'attente`} onBack={onBack} />
      <main className="content">
        <Section title="Inviter">
          {host && host.status !== "error" ? (
            <SharePanel host={host} compact />
          ) : host?.status === "error" ? (
            <>
              <p className="error">Impossible de joindre le service de partage. Vérifie ta connexion internet.</p>
              <button className="btn outline" onClick={onRetry}>Réessayer</button>
            </>
          ) : <p className="hint">Connexion…</p>}
          <p className="hint">Chaque invité tape son pseudo sur son téléphone : il apparaît ici tout seul.</p>
        </Section>
        <Section title={`Joueurs · ${match.players.length}`}>
          <div className="lobby-list">
            {match.players.map((p, i) => {
              const guest = p.id.startsWith("g-");
              const state = online.includes(p.id) ? "on" : recent.includes(p.id) ? "recent" : null;
              return (
                <div key={p.id} className="lobby-row">
                  <span className="lobby-dot">{dot(state)}</span>
                  <input
                    className="field wide" value={p.name} maxLength={MAX_NAME_LENGTH} aria-label={`Nom du joueur ${i + 1}`}
                    onChange={(e) => rename(p.id, e.target.value)}
                  />
                  {guest && <span className="hint lobby-tag">invité</span>}
                  <button className="icon" aria-label={`Retirer ${p.name}`} disabled={match.players.length <= 1} onClick={() => remove(p.id)}>✕</button>
                </div>
              );
            })}
          </div>
          <p className="hint">Les places « Joueur N » encore vides seront prises par les invités. Retire avec ✕ celles dont tu n'as pas besoin.</p>
          {match.players.length < game.maxPlayers && <button className="btn outline" onClick={add}>+ Ajouter un joueur sans téléphone</button>}
        </Section>
        <button className="link danger" onClick={() => setConfirmDelete(true)}>Annuler cette partie</button>
        {confirmDelete && (
          <div className="scrim" role="dialog" aria-modal="true">
            <div className="dialog">
              <h2>Annuler la partie ?</h2>
              <p>Les invités déjà arrivés seront déconnectés.</p>
              <div className="buttons">
                <button className="btn outline" onClick={() => setConfirmDelete(false)}>Non</button>
                <button className="btn danger" onClick={onDelete}>Annuler la partie</button>
              </div>
            </div>
          </div>
        )}
      </main>
      <footer className="bottom">
        {problem && <p className="error bottom-info">{problem}</p>}
        <button className="btn" disabled={!!problem} onClick={() => onStart(startLobby(match))}>Commencer la partie</button>
      </footer>
    </div>
  );
}

/** Côté invité : il tape son pseudo, l'hôte lui crée sa place, puis il attend le début de la partie. */
export function GuestLobby({ match, game, myUid, online, connected, ended, onClaim, onBack }: {
  match: StoredMatch;
  game: GameDefinition;
  myUid: string;
  online: string[];
  connected: boolean;
  ended: boolean;
  onClaim(d: ClaimData): void;
  onBack(): void;
}) {
  const myId = myUid ? guestPlayerId(myUid) : "";
  const mine = match.players.find((p) => p.id === myId);
  const [, setMe] = useMe(match);
  const [pseudo, setPseudo] = useState(() => { try { return localStorage.getItem(PSEUDO_KEY) ?? ""; } catch { return ""; } });
  const [asked, setAsked] = useState(false);
  const clean = pseudo.trim().replace(/\s+/g, " ");
  const full = !mine && match.players.length >= game.maxPlayers && !match.players.some((p, i) => i > 0 && /^Joueur \d+$/.test(p.name) && !p.id.startsWith("g-"));

  // Dès que l'hôte a créé ma place : c'est moi (pour la suite de la partie) et je le signale.
  useEffect(() => { if (mine) { setMe(mine.id); onClaim({ p: mine.id }); } }, [mine?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = () => {
    if (!clean) return;
    try { localStorage.setItem(PSEUDO_KEY, clean); } catch { /* sans importance */ }
    setAsked(true);
    onClaim(mine ? { p: mine.id, n: clean } : { p: JOIN_REQUEST, n: clean });
  };

  return (
    <div className="screen" data-game={game.id}>
      <TopBar title={`${game.displayName} · salle d'attente`} onBack={onBack} />
      <main className="content">
        {ended && <p className="note-lost">L'hôte a arrêté le partage.</p>}
        {!ended && !connected && <p className="note-lost">Connexion perdue : reconnexion automatique dès que la connexion revient.</p>}
        <Section title={mine ? "Tu es dans la partie" : "Rejoindre la partie"}>
          {full && <p className="error">La partie est complète ({game.maxPlayers} joueurs).</p>}
          {!full && (
            <>
              <p className="hint">{mine ? `Tu joues sous le nom « ${mine.name} ». Tu peux le changer.` : "Tape ton pseudo : l'hôte te voit arriver tout de suite."}</p>
              <div className="lobby-row">
                <input
                  className="field wide" value={pseudo} maxLength={MAX_NAME_LENGTH} placeholder="Ton pseudo" aria-label="Ton pseudo" autoFocus={!mine}
                  onChange={(e) => setPseudo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                />
                <button className="btn" disabled={!clean || (!!mine && clean === mine.name)} onClick={send}>{mine ? "Changer" : "Rejoindre"}</button>
              </div>
              {asked && !mine && <p className="hint">Envoi à l'hôte…</p>}
            </>
          )}
        </Section>
        <Section title={`Joueurs · ${match.players.length}`}>
          <div className="lobby-list">
            {match.players.map((p) => (
              <div key={p.id} className={`lobby-row ${p.id === myId ? "me" : ""}`}>
                <span className="lobby-dot">{dot(online.includes(p.id) ? "on" : null)}</span>
                <strong>{p.name}</strong>
                {p.id === myId && <span className="hint">toi</span>}
              </div>
            ))}
          </div>
          {mine && <p className="hint">En attente que l'hôte lance la partie…</p>}
        </Section>
      </main>
    </div>
  );
}
