import { CONTRACTS, POIGNEES, atoutsRequis, seuilRequis } from "./tarot";
import { COUNTER_MODES } from "./counter";
import { GLOBETROTTER_BONUS, LONGEST_BONUS, ROUTE_POINTS, STATION_VALUE } from "./rail";
import { SKYJO_DEFAULT_TARGET } from "./skyjo";
import { DUMPLING_POINTS, FRUIT_POINTS, ONIGIRI_POINTS } from "./sushi";

/** Règles d'un jeu : un résumé, puis des sections dépliables (texte, listes, tableaux). Rédigées pour l'appli. */
export interface RulesSection {
  id: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  table?: { head: string[]; rows: string[][] };
}

export interface RulesDoc {
  title: string;
  summary: string;
  sections: RulesSection[];
}

const tarot = (): RulesDoc => ({
  title: "Tarot",
  summary:
    "Jeu de 78 cartes à 3, 4 ou 5 joueurs. Le joueur qui a fait la plus haute enchère (le preneur) joue contre les autres " +
    "et doit atteindre un nombre de points qui dépend des bouts qu'il possède. À 5 joueurs, il s'associe en secret à un « appelé ».",
  sections: [
    {
      id: "bouts",
      title: "Les bouts et les points à faire",
      paragraphs: [
        "Les trois bouts sont le Petit (le 1 d'atout), le 21 d'atout et l'Excuse. Plus le preneur en a dans ses levées, moins il lui faut de points.",
        "Les 78 cartes valent 91 points au total : ce que l'attaque ne fait pas, la défense le marque.",
      ],
      table: {
        head: ["Bouts de l'attaque", "Points à faire"],
        rows: [0, 1, 2, 3].map((b) => [String(b), String(seuilRequis(b))]),
      },
    },
    {
      id: "contrats",
      title: "Les contrats",
      paragraphs: ["Le contrat annoncé multiplie le score de la manche."],
      table: {
        head: ["Contrat", "Coefficient"],
        rows: CONTRACTS.map((c) => [c.label, `× ${c.multiplier}`]),
      },
    },
    {
      id: "calcul",
      title: "Calcul des points",
      paragraphs: [
        "On compare les points faits au seuil : c'est l'écart. Le score de base vaut (25 + écart) × coefficient du contrat, positif si le contrat est réussi, négatif s'il est chuté.",
        "On y ajoute les primes, puis le total X se répartit entre les joueurs :",
      ],
      bullets: [
        "À 3 ou 4 joueurs : le preneur marque X pour chaque adversaire (il gagne ou perd 2X à 3 joueurs, 3X à 4), et chaque défenseur marque −X.",
        "À 5 joueurs avec appelé : le preneur marque 2X, l'appelé X, chacun des trois défenseurs −X.",
        "À 5 joueurs, appelé à soi-même (le preneur avait le roi appelé) : le preneur joue seul, il marque 4X et chacun des quatre autres −X.",
        "La somme des points de la manche est toujours nulle.",
      ],
    },
    {
      id: "primes",
      title: "Les primes",
      paragraphs: ["Elles s'ajoutent au score de base, au profit du camp qui les réalise (attaque ou défense)."],
      bullets: [
        "Petit au bout : le Petit joué à la dernière levée rapporte 10 × le coefficient du contrat au camp qui le gagne.",
        "Poignée : montrer un nombre d'atouts (l'Excuse compte) rapporte un bonus fixe, non multiplié, au camp qui la montre.",
        "Chelem : annoncé et réussi +400, réussi sans l'avoir annoncé +200, annoncé mais raté −200.",
      ],
    },
    {
      id: "poignees",
      title: "Les poignées",
      paragraphs: ["Nombre d'atouts à montrer (l'Excuse comprise) selon le nombre de joueurs à la table."],
      table: {
        head: ["Poignée", "Bonus", "À 3", "À 4", "À 5"],
        rows: POIGNEES.map((p) => [
          p.label[0].toUpperCase() + p.label.slice(1),
          `+${p.bonus}`,
          String(atoutsRequis(p.id, 3)),
          String(atoutsRequis(p.id, 4)),
          String(atoutsRequis(p.id, 5)),
        ]),
      },
    },
    {
      id: "appli",
      title: "Dans l'appli",
      bullets: [
        "Choisis le preneur (et l'appelé à 5 joueurs), le contrat et le nombre de bouts, puis règle les points faits par l'attaque avec le curseur : les points de la défense s'affichent en miroir.",
        "Ajoute la poignée, le petit au bout et le chelem s'il y en a eu : l'aperçu des points se met à jour en direct.",
        "Option « demi-points » à la création de la partie pour les tables qui comptent les 0,5.",
        "Le Tarot se saisit depuis l'appareil de l'hôte.",
      ],
    },
  ],
});

