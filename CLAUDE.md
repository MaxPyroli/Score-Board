# Consignes du projet

- Langue : français (interface, commits, échanges). Le propriétaire n'est pas développeur : réponses courtes, simples, avec une recommandation claire.
- **Version du site web** (`APP_VERSION` dans `web/src/version.ts`) : à augmenter de 0.001 **uniquement quand on ajoute de nouvelles fonctionnalités**, pas pour un correctif. Le « build » (code du commit + date) change tout seul à chaque publication et sert à vérifier que le site en ligne est à jour ; les deux s'affichent en bas de l'accueil.
- Ne pas publier l'adresse e-mail du propriétaire dans le code ou sur le site.
- Les moteurs de règles (Kotlin et TypeScript) gardent les mêmes noms de champs JSON, pour que les parties restent compatibles.
- Tests : `cd web && npm test` ; Kotlin : `./gradlew :core:test :tarot-engine:test :skyjo-engine:test :freecounter-engine:test :session:test`.
