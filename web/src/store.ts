import { useCallback, useEffect, useState } from "react";
import type { StoredMatch } from "./core";

const KEY = "scoreboard.matches.v1";

function load(): StoredMatch[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(matches: StoredMatch[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(matches));
  } catch {
    // Stockage indisponible (navigation privée…) : l'appli reste utilisable en mémoire.
  }
}

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Parties de l'appareil, les plus récentes d'abord, enregistrées à chaque changement. */
export function useMatches() {
  const [matches, setMatches] = useState<StoredMatch[]>(load);

  useEffect(() => persist(matches), [matches]);

  // Garde plusieurs onglets synchronisés.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setMatches(load());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const save = useCallback((m: StoredMatch) => {
    setMatches((all) => (all.some((x) => x.id === m.id) ? all.map((x) => (x.id === m.id ? m : x)) : [m, ...all]));
  }, []);
  const remove = useCallback((id: string) => setMatches((all) => all.filter((x) => x.id !== id)), []);

  return { matches, save, remove };
}
