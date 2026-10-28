// Migration vers l'adresse commune (charte Paname Dev) : le stockage du navigateur est propre à chaque adresse, donc les parties
// d'une ancienne adresse ne suivent pas toutes seules. L'ancienne adresse emporte ses données dans le lien de redirection
// (#transfer=…), la nouvelle les importe sans jamais écraser ce qu'elle a déjà.

export const TRANSFER_PREFIX = "#transfer=";
const MATCHES_KEY = "scoreboard.matches.v1";
/** À ne pas emporter : état de navigation propre à l'ancienne adresse, ou données du faux serveur de test. */
const SKIP = (key: string) => key === "scoreboard.resume" || key.startsWith("fake:");

/** Clés de l'ancienne adresse (celles qui commencent par `prefix`, ou, sans préfixe, celles qui n'ont pas le préfixe bêta). */
export function collect(raw: Record<string, string>, prefix: string, betaPrefix = "beta:"): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const own = prefix ? k.startsWith(prefix) : !k.startsWith(betaPrefix);
    const key = prefix && own ? k.slice(prefix.length) : k;
    if (own && !SKIP(key)) out[key] = v;
  }
  return out;
}

const toB64 = (s: string) => btoa(unescape(encodeURIComponent(s)));
const fromB64 = (s: string) => decodeURIComponent(escape(atob(s)));

export const encodeTransfer = (data: Record<string, string>): string => toB64(JSON.stringify(data));

export function decodeTransfer(hash: string): Record<string, string> | null {
  if (!hash.startsWith(TRANSFER_PREFIX)) return null;
  try {
    const o = JSON.parse(fromB64(hash.slice(TRANSFER_PREFIX.length)));
    if (!o || typeof o !== "object") return null;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(o)) if (typeof v === "string" && k.length < 200 && v.length < 2_000_000) out[k] = v;
    return out;
  } catch {
    return null;
  }
}

/** Valeurs à écrire : les parties s'ajoutent à celles déjà présentes (par identifiant) ; les autres clés ne remplacent rien. */
export function mergeIncoming(existing: Record<string, string>, incoming: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(incoming)) {
    if (k === MATCHES_KEY) {
      try {
        const mine: { id: string }[] = JSON.parse(existing[k] ?? "[]");
        const theirs: { id: string }[] = JSON.parse(v);
        if (!Array.isArray(mine) || !Array.isArray(theirs)) continue;
        const ids = new Set(mine.map((m) => m.id));
        out[k] = JSON.stringify([...mine, ...theirs.filter((m) => m && typeof m.id === "string" && !ids.has(m.id))]);
      } catch { /* données illisibles : ignorées */ }
    } else if (!(k in existing)) {
      out[k] = v;
    }
  }
  return out;
}