const skyjo = (): RulesDoc => ({
  title: "Skyjo",
  summary:
    "Jeu de cartes à 2 à 8 joueurs : on cherche à avoir le moins de points possible. Chacun a douze cartes face cachée, qu'il révèle peu à peu. " +
    "La partie s'arrête quand un joueur atteint ou dépasse l'objectif (100 points par défaut) : le score le plus bas gagne.",
  sections: [
    {
      id: "manche",
      title: "Une manche",
      bullets: [
        "Chaque joueur dispose ses douze cartes en grille, face cachée, et en retourne deux. À son tour, il pioche (ou prend la défausse) et échange ou retourne une carte.",
        "La manche s'arrête dès qu'un joueur a toutes ses cartes visibles : chacun des autres joue encore un dernier tour.",
        "Chacun additionne ensuite ses cartes : c'est son score de la manche.",
      ],
    },
    {
      id: "doublement",
      title: "La règle du doublement",
      paragraphs: [
        "Celui qui a terminé la manche doit avoir le score strictement le plus bas. Sinon, si son score est positif, il est doublé. Un score nul ou négatif n'est jamais doublé.",
      ],
    },
    {
      id: "fin",
      title: "Fin de partie",
      paragraphs: [
        `Quand un joueur atteint ou dépasse ${SKYJO_DEFAULT_TARGET} points (objectif réglable à la création), la partie s'arrête et le plus petit total l'emporte.`,
      ],
    },
    {
      id: "appli",
      title: "Dans l'appli",
      bullets: [
        "Pour chaque joueur, tape le total de ses cartes (le bouton « − » sert aux totaux négatifs), puis indique qui a terminé la manche.",
        "L'appli applique le doublement toute seule et affiche le détail dans l'historique.",
        "Chaque invité peut saisir lui-même son score depuis son téléphone ; la manche s'ajoute quand tout le monde a saisi.",
      ],
    },
  ],
});

const sixQuiPrend = (): RulesDoc => ({
  title: "6 qui prend !",
  summary:
    "Jeu de 104 cartes à 2 à 10 joueurs. On pose ses cartes en ordre croissant dans quatre rangées ; celui qui pose la sixième carte d'une rangée ramasse les cinq autres " +
    "et leurs têtes de bœuf, qui comptent comme points de pénalité. Le moins de points possible : le plus petit total gagne.",
  sections: [
    {
      id: "manche",
      title: "Une manche",
      bullets: [
        "Chacun reçoit dix cartes. Quatre cartes sont posées pour démarrer les rangées.",
        "Tout le monde choisit une carte en secret, puis on les révèle ensemble et on les pose, de la plus petite à la plus grande, dans la rangée dont la dernière carte est la plus proche en dessous.",
        "La sixième carte d'une rangée oblige son poseur à ramasser les cinq premières. Une carte plus petite que toutes les rangées oblige à ramasser une rangée au choix.",
        "À la fin de la manche, on compte les têtes de bœuf ramassées : ce sont les points de la manche.",
      ],
    },
    {
      id: "fin",
      title: "Fin de partie",
      paragraphs: ["On joue des manches jusqu'à ce qu'un joueur atteigne 66 points ; le plus petit total l'emporte."],
    },
    {
      id: "appli",
      title: "Dans l'appli",
      bullets: [
        "À chaque manche, tape le nombre de têtes de bœuf ramassées par chaque joueur (un champ vide compte 0).",
        "Un message s'affiche quand l'objectif de 66 est atteint ; l'appli te propose alors de terminer la partie.",
        "Chaque invité peut saisir lui-même son score depuis son téléphone.",
      ],
    },
  ],
});

