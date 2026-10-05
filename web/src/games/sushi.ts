import type { GameModule, Scores } from "../core";

// Sushi Go Party ! : trois manches comptées une à une, puis les desserts comptés en fin de partie.
// Chaque joueur indique ce qu'il a devant lui (nombre de cartes de chaque sorte) ; l'appli calcule les points,
// y compris ceux qui dépendent d'une comparaison entre joueurs (makis, temakis, flans, sauce soja, edamame).
// Le menu choisi à la création de la partie décide des cartes proposées à la saisie.

export const SETTING_ROLL = "roll";
export const SETTING_DESSERT = "dessert";

export type Roll = "maki" | "temaki" | "california";
export type Dessert = "flan" | "icecream" | "fruit";

/** Cartes à cocher à la création (apéritifs et spéciaux qui rapportent des points). */
export interface MenuCard { key: string; label: string; description: string; default: boolean; kind: "apero" | "special" }
export const MENU_CARDS: MenuCard[] = [
  { key: "tempura", label: "Tempura", description: "2 cartes = 5 points.", default: true, kind: "apero" },
  { key: "sashimi", label: "Sashimi", description: "3 cartes = 10 points.", default: true, kind: "apero" },
  { key: "dumpling", label: "Gyoza", description: "1, 3, 6, 10, 15 points selon le nombre.", default: true, kind: "apero" },
  { key: "eel", label: "Anguille", description: "1 carte = −3 ; 2 cartes ou plus = 7.", default: false, kind: "apero" },
  { key: "tofu", label: "Tofu", description: "1 carte = 2 ; 2 cartes = 6 ; 3 ou plus = 0.", default: false, kind: "apero" },
  { key: "onigiri", label: "Onigiri", description: "1, 4, 9, 16 points selon le nombre de formes différentes.", default: false, kind: "apero" },
  { key: "edamame", label: "Edamame", description: "1 point par adversaire qui en a aussi (4 par carte au maximum). 3 à 8 joueurs.", default: false, kind: "apero" },
  { key: "miso", label: "Soupe miso", description: "3 points chacune (annulée si jouée en même temps qu'une autre).", default: false, kind: "apero" },
  { key: "wasabi", label: "Wasabi", description: "Triple la valeur du prochain sushi posé dessus.", default: true, kind: "special" },
  { key: "soy", label: "Sauce soja", description: "4 points par carte pour celui qui a le plus de couleurs différentes.", default: false, kind: "special" },
  { key: "tea", label: "Thé", description: "Chaque thé vaut 1 point par carte de la couleur choisie.", default: false, kind: "special" },
  { key: "chopsticks", label: "Baguettes", description: "Prendre 2 cartes au tour suivant ; ne rapporte rien (rien à saisir).", default: false, kind: "special" },
  { key: "menu", label: "Menu", description: "Piocher 4 cartes du paquet et en jouer une ; rien à saisir. 2 à 6 joueurs.", default: false, kind: "special" },
  { key: "spoon", label: "Cuillère", description: "Réclamer une carte à un adversaire ; rien à saisir. 3 à 8 joueurs.", default: false, kind: "special" },
  { key: "specialorder", label: "Commande spéciale", description: "Copie une carte déjà jouée : compte-la comme la carte copiée. 2 à 6 joueurs.", default: false, kind: "special" },
  { key: "takeout", label: "Boîte à emporter", description: "2 points par carte retournée.", default: false, kind: "special" },
];

export interface SushiConfig {
  roll: Roll;
  dessert: Dessert;
  /** Cartes cochées (clés de MENU_CARDS). */
  cards: Set<string>;
}

export function sushiConfig(settings: Record<string, string>): SushiConfig {
  const roll = (["maki", "temaki", "california"] as const).find((r) => r === settings[SETTING_ROLL]) ?? "maki";
  const dessert = (["flan", "icecream", "fruit"] as const).find((d) => d === settings[SETTING_DESSERT]) ?? "flan";
  const cards = new Set(MENU_CARDS.filter((c) => (settings[c.key] !== undefined ? settings[c.key] === "true" : c.default)).map((c) => c.key));
  return { roll, dessert, cards };
}

