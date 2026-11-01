# Comment un lot est écrit et livré

Astra conçoit et spécifie. Cursor développe et teste. JD valide les décisions importantes et chaque fusion.

## 1. Le lot (écrit par Astra)

Un lot tient dans une issue GitHub, ou dans un fichier `docs/implementation/LOT-<n>-<nom>.md`, avec :

1. **But** : une phrase, côté utilisateur.
2. **Périmètre** : les fichiers ou modules concernés, et ce qui est hors périmètre.
3. **Contrat** : types, entrées, sorties (voir `docs/architecture/ETAT-TECHNIQUE.md`).
4. **Critères d'acceptation** : vérifiables, sans rendu payant si possible.
5. **Interface** : si l'interface change, une maquette d'abord, validée par JD avant le code.
6. **Coût Comfy** : « ≈ X crédits estimés », ou 0.

## 2. Exécution (Cursor)

1. Lire le lot, vérifier les dépendances et les conflits avec les branches ouvertes (un seul propriétaire par fichier ; `studio-session.tsx` en particulier).
2. Signaler toute incohérence avec l'existant avant de coder, et proposer une solution compatible.
3. Créer une branche dédiée depuis `main` à jour : `lot/<n>-<nom>`, `fix/<nom>` ou `docs/<nom>`. Faire un `git fetch` avant tout ; jamais de force-push ; ne jamais toucher #112.
4. Tests :
   - `npm test` (unitaires) et `npm run typecheck`, verts ;
   - e2e Playwright avec Comfy simulé (`e2e/helpers/film2-comfy.ts`) pour tout changement de parcours ;
   - interface : captures à 390×844, 844×390, 1024×600 et 1280×800, cibles tactiles de 44 px ;
   - aucun test payant : JD les lance sur la preview.
5. Ouvrir une PR documentée : résumé, fichiers modifiés, tests (nombres), captures ou preuves, risques, état de validation.
6. Mettre à jour l'issue « Suivi Astra × Cursor ».
7. **Pas de fusion sans le oui explicite de JD.**

## 3. Règles qui ne bougent pas

- Comfy / Comfy Cloud uniquement, jamais fal.ai ; modèles open weights pour le concours ; aucun job annulé automatiquement.
- Prix affichés « ≈ X crédits estimés ».
- Aucune clé ni secret dans le code, les PR, les issues ou les conversations. La clé Comfy reste dans le navigateur de l'utilisateur.
- CAST = identités, DÉCOR = lieux, `@Nom`, 3 images maximum par référence.
- Finaliser améliore une prise et ne régénère jamais.
- Anglais par défaut (FR, DE, ES disponibles). Outils cassés masqués.
- Uttu seulement à partir de ses 7 références officielles ; jamais « Mira ».
- Correctifs génériques, jamais propres à un seul personnage.
- Gel du code : mardi 3 novembre à 10:00 (heure de Zurich). Rien de risqué après.

## 4. « Terminé » veut dire prouvé

Une tâche n'est terminée qu'avec une preuve : SHA de commit, lien de CI, sortie de test ou capture.
