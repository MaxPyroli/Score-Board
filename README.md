# PanaGames

Application Android de comptage de points pour jeux de société, en commençant
par le Tarot. Voir la vision et les décisions détaillées dans le document de
cadrage du projet (à ajouter au dépôt si besoin).

## État actuel

Étape 1 de l'ordre de travail : le moteur de règles du Tarot, en Kotlin pur.

- `tarot-engine/` : calcul des points d'une manche de Tarot (3, 4 ou 5
  joueurs), sans aucune dépendance Android ni UI, testable sur JVM et
  réutilisable tel quel dans une future version web.

Pas encore implémenté : module `app` (écrans Compose), stockage Room,
partage de session Nearby Connections. Voir "Ordre de travail" ci-dessous.

## Le moteur `tarot-engine`

Barème implémenté (référentiel FFT) :

- Seuil de points requis selon le nombre de bouts : 0 bout → 56, 1 bout → 51,
  2 bouts → 41, 3 bouts → 36.
- Score de contrat = `(25 + |écart|) × multiplicateur du contrat`, signé selon
  la réussite ou l'échec du contrat (le signe de `25 + écart` seul n'indique
  pas la réussite : c'est bien `écart >= 0` qui décide).
- Multiplicateurs : Petite ×1, Garde ×2, Garde sans ×4, Garde contre ×6.
- Poignée (simple +20, double +30, triple +40), petit au bout (±10) et
  chelem (+400 annoncé et réussi, +200 réussi non annoncé, -200 annoncé et
  raté) s'ajoutent/se retranchent selon le camp qui en bénéficie, pour former
  le score final réparti entre les joueurs.
- Répartition : à 3 ou 4 joueurs, le preneur joue seul contre les autres
  (`(n-1)×X` pour le preneur, `-X` par défenseur). À 5 joueurs avec un appelé
  distinct, le preneur touche `2X`, l'appelé `X`, chaque défenseur `-X`. En
  cas d'« appelé à soi-même », le preneur joue seul contre les 4 autres
  (`4X` pour le preneur, `-X` par joueur).

Le module valide ses entrées (nombre de joueurs, bouts, points par pas de
0,5, cohérence appelé/chelem, etc.) et garantit que la somme des points
distribués à une manche est toujours nulle. Voir les tests dans
`tarot-engine/src/test/kotlin/com/panagames/tarot/TarotScoringTest.kt` pour
les cas couverts, y compris les cas limites.

### Lancer les tests

```bash
./gradlew :tarot-engine:test
```

## Architecture cible

- Un cœur générique (parties, joueurs, historique des manches, annulation,
  statistiques, partage de session) + un module par jeu. Le cœur générique
  sera introduit quand un deuxième jeu rejoindra le Tarot, pour ne pas forcer
  une abstraction prématurée sur un seul module.
- Chaque moteur de règles reste du Kotlin pur, sans dépendance Android, pour
  rester testable sur JVM et réutilisable dans une éventuelle version web.

## Ordre de travail

1. ✅ Moteur de règles en Kotlin pur + tests, Tarot en premier.
2. Écrans de base (Jetpack Compose) : joueurs, saisie d'une manche, tableau
   des scores, historique. Stockage local avec Room.
3. Partage de session (code, QR code, Nearby Connections).
4. Polissage, puis publication sur la Play Console.
