/**
 * Visuels des jeux (facultatifs), détectés tout seuls d'après le nom du fichier dans `src/assets/games/` :
 *  - `<jeu>-bg.jpg`   : visuel de fond de la carte (à droite, fondu vers la couleur du jeu côté titre) ;
 *  - `<jeu>-logo.png` : logo du jeu, affiché à la place du titre en texte.
 * `<jeu>` = tarot, skyjo, sixquiprend ou free ; formats acceptés : jpg, jpeg, png, webp, svg.
 * Sans fichier, la carte garde son illustration par défaut.
 */
const files = import.meta.glob("../assets/games/*.{jpg,jpeg,png,webp,svg}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

/** Adresse d'un visuel, ou `undefined` s'il n'y en a pas pour ce jeu. */
export function gameImage(id: string, kind: "bg" | "logo"): string | undefined {
  const marker = `/${id}-${kind}.`;
  const key = Object.keys(files).find((k) => k.includes(marker));
  return key ? files[key] : undefined;
}