/** Points d'une manche pour chaque joueur : quantités par carte (clé du champ → nombre). */
export type SushiSheet = Record<string, number>;

export interface SushiRound {
  /** Vrai pour la dernière saisie (desserts de toute la partie), faux pour une manche. */
  dessert: boolean;
  /** Desserts : le menu contient les fruits (un joueur sans fruit perd alors 2 points par sorte). */
  fruit?: boolean;
  sheets: Record<string, SushiSheet>;
}

export const NIGIRI = [
  { key: "egg", on: "eggW", label: "Sushi omelette", points: 1 },
  { key: "salmon", on: "salmonW", label: "Sushi saumon", points: 2 },
  { key: "squid", on: "squidW", label: "Sushi calamar", points: 3 },
] as const;

export const DUMPLING_POINTS = [0, 1, 3, 6, 10, 15];
export const ONIGIRI_POINTS = [0, 1, 4, 9, 16];
export const FRUITS = [
  { key: "melon", label: "Pastèques" },
  { key: "orange", label: "Oranges" },
  { key: "pineapple", label: "Ananas" },
] as const;
export const FRUIT_POINTS = [-2, 0, 1, 3, 6, 10];

export interface SushiField {
  key: string;
  label: string;
  hint?: string;
  /** Valeur maximale acceptée. */
  max: number;
  /** Titre de la rubrique (carte) à laquelle le champ appartient. */
  group: string;
}

const MAX_COUNT = 99;

/** Champs proposés à la saisie, dans l'ordre d'affichage, selon le menu et le type de saisie. */
export function fieldsFor(config: SushiConfig, dessert: boolean): SushiField[] {
  const f: SushiField[] = [];
  const add = (key: string, label: string, group: string, hint?: string, max = MAX_COUNT) => f.push({ key, label, group, hint, max });
  if (dessert) {
    if (config.dessert === "flan") add("flan", "Flans (toute la partie)", "Flan");
    if (config.dessert === "icecream") add("icecream", "Glaces matcha (toute la partie)", "Glace matcha");
    if (config.dessert === "fruit") for (const fr of FRUITS) add(fr.key, `${fr.label} (symboles, toute la partie)`, "Fruits");
    return f;
  }
  for (const n of NIGIRI) {
    add(n.key, `${n.label} posés`, "Sushis");
    if (config.cards.has("wasabi")) add(n.on, "dont sur un wasabi", "Sushis", "Triplent leur valeur");
  }
  if (config.roll === "maki") add("maki", "Symboles de maki saumon", "Makis saumon");
  if (config.roll === "temaki") add("temaki", "Temakis", "Temaki");
  if (config.roll === "california") {
    add("californiaFirst", "1re place à 10 symboles (+8)", "California", "1 si le joueur a atteint 10 symboles en premier", 1);
    add("californiaSecond", "2e place à 10 symboles (+6)", "California", "1 s'il a atteint 10 symboles en deuxième", 1);
    add("california", "Symboles California encore devant lui", "California", "Le plus grand nombre gagne 2 points en fin de manche");
  }
  const has = (k: string) => config.cards.has(k);
  if (has("tempura")) add("tempura", "Tempuras", "Tempura");
  if (has("sashimi")) add("sashimi", "Sashimis", "Sashimi");
  if (has("dumpling")) add("dumpling", "Gyozas", "Gyoza");
  if (has("eel")) add("eel", "Anguilles", "Anguille");
  if (has("tofu")) add("tofu", "Tofus", "Tofu");
  if (has("onigiri")) for (const [i, s] of ["ronds", "triangles", "carrés", "rectangles"].entries()) add(`onigiri${i + 1}`, `Onigiri ${s}`, "Onigiri");
  if (has("edamame")) add("edamame", "Edamames", "Edamame");
  if (has("miso")) add("miso", "Soupes miso (comptées)", "Soupe miso", "Sans celles annulées");
  if (has("soy")) {
    add("soy", "Sauces soja", "Sauce soja");
    add("colors", "Couleurs différentes devant lui", "Sauce soja", "À indiquer par tous les joueurs, même sans sauce soja");
  }
  if (has("tea")) {
    add("tea", "Thés", "Thé");
    add("teaSet", "Cartes de la couleur choisie", "Thé", "La couleur la plus représentée devant lui");
  }
  if (has("takeout")) add("takeout", "Cartes retournées (2 points chacune)", "Boîte à emporter");
  return f;
}

