/**
 * Visuels des jeux. Chaque jeu a un fond par défaut dessiné pour l'appli (src/assets/games/defaults/<jeu>-bg.svg,
 * dans l'esprit du jeu : couleurs, motifs). Pour mettre ta propre image, dépose dans `src/assets/games/` :
 *  - `<jeu>-bg.jpg`   : visuel de fond (à droite, fondu vers la couleur du jeu côté titre) ;
 *  - `<jeu>-logo.png` : logo du jeu, posé à droite par-dessus le fond (le titre reste en texte).
 * `<jeu>` = tarot, skyjo, sixquiprend ou free ; formats acceptés : jpg, jpeg, png, webp, svg.
 * Tes fichiers remplacent les fonds par défaut.
 */
// Les options de import.meta.glob doivent être écrites en littéral (Vite les lit à la construction).
const custom = import.meta.glob("../assets/games/*.{jpg,jpeg,png,webp,svg}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;
const defaults = import.meta.glob("../assets/games/defaults/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const find = (files: Record<string, string>, marker: string): string | undefined => {
  const key = Object.keys(files).find((k) => k.includes(marker));
  return key ? files[key] : undefined;
};

/** Adresse d'un visuel, ou `undefined` s'il n'y en a pas pour ce jeu. */
export function gameImage(id: string, kind: "bg" | "logo"): string | undefined {
  const marker = `/${id}-${kind}.`;
  return find(custom, marker) ?? (kind === "bg" ? find(defaults, marker) : undefined);
}
