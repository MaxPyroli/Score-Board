# Publier sur Google Play : test interne

## 0. À décider avant le premier envoi

L'identifiant de l'appli (`applicationId`, aujourd'hui `com.panagames.app`) est **définitif** dès le premier fichier envoyé à Google. Il faut aussi le nom de l'appli. Ensuite on change les deux dans le code et on continue.

## 1. Clé d'envoi (une seule fois)

La clé d'envoi prouve à Google que le fichier vient bien de toi. Elle est fournie à part (jamais dans le dépôt).
Dans GitHub : dépôt → Settings → Secrets and variables → Actions → New repository secret. Créer 4 secrets :

| Nom | Valeur |
| --- | --- |
| `UPLOAD_KEYSTORE_BASE64` | tout le contenu du fichier `upload-key.base64.txt` |
| `UPLOAD_KEYSTORE_PASSWORD` | le mot de passe indiqué dans `upload-key-INFO.txt` |
| `UPLOAD_KEY_ALIAS` | `upload` |
| `UPLOAD_KEY_PASSWORD` | le même mot de passe |

Garde `upload-key.jks` en lieu sûr (gestionnaire de mots de passe, cloud privé). Si tu le perds, Google peut le remplacer via le support, ce n'est pas irrémédiable.

## 2. Construire le fichier de publication

Onglet **Actions** → **Publication (AAB pour Google Play)** → **Run workflow**. À la fin, télécharger l'artefact `panagames-release-aab` (un zip contenant `app-release.aab`).
À refaire à chaque nouvelle version : le numéro de version augmente tout seul.

## 3. Play Console

1. **Créer l'application** : nom, langue (français), application (pas un jeu vidéo), gratuite.
2. **Test interne** (menu Test et publication → Tests → Test interne) :
   - Onglet Testeurs : créer une liste d'e-mails (jusqu'à 100 personnes, comptes Google).
   - Créer une version → accepter **Play App Signing** → importer le `.aab` → enregistrer → lancer.
   - Copier le lien d'invitation : chaque testeur l'ouvre sur son téléphone, accepte, puis installe depuis le Play Store. Les mises à jour suivantes arrivent toutes seules.
3. **Contenu de l'application** (menu Politique et applications → Contenu de l'application) : politique de confidentialité (URL), accès à l'appli (tout est accessible), publicité (aucune), classification du contenu (questionnaire), public cible, sécurité des données (voir `data-safety-fr.md`).
4. **Fiche** : textes dans `listing-fr.md`.

## 4. Pour la publication publique

Si ton compte développeur est **personnel et créé après le 13 novembre 2023**, Google exige d'abord un **test fermé** avec au moins 12 testeurs inscrits pendant 14 jours d'affilée (le test interne ne compte pas), puis une demande d'accès à la production. Un compte d'organisation n'est pas concerné.

## Politique de confidentialité en ligne

Google veut une adresse web. Option simple : activer GitHub Pages sur le dépôt (Settings → Pages), ou utiliser l'adresse directe du fichier `PRIVACY.md` sur GitHub.