const get = (s: SushiSheet | undefined, k: string) => Math.max(0, s?.[k] ?? 0);

/** Rang à « compétition » : égalité = même rang, le rang suivant saute ; chacun reçoit les points de sa place. */
function placePoints(ids: string[], value: (id: string) => number, awards: number[]): Record<string, number> {
  const out: Record<string, number> = {};
  const ranked = ids.filter((id) => value(id) > 0).sort((a, b) => value(b) - value(a));
  for (const id of ranked) out[id] = awards[ranked.findIndex((o) => value(o) === value(id))] ?? 0;
  return out;
}

/** Points de chaque joueur pour une saisie (manche ou desserts). */
export function scoreSushi(round: SushiRound): Scores {
  const ids = Object.keys(round.sheets);
  const n = ids.length;
  const total: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  const add = (id: string, pts: number) => { total[id] += pts; };
  const val = (id: string, k: string) => get(round.sheets[id], k);

  for (const id of ids) {
    for (const g of NIGIRI) {
      const all = val(id, g.key);
      const onWasabi = Math.min(all, val(id, g.on));
      add(id, (all - onWasabi) * g.points + onWasabi * g.points * 3);
    }
    add(id, Math.floor(val(id, "tempura") / 2) * 5);
    add(id, Math.floor(val(id, "sashimi") / 3) * 10);
    add(id, DUMPLING_POINTS[Math.min(5, val(id, "dumpling"))]);
    const eel = val(id, "eel");
    add(id, eel === 0 ? 0 : eel === 1 ? -3 : 7);
    const tofu = val(id, "tofu");
    add(id, tofu === 1 ? 2 : tofu === 2 ? 6 : 0);
    // Onigiri : on forme d'abord les plus grands ensembles de formes différentes.
    const shapes = [1, 2, 3, 4].map((i) => val(id, `onigiri${i}`)).sort((a, b) => b - a);
    for (let size = 1; size <= 4; size++) add(id, (shapes[size - 1] - (shapes[size] ?? 0)) * ONIGIRI_POINTS[size]);
    add(id, val(id, "miso") * 3);
    add(id, val(id, "takeout") * 2);
    add(id, val(id, "tea") * val(id, "teaSet"));
    add(id, val(id, "californiaFirst") * 8 + val(id, "californiaSecond") * 6);
    add(id, Math.floor(val(id, "icecream") / 4) * 12);
    if (round.fruit) for (const fr of FRUITS) add(id, FRUIT_POINTS[Math.min(5, val(id, fr.key))]);
    // Edamame : 1 point par adversaire qui en a aussi, 4 par carte au maximum.
    const edamame = val(id, "edamame");
    if (edamame > 0) add(id, edamame * Math.min(4, ids.filter((o) => o !== id && val(o, "edamame") > 0).length));
  }

  // Maki : le plus d'icônes 6 points, puis 3 ; à 6 joueurs ou plus 6, 4, 2 ; égalité : tous reçoivent les points de la place.
  const maki = placePoints(ids, (id) => val(id, "maki"), n >= 6 ? [6, 4, 2] : [6, 3]);
  for (const [id, pts] of Object.entries(maki)) add(id, pts);

  // California : le plus de symboles devant soi en fin de manche gagne 2 points (égalité : tous).
  for (const [id, pts] of Object.entries(placePoints(ids, (id) => val(id, "california"), [2]))) add(id, pts);
  // Temaki et flan : le plus reçoit le bonus, le moins le malus (pas de malus à deux joueurs). Égalité : tous les ex æquo
  // reçoivent les points complets (à égalité parfaite, bonus et malus se compensent).
  const mostAndFewest = (key: string, bonus: number, malus: number) => {
    const counts = ids.map((id) => val(id, key));
    const most = Math.max(...counts);
    const fewest = Math.min(...counts);
    if (most === 0) return; // carte absente du menu, ou personne n'en a
    for (const id of ids) {
      if (val(id, key) === most) add(id, bonus);
      if (n > 2 && val(id, key) === fewest) add(id, malus);
    }
  };
  mostAndFewest("temaki", 4, -4);
  mostAndFewest("flan", 6, -6);
  // Sauce soja : 4 points par carte pour qui a le plus de couleurs différentes (égalité : tous les ex æquo).
  const colors = ids.map((id) => val(id, "colors"));
  const bestColors = Math.max(0, ...colors);
  if (bestColors > 0) for (const id of ids) if (val(id, "colors") === bestColors) add(id, val(id, "soy") * 4);

  return total;
}

