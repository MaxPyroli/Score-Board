# PanaGames

Application Android de comptage de points pour jeux de société, en commençant
par le Tarot. Kotlin + Jetpack Compose, 100 % hors-ligne, stockage local (Room).

## État actuel

Étape 2 de l'ordre de travail : écrans de base, avec le Tarot comme premier jeu.

- Accueil : choix du jeu, liste des parties, suppression.
- Nouvelle partie : nombre de joueurs selon le jeu, noms, réglages du jeu (demi-points au Tarot, objectif de points…).
- Partie : tableau des scores, historique des manches (toucher une manche pour la
  modifier ou la supprimer), annulation de la dernière manche avec « Rétablir ».
- Saisie d'une manche de Tarot : preneur, appelé (à 5), contrat, bouts, curseur de
  points (attaque / défense en miroir), poignée, petit au bout, chelem, aperçu
  des points en direct.

Jeux disponibles : Tarot, Skyjo, 6 qui prend !, Compteur libre (objectif de points
facultatif, sens du jeu réglable). Pour un jeu simple, il suffit d'un réglage du compteur ;
un jeu avec règles propres (Tarot, Skyjo) a son propre module de règles et son écran de saisie.

Partage de session (hors-ligne, Nearby Connections) : l'hôte partage une partie depuis l'écran de la
partie (icône Partager) ; les autres téléphones la rejoignent depuis l'accueil avec le code à 4
caractères ou en scannant le QR code, et la suivent en direct **en lecture seule**. La connexion se
rétablit automatiquement quand un spectateur revient à proximité. L'hôte garde la version de référence ;
chaque modification est renvoyée en entier. Saisie des manches par les participants : à décider.

Pas encore fait : polissage du Tarot, publication.

## Modules

| Module | Contenu | Android ? |
| --- | --- | --- |
| `core` | Cœur générique : joueurs, partie (liste de manches), interface `GameModule`, totaux | non (Kotlin pur) |
| `tarot-engine` | Barème du Tarot, brouillon de manche (logique du formulaire), résumé d'une manche, adaptateur `GameModule` | non (Kotlin pur) |
| `skyjo-engine` | Skyjo : points doublés pour celui qui termine sans avoir le score le plus bas | non (Kotlin pur) |
| `freecounter-engine` | Compteur à points saisis à la main : « Compteur libre » et « 6 qui prend ! » (fin à 66) | non (Kotlin pur) |
| `session` | Partage entre appareils, partie pure : code de session, format d'échange compressé, découpage des gros envois, liste des permissions | non (Kotlin pur) |
| `app` | Écrans Compose, Room, navigation, Nearby Connections | oui |

Les modules Kotlin purs se compilent et se testent partout, sans SDK Android :

```bash
./gradlew :core:test :tarot-engine:test :skyjo-engine:test :freecounter-engine:test :session:test
```

Le module `app` n'est inclus que si un SDK Android est détecté (`ANDROID_HOME`, ou
`sdk.dir` dans `local.properties`, ce que crée Android Studio). Il n'a pas pu être
compilé dans l'environnement de développement initial (accès réseau à Google
bloqué) : la CI GitHub (`.github/workflows/android.yml`) le compile et publie un APK
de test (onglet *Actions* → dernière exécution → artefact `panagames-debug-apk`).

## Architecture

- Une partie est une liste ordonnée de manches ; les scores se déduisent de cette liste
  (annulation et modification d'une manche passée sont triviales, la synchronisation
  entre téléphones le sera aussi).
- Chaque jeu = un `GameModule` (Kotlin pur : calcul des points, encodage d'une manche)
  + une `GameDefinition` côté app (réglages, description d'une manche, écran de saisie).
  Ajouter un jeu = ajouter ces deux éléments et l'inscrire dans `Games.all`, sans
  toucher aux écrans communs.
- Toute la logique du formulaire Tarot vit en Kotlin pur (`TarotRoundDraft`) et est
  testée sur JVM ; l'écran ne fait que l'afficher.
- Identifiant de package provisoire : `com.panagames.app` (à définir avant publication).

## Barème Tarot implémenté (règles FFT, recoupées avec plusieurs sources en ligne)

- Seuil selon les bouts : 0 → 56, 1 → 51, 2 → 41, 3 → 36.
- Score de contrat = `(25 + |écart|) × multiplicateur` (Petite ×1, Garde ×2, Garde sans ×4,
  Garde contre ×6), signé selon la réussite du contrat.
- Petit au bout : ±10 × multiplicateur du contrat. Poignée (+20 / +30 / +40) et chelem (+400
  annoncé réussi, +200 réussi non annoncé, −200 annoncé raté) s'ajoutent sans multiplicateur,
  selon le camp qui en bénéficie. Atouts requis pour une poignée : 13/15/18 à 3 joueurs,
  10/13/15 à 4, 8/10/13 à 5.
- Répartition : à 3 ou 4 joueurs, le preneur touche `(n−1)×X`, chaque défenseur `−X`.
  À 5 avec appelé : preneur `2X`, appelé `X`, défenseurs `−X`. Appelé à soi-même :
  preneur `4X`, les 4 autres `−X`.

## Ordre de travail

1. ✅ Moteur de règles en Kotlin pur + tests.
2. ✅ Écrans de base (à valider sur un vrai téléphone via l'APK de la CI).
3. ✅ Partage de session (code, QR code, Nearby Connections) : à valider sur deux vrais téléphones.
4. Polissage (dont le Tarot), puis publication sur la Play Console.
