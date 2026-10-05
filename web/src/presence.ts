import { useEffect, useRef, useState } from "react";

/** Durée pendant laquelle la place d'un joueur déconnecté reste réservée (« déconnecté depuis peu »). */
export const GRACE_MS = 5 * 60 * 1000;

/**
 * Met à jour la liste des départs récents : un joueur qui était connecté (autre appareil) et ne l'est plus est
 * noté « parti à telle heure » ; un joueur revenu est retiré. Fonction pure, testée.
 */
export function updateGone(gone: Record<string, number>, before: string[], now: string[], at: number): Record<string, number> {
  const next: Record<string, number> = { ...gone };
  for (const id of before) if (!now.includes(id) && next[id] === undefined) next[id] = at;
  for (const id of now) delete next[id];
  return next;
}

/** Joueurs partis depuis moins de `grace` ms. */
export const recentlyGone = (gone: Record<string, number>, at: number, grace = GRACE_MS): string[] =>
  Object.keys(gone).filter((id) => at - gone[id] < grace);

/**
 * Suit les départs vus depuis cet appareil. `connectedOthers` : joueurs actuellement représentés par un autre
 * appareil connecté. Renvoie ceux partis depuis peu (place encore réservée) ; au-delà, la place est libre.
 */
export function useRecentlyGone(connectedOthers: string[]): string[] {
  const previous = useRef<string[]>(connectedOthers);
  const [gone, setGone] = useState<Record<string, number>>({});
  const [, tick] = useState(0);
  const key = connectedOthers.join("|");
  useEffect(() => {
    setGone((g) => updateGone(g, previous.current, connectedOthers, Date.now()));
    previous.current = connectedOthers;
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  // Réévalue régulièrement pour que la réservation expire sans autre événement.
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 15000);
    return () => window.clearInterval(t);
  }, []);
  return recentlyGone(gone, Date.now()).filter((id) => !connectedOthers.includes(id));
}
