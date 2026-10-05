# Activer le partage en direct (Firebase)

À faire une seule fois, avec ton compte Google. Gratuit (plan Spark, sans carte bancaire).

1. Va sur https://console.firebase.google.com → **Créer un projet** (ou « Add project »).
   - Nom : `score-board` (au choix). Désactive Google Analytics. Valide.
2. Menu de gauche **Build → Authentication** → *Get started* → onglet *Sign-in method* →
   **Anonymous** → active → *Save*.
3. **Build → Realtime Database** → *Create database*.
   - Emplacement : `europe-west1` (Belgique). Mode : **Locked mode** (verrouillé). *Enable*.
4. Onglet **Rules** de cette base : efface tout, colle le contenu de `firebase/database.rules.json`
   (dans ce dépôt), puis **Publish**.
5. Roue dentée ⚙ (en haut à gauche) → **Project settings** → *General* → en bas « Your apps » →
   icône **`</>`** (Web) → surnom `web`, ne coche pas Hosting → *Register app*.
   Copie le bloc `const firebaseConfig = { ... }` affiché.
6. Envoie ce bloc à Claude (il n'est pas secret : il est public par conception, la sécurité vient
   des règles de l'étape 4). Il le colle dans `web/src/firebaseConfig.ts` et publie.

## Mettre à jour les règles

Quand `firebase/database.rules.json` change (par exemple pour les pastilles « connecté », le changement de nom et la saisie des scores par les invités),
recolle son contenu dans l'onglet **Rules** de la base, puis **Publish**.

## Comment c'est protégé

- Il faut être connecté (anonymement) pour lire ou écrire ; chaque appareil a son identifiant.
- Seul l'hôte (celui qui a créé le code) peut modifier ou supprimer sa session ; les invités ne font que lire.
- Un code ne se lit que si on le connaît (pas de liste des parties) ; une session abandonnée depuis plus de
  24 h libère son code.
- Les données sont limitées en taille et n'ont que les champs prévus.

## Limites connues

- Un code à 4 caractères peut se deviner par essais répétés ; les parties ne contiennent que des
  noms et des scores. Si besoin, on passera à 6 caractères.
- Plan gratuit : 100 connexions simultanées et 1 Go de données, très largement suffisant.
