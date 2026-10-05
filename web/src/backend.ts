import type { Unsubscribe } from "firebase/database";
import { firebaseConfig } from "./firebaseConfig";

/** Contenu d'une session partagée côté serveur : la partie en texte JSON (`null` = la session n'existe pas). */
export type Remote = { exists: false } | { exists: true; payload: string };

/**
 * Signature d'un appareil connecté à une session : le joueur qu'il représente (`p`, vide = il regarde seulement)
 * et, s'il vient de changer de nom, le nouveau nom demandé (`n`). Disparaît quand l'appareil se déconnecte.
 */
export interface Claim {
  uid: string;
  p: string;
  n?: string;
  /** Saisie de manche de cet appareil : numéro de la manche visée, score (texte, signe compris) et « j'ai terminé » (Skyjo). */
  r?: number;
  s?: string;
  f?: boolean;
}

/** Ce qu'un appareil déclare de lui-même (tout sauf l'identifiant, ajouté par le serveur). */
export type ClaimData = Omit<Claim, "uid">;

/** Ce dont le partage a besoin d'un serveur ; deux versions : Firebase, et une fausse pour les tests. */
export interface Backend {
  /** Publie (ou remplace) la session. `taken` : ce code appartient déjà à quelqu'un d'autre. */
  publish(code: string, payload: string): Promise<"ok" | "taken">;
  remove(code: string): Promise<void>;
  watch(code: string, onData: (r: Remote) => void, onConnection: (up: boolean) => void, onError: (e: unknown) => void): Unsubscribe;
  /** Identifiant anonyme de cet appareil. */
  uid(): Promise<string>;
  /** Cet appareil se signale (retiré automatiquement s'il se déconnecte) ; `set` remplace sa signature. */
  announce(code: string): { set(claim: ClaimData): void; stop(): void };
  /** Signatures de tous les appareils connectés à la session. */
  watchClaims(code: string, cb: (claims: Claim[]) => void): Unsubscribe;
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
