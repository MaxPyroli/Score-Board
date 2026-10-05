import type { ComponentType } from "react";
import {
  describeTarget, flag, leader, roundScores, SETTING_LOWEST_WINS, SETTING_TARGET, targetOf, totals,
  type GameModule, type Scores, type StoredMatch,
} from "../core";
import { tarotModule, summarize } from "./tarot";
import type { Entries } from "../guestEntry";
import { SKYJO_DEFAULT_TARGET, buildSkyjo, skyjoModule, summarizeSkyjo } from "./skyjo";
import { FREE, SIX_QUI_PREND, buildFree } from "./counter";
import { CounterEditor, SkyjoEditor, TarotEditor } from "../ui/editors";

export interface GameOption {
  key: string;
  label: string;
  description: string;
  default: boolean;
}

export interface NumberOption {
  key: string;
  label: string;
  description: string;
  default: string | null;
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
  /** Réglages imposés par le jeu à toute partie. */
  fixedSettings: Record<string, string>;
  totals(m: StoredMatch): Scores;
  roundScores(m: StoredMatch): Scores[];
  describeRound(m: StoredMatch, index: number): { headline: string; detail: string };
  status(m: StoredMatch): string | null;
  /** Le plus petit score gagne-t-il ? */
  lowestWins(m: StoredMatch): boolean;
  /** Joueur en tête (sens du jeu respecté), ou `null`. */
  leaderId(m: StoredMatch): string | null;
  /** Présent si les joueurs peuvent saisir leur propre score (Tarot : hôte seulement pour l'instant). */
  guestEntry?: GuestEntryConfig;
  Editor: ComponentType<EditorProps>;
}

const targetOption = (def: string | null): NumberOption => ({
  key: SETTING_TARGET,
  label: "Objectif de points (facultatif)",
  description: "Un message s'affiche quand un joueur l'atteint.",
  default: def,
});

const nameMap = (m: StoredMatch) => (id: string) => m.players.find((p) => p.id === id)?.name ?? id;

function counterGame(
  module: GameModule<any>, tagline: string, lowestWins: boolean | null, defaultTarget: string | null,
  allowNegative: boolean,
): GameDefinition {
  const lowest = (m: StoredMatch) => flag(m, SETTING_LOWEST_WINS);
  return {
    id: module.id, displayName: module.displayName, tagline, minPlayers: module.minPlayers, maxPlayers: module.maxPlayers,
    options: lowestWins === null
      ? [{ key: SETTING_LOWEST_WINS, label: "Le plus petit score gagne", description: "À activer pour les jeux où il faut marquer le moins de points.", default: false }]
      : [],
    numberOptions: [targetOption(defaultTarget)],
    fixedSettings: lowestWins === null ? {} : { [SETTING_LOWEST_WINS]: String(lowestWins) },
    totals: (m) => totals(module, m),
    roundScores: (m) => roundScores(module, m),
    describeRound: () => ({ headline: "", detail: "" }),
    status: (m) => describeTarget(m.players, totals(module, m), targetOf(m), lowest(m)),
    lowestWins: lowest,
    leaderId: (m) => leader(m.players, totals(module, m), lowest(m))?.id ?? null,
    guestEntry: {
      finisher: false,
      allowNegative,
      build(m, entries) {
        const ids = m.players.map((p) => p.id);
        const r = buildFree({ players: ids, texts: Object.fromEntries(ids.map((id) => [id, entries[id].score])), negatives: [] }, nameMap(m), allowNegative);
        return r.round ? { raw: module.encodeRound(r.round) } : { error: r.error ?? "Saisie invalide." };
      },
    },
    Editor: (props) => <CounterEditor {...props} module={module} allowNegative={allowNegative} />,
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
    describeRound: (m, i) => summarizeSkyjo(skyjoModule.decodeRound(m.rounds[i]), nameMap(m)),
    status: (m) => describeTarget(m.players, totals(skyjoModule, m), targetOf(m), true),
    lowestWins: () => true,
    leaderId: (m) => leader(m.players, totals(skyjoModule, m), true)?.id ?? null,
    guestEntry: {
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
    },
    Editor: SkyjoEditor,
  };
  return [
    tarot, skyjo,
    counterGame(SIX_QUI_PREND, "2 à 10 joueurs · têtes de bœuf additionnées, fin à 66, le plus petit score gagne", true, "66", false),
    counterGame(FREE, "2 à 6 joueurs · points saisis à la main, objectif facultatif", null, null, true),
  ];
}

export const GAMES: GameDefinition[] = buildGames();
export const gameById = (id: string) => GAMES.find((g) => g.id === id);
