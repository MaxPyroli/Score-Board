import type { FirebaseOptions } from "firebase/app";

/**
 * Configuration Firebase du partage en direct (publique par conception : la sécurité vient des règles
 * de la base, voir firebase/database.rules.json). `null` pour désactiver le partage ; le guide est dans docs/firebase.md.
 */
export const firebaseConfig: FirebaseOptions | null = {
  apiKey: "AIzaSyDl4mU1nsxwQ6f6cM3lL750s0lIeZxPaJ4",
  authDomain: "score-board-54f2b.firebaseapp.com",
  databaseURL: "https://score-board-54f2b-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "score-board-54f2b",
  storageBucket: "score-board-54f2b.firebasestorage.app",
  messagingSenderId: "56487610481",
  appId: "1:56487610481:web:546b2c4f5d0012f0b373d0",
};
