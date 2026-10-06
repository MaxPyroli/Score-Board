import type { ComponentType } from "react";
import {
  describeTarget, flag, leader, parseScore, plain, roundScores, SETTING_LOWEST_WINS, SETTING_TARGET, targetOf, totals,
  type GameModule, type Scores, type StoredMatch,
} from "../core";
import { tarotModule, summarize } from "./tarot";
import type { Entries } from "../guestEntry";
import { SKYJO_DEFAULT_TARGET, buildSkyjo, calculerSkyjo, skyjoModule, summarizeSkyjo } from "./skyjo";
import {
  COUNTER_MODES, FREE, SETTING_MODE, counterModule, adjustRound, SETTING_ROUNDS, SETTING_START, SIX_QUI_PREND, buildFree, changesOf, lowestWinsFor, modeOf,
  negateRound, startOf, type CounterMode, type FreeRound,
} from "./counter";
import { SushiSetup } from "../ui/SushiSetup";
import { CounterEditor, RailEditor, SkyjoEditor, SushiEditor, TarotEditor, WinnerEditor } from "../ui/editors";
import {
  SETTING_EDITION, SETTING_GLOBETROTTER, SETTING_LONGEST, SETTING_STATIONS, editionDefaults, editionOf, railModule,
} from "./rail";
import { assistantEnabled } from "../assistant";
import { ROUNDS_BEFORE_DESSERT, SETTING_ASSISTANT, SETUP_DEFAULTS, menuProblem, sushiModule } from "./sushi";

/** Réglages choisis à la création d'une partie (tous en texte : « true »/« false », nombres, choix). */
export type Values = Record<string, string>;

export interface GameOption {
  key: string;
  label: string;
  description: string;
  default: boolean;
  /** Affiché seulement si… (selon les autres réglages). */
  visibleWhen?: (v: Values) => boolean;
  /** Valeur par défaut qui dépend d'un choix (ex. l'édition) ; réappliquée quand ce choix change. */
  defaultFor?: (v: Values) => boolean | null;
}

export interface NumberOption {
  key: string;
  label: string;
  description: string;
  default: string | null;
  visibleWhen?: (v: Values) => boolean;
  /** Libellé qui dépend des autres réglages (ex. selon le mode). */
  labelFor?: (v: Values) => string;
  /** Valeur par défaut qui dépend des autres réglages ; réappliquée quand ils changent. */
  defaultFor?: (v: Values) => string | null;
}

/** Réglage à choix unique (ex. mode de comptage). */
export interface ChoiceOption {
  key: string;
  label: string;
  default: string;
  choices: { value: string; label: string; description: string }[];
}

/** Préparation de partie propre à un jeu (remplace les réglages génériques) : menu de Sushi Go Party !. */
export interface SetupProps {
  values: Values;
  /** Change plusieurs réglages à la fois. */
  setMany(patch: Values): void;
  players: number;
}
export interface GameSetup {
  /** Valeurs de départ ; toutes les clés sont enregistrées dans les réglages de la partie. */
  defaults(): Values;
  Component: ComponentType<SetupProps>;
  /** Raison pour laquelle la partie ne peut pas commencer, ou `null`. */
  problem(values: Values, players: number): string | null;
}

export interface EditorProps {
  match: StoredMatch;
  /** Index de la manche modifiée, `null` pour une nouvelle manche. */
  roundIndex: number | null;
  onSave(raw: string): void;
  onDelete?: () => void;
  onCancel(): void;
}

/** Saisie de la manche par les joueurs eux-mêmes (chacun son score), pour les jeux qui s'y prêtent. */
export interface GuestEntryConfig {
  /** Le joueur qui a terminé la manche doit être désigné (Skyjo). */
  finisher: boolean;
  allowNegative: boolean;
  /** Manche (texte JSON) construite à partir des saisies de tous les joueurs, ou erreur lisible. */
  build(match: StoredMatch, entries: Entries): { raw: string } | { error: string };
}

