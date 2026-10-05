import { counterModule } from "./counter";

// Catalogue de jeux « compteur » : chacun a son nom, ses nombres de joueurs, son thème de couleur et son illustration,
// et se joue avec le comptage par manche (modèle commun du Compteur libre). Ajouter un jeu = une ligne ici.
// Les jeux qui ont des règles de décompte propres (Tarot, Skyjo, Rail, Sushi Go…) sont codés à part.

export interface CatalogGame {
  id: string;
  name: string;
  min: number;
  max: number;
  /** Courte description du jeu. */
  blurb: string;
  /** Le plus petit score gagne. */
  lowest?: boolean;
  /** Objectif de points habituel (modifiable à la création). */
  target?: string;
  /** Scores négatifs possibles. */
  negative?: boolean;
  /** Symbole de l'illustration. */
  emoji: string;
}

export const CATALOG: CatalogGame[] = [
  { id: "7wonders", name: "7 Wonders", min: 2, max: 7, blurb: "civilisations, cartes et merveilles", emoji: "🏛️" },
  { id: "agricola", name: "Agricola", min: 2, max: 5, blurb: "fermes, cultures et animaux", emoji: "🌾" },
  { id: "arknova", name: "Ark Nova", min: 2, max: 4, blurb: "zoo et conservation des espèces", emoji: "🦒" },
  { id: "azul", name: "Azul", min: 2, max: 4, blurb: "carreaux de faïence à poser", emoji: "🔷" },
  { id: "belote", name: "Belote", min: 2, max: 4, blurb: "jeu de cartes à la française", emoji: "🂡" },
  { id: "brass", name: "Brass : Birmingham", min: 2, max: 4, blurb: "révolution industrielle", emoji: "🏭" },
  { id: "carcassonne", name: "Carcassonne", min: 2, max: 5, blurb: "tuiles, chemins, villes et prés", emoji: "🏰" },
  { id: "cascadia", name: "Cascadia", min: 2, max: 4, blurb: "habitats et animaux du Nord-Ouest", emoji: "🐻" },
  { id: "catan", name: "Catan", min: 3, max: 6, blurb: "colonies, routes et commerce", target: "10", emoji: "🏘️" },
  { id: "cribbage", name: "Cribbage", min: 2, max: 4, blurb: "jeu de cartes avec planche à chevilles", target: "121", emoji: "📌" },
  { id: "coeurs", name: "Cœurs (Hearts)", min: 3, max: 6, blurb: "éviter les cœurs et la dame de pique", lowest: true, target: "100", emoji: "♥️" },
  { id: "dixit", name: "Dixit", min: 3, max: 6, blurb: "images et devinettes", target: "30", emoji: "🖼️" },
  { id: "dominion", name: "Dominion", min: 2, max: 4, blurb: "construction de deck", emoji: "👑" },
  { id: "dominos", name: "Dominos", min: 2, max: 4, blurb: "pose de dominos", emoji: "🁣" },
  { id: "everdell", name: "Everdell", min: 2, max: 4, blurb: "cité d'animaux dans la forêt", emoji: "🌳" },
  { id: "hanabi", name: "Hanabi", min: 2, max: 5, blurb: "feu d'artifice en coopération", emoji: "🎆" },
  { id: "jaipur", name: "Jaipur", min: 2, max: 2, blurb: "marchands et jetons de marchandises", emoji: "🐪" },
  { id: "kingdomino", name: "Kingdomino", min: 2, max: 4, blurb: "dominos et royaumes", emoji: "🏯" },
  { id: "lostcities", name: "Lost Cities", min: 2, max: 2, blurb: "expéditions à deux", emoji: "🧭" },
  { id: "loveletter", name: "Love Letter", min: 2, max: 6, blurb: "séduire la princesse", emoji: "💌" },
  { id: "millebornes", name: "Mille Bornes", min: 2, max: 6, blurb: "course automobile en cartes", target: "5000", emoji: "🚗" },
  { id: "papayoo", name: "Papayoo", min: 3, max: 8, blurb: "plis à éviter, le moins de points gagne", lowest: true, emoji: "🥭" },
  { id: "patchwork", name: "Patchwork", min: 2, max: 2, blurb: "couvertures et boutons", emoji: "🧵" },
  { id: "phase10", name: "Phase 10", min: 2, max: 6, blurb: "réaliser les dix phases, le moins de points gagne", lowest: true, emoji: "🔟" },
  { id: "qwirkle", name: "Qwirkle", min: 2, max: 4, blurb: "tuiles de formes et de couleurs", emoji: "🟪" },
  { id: "qwixx", name: "Qwixx", min: 2, max: 5, blurb: "dés et cases à cocher", emoji: "🎲" },
  { id: "rami", name: "Rami", min: 2, max: 6, blurb: "combinaisons de cartes, le moins de points gagne", lowest: true, emoji: "🃏" },
  { id: "root", name: "Root", min: 2, max: 4, blurb: "guerre asymétrique dans la forêt", emoji: "🦊" },
  { id: "rummikub", name: "Rummikub", min: 2, max: 4, blurb: "tuiles numérotées, points négatifs pour les perdants", negative: true, emoji: "🧮" },
  { id: "scrabble", name: "Scrabble", min: 2, max: 4, blurb: "mots et lettres", emoji: "🔤" },
  { id: "scythe", name: "Scythe", min: 2, max: 5, blurb: "conquête dans une Europe alternative", emoji: "⚙️" },
  { id: "splendor", name: "Splendor", min: 2, max: 4, blurb: "gemmes et cartes de développement", target: "15", emoji: "💎" },
  { id: "takenoko", name: "Takenoko", min: 2, max: 4, blurb: "panda, bambous et jardin", emoji: "🐼" },
  { id: "terraforming", name: "Terraforming Mars", min: 2, max: 5, blurb: "transformer la planète rouge", emoji: "🪐" },
  { id: "wingspan", name: "Wingspan", min: 2, max: 5, blurb: "oiseaux et habitats", emoji: "🐦" },
  { id: "wizard", name: "Wizard", min: 3, max: 6, blurb: "annoncer ses plis, points négatifs possibles", negative: true, emoji: "🧙" },
  { id: "uno", name: "Uno", min: 2, max: 10, blurb: "se débarrasser de ses cartes", target: "500", emoji: "🟥" },
  { id: "yams", name: "Yams", min: 2, max: 8, blurb: "dés et combinaisons", emoji: "🎯" },
];

