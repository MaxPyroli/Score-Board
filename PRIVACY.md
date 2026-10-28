# Politique de confidentialité

Dernière mise à jour : 28 octobre 2026

Score Board compte les points de jeux de société. Il existe en application Android et en site (version web installable). Éditeur : **Paname Dev**. **Sans pub, sans pistage**, sans compte.

Ce document décrit d'abord l'application Android, puis le site.

## Application Android

### Ce qui est enregistré, et où

- Les parties (noms de joueurs que tu saisis, scores, réglages) sont enregistrées **uniquement sur ton téléphone**.
- Aucun compte n'est demandé. Aucune donnée n'est envoyée à un serveur, ni au développeur, ni à un tiers.
- L'application ne contient ni publicité, ni outil de mesure d'audience, ni traceur.
- Désinstaller l'application supprime toutes les données.

### Partage d'une partie entre téléphones

Si tu choisis de partager une partie, elle est envoyée directement aux téléphones proches qui rejoignent avec le code, par Bluetooth et Wi-Fi, sans passer par internet. Seuls les téléphones qui connaissent le code peuvent la suivre. Tu peux arrêter le partage à tout moment.

### Autorisations demandées

- **Appareils à proximité (Bluetooth, Wi-Fi)** : uniquement pour partager et rejoindre une partie.
- **Localisation (Android 12 et versions antérieures)** : Android l'exige pour rechercher des appareils Bluetooth proches. L'application n'utilise ni ne conserve ta position.
- Le scan d'un QR code passe par le module de lecture de codes de Google Play Services ; l'application n'accède pas directement à l'appareil photo.

## Site (version web)

La version web enregistre tes parties, tes derniers noms et tes préférences **uniquement dans ton navigateur**. Aucun compte, aucune publicité, aucun outil de mesure d'audience, aucun traceur. Les polices et les scripts sont hébergés avec le site : aucune requête vers un tiers pour l'afficher.

### Partage en direct : service tiers Firebase

Seulement si tu partages ou rejoins une partie, le site contacte **Firebase** (Google), base de données hébergée en Europe (Belgique) :

- la partie (noms des joueurs, scores, réglages) est publiée sous un code de 4 caractères, et supprimée quand tu arrêtes le partage (si tu fermes l'appli sans l'arrêter, elle peut rester un temps sur le serveur) ;
- chaque appareil reçoit un identifiant anonyme (connexion anonyme de Firebase, sans e-mail) ; pendant une partie partagée, le serveur voit quel joueur chaque appareil représente, son pseudo et le score qu'il a saisi en cours de manche ;
- Firebase reçoit l'adresse IP de l'appareil qui se connecte, comme tout service en ligne ;
- seuls ceux qui connaissent le code peuvent suivre la partie.

### Appareil photo

Le bouton « Scanner le QR code » demande l'accès à l'appareil photo, uniquement pour lire le code d'une partie. L'image est analysée sur ton appareil : elle n'est ni enregistrée ni envoyée.

## Contact

Pour toute question : **contact@panamedev.fr**

© 2026 Paname Dev · Pensé par Paname Dev et codé par Claude