/** Tout ce que l'interface a besoin de savoir d'un jeu (écrans communs génériques). */
export interface GameDefinition {
  id: string;
  displayName: string;
  tagline: string;
  minPlayers: number;
  maxPlayers: number;
  options: GameOption[];
  numberOptions: NumberOption[];
  choiceOptions?: ChoiceOption[];
  setup?: GameSetup;
  /** Le jeu a des aides supplémentaires en mode assistant (repéré par un tampon sur l'accueil). */
  assistant?: boolean;
  /** Réglages imposés par le jeu à toute partie. */
  fixedSettings: Record<string, string>;
  totals(m: StoredMatch): Scores;
  roundScores(m: StoredMatch): Scores[];
  /** Petites pastilles à côté du score d'un joueur dans une manche (ex. « ×2 » au Skyjo) : identifiant du joueur → texte. */
  roundBadges?(m: StoredMatch, index: number): Record<string, string>;
  describeRound(m: StoredMatch, index: number): { headline: string; detail: string };
  status(m: StoredMatch): string | null;
  /** Le plus petit score gagne-t-il ? */
  lowestWins(m: StoredMatch): boolean;
  /** Joueur en tête (sens du jeu respecté), ou `null`. */
  leaderId(m: StoredMatch): string | null;
  /** Partie terminable ? (objectif atteint, dernière manche jouée, dernier en vie…) : l'appli propose alors de la terminer. */
  canFinish(m: StoredMatch): boolean;
  /** Boutons de variation directe (+1, −1…) sur chaque joueur, à la place de « Nouvelle manche » ; `null` sinon. */
  quickSteps(m: StoredMatch): number[] | null;
  /** Peut-on ajouter une manche ? (jeux à décompte unique : non, une fois le décompte fait). Par défaut oui. */
  canAddRound?(m: StoredMatch): boolean;
  /** Manche (texte) correspondant à une variation directe d'un joueur (boutons +1, −1…). */
  encodeAdjust?(m: StoredMatch, playerId: string, delta: number): string;
  /** Présent si les joueurs peuvent saisir leur propre score dans cette partie (Tarot : hôte seulement). */
  guestEntry?(m: StoredMatch): GuestEntryConfig | undefined;
  Editor: ComponentType<EditorProps>;
}

const targetOption = (def: string | null, endAt = false): NumberOption => ({
  key: SETTING_TARGET,
  label: endAt ? "La partie s'arrête à (têtes de bœuf)" : "Objectif de points (facultatif)",
  description: endAt ? "Quand un joueur atteint ou dépasse ce total, la partie est terminée." : "Un message s'affiche quand un joueur l'atteint.",
  default: def,
});

const nameMap = (m: StoredMatch) => (id: string) => m.players.find((p) => p.id === id)?.name ?? id;

function counterGame(
  module: GameModule<any>, tagline: string, lowestWins: boolean | null, defaultTarget: string | null,
  allowNegative: boolean, endAt = false,
): GameDefinition {
  const lowest = (m: StoredMatch) => flag(m, SETTING_LOWEST_WINS);
  return {
    id: module.id, displayName: module.displayName, tagline, minPlayers: module.minPlayers, maxPlayers: module.maxPlayers,
    options: lowestWins === null
      ? [{ key: SETTING_LOWEST_WINS, label: "Le plus petit score gagne", description: "À activer pour les jeux où il faut marquer le moins de points.", default: false }]
      : [],
    numberOptions: [targetOption(defaultTarget, endAt)],
    fixedSettings: lowestWins === null ? {} : { [SETTING_LOWEST_WINS]: String(lowestWins) },
    totals: (m) => totals(module, m),
    roundScores: (m) => roundScores(module, m),
    describeRound: () => ({ headline: "", detail: "" }),
    status: (m) => describeTarget(m.players, totals(module, m), targetOf(m), lowest(m), endAt),
    lowestWins: lowest,
    canFinish: (m) => targetReached(m, totals(module, m)),
    quickSteps: () => null,
    leaderId: (m) => leader(m.players, totals(module, m), lowest(m))?.id ?? null,
    guestEntry: () => pointsEntry(module, allowNegative, false),
    Editor: (props) => <CounterEditor {...props} module={module} allowNegative={allowNegative} />,
  };
}

const targetReached = (m: StoredMatch, t: Scores): boolean => {
  const target = targetOf(m);
  return target !== null && m.players.some((p) => (t[p.id] ?? 0) >= target);
};

