# Lots exécutables — Astra × Cursor

Base examinée : main `77094dd`. Suivi unique : [#216](https://github.com/eNudimmud/U-TTU-Studio/issues/216). Lire [architecture](../architecture/CINEMA_ENGINE.md), [contrats](../architecture/CONTRACTS.md), [workflows](../architecture/CINEMA_WORKFLOWS.md). Compléter la méthode de `docs/implementation/README.md` dans #215, sans la dupliquer.

Les corrections #209/#211/#217/#218/#220/#221 sont fusionnées : ce sont des acquis, pas des tâches à refaire. Les lots ci-dessous sont prêts pour préparation/implémentation headless, sauf les interfaces et actions explicitement réservées à JD.

## Ordre et propriétaires de fichiers

| Lot / branche | Dépendances | Surface exclusive | Statut initial |
| --- | --- | --- | --- |
| CE0 `feat/cinema-native-agent` | Contrats | `lib/cinema/types.ts`, manifeste/adapter texte et policy | Prêt ; commencer par un commit de types communs |
| CE1 `fix/cinema-reference-bindings` | Types CE0 | Références, snapshot, préparation des vues | Prêt après types ; compléter #217 |
| CE2 `fix/cinema-durable-settlement` | Types CE0 | Journal, settlement, budget | Prêt après types |
| CE3 `feat/cinema-intent-commands` | Types CE0 ; CE2 pour persistance | Parser, contexte, commandes | Parser/test parallélisables ; adapter persistance ensuite |
| CE4 `feat/cinema-workspace-u1` | Accord JD U1 ; CE0–CE3 | Storyboard/conversation, CSS et messages | Bloqué pour implémentation UI |
| CE5 `test/cinema-p0-integration` | Lots précédents selon périmètre validé | Raccords `studio-session`, e2e, preuves de production | Préparation prête ; Cloud par JD |

Chaque branche part du main à jour, SHA inscrit dans la PR ; une dépendance peut être empilée sur un commit publié sans fusionner main. Un seul propriétaire modifie `types.ts` (CE0), un seul intègre `studio-session.tsx` (CE5), un seul touche messages/styles (CE4). Les lots produisent des adapters et patchs de raccord à intégrer séquentiellement. Ne pas écraser les changements d'un autre exécutant.

Interdictions communes : aucun merge sans accord JD, force-push, PR #112, destruction de données, secret sérialisé, Vercel/Google login, nouveau fournisseur/fal, job payant lancé par l'agent, cancel automatique ou retry POST incertain. Lire `AGENTS.md` et les docs locales de Next avant code applicatif. Pas de modification manuelle du kernel vendored ni de mise à jour de dépendances opportuniste.

## CE0 — Agent natif et garde de soumission

**Objectif.** Résoudre #214 : Uttu propose des opérations via un modèle natif admissible ; le mode concours n'envoie plus GPT-5 Nano. Il n'exécute pas directement les commandes générées.

**Fichiers.** Créer `src/lib/cinema/types.ts`, `intent-workflow.ts`, `intent-job.ts`, `workflow-policy.ts`, `workflows/cinema/intent-qwen3vl.api.json`, `tests/cinema-intent-job.test.ts`, `tests/cinema-workflow-policy.test.ts`. Lire `agent/uttu-comfy.ts`, `render/client.ts`, `render/recovery.ts`, `open-weights.ts`, `workflows/registre.ts`. Raccords dans l'agent existant et sa route à fournir à CE5. Aucun nouveau sélecteur UI.

**Contrats/données.** Implémenter les types de CONTRACTS et validateurs de manifeste, `IntentJobSnapshot`, `JobReceipt` texte. Adapter submit/poll/history du client existant. Vérifier le template `llm_qwen3vl_text_gen` et le fichier conversationnel Qwen3-VL 8B exact, sortie `PreviewAny`, profil sans image. Le registre connaît déjà la famille. Le graphe demeure candidat jusqu'à qualification par un test utilisateur autorisé.

**Comportement.** Persister la tentative avant POST ; un état incertain reste reprenable sans renvoi. Lire du texte, pas un faux média. Limiter contexte/sortie, séparer instructions du texte des fiches, pas de fallback fermé ni second assistant. Étendre #220 pour vérifier tous les graphes effectifs, y compris agent, bulle, plan, outils et finition ; réutiliser sa classification et ses fixtures.

**Tests.** Graphes natifs acceptés ; Partner/API node caché dans un sous-graphe refusé ; ancienne préférence Nano refusée en concours ; GPT refusé ; manifeste inconnu/candidat non sélectionnable en démo ; texte valide/absent/tronqué dans l'historique ; réponse POST perdue sans retry ; même reçu repris après reload ; clé absente de toute sérialisation. Pas de réseau payant.

**Acceptation.** Table des routes payantes et garde commune prouvée. JSON API épinglé, modèles/licences, outputs et devis renseignés ou marqués inconnus ; test Cloud concret prêt pour JD. Pas de revendication d'agent open weights opérationnel avant ce run. Si le modèle manque sur Cloud, signaler `INTENT_MODEL_UNAVAILABLE` dans #214 sans bloquer CE1/CE2.

## CE1 — Bindings jusqu'au graphe, après #217

**Objectif.** Conserver objet/style, ne plus inférer les rôles par la position d'une image, compléter le filtrage de planches du chemin film.

**Fichiers.** Créer `src/lib/cinema/references.ts`, `reference-preparation.ts`, `snapshot.ts`, `tests/cinema-references.test.ts`. Lire et préparer les raccords à `storyboard/film.ts`, `render/cast-references.ts`, `render/ltx-graph.ts`, `creation/sheet.ts`, `creation/named-references.ts`, `creation/bubble.ts`. Ne pas réécrire les tests T1/T2 de #217 ; les prolonger.

**Contrats/données.** `ReferenceBinding`, `CompiledReferences`, `ShotSnapshot`, mappings de slots complets. Carte legacy identifiée par projet/catégorie/id ; identité liée explicitement. Préparation asynchrone de pixels avec cache par hash, puis sélection pure équilibrée de #217. Même résultat préparé pour devis, prompt et graph. Hash modifié après devis => invalidation.

**Comportement.** `qui/ou/objet/style` survivent à `versPlanFilm` jusqu'aux entrées effectives. Pas de troncature des refs requises, pas de création implicite d'identité absente. Supprimer les hypothèses mono-personnage de `ltx-graph` pour un appel multi-références ; guide de pose/cadrage ne remplace pas les identités. P0 recommandé : image clé approuvée puis chemin LTX à une image, sans composition cachée. Ne pas confondre une photo CAST brute avec une image clé approuvée.

**Tests.** Fixture Enki/Fizz sans images privées, plus fixture générique : ordre des personnages inversé, décor au début/à la fin, deux noms égaux dans différents projets, costume absent, ref objet/style, photo planche mal classée dans `photos`, fichier illisible, personnage sans pixels. Cas critique : deux personnages ×2 vues + décor = cinq images devant une capacité quatre ; refus explicite, jamais décor supprimé. Deux cartes partageant un fichier conservent leurs diagnostics, sans créer un groupe à zéro image. Collection Uttu incomplète refusée.

**Acceptation.** Mapping image→rôle→entity exact dans le graphe ; aucun `same person` multi-identité, aucune dernière image présumée décor ; aucune ref verrouillée perdue. Une modification du plan 2 laisse les snapshots des plans 1/3 identiques. Les tests prouvent les entrées, pas la qualité visuelle ; celle-ci reste à CE5/JD.

**Interdictions particulières.** Pas de nom/trait canonique codé en dur, de nouveau personnage, de méthode B payante automatique, ni de relèvement silencieux des limites 3/7.

## CE2 — Journal, reprise et coûts

**Objectif.** Un résultat est associé au bon plan/projet même si la page storyboard est fermée ; les opérations et coûts incertains restent traçables.

**Fichiers.** Créer `src/lib/cinema/journal.ts`, `settlement.ts`, `spend-ledger.ts`, `tests/cinema-journal.test.ts`, `tests/cinema-settlement.test.ts`, `tests/cinema-spend.test.ts`. Raccords préparés vers `render/recovery.ts`, `settings.ts`, `settle-take.ts`, `film/registre.ts` et le coffre. Ne pas remplacer le client billing de #209.

**Contrats/données.** Reçu v2 + snapshot immuable + tentative unique + compte/projet. Étendre les reçus existants plutôt que doubler l'autorité. Métadonnées additives et journal avec hashes avant/après ; migrations sauvegardées, idempotentes, préservant IDs/champs inconnus. File durable, une soumission à la fois. Chaque lancement P0 est utilisateur : pas de cascade de génération autorisée par un simple changement de plan.

**Comportement.** Asset durable → prise idempotente → projections → settled. Retour tardif = variante de la révision source ; projet inaccessible = result_pending, pas projet ouvert. Pas de remplacement de prise gardée. Accord consommé une fois, coût inconnu réservé. Solde indicatif ; devis/autorisation requis même si le solde est élevé. Coût par job et provenance, unités billing vérifiées.

**Tests de panne.** Crash avant/après POST, réponse perdue, timeout polling, deux onglets, navigation/reload, compte changé, plan archivé, projet indisponible, téléchargement interrompu, résultat dupliqué, crash entre chaque écriture, quota/fichier partiel, écriture concurrente inconnue, solde qui monte, estimation expirée, tentative incertaine conservant sa réserve. Observer au plus un POST et aucun cancel dans toute reprise ambiguë.

**Acceptation.** Une seule prise/média par sortie, toujours dans son projet/plan ; reprise sans montage du composant ; migration et rollback sans perte ; conflit conservateur sans écrasement. Si verrou navigateur indisponible, ne pas prétendre une exclusion fiable : bloquer la deuxième session payante. Aucun secret dans fixtures ou logs.

## CE3 — Intentions et transactions storyboard

**Objectif.** Transformer « trois plans », « ajoute un gros plan », « inverse les deux derniers », « conserve le personnage, change la caméra », « ralentis le mouvement » en opérations vérifiables.

**Fichiers.** `src/lib/cinema/intent.ts`, `context.ts`, `commands.ts`, `tests/cinema-intent.test.ts`, `tests/cinema-commands.test.ts`. Lire `storyboard/ecrire.ts`, `corriger.ts`, `storyboard.ts` et `agent/uttu-comfy.ts`. Le modèle propose, les services purs appliquent ; le kernel vendored ne change pas.

**Contrats/données.** Unions d'opérations et DTO de proposition ; IDs/révisions alloués et contrôlés côté application. Contexte : sélection, catalogue de refs avec IDs, locks, capacités qualifiées, résumé narratif. Si trop long, produire un diagnostic et réduire les éléments non essentiels sans omettre silencieusement les refs verrouillées. Pas de 24 noms sans identité suffisante pour l'action.

**Comportement.** Création de trois plans atomique ; patch allowlist sur le seul plan ciblé ; réordre permutation exacte ; duplication nouvelle identité de plan ; archivage/undo journalisés. `prepare` ne génère rien. Une demande unsupported de caméra peut devenir consigne descriptive, sans faux contrôle physique. Finaliser exige prise source et manifeste de finition ; jamais `generate_shot`.

**Tests.** FR/EN/DE/ES : fixtures de commandes attendues, ambiguïté, ID inventé, JSON tronqué/plusieurs objets, injection dans note, lock conflict, stale revision, mauvais projet, mutation locale isolée, reorder sans perte, undo après sauvegarde, finition sans source, invalidation devis. Ces fixtures testent le contrat ; elles ne valident pas la compréhension réelle de Qwen.

**Acceptation.** Réponse invalide = zéro mutation/zéro appel payant supplémentaire. Cinq demandes P0 ont un résultat typé et un diagnostic stable. Les tests de #218 restent vrais ou évoluent avec migration documentée, pas une simple mise à jour des assertions pour masquer une régression.

## CE4 — Workspace U1, seulement après accord

**Objectif.** Une conversation principale, plans visuels et contexte accessible à la demande, selon [U1](../architecture/UX_REVIEW.md).

**Fichiers.** `src/components/storyboard/storyboard-page.tsx` et enfants, `src/components/app/barre-fil.tsx`, `creation-bar.tsx`, `messages/{en,fr,de,es}.json`, `src/components/app/app.css`. Pas de logique d'autorisation dans les composants. Préserver le rendu serveur et chargement différé #221.

**Comportements.** Portée du plan visible ; sélection directe, menu de variante/archivage, alternative clavier au drag ; conversation commune, pas de doublon FAQ. Contexte repliable références/verrous/histoire. Coût réel ou indisponible, états cloud honnêtes ; outils non raccordés masqués. EN par défaut, préférence de langue conservée. Export annoncé 540p/12fps.

**Tests.** 390×844, 844×390, 1024×600, 1280×800 ; cibles >=44 px ; pas de scroll horizontal ; focus conservé ; annonces accessibles ; quatre langues ; erreur/reprise ; sélection Fizz puis caméra ne touche pas Enki. Régression SSR/LCP #221 évitée.

**Acceptation/autorité.** Commentaire JD `U1 validé` avant code UI. La présence de cette spécification n'est pas cet accord. Pas de design supplémentaire introduit au passage.

## CE5 — Intégration, répétition et mise à jour de candidature

**Objectif.** Prouver le parcours réel en s'appuyant sur DEMO-P0 (#215) et SOUMISSION (#219), sans produire de dossiers concurrents.

**Fichiers.** Un propriétaire raccorde `src/components/app/studio-session.tsx`, les adapters legacy et le composant agent. Tests `tests/p0-non-regression.test.ts`, nouvelle couverture e2e storyboard→job→registre→montage. Mise à jour des documents existants par leur propriétaire, sur branche dédiée.

**Tests de raccord.** Agent natif avec réponse simulée explicitement identifiée ; trois plans liés au bon projet ; refs effectives dans chaque graph ; changement isolé ; autorisation unique ; reload pendant job ; résultat dans bon plan ; prises gardées ; export lisible. Éliminer le passage obsolète `?film2=0` du test signalé dans #216 après avoir compris ce qu'il devait vérifier ; ne pas le supprimer pour faire passer la CI sans remplacement utile.

**Validation.** Tests ciblés des lots, puis checks requis du dépôt sur l'intégration (typecheck, tests, build, e2e concernés). Rapporter SHA, commande et nombres exacts. Pas de suite complète répétée sans nouveau code/échec. La CI et les mocks ne prouvent pas l'identité visuelle.

**Tests Cloud préparés, lancés par JD.** Inventaire des refs repris de DEMO-P0 et présence actuelle confirmée dans son projet ; droits/publication et compositions approuvés. Fournir graph hash, inputs, prompts adaptés, devis, nombre maximal de runs, plafond de tranche et critères d'arrêt. Les 300 crédits incluent l'agent et les essais déjà faits ; compteur non fiable. Aucune nouvelle dépense ni tranche n'est approuvée ici.

Qualification agent : sortie texte/JSON puis demandes P0 dans les langues retenues ; toutes mutations valides ou explicitement refusées. Qualification image : comparaison Enki/Fizz/Blanche sans contamination, pas de planche reproduite, style conservé. Qualification vidéo : image clé source, mouvement simple et continuité, aucun résultat orphelin. Identité ratée = échec documenté ; pas remplacement par média externe.

**Export et dossier.** Conserver l'épreuve 540p/12fps et les originaux ; master haute résolution seulement si réellement validé. Mettre à jour la candidature déjà annoncée par JD le 30 octobre, pas en créer une seconde. Vérifier sa méthode d'édition. Clip/capture existants intacts ; toute nouvelle version séparée. Préparer repo/commit, licence/setup, graphes/modèles exacts, démo réelle, limites et preuves, puis accord avant publication.

**Échéances Zurich.** Lundi : intégration et répétition. Mardi 3 à 10 h : gel, seulement corrections critiques approuvées ; 16 h : dossier prêt ; cible de mise à jour 16 h 30 ; limite officielle 18 h. Si l'agent ou les rendus échouent, proposer un périmètre de secours clairement nommé à JD ; ne pas présenter une animatique d'images comme P0 vidéo complet.

## Protocole de retour

Dans chaque PR de lot et lien dans #216 :

```text
LOT: CE1
STATUS: planned | in_progress | implemented_untested | tested | partial | blocked
BASE / HEAD: <commits>
DECISION: <choix et justification courte>
PROOF: <commandes, résultats, CI, preview>
BLOCKER: <question technique pour Astra ou décision réservée à JD>
NEXT: <action, propriétaire>
```

Cursor accuse réception avant de marquer un lot en cours. Astra arbitre dans le fil, sans demander à JD de relayer. Regrouper les validations humaines avec décision/recommandation/impact/risques/preuves. Le design, les tranches, les merges et la direction artistique ne sont jamais présumés approuvés.
