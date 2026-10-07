import type { Claim } from "./backend";

/** Une coupure plus courte que ça (réseau qui vacille, retour de veille) ne doit pas faire clignoter les pastilles « connecté ». */
export const PRESENCE_GRACE_MS = 6000;
/** Une connexion perdue n'est signalée qu'au bout de ce délai ; son retour, lui, est immédiat. */
export const CONNECTION_GRACE_MS = 3500;

/**
 * Lisse les signatures des appareils : une signature qui disparaît du serveur (déconnexion) reste affichée
 * `graceMs` millisecondes, le temps de voir si l'appareil revient aussitôt.
 */
export class ClaimsGrace {
  private seen = new Map<string, { claim: Claim; at: number }>();

  constructor(private graceMs = PRESENCE_GRACE_MS, private now: () => number = Date.now) {}

  /** Nouveau relevé du serveur : renvoie les signatures à afficher. */
  update(claims: Claim[]): Claim[] {
    const t = this.now();
    for (const c of claims) this.seen.set(c.uid, { claim: c, at: t });
    return this.current(new Set(claims.map((c) => c.uid)));
  }

  /** Signatures à afficher maintenant (les expirées sont oubliées). */
  current(live?: Set<string>): Claim[] {
    const t = this.now();
    const out: Claim[] = [];
    for (const [uid, e] of [...this.seen]) {
      if (live?.has(uid) || t - e.at < this.graceMs) out.push(e.claim);
      else this.seen.delete(uid);
    }
    return out;
  }

  /** Dans combien de ms la prochaine signature expire (`null` : aucune en sursis). */
  nextExpiryIn(live: Set<string>): number | null {
    const t = this.now();
    let min: number | null = null;
    for (const [uid, e] of this.seen) {
      if (live.has(uid)) continue;
      const left = this.graceMs - (t - e.at);
      if (left > 0 && (min === null || left < min)) min = left;
    }
    return min;
  }
}