/** Saisie par les joueurs de leur score de manche (compteurs) ; `negate` : décompte, les points sont retirés. */
function pointsEntry(module: GameModule<FreeRound>, allowNegative: boolean, negate: boolean): GuestEntryConfig {
  return {
    finisher: false,
    allowNegative,
    build(m, entries) {
      const ids = m.players.map((p) => p.id);
      const r = buildFree({ players: ids, texts: Object.fromEntries(ids.map((id) => [id, entries[id].score])), negatives: [] }, nameMap(m), allowNegative);
      return r.round ? { raw: module.encodeRound(negate ? negateRound(r.round) : r.round) } : { error: r.error ?? "Saisie invalide." };
    },
  };
}

const plural = (n: number, one: string, many: string) => (Math.abs(n) > 1 ? many : one);

/** Compteur libre : plusieurs modes de comptage (points par manche, manches gagnées, compteur direct, vies, décompte). */
function freeCounterGame(): GameDefinition {
  const mod = FREE;
  const mode = (m: StoredMatch): CounterMode => modeOf(m.settings);
  const inModes = (...modes: CounterMode[]) => (v: Values) => modes.includes(modeOf(v));
  const totalsOf = (m: StoredMatch): Scores => {
    const start = startOf(m.settings);
    const base = totals(mod, m);
    return start === 0 ? base : Object.fromEntries(Object.entries(base).map(([id, v]) => [id, v + start]));
  };
  const lowest = (m: StoredMatch) => lowestWinsFor(m.settings);
  const roundsLimit = (m: StoredMatch) => {
    const n = m.settings[SETTING_ROUNDS] === undefined ? null : parseScore(m.settings[SETTING_ROUNDS]);
    return n !== null && n > 0 ? Math.floor(n) : null;
  };
  const alive = (m: StoredMatch) => m.players.filter((p) => (totalsOf(m)[p.id] ?? 0) > 0);
  const names = (list: { name: string }[]) => list.map((p) => p.name).join(", ");

  const status = (m: StoredMatch): string | null => {
    const t = totalsOf(m);
    switch (mode(m)) {
      case "wins": {
        const target = targetOf(m);
        if (target === null) return null;
        const done = m.players.filter((p) => (t[p.id] ?? 0) >= target);
        return done.length === 0 ? `Premier à ${plain(target)} manche${target > 1 ? "s" : ""} gagnée${target > 1 ? "s" : ""}`
          : `${names(done)} ${done.length > 1 ? "ont" : "a"} gagné ${plain(target)} manche${target > 1 ? "s" : ""} !`;
      }
      case "lives": {
        if (m.rounds.length === 0) return `${plain(startOf(m.settings))} vie${startOf(m.settings) > 1 ? "s" : ""} pour chacun`;
        const left = alive(m);
        if (left.length === 1 && m.players.length > 1) return `Dernier en vie : ${left[0].name}`;
        if (left.length === 0) return "Tout le monde est éliminé.";
        const out = m.players.filter((p) => !left.includes(p));
        return out.length ? `Éliminé${out.length > 1 ? "s" : ""} : ${names(out)}` : null;
      }
      case "countdown": {
        const done = m.players.filter((p) => (t[p.id] ?? 0) <= 0);
        return done.length ? `${names(done)} ${done.length > 1 ? "ont" : "a"} atteint 0 !` : `Descendre de ${plain(startOf(m.settings))} à 0`;
      }
      default: {
        const limit = roundsLimit(m);
        const parts: string[] = [];
        const target = describeTarget(m.players, t, targetOf(m), lowest(m));
        if (target) parts.push(target);
        if (limit) parts.push(m.rounds.length >= limit ? `Les ${limit} manches sont jouées.` : `Manche ${m.rounds.length + 1} sur ${limit}`);
        return parts.length ? parts.join(" · ") : null;
      }
    }
  };

  const canFinish = (m: StoredMatch): boolean => {
    const t = totalsOf(m);
    switch (mode(m)) {
      case "lives": return m.rounds.length > 0 && alive(m).length <= 1 && m.players.length > 1;
      case "countdown": return m.players.some((p) => (t[p.id] ?? 0) <= 0);
      case "points": { const l = roundsLimit(m); return targetReached(m, t) || (l !== null && m.rounds.length >= l); }
      default: return targetReached(m, t);
    }
  };

  return {
    id: mod.id, displayName: mod.displayName,
    tagline: "2 à 20 joueurs · points par manche, manches gagnées, compteur direct, vies, décompte",
    minPlayers: mod.minPlayers, maxPlayers: mod.maxPlayers,
    choiceOptions: [{
      key: SETTING_MODE, label: "Mode de comptage", default: "points",
      choices: COUNTER_MODES.map((c) => ({ value: c.id, label: c.label, description: c.description })),
    }],
    options: [{
      key: SETTING_LOWEST_WINS, label: "Le plus petit score gagne", description: "À activer pour les jeux où il faut marquer le moins de points.",
      default: false, visibleWhen: inModes("points", "live"),
    }],
    numberOptions: [
      {
        key: SETTING_TARGET, label: "Objectif de points (facultatif)", description: "Un message s'affiche quand un joueur l'atteint.", default: null,
        visibleWhen: inModes("points", "live", "wins"),
        labelFor: (v) => (modeOf(v) === "wins" ? "Manches à gagner (facultatif)" : "Objectif de points (facultatif)"),
      },
      {
        key: SETTING_ROUNDS, label: "Nombre de manches (facultatif)", description: "Un message s'affiche quand la dernière manche est jouée.", default: null,
        visibleWhen: inModes("points"),
      },
      {
        key: SETTING_START, label: "Total de départ", description: "Valeur de départ de chaque joueur.", default: null,
        visibleWhen: inModes("lives", "countdown"),
        labelFor: (v) => (modeOf(v) === "lives" ? "Vies au départ" : "Total de départ"),
        defaultFor: (v) => (modeOf(v) === "lives" ? "3" : modeOf(v) === "countdown" ? "301" : null),
      },
    ],
    fixedSettings: {},
    totals: totalsOf,
    roundScores: (m) => roundScores(mod, m),
    describeRound(m, i) {
      const round = mod.decodeRound(m.rounds[i]);
      const ids = m.players.map((p) => p.id);
      const name = nameMap(m);
      if (mode(m) === "wins") {
        const winners = changesOf(round, ids).map((c) => name(c.id));
        return { headline: winners.length ? `${winners.join(" et ")} ${winners.length > 1 ? "ont" : "a"} gagné la manche` : "Manche sans gagnant", detail: "" };
      }
      if (mode(m) === "live" || mode(m) === "lives") {
        const changes = changesOf(round, ids);
        const text = changes.map((c) => {
          const sign = c.delta > 0 ? "+" : "−";
          return mode(m) === "lives" ? `${name(c.id)} ${sign}${plain(Math.abs(c.delta))} ${plural(c.delta, "vie", "vies")}` : `${name(c.id)} ${sign}${plain(Math.abs(c.delta))}`;
        });
        return { headline: text.join(" · "), detail: "" };
      }
      return { headline: "", detail: "" };
    },
    status,
    lowestWins: lowest,
    canFinish,
    quickSteps: (m) => (mode(m) === "live" ? [-5, -1, 1, 5] : mode(m) === "lives" ? [-1, 1] : null),
    encodeAdjust: (m, playerId, delta) => mod.encodeRound(adjustRound(m.players.map((p) => p.id), playerId, delta)),
    leaderId: (m) => leader(m.players, totalsOf(m), lowest(m))?.id ?? null,
    guestEntry(m) {
      const k = mode(m);
      return k === "points" ? pointsEntry(mod, true, false) : k === "countdown" ? pointsEntry(mod, false, true) : undefined;
    },
    Editor(props) {
      const k = mode(props.match);
      if (k === "wins") return <WinnerEditor {...props} module={mod} />;
      return <CounterEditor {...props} module={mod} allowNegative={k !== "countdown"} negate={k === "countdown"} />;
    },
  };
}