const free = (): RulesDoc => ({
  title: "Compteur libre",
  summary:
    "Un compteur pour tous les jeux qui n'ont pas leur propre écran. Tu choisis un mode de comptage à la création de la partie, " +
    "et les réglages proposés dépendent de ce mode.",
  sections: [
    ...COUNTER_MODES.map((m) => ({
      id: `mode-${m.id}`,
      title: m.label,
      paragraphs: [m.description],
      bullets: modeDetails[m.id],
    })),
    {
      id: "fin",
      title: "Terminer la partie",
      paragraphs: [
        "L'appli te propose de terminer la partie quand elle s'y prête : objectif atteint, dernière manche jouée, dernier joueur en vie ou décompte à zéro. L'écran de fin affiche le classement et le résultat de chacun.",
      ],
    },
  ],
});

const modeDetails: Record<string, string[]> = {
  points: [
    "Réglable : le plus petit score gagne ou le plus grand, un objectif de points, un nombre de manches.",
    "À chaque manche, tape les points de chaque joueur (le bouton « − » pour un score négatif).",
  ],
  wins: [
    "À chaque manche, coche le gagnant ; en cas d'égalité, coche plusieurs joueurs.",
    "Réglable : le nombre de manches à gagner pour remporter la partie.",
  ],
  live: [
    "Des boutons −5, −1, +1, +5 sur chaque joueur ; chaque appui est enregistré dans l'historique et peut être annulé.",
    "Réglable : le sens du jeu et un objectif de points.",
  ],
  lives: [
    "Réglable : le nombre de vies de départ (3 par défaut).",
    "Chaque perte ou gain de vie se fait avec les boutons −1 et +1 de chaque joueur.",
  ],
  countdown: [
    "Réglable : le total de départ (301 par défaut). Tape les points marqués à chaque manche : ils sont retirés du total.",
    "Le premier qui arrive à 0 gagne ; le plus petit total restant est en tête.",
  ],
};

const rail = (): RulesDoc => ({
  title: "Les Aventuriers du Rail",
  summary:
    "Jeu de 2 à 5 joueurs : on collectionne des cartes wagon pour prendre possession de routes entre des villes, et on réalise des billets destination secrets. " +
    "Les points se gagnent avec les routes, les billets réussis et quelques bonus ; un billet raté fait perdre ses points. Le plus gros total gagne.",
  sections: [
    {
      id: "routes",
      title: "Les routes",
      paragraphs: ["Chaque route prise rapporte des points selon sa longueur en wagons, quelle que soit la carte (la longueur 8 existe sur la carte Europe)."],
      table: {
        head: ["Longueur", "Points"],
        rows: ROUTE_POINTS.map((r) => [`${r.length} wagon${r.length > 1 ? "s" : ""}`, String(r.points)]),
      },
    },
    {
      id: "billets",
      title: "Les billets destination",
      paragraphs: [
        "À la fin de la partie, chaque billet dont les deux villes sont reliées par les routes du joueur lui rapporte la valeur indiquée dessus ; chaque billet non relié lui en fait perdre autant.",
      ],
    },
    {
      id: "bonus",
      title: "Les bonus (selon l'édition)",
      bullets: [
        `Plus long chemin : ${LONGEST_BONUS} points pour celui dont le chemin continu est le plus long. En cas d'égalité, tous les ex æquo reçoivent le bonus.`,
        `Gares non utilisées (édition Europe) : ${STATION_VALUE} points pour chaque gare restée dans la boîte (3 gares par joueur au départ).`,
        `Globe-trotter (selon l'édition ou l'extension) : ${GLOBETROTTER_BONUS} points pour celui qui a réussi le plus de billets destination. Je ne l'ai pas confirmé pour toutes les éditions : coche-le seulement si ton jeu l'utilise.`,
      ],
    },
    {
      id: "egalite",
      title: "En cas d'égalité",
      paragraphs: ["Celui qui a réussi le plus de billets destination l'emporte ; s'il y a encore égalité, celui qui a le plus long chemin continu."],
    },
    {
      id: "appli",
      title: "Dans l'appli",
      bullets: [
        "Choisis l'édition à la création, puis coche les bonus de ton jeu : ils sont proposés selon l'édition (tu peux les changer).",
        "Une fiche par joueur : points des routes (saisis directement, ou calculés avec « Compter les routes »), billets réussis et ratés, gares non utilisées.",
        "Pour les bonus, indique la longueur du plus long chemin de chacun (et son nombre de billets réussis pour le globe-trotter) : l'appli compare et attribue le bonus toute seule, égalités comprises.",
      ],
    },
  ],
});

