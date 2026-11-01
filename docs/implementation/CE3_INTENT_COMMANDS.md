# CE3 — Intent → commandes storyboard

Spec : `docs/implementation/CINEMA_LOTS.md` (CE3) et `docs/architecture/*` sur la PR #222 @ c99fc3c (non mergée).
Base : `fix/cinema-durable-settlement` (CE2, #226). Aucun appel réseau, aucun appel payant, aucun run Qwen : tout est mocké.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `src/lib/cinema/context.ts` | `buildIntentContext` : IDs/révisions venus de l'app, refs sans ID exclues, capacités `validated`/`demo` seulement, réduction ordonnée (récit → texte des autres plans → refs non verrouillées) avec diagnostics, `CONTEXT_TOO_LONG` sinon. |
| `src/lib/cinema/intent.ts` | `parseIntent` : un seul objet JSON (fence ```json tolérée), clés inconnues refusées à tous les niveaux, refs résolues par ID (nom ambigu → question avec candidats), locks, révisions, scope, permutation exacte, finition avec source + recette qualifiée, « ce plan » sans sélection → question. Ne lève jamais : `valid` / `needs_clarification` / `invalid`. |
| `src/lib/cinema/commands.ts` | `applyOperation` / `applyEnvelope` (pures, tout ou rien), `commitIntent` (lecture + application + écriture sous un seul verrou projet, une transaction CE2 board + sidecar), `undoIntent` (inverse journalisé). |
| `src/lib/cinema/journal.ts` | Additif : `storyboardRevision?`, `archivedShots?` dans `CinemaMeta`, `markRolledBack`. |

## Checklist CE3

- [x] Contexte compact, IDs de l'app, budget 6000 caractères avec réduction diagnostiquée, refs verrouillées conservées.
- [x] Parse strict : un objet, JSON tronqué / plusieurs objets / prose refusés ; `operationId` jamais pris du modèle.
- [x] ID inventé refusé (`UNKNOWN_ID`) ; nom ambigu → `needs_clarification` avec `candidateIds`, jamais de nouveau personnage.
- [x] Injection dans une note = donnée : marqueurs retirés, aucune clé `approval`, aucune opération en plus.
- [x] Lock (`LOCK_CONFLICT`), révision périmée (`REVISION_CONFLICT`), autre projet (`SCOPE_MISMATCH`) — vérifiés au parse **et** au moment d'appliquer.
- [x] « trois plans » = un `storyboard.create` indivisible ; IDs alloués par l'app ; aucune ref héritée implicitement.
- [x] Patch local isolé (plans 1 et 3 identiques octet pour octet).
- [x] Reorder = permutation exacte, sans perte ni doublon.
- [x] Pas d'opération `generate_*` ; `*.prepare` ne mutent rien.
- [x] Finition sans prise source refusée (`FINISH_SOURCE_MISSING` au parse, re-vérifiée à l'application).
- [x] Invalidation des devis : tout patch/archive incrémente la révision du plan (`invalidated`), donc le digest du snapshot change.
- [x] Undo après sauvegarde : transaction inverse ; refusé si le storyboard a changé depuis ; les révisions n'arrière jamais.
- [x] Zéro mutation sur réponse invalide ou opération en échec.
- [x] Fixtures FR/EN/DE/ES pour les 5 demandes P0.

## Tests

- `tests/cinema-intent.test.ts` : 30 tests (20 fixtures P0 × 4 langues + refus/questions + contexte).
- `tests/cinema-commands.test.ts` : 13 tests (transactions, commit/undo, bout en bout mocké).
- Suite complète : 975 tests, 974 pass, 0 fail, 1 skipped ; `tsc --noEmit` OK. Les tests storyboard existants (#218) passent sans modification.

Les fixtures prouvent le **contrat**, pas que Qwen comprend les demandes : cela relève du run de qualification de JD.

## Décisions (réversibles, compatibles)

1. **Clés inconnues refusées à tous les niveaux**, y compris la racine (`approval`, `operationId`, `planFilmId`…). Plus strict que nécessaire ; on peut relâcher plus tard sans casser les données.
2. **Les `*.prepare` ne vérifient pas les capacités** au parse : CE5 vérifie à `prepareJob`/devis. Le parse vérifie seulement cible, révision et (pour la finition) source + recette connue.
3. **Reorder global** : une permutation de tous les plans actifs ; chaque séquence garde son nombre de plans (le board lit les plans en ligne).
4. **Archive** = retiré du board, copie complète dans le sidecar `.uttu/cinema-<id>.json` (`archived` + `archivedShots`). Pas de suppression de fichier.
5. **Création** ajoutée à la dernière séquence (créée si aucune) ; pas d'`ajouterPlan` qui hérite des refs du voisin.
6. **Caméra non supportée** (« ralentis le mouvement ») = patch descriptif `action`/`promptManuel`, jamais un faux contrôle physique (`speed` refusé).
7. **Undo** : les révisions des plans touchés et du storyboard **avancent** (+1) au lieu de revenir en arrière, pour qu'aucun devis/approbation ancien ne redevienne valide. Prises et règlements (`takes`/`settled`) du sidecar ne sont pas annulés.
8. **Capacités** filtrées à `validated`/`demo` : les `candidate` ne sont pas montrées au modèle.
9. `CinemaMeta` (fichier CE2) étendu de façon additive ; un ancien sidecar se lit tel quel (`storyboardRevision` absent = 0).

## Risques

- Undo refusé si un règlement CE2 a écrit le sidecar entre-temps (conservateur : pas d'écrasement). L'UI doit l'expliquer.
- Budget de contexte compté en caractères, pas en tokens.
- Les messages d'erreur sont en français dans le code ; l'UI (CE4) traduit par code.

## Hand-offs

- **CE4** (#223) : `{ selectedShotId }` alimente `buildIntentContext` ; `needs_clarification.unresolved[].candidateIds` pour les puces ; `invalidated` pour griser un devis.
- **CE5** : `prepared[]` est l'entrée de `prepareJob`/devis ; branchement dans `studio-session.tsx` (non touché ici).