/** Les Aventuriers du Rail : un décompte final (une fiche par joueur) ; les bonus en jeu dépendent de l'édition. */
function railGame(): GameDefinition {
  const t = (m: StoredMatch) => totals(railModule, m);
  const bonusOption = (key: string, label: string, description: string, pick: (d: ReturnType<typeof editionDefaults>) => boolean): GameOption => ({
    key, label, description, default: pick(editionDefaults("base")),
    defaultFor: (v) => pick(editionDefaults(editionOf(v))),
  });
  return {
    id: railModule.id, displayName: railModule.displayName,
    tagline: "2 à 5 joueurs · routes, billets destination, plus long chemin, gares",
    minPlayers: railModule.minPlayers, maxPlayers: railModule.maxPlayers,
    choiceOptions: [{
      key: SETTING_EDITION, label: "Édition", default: "base",
      choices: [
        { value: "base", label: "USA, France et autres cartes", description: "Routes de 1 à 6 wagons, bonus du plus long chemin." },
        { value: "europe", label: "Europe", description: "Routes jusqu'à 8 wagons, gares non utilisées (+4 chacune) en plus." },
      ],
    }],
    options: [
      bonusOption(SETTING_LONGEST, "Bonus du plus long chemin (+10)", "À cocher si ton édition l'utilise ; en cas d'égalité, tous les ex æquo le reçoivent.", (d) => d.longest),
      bonusOption(SETTING_STATIONS, "Gares non utilisées (+4 chacune)", "Édition Europe : chaque gare restée dans la boîte rapporte 4 points.", (d) => d.stations),
      bonusOption(SETTING_GLOBETROTTER, "Bonus globe-trotter (+15)", "Selon l'édition ou l'extension : bonus pour le plus de billets destination réussis.", (d) => d.globetrotter),
    ],
    numberOptions: [], fixedSettings: {},
    totals: t,
    roundScores: (m) => roundScores(railModule, m),
    describeRound(m, i) {
      const round = railModule.decodeRound(m.rounds[i]);
      const names = m.players.filter((p) => round.sheets[p.id]?.longest).map((p) => p.name);
      return { headline: "Décompte final", detail: names.length ? `Plus long chemin : ${names.join(", ")}` : "" };
    },
    status: (m) => (m.rounds.length === 0 ? "Fais le décompte final : routes, billets, bonus." : null),
    lowestWins: () => false,
    canFinish: (m) => m.rounds.length > 0,
    canAddRound: (m) => m.rounds.length === 0,
    quickSteps: () => null,
    leaderId: (m) => leader(m.players, t(m), false)?.id ?? null,
    Editor: RailEditor,
  };
}

