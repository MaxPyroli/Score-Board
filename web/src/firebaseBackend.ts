import { initializeApp, type FirebaseOptions } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getDatabase, onDisconnect, onValue, ref, remove, serverTimestamp, set } from "firebase/database";
import type { Backend, Claim } from "./backend";

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
      let me: Promise<ReturnType<typeof ref>> | null = null;
      const getRef = () => (me ??= (async () => {
        const r = ref(db, `viewers/${code}/${await uid()}`);
        await onDisconnect(r).remove();
        return r;
      })());
      return {
        set(claim) {
          const value: { p: string; n?: string } = { p: claim.p };
          if (claim.n) value.n = claim.n;
          void getRef().then((r) => (stopped ? undefined : set(r, value))).catch(() => {});
        },
        stop() {
          stopped = true;
          void me?.then((r) => remove(r)).catch(() => {});
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
              claims.push({ uid: child.key as string, p: v.p, ...(typeof v.n === "string" ? { n: v.n } : {}) });
            }
          });
          cb(claims);
        }, () => {});
      });
    },
  };
}
