# Consignes du projet

- Langue : français (interface, commits, échanges). Le propriétaire n'est pas développeur : réponses courtes, simples, avec une recommandation claire.
- **Version du site web : à chaque publication (chaque push qui change `web/`), augmenter `APP_VERSION` dans `web/src/version.ts` de 0.001** (0.002 → 0.003…). Le numéro s'affiche en bas de l'accueil et sert à vérifier que le site en ligne est à jour.
- Ne pas publier l'adresse e-mail du propriétaire dans le code ou sur le site.
- Les moteurs de règles (Kotlin et TypeScript) gardent les mêmes noms de champs JSON, pour que les parties restent compatibles.
- Tests : `cd web && npm test` ; Kotlin : `./gradlew :core:test :tarot-engine:test :skyjo-engine:test :freecounter-engine:test :session:test`.
