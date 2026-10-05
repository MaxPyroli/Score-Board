// Mémoire de « là où j'en étais » pour qu'actualiser la page (ou rouvrir le site) ramène au même endroit :
// partie ouverte, partage en cours côté hôte, partie rejointe côté invité. Expire après 12 h.
const KEY = "scoreboard.resume";
const TTL_MS = 12 * 60 * 60 * 1000;

export interface Resume {
  /** Écran à rouvrir : une partie, ou l'écran « rejoindre ». */
  view?: { kind: "match"; matchId: string } | { kind: "join" };
  /** Partage en cours côté hôte (le code est conservé pour que les invités restent connectés). */
  hosting?: { matchId: string; code: string };
  /** Partie suivie côté invité. */
  joined?: { code: string };
}

export function loadResume(): Resume {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (!raw || typeof raw.at !== "number" || Date.now() - raw.at > TTL_MS) return {};
    const { at: _at, ...rest } = raw;
    return rest as Resume;
  } catch {
    return {};
  }
}

/** Met à jour la mémoire ; une clé à `undefined` est effacée. */
export function patchResume(patch: Partial<Resume>) {
  try {
    const next: Record<string, unknown> = { ...loadResume(), ...patch, at: Date.now() };
    for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch { /* sans importance */ }
}