export const catalogGame = (id: string): CatalogGame | undefined => CATALOG.find((g) => g.id === id);

export const catalogModule = (g: CatalogGame) => counterModule(g.id, g.name, g.min, g.max);

export const catalogTagline = (g: CatalogGame): string =>
  `${g.min === g.max ? `${g.min} joueurs` : `${g.min} à ${g.max} joueurs`} · ${g.blurb}`;

/** Teinte (0–360) du thème d'un jeu du catalogue : répartie sur le cercle des couleurs, de façon stable. */
const hueOf = (index: number) => (index * 47 + 12) % 360;

/** Thème de couleurs de chaque jeu du catalogue (même mécanisme que les thèmes des autres jeux, en CSS). */
export function catalogThemeCss(): string {
  const light = CATALOG.map((g, i) => {
    const h = hueOf(i);
    return `[data-game="${g.id}"] { --g1: hsl(${h} 58% 36%); --g2: hsl(${(h + 28) % 360} 55% 22%); --primary: hsl(${h} 62% 38%); --primary-soft: hsl(${h} 70% 92%); }`;
  });
  const dark = CATALOG.map((g, i) => {
    const h = hueOf(i);
    return `[data-game="${g.id}"] { --primary: hsl(${h} 85% 74%); --primary-soft: hsl(${h} 35% 20%); }`;
  });
  return `${light.join("\n")}\n@media (prefers-color-scheme: dark) {\n${dark.join("\n")}\n}`;
}

/** Ajoute les thèmes du catalogue à la page (une seule fois). */
export function installCatalogThemes(): void {
  if (typeof document === "undefined" || document.getElementById("catalog-themes")) return;
  const style = document.createElement("style");
  style.id = "catalog-themes";
  style.textContent = catalogThemeCss();
  document.head.appendChild(style);
}