/** Sushi Go Party ! en mode assistant : trois manches, puis les desserts de toute la partie ; le menu choisi décide des cartes proposées. */
function sushiAssistantGame(): GameDefinition {
  const t = (m: StoredMatch) => totals(sushiModule, m);
  const done = (m: StoredMatch) => m.rounds.length;
  return {
    id: sushiModule.id, displayName: sushiModule.displayName,
    tagline: "2 à 8 joueurs · menu de ton choix, makis, flans et comparaisons calculés",
    minPlayers: sushiModule.minPlayers, maxPlayers: sushiModule.maxPlayers,
    options: [],
    numberOptions: [], fixedSettings: {},
    totals: t,
    roundScores: (m) => roundScores(sushiModule, m),
    describeRound(m, i) {
      const round = sushiModule.decodeRound(m.rounds[i]);
      return { headline: round.dessert ? "Desserts" : `Manche ${i + 1}`, detail: "" };
    },
    status: (m) => (done(m) < ROUNDS_BEFORE_DESSERT ? `Manche ${done(m) + 1} sur ${ROUNDS_BEFORE_DESSERT}` : done(m) === ROUNDS_BEFORE_DESSERT ? "Compte les desserts de toute la partie." : null),
    lowestWins: () => false,
    canFinish: (m) => done(m) > ROUNDS_BEFORE_DESSERT,
    canAddRound: (m) => done(m) <= ROUNDS_BEFORE_DESSERT,
    quickSteps: () => null,
    leaderId: (m) => leader(m.players, t(m), false)?.id ?? null,
    Editor: SushiEditor,
  };
}

const SUSHI_CLASSIC = counterModule("sushi", "Sushi Go Party !", 2, 8);
const isAssistantMatch = (m: StoredMatch) => m.settings[SETTING_ASSISTANT] === "true";

/**
 * Sushi Go Party ! : par défaut un compteur classique (un score par joueur et par manche) ; avec le mode assistant
 * (réglage de l'accueil, mémorisé dans la partie), le décompte carte par carte avec les menus.
 */
