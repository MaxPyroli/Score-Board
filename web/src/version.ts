import { IS_BETA } from "./channel";

declare const __BUILD_COMMIT__: string;
declare const __BUILD_DATE__: string;

/** Numéro de version affiché : augmenté de 0.001 uniquement quand on ajoute des fonctionnalités (voir CLAUDE.md). */
export const APP_VERSION = "0.016";

export const CONTACT_URL = "https://github.com/MaxPyroli/Score-Board/issues";

// Identité Paname Dev (charte commune) : valeurs à utiliser telles quelles.
export const PUBLISHER = "Paname Dev";
export const CONTACT_EMAIL = "contact@panamedev.fr";
export const FIRST_YEAR = 2026;
const year = new Date().getFullYear();
export const COPYRIGHT = `© ${year > FIRST_YEAR ? `${FIRST_YEAR}–${year}` : FIRST_YEAR} ${PUBLISHER}`;
export const CREDIT = `Pensé par ${PUBLISHER} et codé par Claude`;
/** Dernière modification de la page de confidentialité (à changer à chaque modification du texte). */
export const PRIVACY_DATE = "28 octobre 2026";

const date = new Date(typeof __BUILD_DATE__ === "string" ? __BUILD_DATE__ : Date.now());

/** « v0.001 · build 233ea11 · 5 oct. 2026, 14:32 » */
export const versionLabel = `v${APP_VERSION}${IS_BETA ? " BÊTA" : ""} · build ${typeof __BUILD_COMMIT__ === "string" ? __BUILD_COMMIT__ : "dev"} · ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date)}`;
