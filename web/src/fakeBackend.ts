import type { Backend, Remote } from "./backend";

// Faux serveur pour les tests de navigateur (VITE_FAKE_BACKEND=1) : les pages d'un même navigateur
// se parlent via le localStorage. Jamais utilisé en production.
const KEY = (c: string) => `fake:session:${c}`;
const VIEW = (c: string, id: string) => `fake:viewers:${c}:${id}`;
const me = Math.random().toString(36).slice(2);

const read = (code: string): Remote => {
  const v = localStorage.getItem(KEY(code));
  return v === null ? { exists: false } : { exists: true, payload: v };
};

function listen(handler: () => void) {
  const f = () => handler();
  window.addEventListener("storage", f);
  return () => window.removeEventListener("storage", f);
}

export const fakeBackend: Backend = {
  async publish(code, payload) { localStorage.setItem(KEY(code), payload); return "ok"; },
  async remove(code) { localStorage.removeItem(KEY(code)); },
  watch(code, onData, onConnection) {
    onConnection(true);
    queueMicrotask(() => onData(read(code)));
    const off = listen(() => onData(read(code)));
    const onOnline = () => onConnection(navigator.onLine);
    window.addEventListener("online", onOnline); window.addEventListener("offline", onOnline);
    return () => { off(); window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOnline); };
  },
  presence(code) {
    localStorage.setItem(VIEW(code, me), "1");
    const bye = () => localStorage.removeItem(VIEW(code, me));
    window.addEventListener("beforeunload", bye);
    return () => { bye(); window.removeEventListener("beforeunload", bye); };
  },
  countViewers(code, cb) {
    const count = () => cb(Object.keys(localStorage).filter((k) => k.startsWith(`fake:viewers:${code}:`)).length);
    count();
    return listen(count);
  },
};