function sushiGame(): GameDefinition {
  const classic = { ...counterGame(SUSHI_CLASSIC, "", false, null, true), numberOptions: [] as NumberOption[] };
  const assistant = sushiAssistantGame();
  const pick = (m: StoredMatch) => (isAssistantMatch(m) ? assistant : classic);
  return {
    ...classic,
    tagline: "2 à 8 joueurs · points de chaque manche ; en mode assistant, menus et décompte carte par carte",
    assistant: true,
    setup: {
      defaults: () => ({ ...SETUP_DEFAULTS, [SETTING_ASSISTANT]: String(assistantEnabled()) }),
      Component: SushiSetup,
      problem: (v, players) => (assistantEnabled() ? menuProblem(v, players) : null),
    },
    totals: (m) => pick(m).totals(m),
    roundScores: (m) => pick(m).roundScores(m),
    describeRound: (m, i) => pick(m).describeRound(m, i),
    status: (m) => pick(m).status(m),
    lowestWins: (m) => pick(m).lowestWins(m),
    leaderId: (m) => pick(m).leaderId(m),
    canFinish: (m) => pick(m).canFinish(m),
    quickSteps: (m) => pick(m).quickSteps(m),
    canAddRound: (m) => pick(m).canAddRound?.(m) ?? true,
    guestEntry: (m) => pick(m).guestEntry?.(m),
    Editor: (props) => { const E = pick(props.match).Editor; return <E {...props} />; },
  };
}

function buildGames(): GameDefinition[] {
  const tarot: GameDefinition = {
    id: tarotModule.id, displayName: "Tarot", tagline: "3, 4 ou 5 joueurs · contrats, bouts, poignées, chelem",
    minPlayers: 3, maxPlayers: 5,
    options: [{ key: tarotModule.SETTING_DEMI_POINTS, label: "Utiliser les demi-points", description: "Points réalisés par pas de 0,5 au lieu de 1.", default: false }],
    numberOptions: [], fixedSettings: {},
    totals: (m) => totals(tarotModule, m),
    roundScores: (m) => roundScores(tarotModule, m),
    describeRound: (m, i) => summarize(tarotModule.decodeRound(m.rounds[i]), nameMap(m)),
    status: () => null,
    lowestWins: () => false,
    canFinish: () => false,
    quickSteps: () => null,
    leaderId: (m) => leader(m.players, totals(tarotModule, m), false)?.id ?? null,
    Editor: TarotEditor,
  };
  const skyjo: GameDefinition = {
    id: skyjoModule.id, displayName: "Skyjo",
    tagline: "2 à 8 joueurs · le plus petit score gagne, points doublés si on termine sans être le plus bas",
    minPlayers: 2, maxPlayers: 8, options: [], numberOptions: [targetOption(String(SKYJO_DEFAULT_TARGET))],
    fixedSettings: { [SETTING_LOWEST_WINS]: "true" },
    totals: (m) => totals(skyjoModule, m),
    roundScores: (m) => roundScores(skyjoModule, m),
    roundBadges: (m, i) => {
      const r = skyjoModule.decodeRound(m.rounds[i]);
      return calculerSkyjo(r).finisherDoubled ? { [r.finisherId]: "×2" } : {};
    },
    describeRound: (m, i) => summarizeSkyjo(skyjoModule.decodeRound(m.rounds[i]), nameMap(m)),
    status: (m) => describeTarget(m.players, totals(skyjoModule, m), targetOf(m), true),
    lowestWins: () => true,
    canFinish: (m) => targetReached(m, totals(skyjoModule, m)),
    quickSteps: () => null,
    leaderId: (m) => leader(m.players, totals(skyjoModule, m), true)?.id ?? null,
    guestEntry: () => ({
      finisher: true,
      allowNegative: true,
      build(m, entries) {
        const ids = m.players.map((p) => p.id);
        const finishers = ids.filter((id) => entries[id].finisher);
        if (finishers.length !== 1) {
          return { error: finishers.length === 0 ? "Personne n'a indiqué avoir terminé la manche." : "Plusieurs joueurs disent avoir terminé la manche." };
        }
        const r = buildSkyjo(
          { players: ids, texts: Object.fromEntries(ids.map((id) => [id, entries[id].score])), negatives: [], finisherId: finishers[0] },
          nameMap(m),
        );
        return r.round ? { raw: skyjoModule.encodeRound(r.round) } : { error: r.error ?? "Saisie invalide." };
      },
    }),
    Editor: SkyjoEditor,
  };
  return [
    tarot, skyjo, railGame(), sushiGame(),
    counterGame(SIX_QUI_PREND, "2 à 10 joueurs · têtes de bœuf additionnées, fin à 66, le plus petit score gagne", true, "66", false, true),
    freeCounterGame(),
  ];
}

export const GAMES: GameDefinition[] = buildGames();
export const gameById = (id: string) => GAMES.find((g) => g.id === id);
