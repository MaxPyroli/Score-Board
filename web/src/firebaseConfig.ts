import type { FirebaseOptions } from "firebase/app";

/**
 * Configuration Firebase du partage en direct (publique par conception : la sécurité vient des règles
 * de la base, voir firebase/database.rules.json). `null` tant que le projet Firebase n'est pas relié ;
 * le guide est dans docs/firebase.md.
 */
export const firebaseConfig: FirebaseOptions | null = null;
