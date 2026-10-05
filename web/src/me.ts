import { useCallback, useState } from "react";
import type { StoredMatch } from "./core";

// « Qui suis-je ? » : le joueur de la partie que cet appareil représente (propre à chaque appareil).
// undefined = pas encore choisi ; null = « je regarde seulement ».
const key = (matchId: string) => `scoreboard.me.${matchId}`;

function load(match: StoredMatch): string | null | undefined {
  try {
    const raw = localStorage.getItem(key(match.id));
    if (raw === null) return undefined;
    if (raw === "") return null;
    return match.players.some((p) => p.id === raw) ? raw : undefined;
  } catch {
    return undefined;
  }
}

export function useMe(match: StoredMatch) {
  const [me, setMeState] = useState<string | null | undefined>(() => load(match));
  const setMe = useCallback((id: string | null) => {
    setMeState(id);
    try { localStorage.setItem(key(match.id), id ?? ""); } catch { /* sans importance */ }
  }, [match.id]);
  // Si les joueurs de la partie ont changé et que le choix n'existe plus, on redemande.
  const valid = me === undefined || me === null || match.players.some((p) => p.id === me);
  return [valid ? me : undefined, setMe] as const;
}
