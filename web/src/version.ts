declare const __BUILD_COMMIT__: string;
declare const __BUILD_DATE__: string;

/** Numéro de version affiché : augmenté de 0.001 uniquement quand on ajoute des fonctionnalités (voir CLAUDE.md). */
export const APP_VERSION = "0.006";

export const CONTACT_URL = "https://github.com/MaxPyroli/Score-Board/issues";

const date = new Date(typeof __BUILD_DATE__ === "string" ? __BUILD_DATE__ : Date.now());

/** « v0.001 · build 233ea11 · 5 oct. 2026, 14:32 » */
export const versionLabel = `v${APP_VERSION} · build ${typeof __BUILD_COMMIT__ === "string" ? __BUILD_COMMIT__ : "dev"} · ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date)}`;
