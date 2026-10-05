import { initializeApp, type FirebaseOptions } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getDatabase, onDisconnect, onValue, ref, remove, serverTimestamp, set } from "firebase/database";
import type { Backend, Claim, ClaimData } from "./backend";

/** Partage via Firebase Realtime Database : connexion anonyme, une entrée par code. Règles : firebase/database.rules.json. */
export function createFirebaseBackend(config: FirebaseOptions): Backend {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getDatabase(app);

  const uid = async () => auth.currentUser?.uid ?? (await signInAnonymously(auth)).user.uid;
  const session = (code: string) => ref(db, `sessions/${code}`);
  const viewers = (code: string) => ref(db, `viewers/${code}`);

  /** Les écoutes démarrent après la connexion anonyme ; le retour peut être appelé avant. */
  const later = (start: () => Promise<() => void>): (() => void) => {
    let stop: (() => void) | null = null;
    let cancelled = false;
    start().then((s) => (cancelled ? s() : (stop = s)), () => {});
    return () => { cancelled = true; stop?.(); };
  };

  return {
    async publish(code, payload) {
      const owner = await uid();
      try {
        await set(session(code), { owner, updatedAt: serverTimestamp(), payload });
        return "ok";
      } catch (e) {
        if ((e as { code?: string }).code?.toUpperCase().includes("PERMISSION_DENIED")) return "taken";
        throw e;
      }
    },

    async remove(code) {
      await uid();
      await remove(session(code));
    },

    watch(code, onData, onConnection, onError) {
      return later(async () => {
        await uid();
        const offConn = onValue(ref(db, ".info/connected"), (s) => onConnection(s.val() === true));
        const offData = onValue(
          session(code),
          (s) => onData(s.exists() ? { exists: true, payload: String(s.val().payload ?? "") } : { exists: false }),
          onError,
        );
        return () => { offConn(); offData(); };
      });
    },

    uid,

    announce(code) {
      let stopped = false;
      let latest: ClaimData | null = null;
      const meRef = (async () => ref(db, `viewers/${code}/${await uid()}`))();
      const value = (claim: ClaimData): ClaimData => {
        const v: ClaimData = { p: claim.p };
        if (claim.n) v.n = claim.n;
        if (claim.r !== undefined) v.r = claim.r;
        if (claim.s !== undefined) v.s = claim.s;
        if (claim.f) v.f = true;
        return v;
      };
      const write = async () => {
        const r = await meRef;
        if (stopped || !latest) return;
        await onDisconnect(r).remove(); // retiré par le serveur si cet appareil se déconnecte
        await set(r, value(latest));
      };
      // À chaque (re)connexion — retour de veille, réseau revenu — on se signale de nouveau : pendant la coupure,
      // le serveur a retiré notre signature, et sans cela on resterait « déconnecté » alors qu'on est revenu.
      const offConn = later(async () => {
        await meRef;
        return onValue(ref(db, ".info/connected"), (s) => { if (s.val() === true) void write().catch(() => {}); });
      });
      return {
        set(claim) {
          latest = claim;
          void write().catch(() => {});
        },
        stop() {
          stopped = true;
          offConn();
          void meRef.then((r) => remove(r)).catch(() => {});
        },
      };
    },

    watchClaims(code, cb) {
      return later(async () => {
        await uid();
        return onValue(viewers(code), (s) => {
          const claims: Claim[] = [];
          s.forEach((child) => {
            const v = child.val();
            if (v && typeof v === "object" && typeof v.p === "string") {
              claims.push({
                uid: child.key as string,
                p: v.p,
                ...(typeof v.n === "string" ? { n: v.n } : {}),
                ...(typeof v.r === "number" ? { r: v.r } : {}),
                ...(typeof v.s === "string" ? { s: v.s } : {}),
                ...(v.f === true ? { f: true } : {}),
              });
            }
          });
          cb(claims);
        }, () => {});
      });
    },
  };
}
