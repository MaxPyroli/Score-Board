import type { Unsubscribe } from "firebase/database";
import { firebaseConfig } from "./firebaseConfig";

/** Contenu d'une session partagée côté serveur : la partie en texte JSON (`null` = la session n'existe pas). */
export type Remote = { exists: false } | { exists: true; payload: string };

/** Ce dont le partage a besoin d'un serveur ; deux versions : Firebase, et une fausse pour les tests. */
export interface Backend {
  /** Publie (ou remplace) la session. `taken` : ce code appartient déjà à quelqu'un d'autre. */
  publish(code: string, payload: string): Promise<"ok" | "taken">;
  remove(code: string): Promise<void>;
  watch(code: string, onData: (r: Remote) => void, onConnection: (up: boolean) => void, onError: (e: unknown) => void): Unsubscribe;
  /** L'invité se signale (compté côté hôte) ; le retour le retire. */
  presence(code: string): Unsubscribe;
  countViewers(code: string, cb: (n: number) => void): Unsubscribe;
}

const FAKE = import.meta.env.VITE_FAKE_BACKEND === "1";

/** Le partage est-il relié à un serveur ? */
export const sharingConfigured = FAKE || firebaseConfig !== null;

let backend: Promise<Backend | null> | null = null;

export function getBackend(): Promise<Backend | null> {
  if (!backend) {
    const config = firebaseConfig;
    backend = FAKE
      ? import("./fakeBackend").then((m) => m.fakeBackend)
      : config
        ? import("./firebaseBackend").then((m) => m.createFirebaseBackend(config))
        : Promise.resolve(null);
  }
  return backend;
}
