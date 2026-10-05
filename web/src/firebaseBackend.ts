import { initializeApp, type FirebaseOptions } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getDatabase, onDisconnect, onValue, ref, remove, serverTimestamp, set } from "firebase/database";
import type { Backend } from "./backend";

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

    presence(code) {
      return later(async () => {
        const me = ref(db, `viewers/${code}/${await uid()}`);
        await onDisconnect(me).remove();
        await set(me, true);
        return () => { void remove(me); };
      });
    },

    countViewers(code, cb) {
      return later(async () => {
        await uid();
        return onValue(viewers(code), (s) => cb(s.size), () => {});
      });
    },
  };
}
