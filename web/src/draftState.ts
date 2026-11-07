import { useCallback, useState, type Dispatch, type SetStateAction } from "react";

// Brouillon d'une manche en cours de saisie : gardé sur l'appareil pour survivre à une actualisation de la page.
// Effacé dès qu'on enregistre ou qu'on quitte l'écran de saisie. Expire après 12 h.
const PREFIX = "scoreboard.draft.";
const TTL_MS = 12 * 60 * 60 * 1000;

export function draftScope(matchId: string, roundIndex: number | null): string {
  return `${PREFIX}${matchId}:${roundIndex ?? "new"}:`;
}

function read<T>(key: string): T | undefined {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? "null");
    if (!raw || typeof raw.at !== "number" || Date.now() - raw.at > TTL_MS) return undefined;
    return raw.v as T;
  } catch {
    return undefined;
  }
}

/** Comme `useState`, mais la valeur est conservée localement sous `scope + name`. */
export function useDraft<T>(scope: string, name: string, init: () => T): [T, Dispatch<SetStateAction<T>>] {
  const key = scope + name;
  const [value, setValue] = useState<T>(() => read<T>(key) ?? init());
  const set: Dispatch<SetStateAction<T>> = useCallback((u) => {
    setValue((prev) => {
      const next = typeof u === "function" ? (u as (p: T) => T)(prev) : u;
      try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), v: next })); } catch { /* sans importance */ }
      return next;
    });
  }, [key]);
  return [value, set];
}

/** Supprime tous les brouillons de cet écran de saisie. */
export function clearDrafts(scope: string) {
  try {
    for (const k of Object.keys(localStorage)) if (k.includes(scope)) localStorage.removeItem(k);
  } catch { /* sans importance */ }
}