export function validateSheet(sheet: SushiSheet): void {
  for (const [k, v] of Object.entries(sheet)) {
    if (!Number.isInteger(v) || v < 0 || v > MAX_COUNT) throw new Error(`Valeur invalide : ${k}`);
  }
  for (const g of NIGIRI) if ((sheet[g.on] ?? 0) > (sheet[g.key] ?? 0)) throw new Error("Plus de sushis sur wasabi que de sushis");
  if ((sheet.californiaFirst ?? 0) > 1 || (sheet.californiaSecond ?? 0) > 1) throw new Error("Place de California invalide");
}

export const sushiModule: GameModule<SushiRound> = {
  id: "sushi",
  displayName: "Sushi Go Party !",
  minPlayers: 2,
  maxPlayers: 8,
  scoreRound: scoreSushi,
  encodeRound: (r) => JSON.stringify(r),
  decodeRound(raw) {
    const o = JSON.parse(raw);
    const sheets: Record<string, SushiSheet> = {};
    for (const [id, s] of Object.entries((o.sheets ?? {}) as Record<string, SushiSheet>)) {
      validateSheet(s);
      sheets[id] = s;
    }
    return { dessert: !!o.dessert, ...(o.fruit ? { fruit: true } : {}), sheets };
  },
};

/** Nombre de manches avant la saisie des desserts. */
export const ROUNDS_BEFORE_DESSERT = 3;

/** Saisie de l'écran : un texte par champ. */
export type SushiDraftSheet = Record<string, string>;

export const draftFromSheet = (s: SushiSheet | undefined): SushiDraftSheet =>
  Object.fromEntries(Object.entries(s ?? {}).filter(([, v]) => v > 0).map(([k, v]) => [k, String(v)]));

/** Construit la saisie : un champ vide compte 0 ; erreur en nommant le joueur et le champ. */
export function buildSushi(
  drafts: Record<string, SushiDraftSheet>, ids: string[], nameOf: (id: string) => string, fields: SushiField[], dessert: boolean,
): { round?: SushiRound; error?: string } {
  const sheets: Record<string, SushiSheet> = {};
  for (const id of ids) {
    const sheet: SushiSheet = {};
    for (const f of fields) {
      const t = (drafts[id]?.[f.key] ?? "").trim();
      if (t === "") continue;
      if (!/^\d+$/.test(t)) return { error: `${nameOf(id)} · ${f.label} : entre un nombre entier (0 ou plus).` };
      const v = Number(t);
      if (v > f.max) return { error: `${nameOf(id)} · ${f.label} : ${f.max} au maximum.` };
      if (v > 0) sheet[f.key] = v;
    }
    for (const g of NIGIRI) {
      if ((sheet[g.on] ?? 0) > (sheet[g.key] ?? 0)) return { error: `${nameOf(id)} · ${g.label} : pas plus de sushis sur wasabi que de sushis.` };
    }
    sheets[id] = sheet;
  }
  const fruit = dessert && fields.some((f) => f.key === FRUITS[0].key);
  return { round: { dessert, ...(fruit ? { fruit: true } : {}), sheets } };
}