const sushi = (): RulesDoc => ({
  title: "Sushi Go Party !",
  summary:
    "Jeu de 2 à 8 joueurs : on choisit une carte dans sa main, on passe le reste à son voisin, et on compose devant soi la meilleure assiette. " +
    "Trois manches comptées une à une, puis les desserts comptés à la fin. Le plus gros total gagne.",
  sections: [
    {
      id: "points",
      title: "Les points d'une manche",
      bullets: [
        "Nigiri : œuf 1, saumon 2, calamar 3 ; posé sur un wasabi, il vaut le triple.",
        "Tempura : 5 points par paire. Sashimi : 10 points par trio.",
        `Gyoza : ${DUMPLING_POINTS.slice(1, 5).join(", ")} puis ${DUMPLING_POINTS[5]} points pour 1, 2, 3, 4 puis 5 cartes ou plus.`,
        "Anguille : 1 carte −3 points ; 2 cartes ou plus 7 points. Tofu : 1 carte 2 points, 2 cartes 6 points, 3 ou plus 0.",
        `Onigiri : ${ONIGIRI_POINTS.slice(1).join(", ")} points pour 1, 2, 3 ou 4 formes différentes (chaque ensemble compte à part).`,
        "Soupe miso : 3 points ; si plusieurs sont jouées au même tour, toutes sont défaussées et ne rapportent rien (ne les compte pas).",
        "Boîte à emporter : 2 points par carte retournée. Thé : pour chaque thé, 1 point par carte du plus grand ensemble de même couleur de fond.",
        "Wasabi, baguettes, menu, cuillère et commande spéciale ne rapportent rien par eux-mêmes : la commande spéciale se compte comme la carte copiée.",
      ],
    },
    {
      id: "comparaisons",
      title: "Les points par comparaison",
      paragraphs: ["L'appli compare les joueurs et attribue ces points toute seule. En cas d'égalité, tous les ex æquo reçoivent les points complets."],
      bullets: [
        "Maki : le plus d'icônes 6 points, le deuxième 3 points (il faut en avoir au moins une). À 6 joueurs ou plus : 6, 4 et 2 points pour les trois premiers. Une égalité en tête supprime la place suivante.",
        "Temaki : le plus +4 points, le moins −4 points (pas de malus à 2 joueurs).",
        "Uramaki : le premier à atteindre 10 icônes 8 points, le deuxième 5, le troisième 2. En fin de manche, les places restantes vont à ceux qui en ont le plus. Tu indiques la place de chacun.",
        "Edamame : 1 point par adversaire qui en a aussi, 4 points par carte au maximum.",
        "Sauce soja : 4 points par sauce soja pour celui qui a le plus de couleurs de fond différentes (sauce comprise).",
      ],
    },
    {
      id: "desserts",
      title: "Les desserts (fin de partie)",
      bullets: [
        "Pudding : le plus +6 points, le moins −6 points (pas de malus à 2 joueurs).",
        "Glace au thé vert : 12 points par ensemble de 4.",
        `Fruits : pour chaque sorte (pastèque, orange, ananas), selon le nombre de symboles : ${FRUIT_POINTS.join(", ")} points pour 0, 1, 2, 3, 4 puis 5 ou plus.`,
        "Les desserts pris pendant les manches sont mis de côté et ne comptent qu'à la fin : indique le total de la partie.",
      ],
    },
    {
      id: "egalite",
      title: "En cas d'égalité",
      paragraphs: ["Celui qui a le plus de puddings l'emporte."],
    },
    {
      id: "appli",
      title: "Dans l'appli",
      bullets: [
        "À la création, choisis le menu : un rouleau, un dessert et les apéritifs et spéciaux de ta partie. L'appli ne propose que ces cartes à la saisie.",
        "Une saisie par manche (3), puis une dernière pour les desserts de toute la partie. Pour chaque joueur, indique le nombre de cartes de chaque sorte.",
        "Les points s'affichent en direct et les comparaisons se font entre tous les joueurs : pense à saisir tout le monde avant de valider.",
        "Carte menu ou commande spéciale : compte simplement la carte obtenue ou copiée, si sa sorte fait partie de ton menu.",
      ],
    },
  ],
});

const DOCS: Record<string, () => RulesDoc> = { tarot, skyjo, rail, sushi, sixquiprend: sixQuiPrend, free };

/** Règles d'un jeu (par identifiant), ou `undefined` si le jeu n'en a pas. */
export const rulesFor = (gameId: string): RulesDoc | undefined => DOCS[gameId]?.();
