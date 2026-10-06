// Deux versions du site : la version publique (publiée à la fusion sur main) et la bêta (publiée à chaque envoi sur la
// branche de travail, dans le dossier /beta/). La bêta sert à tester avant de publier.
export const IS_BETA = import.meta.env.VITE_CHANNEL === "beta";

/** Adresse de la version publique (la bêta peut être sur un autre site). */
export const PUBLIC_URL: string = import.meta.env.VITE_PUBLIC_URL ?? "../";

const PREFIX = "beta:";

// Les deux versions sont sur le même site, donc partagent le stockage du navigateur : en bêta, chaque clé est préfixée
// pour ne jamais mélanger (ni abîmer) les parties et réglages de la version publique.
if (IS_BETA && typeof Storage !== "undefined") {
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
