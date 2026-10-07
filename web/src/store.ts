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

// ---------- Groupes de joueurs récents ----------

const GROUPS_KEY = "scoreboard.recentGroups";
const MAX_GROUPS = 6;

export function loadGroups(): string[][] {
  try {
    const v = JSON.parse(localStorage.getItem(GROUPS_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((g): g is string[] => Array.isArray(g) && g.every((n) => typeof n === "string")) : [];
  } catch {
    return [];
  }
}

/** Retient un groupe de joueurs (le plus récent d'abord, sans doublon, 6 au maximum). */
export function rememberGroup(names: string[]) {
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((n, i) => n.toLowerCase() === b[i].toLowerCase());
  const groups = [names, ...loadGroups().filter((g) => !same(g, names))].slice(0, MAX_GROUPS);
  try {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
  } catch { /* sans importance */ }
}

/** Oublie un groupe de joueurs récents (il n'est plus proposé à la création d'une partie). */
export function forgetGroup(names: string[]) {
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((n, i) => n.toLowerCase() === b[i].toLowerCase());
  try {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(loadGroups().filter((g) => !same(g, names))));
  } catch { /* sans importance */ }
}
