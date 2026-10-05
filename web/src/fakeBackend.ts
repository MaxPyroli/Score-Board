import type { Backend, Remote } from "./backend";

// Faux serveur pour les tests de navigateur (VITE_FAKE_BACKEND=1) : les pages d'un même navigateur
// se parlent via le localStorage. Jamais utilisé en production.
const KEY = (c: string) => `fake:session:${c}`;
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
  async uid() { return me; },
  announce(code) {
    const k = `fake:claim:${code}:${me}`;
    const bye = () => { localStorage.removeItem(k); window.dispatchEvent(new Event("storage")); };
    window.addEventListener("beforeunload", bye);
    return {
      set(claim) { localStorage.setItem(k, JSON.stringify(claim)); window.dispatchEvent(new Event("storage")); },
      stop() { bye(); window.removeEventListener("beforeunload", bye); },
    };
  },
  watchClaims(code, cb) {
    const prefix = `fake:claim:${code}:`;
    const read = () => cb(Object.keys(localStorage).filter((k) => k.startsWith(prefix)).map((k) => ({ uid: k.slice(prefix.length), ...JSON.parse(localStorage.getItem(k) ?? "{}") })));
    read();
    return listen(read);
  },
};
