# CE5 — Raccord du Cinema Engine et revue préalable

Décisions Astra du 1er novembre 2026. Source commune : [#216](https://github.com/eNudimmud/U-TTU-Studio/issues/216). Design U1 [validé par JD](https://github.com/eNudimmud/U-TTU-Studio/pull/222#issuecomment-6557202544). Ce lot complète [CINEMA_LOTS](CINEMA_LOTS.md) ; les contrats et les responsabilités existants restent applicables.

**Statut : préparation et intégration autorisées sur branche dédiée ; corrections de revue avant activation payante.** Aucun merge, aucune tranche ni composition artistique ne sont approuvés par ce document.

## État actuel — revue du 1er novembre, soirée Zurich

**CE5 est livré partiellement dans [#228](https://github.com/eNudimmud/U-TTU-Studio/pull/228), tête revue `6bd185e73178e58f671071397ab8bdb9e597ab48`. R1–R5 sont corrigés et vérifiés.** Sur cette tête, Astra a réexécuté **210 tests ciblés, tous verts**, dont les cinq sondes originales, les 202 tests `cinema-*` et les trois tests `storyboard-reglage`. Aucun appel Cloud.

CI exacte : [41345683801](https://github.com/eNudimmud/U-TTU-Studio/actions/runs/41345683801), `success`. La preuve CI complète reste distincte des tests ciblés exécutés par Astra. Les dernières mesures LCP et les parcours e2e sont [rapportés par Cursor](https://github.com/eNudimmud/U-TTU-Studio/pull/228#issuecomment-6561854090), pas remesurés ici.

Le contrôleur, l'écriture journalisée `use-storyboards`, l'agent de correction sous drapeau de qualification et le chargement différé sont présents. Le corps initial de #228 ne reflète plus tous ces raccords. Le chemin prise reste masqué, faute de manifestes de plan ; aucune qualification Cloud n'est démontrée. La revue nouvelle reproduit **sept échecs** R6–R10, détaillés en §7. L'intégration reste `partial`.

Le retour mobile de JD [#216](https://github.com/eNudimmud/U-TTU-Studio/issues/216#issuecomment-6563277521) demande une simplification du storyboard. U1 reste l'approbation historique ; une révision importante exige une proposition puis l'accord de JD. Les corrections headless ci-dessous avancent indépendamment.

## 1. État historique de la revue initiale, sans refaire les lots

| Lot | PR / SHA examiné | Vérification Astra | Suite |
| --- | --- | --- | --- |
| CE0 | [#224](https://github.com/eNudimmud/U-TTU-Studio/pull/224) / `210d7fe` | CI verify + Vercel verts ; revue ciblée ; tests mockés | R4/R5, journal des dépenses commun ; qualification Cloud reste absente |
| CE1 | [#225](https://github.com/eNudimmud/U-TTU-Studio/pull/225) / `8e0896a` | CI verify + Vercel verts ; lecture des bindings, préparation, snapshot et adapter | Raccorder les hashes réellement préparés, les rôles et le refus de dépassement |
| CE2 | [#226](https://github.com/eNudimmud/U-TTU-Studio/pull/226) / `30f1fa5` | CI verify + Vercel verts ; revue + reproductions | R1/R2/R3 avant retour de résultat en production |
| CE3 | [#227](https://github.com/eNudimmud/U-TTU-Studio/pull/227) / `ba66315` | CI verify + Vercel verts ; revue contexte/parser/commit/undo | Brancher contexte explicite, reprise du journal et mutation unique |
| CE4 | [#223](https://github.com/eNudimmud/U-TTU-Studio/pull/223) / `6e3edd8` | CI verify + Vercel verts ; lecture du raccord ; responsive/Lighthouse rapportés par Cursor | Préserver U1 ; revue visuelle de la preview encore distincte |
| CE5 | `test/cinema-p0-integration` | Planifié, pas encore livré | Un propriétaire pour le raccord |

Astra a exécuté sur `ba66315` : `node --experimental-strip-types --no-warnings --test tests/cinema-*.test.ts` : **121/121 passent**. Cela couvre CE0/CE2/CE3 présents dans cette branche, pas CE1/CE4, et aucun run Cloud.

Cinq sondes supplémentaires ont reproduit cinq écarts malgré cette suite verte. Les assertions attendues échouent sur cette base : ce sont des reproductions, pas des tests de recette passés.

## 2. R1–R5 — corrigés et vérifiés, historique des reproductions

Les cinq assertions ci-dessous passent sur `6bd185e`. Conserver leur couverture. Reproduction historique complète : [ce0-ce2-regressions.patch](probes/ce0-ce2-regressions.patch). Dans un checkout de revue de `ba66315`, appliquer ce patch puis exécuter :

```sh
git apply /chemin/vers/ce0-ce2-regressions.patch
node --experimental-strip-types --no-warnings --test tests/astra-review-probes.test.ts
```

Le patch ajoute uniquement un fichier de tests synthétiques. Aucun secret, aucune image privée, aucun réseau. Cursor reprend les assertions dans les tests des lots concernés, sans affaiblir les attentes.

| Repère | Localisation | Reproduction et impact | Correction / acceptation |
| --- | --- | --- | --- |
| R1 — P1 | CE2 `submitShotJob` | Snapshot de révision 9 et digest différent avec ancien devis/accord : le POST part. Le code compare accord↔devis, pas snapshot réel↔devis. | Vérifier digest snapshot, graph effectif et génération avant toute réserve/POST ; relire révision/verrous/références au dernier point de validation. Mutation après devis = zéro POST, nouvel accord nécessaire. |
| R2 — P1 | CE2 `settleShotJob` | Une prise ajoutée après lecture du registre mais avant acquisition du verrou est écrasée. `runTransaction` voit le fichier récent comme « before » puis écrit le calcul périmé. | Lire, calculer et écrire registre/sidecar/lien storyboard sous une même acquisition du verrou projet. Télécharger les médias avant ; revalider sous verrou. Appeler le journal avec le verrou déjà détenu, sans réentrance. Conserver toute prise concurrente et sa sélection. |
| R3 — P1 | CE2 `settleShotJob` | Crash après journal, puis modification du registre par l'utilisateur : replay produit `REVISION_CONFLICT` mais retourne `settled`, et peut ajouter le dedup alors que la prise n'est pas dans le registre autoritatif. | Rester `result_pending`, conserver le conflit et les médias ; ne pas avancer les projections/dedup ni effacer le reçu tant que les cibles nécessaires ne sont pas appliquées et relues. Un conflit n'est jamais un succès. |
| R4 — P1 | CE0 `submitApprovedIntent` | Après submit→poll→settle, le même objet d'accord autorise un second POST. La consommation n'est mémorisée que dans le reçu remplaçable. | Consommation durable dans le ledger commun pour texte et média, sous exclusion commune ; terminal/oubli du reçu/reload ne réactivent jamais un accord. Un nouveau job exige un nouvel accord. |
| R5 — P1 | CE0 `submitApprovedIntent` | Modifier prompt et seed du graph après devis reste accepté, car `stripData` retire précisément ces champs avant comparaison. | Recalculer le digest de la charge utile canonique exacte et du snapshot avant POST ; vérifier aussi manifeste/workflow/account. Conserver la comparaison du template, mais elle ne remplace pas l'intégrité des données approuvées. |

**Portée.** CE0 est propriétaire de R4/R5, CE2 de R1/R2/R3 ; CE1 fournit le calcul snapshot/génération. Correctifs additifs sur leurs branches, puis repris dans CE5. Pas d'écriture sur les branches d'un autre exécutant par Astra.

Compléments nécessaires au raccord :
- Conserver les `GenerationSettings` qui contribuent au digest ; le reçu CE2 actuel n'en conserve pas une copie explicite. Recalcul après reload sans inventer seed, prompt ou ordre d'images.
- Une snapshot gelée au premier niveau n'est pas une garantie d'intégrité de ses objets imbriqués : la vérification au dernier point avant POST reste obligatoire.
- Un coût GPU estimé ne doit pas libérer comme « définitivement facturé » une réserve susceptible d'être révisée par la facture ; conserver sa provenance et pouvoir actualiser le coût. Une dépense inconnue n'est jamais zéro.
- Vérifier les valeurs numériques finies et positives des plafonds, les devis expirés/malformés et la limite globale de campagne de 300 crédits, en plus de la tranche autorisée. Inclure l'agent et les essais antérieurs connus ; un changement de tranche n'efface pas la consommation.

## 3. Réponses d'Astra aux questions techniques

1. **Qwen / CLIP type.** Conserver `stable_diffusion` comme candidat pour le fichier 8B. Lecture directe de [ComfyUI `6d35280`, sd.py](https://github.com/Comfy-Org/ComfyUI/blob/6d35280/comfy/sd.py#L2044) : ce type arrive à la branche conversationnelle générique Qwen3-VL ; `ideogram4`, `boogu`, `joyimage`, `qwen_image` et les branches Flux ont des traitements de conditionnement particuliers. C'est une justification du code, **pas une preuve de la version ni de la disponibilité sur Cloud**. Vérifier les schémas/noms de modèles via lectures Cloud disponibles depuis le navigateur de JD avant tout essai. Pas de changement automatique vers `ideogram4` après erreur : diagnostic et nouvel essai distinct, autorisé.
2. **Reçus.** Garder temporairement `u-ttu-intent-op` pour le texte et `u-ttu-operation.cinema` pour le média est acceptable : deux kinds, pas deux copies d'une même opération. Ils partagent impérativement exclusion, consommation d'accords, budget et politique de reprise. Centraliser les constantes/ports communs pour éviter la dépendance cyclique intent-job↔spend-ledger. Aucun second orchestrateur payant.
3. **Registre.** L'agent reste dans son registre interne de manifestes ; aucune entrée d'outil visiteur dans `workflows/index.json` n'est nécessaire, même après qualification. Candidat inaccessible au chemin démo ; promotion dans un commit séparé avec preuves exactes.
4. **Erreurs.** CE5 traduit les codes dans les catalogues existants EN/FR/DE/ES. `ineligible` ne doit plus apparaître comme erreur réseau. Aucun nouveau panneau. Conserver `messages/storyboard/*.json` et le chargement serveur de #221.
5. **Éditeur Comfy relayé.** Il est dans le périmètre de la règle Comfy/open weights pour les soumissions effectuées via le Studio. Examiner `src/lib/comfy-proxy.ts`, `comfy-media.ts`, `run-gate.ts` et les handlers de relais. Appliquer la même garde au graphe effectif avant transmission du POST prompt. Les lectures, l'historique, le polling et les jobs déjà partis continuent : aucun cancel. Pas de prétention à contrôler les actions faites directement sur un autre site Comfy.
6. **Compte.** CE5 adapte `client.user()` au véritable identifiant opaque stable renvoyé par `/api/user`, avec fixture expurgée du schéma observé. Ne pas deviner un champ ni rabattre sur le hash de clé. Si l'identifiant manque, pas de nouvelle soumission cinéma ; conserver le reçu. Une ancienne empreinte est un format legacy à migrer explicitement, jamais preuve d'identité. Tester rotation de clé du même compte et changement de compte.
7. **Undo CE3.** Refus conservateur accepté pour P0 si un settlement a modifié le sidecar entre-temps. Afficher un diagnostic compréhensible, garder les deux versions et toutes les prises. Ne pas tenter de fusion opportuniste de `takes/settled` dans l'ancien snapshot pour tenir l'échéance. L'annulation fine par domaines sera P1.
8. **Éligibilité.** La blacklist commune est une défense, pas un certificat. Le chemin P0 sélectionne seulement des manifestes documentés et qualifiés ; licence inconnue = pas de sélection démo. Aucun modèle supplémentaire introduit par CE5.
9. **U1.** Garder les améliorations d'accessibilité et les actions locales existantes dans le périmètre approuvé. Une action encore non raccordée est masquée dans le produit livré ; la maquette documentaire peut rester illustrative. Ne pas expédier le bouton image clé inactif comme fonctionnalité disponible.

## 4. Mission Cursor CE5, directement exécutable

### Branche, dépendances et ordre

Branche `test/cinema-p0-integration`, ouverte à partir de la pile CE3/CE2/CE0 publiée. Reprendre les commits exclusifs CE1 et CE4 ainsi que les correctifs de revue, après inspection des bases. Écrire les SHAs intégrés dans la PR. Pas de fusion de PR, pas de modification de main, pas de force-push ni de réécriture des branches sources. L'intégration peut être préparée avant l'accord de merge.

Ordre de travail :
1. R1–R5 et tests de panne dans les lots propriétaires.
2. Socle de session cinéma + adapters legacy + reprise.
3. Agent natif → CE3 → storyboard dans U1.
4. Références → image clé → vidéo → settlement → montage/export.
5. Tests de raccord, preview puis qualification Cloud par JD.

**Ne pas fusionner #224 seule comme livraison fonctionnelle : elle ferme l'ancien chat GPT en mode concours, alors que le raccord natif n'est pas encore présent.** Une livraison doit montrer le chemin intégré réel, ou signaler explicitement la capacité indisponible.

### Fichiers et propriétaire unique

- Raccord principal : `src/components/app/studio-session.tsx`.
- Service sans dépendance React : `src/lib/cinema/controller.ts` (nouveau) ; adapters compte, catalogue, manifestes et reprise selon les ports existants. Pas de logique de coût dans le JSX.
- Conversation : `src/components/app/uttu-free.tsx`, `src/components/storyboard/storyboard-page.tsx`, `storyboard-uttu.tsx`, `storyboard-workspace.tsx`.
- Persistance : adapter `use-storyboards.ts` aux commandes journalisées ; aucun second writer qui réécrit un board entier après un settlement.
- Génération : `src/lib/storyboard/film.ts`, `src/lib/render/run.ts` et garde des handlers relayés.
- Messages : catalogues existants seulement ; pas de nouveaux styles sauf ajustement nécessaire dans U1.
- Tests : `tests/cinema-controller.test.ts`, extensions des tests de lots, `e2e/cinema-p0-integration.spec.ts`. Mettre à jour DEMO-P0 et SOUMISSION via leur propriétaire, sans les dupliquer.

Lire les instructions Next locales avant code applicatif. Pas de nouvelle dépendance ni de changement du kernel vendored.

### Contrats du contrôleur

Les opérations exposées à la session doivent distinguer :
- **préparer une intention** : capturer compte/projet/storyboard/sélection/révisions/catalogue/verrous ; produire contexte borné, snapshot, graph et devis ; aucun POST ;
- **soumettre l'intention approuvée** : revalider, consommer l'accord/réserver, persister, puis un POST ; passer par le même budget que les rendus ;
- **reprendre l'intention** : GET seulement ; valider le texte complet avec CE3 et la cible d'origine, puis le journal ; proposition invalide ou ambiguë = zéro mutation et aucune requête payante de réparation ;
- **appliquer une opération locale** : même CE3 pour conversation et boutons (édition, duplication, ordre, archivage, undo) ; révisions/verrous revalidés au commit ;
- **préparer un plan** : sélectionner un manifeste autorisé pour cette action, préparer refs et génération exactes, calculer snapshot et devis ;
- **soumettre un plan approuvé** : validation finale puis chemin CE2 ; une approbation de plan ne vaut pas approbation du suivant ;
- **reprendre les résultats** : reprendre d'abord les journaux incomplets, puis reçus/jobs ; stockage ciblé sur le projet d'origine indépendamment du composant ouvert.

Chaque réponse au composant porte un code stable et une cible explicite. Les handles de client et les credentials restent en mémoire ; jamais dans contexte modèle, snapshot, journal, prompts ou télémétrie.

### Raccord conversation et storyboard

- Remplacer le préfixe « shot N » de CE4 par `selectedShotId` dans `buildIntentContext`. La requête reste intacte. Lire CE3 depuis le même snapshot que celui envoyé au modèle, puis vérifier l'état courant avant commit.
- Avant qualification, le profil candidat ne s'exécute que sur la preview de test prévue pour JD, dans les surfaces de confirmation déjà approuvées ; pas de nouvel outil public, sélecteur ou second agent.
- Produire côté code une description de schéma complète (enums de cadrage/caméra/durée/dialogue, champs requis et exemple valide) conforme au parser. Le prompt actuel ne donne pas toutes les valeurs de cadrage : ne pas laisser le modèle deviner le contrat.
- Conserver dans le contexte compact les références liées au plan sélectionné et ses champs nécessaires à la modification ; leur statut « verrouillé » seul ne décrit pas leur valeur. Diagnostiquer une réduction de contexte.
- Le journal doit être idempotent à l'échelle de la commande : après crash ou double livraison du même texte, ne pas créer deux séries de plans, ni retourner un état en mémoire différent des fichiers. Reprendre l'opération existante avant de recalculer/appliquer.
- Tous les writers directs des fiches, menus et undo passent par la validation/révision commune ; les anciennes sauvegardes du composant ne doivent pas contourner l'invalidation de devis.
- Les actions préparées (`prepared[]`) affichent le devis approprié, sans lancer le rendu.

### Raccord références et vidéo

Chaîne unique : catalogue du projet → `resolveReferences` → `prepareReferences` → `withPreparedHashes` → `compileReferences` → prompt des slots → graph → snapshot/devis.

- Même liste préparée pour coût, prompt et graph ; les fichiers relus après devis doivent conserver leurs hashes. Toute différence invalide l'accord.
- Lire `EnvoiPlan.references` avec les quatre rôles. Dans le chemin cinéma, ne plus utiliser `nouveaux/nouveauLieu` pour fabriquer implicitement des identités absentes.
- Verrous et collections complets ; aucune troncature pour tenir dans le modèle. Les sept références officielles restent nécessaires pour Uttu ; aucune image d'Uttu dans les tests.
- Image clé produite comme variante, source conservée ; son approbation est liée au plan, à sa révision et aux bindings, pas seulement à un assetId global.
- Animation P0 : uniquement cette image clé approuvée dans le chemin une image LTX. Un changement de plan invalide l'approbation d'image clé selon les champs affectés. Pas de composition intermédiaire cachée.
- Finaliser : sourceTakeId obligatoire, manifeste de finition, version fille et original intact. Pas de reroutage vers génération créative.

### Retour, budget et export

- Corriger R2/R3 avant raccord : lire/calculer/écrire sous le même verrou et conserver les conflits non réglés en attente.
- Un résultat d'une ancienne révision est une variante, indiquée dans le contexte ; il ne remplace pas une prise gardée.
- Reprise après navigation/reload sans montage de la page storyboard ; compte ou projet indisponible = reçu conservé.
- Sans exclusion fiable entre onglets, bloquer la concurrence payante ; ne pas transformer le marqueur TTL best effort en garantie. Les lectures/reprises ne démarrent aucun POST.
- Un coût encore inconnu conserve sa réserve et l'indication correspondante. Prévoir une réconciliation de facture sans prétendre que le solde constitue une preuve.
- Export : raccorder l'action au montage réel et aux prises sélectionnées. Le footer CE4 affiche actuellement des indications et l'impression ; ce texte ne prouve pas un export vidéo. Fournir une séquence réellement téléchargeable, épreuve 540p/12 fps correctement annoncée ; préserver les originaux. Aucun 1080p promis sans preuve.

## 5. Recette avant demande humaine

### Sans dépense

1. R1–R5 verts et tests existants préservés ; courses réelles de deux acteurs, pas seulement deux appels séquentiels.
2. Contexte → texte mocké → trois plans atomiques → édition du seul plan 2 → révisions et autres plans inchangés.
3. Un accord ne sert qu'une fois (texte et média), même après terminal/oubli/reload ; mutation seed/prompt/refs/compte après devis refusée.
4. Réponse POST perdue, refresh, autre projet ouvert, shot archivé, conflit de registre, échec de stockage, double callback : au plus un POST ; aucune prise perdue ; résultat au bon endroit.
5. Une sortie image clé approuvée alimente seule le graph vidéo ; aucune référence personnage inventée.
6. Montage et export via parcours UI réel avec médias de test explicitement synthétiques ; fixture isolée de toute preview publique.
7. 390×844, 844×390, 1024×600, 1280×800 ; cibles 44 px ; EN/FR/DE/ES ; état « non enregistré » et erreurs réelles ; un seul composer ; régression SSR/LCP vérifiée sur la même méthode que #221.
8. Typecheck, tests, build et e2e requis sur le SHA intégré. Résultats, limites et URL de preview dans la PR.

### Qualification payante : préparer, ne pas lancer

Après les corrections et une preview réellement raccordée, proposer à JD un dossier concret : SHA, graph digest, modèle/schema Cloud vérifiés en lecture, contexte synthétique, prompt exact, devis ou estimation indisponible, maximum de runs, plafond de tranche, consommation déjà engagée et critères d'arrêt.

La proposition CE0 reste **au plus deux essais texte**, un premier puis arrêt au premier échec ; hypothèse non mesurée « ≈ 1–3 crédits estimés » par essai, plafond de tranche proposé 10 crédits. Ce plafond n'est **pas approuvé** et ne garantit pas une limite technique chez le fournisseur. Aucun essai automatique de secours.

Qualité visuelle Enki/Fizz/Blanche et droits/compositions font l'objet d'une validation distincte avant leurs rendus. Les tests de contrats ne prouvent ni compréhension de Qwen ni absence de contamination visuelle.

Promotion de manifeste seulement avec runIds, version/graph exact, sortie observée, coût et verdict. Mettre à jour la candidature déjà soumise, sans modifier le clip ou la capture existants.

## 6. Conditions de livraison

CE5 est `partial` tant que les raccords ou reproductions restent ouverts ; `tested` pour les mocks ne signifie pas qualifié Cloud. Fournir une preview intégrée avant la demande de merge. JD reste seul décideur des fusions, dépenses, compositions et changements majeurs de design.

Planning Zurich inchangé : lundi intégration/répétition ; mardi 3 novembre 10 h gel, 16 h dossier prêt, 18 h limite finale. Les corrections critiques après gel nécessitent son accord.


## 7. Revue CE5 à `6bd185e` — missions immédiates, hors nouvelle UI

### Preuves reproductibles

[ce5-integration-regressions.patch](probes/ce5-integration-regressions.patch) ajoute sept assertions synthétiques. Elles **échouent toutes** sur `6bd185e` ; elles ne sont pas des tests passés. Aucun réseau, image privée, secret ou dépense.

```sh
git apply /chemin/vers/ce5-integration-regressions.patch
node --experimental-strip-types --no-warnings --test tests/astra-ce5-probes.test.ts
```

Contrôle positif exécuté séparément (après application du patch historique R1–R5) :

```sh
node --experimental-strip-types --no-warnings --test tests/cinema-*.test.ts tests/storyboard-reglage.test.ts tests/astra-review-probes.test.ts
# 210/210, zéro échec
```

| Repère | Défaut reproduit | Contrat attendu / test d'acceptation |
| --- | --- | --- |
| R6a, P1 | `resumeResults` exclut du `keep` les intents `failed/settled/provider_cancelled`. Après crash entre terminal et réconciliation, `resumeShotJobs` libère la réserve comme `never_sent` : 3 crédits retenus deviennent 0. | Conserver tout attempt associé à un reçu, y compris terminal, jusqu'à réconciliation. Terminal n'est pas preuve d'absence d'envoi. Récupération explicite → coût inconnu retenu ; un orphelin n'est libéré que sur preuve durable « jamais soumis ». Tester les trois états, crash et démarrage avant `resumeIntent`. |
| R6b, P1 | `recordCost` ignore une facture numérique après une estimation GPU numérique : 3 estimés puis 12 facturés restent comptés 3. | Hiérarchie de preuve `billing_job > gpu_estimate > unknown`, facture rapprochée du même attempt/job/compte, mises à jour idempotentes et datées. Avant facture, retenir au minimum la réserve ou l'estimation la plus conservatrice. La facture prévaut même si elle dépasse le plafond : enregistrer le dépassement, bloquer la prochaine opération, ne pas plafonner artificiellement le coût. |
| R7, P1 | `resumeIntent` annonce `INTENT_APPLIED` et `settled` dès qu'un journal existe, même `conflict`. | Après recovery, relire le journal. Seul `applied` confirme l'application. `conflict/prepared` restent en attente avec diagnostic ; `rolled_back` ne réapplique rien et n'est pas annoncé comme appliqué. Garder réponse, portée et contexte. Séparer fin du job / coût de réussite de la mutation. |
| R8, P1 | `rebaseBoard` impose l'ordre de `mine`, même si seule une action a été modifiée : un réordre externe `[s2,s1]` revient silencieusement à `[s1,s2]`. | Fusion à trois versions également pour ordre/séquences/parenté. Structure locale inchangée → structure disque ; les deux structures changées différemment → conflit explicite, disque conservé et copie locale. Tester ajout/suppression/réordre interséquences et vue mise à jour via `cinemaTick`. |
| R9, P1 | Supprimer puis rétablir un plan le remet à l'écran mais son ID reste dans `meta.archived` : CE3 et la génération le refusent. | Restauration explicite = statut actif cohérent, nouvelle révision, anciennes prises et historique conservés. Une image clé ou un devis d'avant l'archivage ne redevient pas valide. Ne pas ressusciter automatiquement un plan supprimé par un autre writer. |
| R10a/b, P1 | Le routeur local de la page lit `Make it a close-up` comme déplacement (`up`) et `Remove the rain` comme suppression du plan. Les réglages sont testés après ces regex. | Parser une **commande complète**, son objet et sa portée ; aucune action structurelle déduite d'un mot isolé. `close-up` ne change pas l'ordre ; retirer la pluie ne retire pas le plan ; négation/plusieurs cibles/clauses mixtes → clarification ou proposition native, aucune mutation opportuniste. Conserver les règles FR/EN/DE/ES. |

Ces tests concernent des comportements produit ; les corriger sans affaiblir leurs assertions. La CI verte existante ne les couvrait pas.

### Propriété et séquencement

| Sous-lot | Branche / fichiers | Dépendances | Acceptation |
| --- | --- | --- | --- |
| CE5-R budget et reprise | Cursor, `test/cinema-p0-integration` : `controller.ts`, `spend-ledger.ts`, tests contrôleur/ledger | CE0/CE2 intégrés ; pas de nouveau design | R6a/b et R7 verts ; aucun POST ni cancel dans recovery ; contrôle du compte avant lectures/applications |
| CE5-W writers | Même propriétaire, `board-writer.ts`, `use-storyboards.ts`, tests writer | CE3 et CE5-R pour replay | R8/R9 verts ; journaux appliqués conservés ou tombstone durable équivalent pour idempotence, traçabilité et inverse. Ne pas supprimer immédiatement le journal d'une sauvegarde « propre ». |
| CE5-L langue / catalogue | Même propriétaire : `corriger.ts`, `ecrire.ts`, selectors de références, tests purs | Aucun changement de layout | R10a/b + négation et clauses mixtes ; même voie de révision/locks ; aucun nouveau personnage pour une identité déjà connue sans photo |
| CE5-U1.1 | Proposition dans `UX_REVIEW.md`, implémentation après accord JD uniquement | Aucun blocage des trois sous-lots précédents | Une action principale par étape ; aucune grille vide dominante ; pas de fonction indisponible présentée comme prête |

Un seul propriétaire de `studio-session.tsx`/`storyboard-page.tsx` : intégrer séquentiellement les adapters. Correctifs additifs sur la branche propriétaire, nouveaux commits et preuves dans #228/#216. Main et PR #112 restent intacts.

### Arbitrages fermant les questions Cursor

1. **Compte confirmé.** La source plus récente de Cursor est vérifiée : [ComfyUI `a9ba0f1`, `openapi.yaml`, UserResponse](https://github.com/Comfy-Org/ComfyUI/blob/a9ba0f1/openapi.yaml#L1478) exige `id` et `status` ; `/api/user` référence ce type à la ligne 4431. `id` stable opaque, jamais clé, reste le bon contrat. Le schéma `Comfy-Org/docs/openapi-cloud.yaml` (blob `2268c8b2e6c5e0aab69fced96e9550f46eff2eba`) ne documentait que `status` : divergence identifiée, pas de nouvelle question à JD. Ajouter des fixtures structurelles sans valeur réelle. Vérifier le compte à la reprise et au rattachement d'un job inconnu.
2. **`closeWithUnknownCost`.** Accepté pour un job prouvé terminal, afin de permettre une nouvelle opération explicitement autorisée tout en comptant intégralement le coût inconnu. Ce n'est ni un coût nul, ni une facture, ni une libération de réserve. Ne jamais l'utiliser pour un POST incertain non rattaché. Un job auparavant incertain puis rattaché et prouvé terminal peut se clôturer ainsi, avec preuve conservée. R6 reste obligatoire.
3. **Hooks budget / `consumedByCaller`.** Ports CE0 vers ledger commun acceptés. Le booléen n'est pas une autorisation autonome : même verrou global, accord consommé par **cet attempt**, devis/digest/compte exacts, aucune autre réservation pour l'accord. Préférer un jeton interne lié à l'attempt ou une seule primitive atomique consume+reserve, plutôt qu'un bypass public. Vérifier écriture et relecture avant POST ; refus = zéro POST. La liste durable de consommation n'est jamais vidée pour réessayer.
4. **Re-pin du graph `88c980ce…`.** Une correction de schéma justifie un nouveau digest calculé depuis le fichier exact et couvert par les tests. Accepté comme candidat versionné, jamais comme qualification Cloud. Pas de changement automatique de loader en cas d'échec. Aucun devis existant ne survit à un changement de graph.
5. **XHR / qualification.** Garde XHR acceptée : ferme le même périmètre que fetch. Le drapeau `?cinema=qualification`, conservé seulement dans la session et inopérant en production, est acceptable pour la preview. Il rend le candidat accessible ; il **n'autorise aucune dépense**. Le dossier de qualification doit donner l'URL exacte avec ce drapeau. Aucun fallback fournisseur ni promotion démo implicite.
6. **Budget 49.** C'est une valeur antérieure rapportée par Cursor, avec date et provenance de facturation, pas une nouvelle autorisation ni une preuve consultée par Astra dans le compte privé. Ne pas demander à JD de la recopier. Avant chaque tranche, réconcilier facture/ledger sur une frontière temporelle explicite : éviter à la fois oubli des dépenses externes et double comptage des jobs du ledger. Une valeur manquante/périmée ou un compte différent bloque l'envoi. La tranche proposée de 10 et les deux essais restent non approuvés.
7. **Performance.** Garder le contrôleur différé. +0,14 s de LCP rapporté sur storyboard ne justifie pas une refonte de chargement avant P0 ; vérifier sur même protocole après stabilisation et traiter seulement une régression reproductible. Pas de report de la sauvegarde/reprise pour gagner un score.
8. **Routage local avant natif.** Accepté uniquement pour une intention locale univoque entièrement représentée et journalisée. Une regex caméra/ambiance n'est pas une compréhension générale. Conserver la demande entière et ses clauses ; en cas d'ambiguïté, ne rien muter, proposer la précision utile ou la préparation native. R10 bloque l'acceptation du raccourci actuel. `data.sauver(..., {now:true}) === false` doit bloquer la préparation native : ne pas continuer sur des fichiers plus anciens que l'écran.
9. **Titres, catégories, références (réponse a/b/c de #216).** a) Titres tirés de l'action réellement présente ; pas de segmentation automatique aveugle sur `; / while / then` (dialogues, simultanéité, lieux et noms restent cohérents). Le découpage natif validé produit des opérations ; un gabarit déterministe est annoncé comme brouillon. b) Distinguer personnages et lieux dans les données ; les textes visibles sont inclus dans U1.1. c) Toutes les identités CAST existantes et les références classées CAST participent à la résolution, même sans image. `identity exists` et `reference ready` sont deux états. Dédupliquer par ID/lien explicite, jamais fusionner deux homonymes ; homonymie = clarification. Une fiche sans image ne déclenche ni création de double ni invention d'identité. Au tournage seulement, expliquer les images/permissions manquantes.
10. **Manifestes prise.** Préparer à partir des graphs déjà présents (keyframe références puis vidéo depuis image approuvée), sans nouveau fournisseur. Pour chacun : hash, rôle des refs, limites, licence, coût et preuve de qualification. Rester candidat/masqué tant que cette preuve manque. On ne peut annoncer « P0 de bout en bout » avec le seul agent texte.

### Conditions de la prochaine revue

R1–R10 verts ; fixtures adverses et contrôles existants préservés ; corps #228 remis à jour ; SHA intégré, CI, preview et état exact des manifestes publiés. Les tests et le design restent distincts de la qualification payante et de l'accord de fusion. Pas de demande de dépense sur une preview encore exposée à ces erreurs.
