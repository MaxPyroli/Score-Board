import { collect, decodeTransfer, encodeTransfer, mergeIncoming, TRANSFER_PREFIX } from "./transfer";

// Deux versions du site : la version publique (publiée à la fusion sur main) et la bêta (publiée à chaque envoi sur la
// branche de travail, dans le dossier /beta/). La bêta sert à tester avant de publier.
export const IS_BETA = import.meta.env.VITE_CHANNEL === "beta";

/** Adresse de la version publique (la bêta peut être sur un autre site). */
export const PUBLIC_URL: string = import.meta.env.VITE_PUBLIC_URL ?? "../";

const PREFIX = "beta:";

/** Adresse commune (charte Paname Dev) de cette version, ex. « beta.scoreboard.panamedev.fr », et redirection depuis les anciennes. */
const SITE_HOST: string = import.meta.env.VITE_SITE_HOST ?? "";
const REDIRECT = import.meta.env.VITE_REDIRECT_TO_SITE === "1";
/** On est sur l'adresse commune : origine à part, donc stockage non préfixé. */
const ON_SITE = !!SITE_HOST && typeof location !== "undefined" && location.hostname === SITE_HOST;

if (typeof window !== "undefined" && SITE_HOST) {
  const store = window.localStorage;
  const raw = (): Record<string, string> => Object.fromEntries(Array.from({ length: store.length }, (_, i) => store.key(i)!).map((k) => [k, store.getItem(k) ?? ""]));
  if (ON_SITE) {
    // Arrivée depuis l'ancienne adresse : on importe les parties emportées, puis on nettoie le lien.
    const incoming = decodeTransfer(location.hash);
    if (incoming) {
      try {
        const add = mergeIncoming(raw(), incoming);
        for (const [k, v] of Object.entries(add)) store.setItem(k, v);
      } catch { /* stockage indisponible : on garde l'arrivée sans les données */ }
      history.replaceState(history.state, "", location.pathname + location.search);
    }
  } else if (REDIRECT) {
    // Ancienne adresse : on part vers la nouvelle en emportant les parties (non supprimées ici, par sécurité).
    try {
      const data = collect(raw(), IS_BETA ? PREFIX : "");
      location.replace(`https://${SITE_HOST}/${Object.keys(data).length ? TRANSFER_PREFIX + encodeTransfer(data) : ""}`);
    } catch {
      location.replace(`https://${SITE_HOST}/`);
    }
  }
}

// Sur les anciennes adresses, les deux versions sont sur le même site, donc partagent le stockage du navigateur : en bêta, chaque clé est
// préfixée pour ne jamais mélanger (ni abîmer) les parties et réglages de la version publique. Sur l'adresse commune, plus besoin.
if (IS_BETA && !ON_SITE && typeof Storage !== "undefined") {
  const proto = Storage.prototype;
  const { getItem, setItem, removeItem } = proto;
  const mine = (s: Storage) => s === window.localStorage;
  proto.getItem = function (key: string) { return getItem.call(this, mine(this) ? PREFIX + key : key); };
  proto.setItem = function (key: string, value: string) { setItem.call(this, mine(this) ? PREFIX + key : key, value); };
  proto.removeItem = function (key: string) { removeItem.call(this, mine(this) ? PREFIX + key : key); };
}

if (IS_BETA && typeof document !== "undefined") {
  document.documentElement.dataset.channel = "beta";
  document.title = "Score Board BÊTA";
}
