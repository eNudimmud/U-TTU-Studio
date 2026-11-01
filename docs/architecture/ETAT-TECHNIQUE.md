# État technique — U*TTU Studio (pour Work Astra)

Relevé du **dimanche 1er novembre 2026, 03:00–03:40 (heure de Zurich)**, par Cursor (exécution). Lecture seule : aucun push sur `main`, aucune fusion, aucun job Comfy payant, aucun secret lu.
Source de vérité : ce dépôt. Suivi des tâches : issue « Suivi Astra × Cursor ».

## 1. Résumé en 6 lignes

1. `main` = `0e4d6a5` (#210, storyboard ouvert), en production (déploiement Vercel Production du 31.10 à 17:41 Zurich), CI verte ([run 41220829568](https://github.com/eNudimmud/U-TTU-Studio/actions/runs/41220829568)). `/storyboard` répond 200 en prod.
2. Tests unitaires verts sur `main` (859/860), #209 (868/869) et #211 (809/810). La fusion d'essai #211 + #209 passe les unitaires (818/819) mais **échoue au typecheck** et a **un conflit e2e**.
3. **#209 est rouge en CI** depuis son dernier commit `49b1e62` (le solde est lu directement sur `api.comfy.org` depuis le navigateur, ce que le test e2e `uttu-agent-mobile` interdit).
4. **Bug générique de mélange d'identités trouvé dans le chemin film/storyboard** : `takePrompt` dit aux modèles que tous les personnages sont « la même personne » (§5).
5. **Le chemin film/storyboard envoie la planche (`card.sheet`) en priorité sur les photos** : cause plausible du « collage de planche » (§5).
6. Le parcours P0 existe de bout en bout sauf un maillon : **l'agent Uttu ne produit ni storyboard ni opérations** ; le storyboard est écrit par un rédacteur déterministe (§6).

## 2. Branches et PR ouvertes

| PR | Branche | Tête | CI | Fusionnable | État |
|---|---|---|---|---|---|
| [#209](https://github.com/eNudimmud/U-TTU-Studio/pull/209) | `fix/bulle-nano-banana` | `49b1e62` (01.11, 02:26) | **rouge** : `verify` en échec ([run 41261148559](https://github.com/eNudimmud/U-TTU-Studio/actions/runs/41261148559)), 1 test e2e `[mobile] uttu-agent-mobile.spec.ts:69` (`outside` ≠ `[]`). `b033c70` et avant : verts. | oui (`UNSTABLE`) | Moteurs Klein (défaut), Qwen Image 2.1, FLUX.2 dev dans la bulle ; pose par seed (8 mises en scène) ; coût réel lu sur la ligne facturée du job. **Titre et description encore « Nano Banana »** : à réécrire avant fusion. Un autre exécutant travaille dessus (fond FLUX / coût / solde). |
| [#211](https://github.com/eNudimmud/U-TTU-Studio/pull/211) | `chore/supprimer-ancien-film` | `d69ab76` (31.10, 23:02) | verte ([run 41246333311](https://github.com/eNudimmud/U-TTU-Studio/actions/runs/41246333311)) | oui (`CLEAN`) | Supprime l'ancien film (103 fichiers, −11 034 lignes), le nouveau s'affiche au premier rendu. |
| [#193](https://github.com/eNudimmud/U-TTU-Studio/pull/193) | `fix/domaine-pages-login-sans-en-tetes` | `1e266bb` | verte | oui (`clean`), 64 commits de retard | Attend la réponse de Comfy (liste autorisée), puis le oui de JD. |
| [#112](https://github.com/eNudimmud/U-TTU-Studio/pull/112) | `concours/composer-carte-intentions` | `7596ae0` | verte (ancienne) | non (`dirty`, 286 commits de retard) | **Intouchable.** Brouillon. |

### Conflits #209 × #211 (fusion d'essai locale, non poussée)

- Fichiers touchés par les deux : `e2e/creation-references.spec.ts`, `messages/{de,en,es,fr}.json`, `src/components/app/app.css`, `src/components/app/studio-session.tsx`.
- Conflit textuel : **`e2e/creation-references.spec.ts` seulement** (le reste fusionne seul).
- Typecheck après fusion : `tests/creation-bubble.test.ts(303,40)` et `(303,105)` : `TS2554 Expected 1 arguments, but got 2`. #211 retire le 2e paramètre de `prefsSession(stored)` ; #209 l'appelle encore avec `, true`. **Correctif connu : retirer `, true` aux deux appels de la ligne 303.** Les unitaires passent quand même (Node retire les types sans les vérifier) : seul `npm run typecheck` le voit.
- Ordre conseillé : fusionner #211 d'abord (verte, mécanique), puis rebaser #209 dessus avec ces deux corrections.

## 3. Santé des tests (01.11, ~03:15 Zurich, Node 24.22, worktrees jetables)

| Arbre | `npm test` | Typecheck |
|---|---|---|
| `main` `0e4d6a5` | 860 tests, **859 pass**, 0 fail, 1 skip | vert en CI |
| #209 `49b1e62` | 869 tests, **868 pass**, 0 fail, 1 skip | vert en CI (e2e rouge, voir §2) |
| #211 `d69ab76` | 810 tests, **809 pass**, 0 fail, 1 skip (−50 : tests de l'ancien film supprimés) | vert en CI |
| Essai #211 + #209 | 819 tests, **818 pass**, 0 fail, 1 skip | **rouge** (ligne 303) |

Playwright non relancé localement : la revue du 31.10 a montré que `next dev` produit de faux échecs (overlay Next, navigateurs non installés). Le signal fiable est la CI (`npm start` après build).

## 4. Carte des composants (après #211)

| Domaine | Fichiers clés | Rôle |
|---|---|---|
| Session | `src/components/app/studio-session.tsx` (2 465 l.) | Contexte React, écritures du coffre, **tous** les rendus payants (bulle, CAST, DÉCOR, prise, suite, outils). Point de fragilité n°1. |
| Bulle de création | `src/components/app/creation-bar.tsx`, `barre-fil.tsx`, `src/lib/barre/thread.ts` | Champ « What are we shooting? », fil, puces @Nom, confirmation, résultat. |
| Moteurs bulle | `src/lib/creation/bubble.ts` (#209) | Choix du moteur (`klein`/`qwen`/`flux2`, Nano caché), répartition des photos (`bubbleReferenceSlots`), prompts (`bubblePrompt`), graphes (`flux2BubbleNodes`, `qwenBubbleNodes`, Klein via `render/klein-graph.ts`), devis (`bubbleQuote`). |
| CAST | `src/lib/creation/still.ts`, `named-references.ts`, `reference-board.ts`, `components/app/reference-library.tsx` | Fiches personnage, 1 à 3 photos, planche multi-vues. |
| DÉCOR | `src/lib/creation/decor-cadre.ts`, `src/lib/repere3d/*`, `components/app/reperage/*` | Lieux, repérage 3D (OSM, photos de rue), image gardée. |
| PRISE (film) | `components/app/film/film-plans.tsx`, `src/lib/film/*`, `src/lib/render/take-graph.ts`, `take-prompt.ts`, `references.ts`, `ltx-*`, `h3-base.ts` | Carte de plan : une phrase, Qui/Où, un devis, une confirmation, la prise. |
| Registre | `src/lib/film/registre.ts` (`.uttu/registre-plans.json`) | Personnages, lieux, plans, prises, montage par id. 3 réfs max par personnage. |
| Storyboard | `src/lib/storyboard/*` (`.uttu/sb-*.json` + Markdown), `src/app/storyboard`, `src/components/storyboard/*` | Modèle, rédacteur (`ecrire.ts`), devis (`devis.ts`), passage au film (`film.ts` → `tournerPlan`). |
| Agent Uttu | `src/lib/agent/uttu.ts` (gratuit, FAQ), `uttu-comfy.ts` (Comfy Router), route `/studio-agent/chat` | Répond et conseille ; **ne lance rien** par conception. |
| MONTAGE | `components/app/film/film-montage.tsx`, `src/lib/montage/*` | Timeline locale ; export `encode.ts` + `export-plan.ts`. |
| Médiathèque | `src/app/mon-studio`, `components/app/media-library.tsx`, `src/lib/coffre/*` | Projets dans le navigateur ou un dossier (Obsidian), ZIP. |
| Client Comfy | `src/lib/render/client.ts`, `run.ts`, `recovery.ts`, `src/lib/comfy-proxy.ts` | Envoi, suivi, jamais d'annulation, reçu local, solde, coût réel. |
| Prix et solde | `src/lib/credits.ts`, `workflows/registre.ts`, `render/billed-quote.ts`, `landed-cost.ts`, `measured-quote.ts` | Devis (« ≈ X crédits estimés »), plafond, coût réel. |

**Contrats tels qu'ils existent** (à figer ou changer par Astra) :
- Référence = `{ name, category: cast|decor|objet|style|photo, description?, pictures[] }` (`BubbleReference`). Ordre d'envoi : cast → photo → objet → style → décor.
- Plan storyboard → film : `EnvoiPlan { planId, phrase, ligne, castIds, decorId, nouveaux, nouveauLieu, settings }` (`storyboard/film.ts`), id stable `sb-<storyboard>-<plan>`.
- Rendu : `client.submit(graph)` → `followTake(jobId, balanceBefore)` → `{ balanceAfter, costCredits }`. Aucun `cancel`.
- Trois modèles de production coexistent : notes du coffre, registre film, storyboards. Liés par id.
- Deux constructeurs de prompt à références : `bubblePrompt` (images fixes) et `takePrompt` (prises vidéo). Ils n'ont pas les mêmes règles d'identité.

## 5. Continuité CAST / DÉCOR

### Où les références deviennent des images

| Chemin | Choix des images | Texte qui les nomme |
|---|---|---|
| Bulle image (#209) | `chipReference` → `bubbleReferenceSlots` : chaque photo de chaque référence, tour à tour, jusqu'à 7 (`bubble.ts` l. 164–182) | `bubblePrompt` : ordinal (Klein, **et FLUX.2 qui n'a pas de branche à lui**), `<imageN>` (Qwen), « image N » (Nano) |
| Film / storyboard | `tournerPlan` (`studio-session.tsx` ~l. 1745) : `card.sheet ? [card.sheet] : card.photos.slice(0, 1)` puis `referencePaths` (photos, puis vues du lieu) | `takePrompt` (`render/take-prompt.ts`) |

### Causes plausibles du mélange Fizz → Enki

1. **Film/storyboard, certain et générique** : `takePrompt` écrit `<Picture 1> and <Picture 2> show Enki, Fizz, the same person. Keep this person for the whole shot.` Avec deux personnages, le texte ordonne au modèle de les fondre en un.
2. **Film/storyboard, planche** : la planche multi-vues (`card.sheet`) passe avant les photos. C'est le « collage de planche » observé (planche du Blanche Of Castille, ~11 vignettes ; planche de Fizz, ~20 vues).
3. **Bulle, déséquilibre** : job FLUX.2 `d107aeb5` (seed 1870199061) : Enki ×3, Fizz ×1, Blanche ×1. Le personnage aux 3 photos domine le conditionnement.
4. **Bulle FLUX.2** : toutes les références sont chaînées dans un seul conditionnement (`ReferenceLatent` en série), sans masque ni région. Le prompt utilise les ordinaux du modèle Klein (« the first to third images »), pas un format propre à FLUX.2.
5. **Rôle CAST identique pour tous** : « keep this exact character… outfit » sans description propre quand la fiche n'en a pas. Rien ne dit « Fizz ne porte pas de vêtements ».
6. Déjà corrigé sur #209 : pose figée (mise en scène tirée de la seed, `0804426`), « stand » retiré (`22e4092`), planche non envoyée quand la fiche a une vue propre (`2541075`, **bulle seulement**).

Proposition de l'autre exécutant (document seul) : `/workspace/pose-dbg/methode-multi-perso.md` : A) une vue propre par personnage + description courte + règle « A n'a pas les vêtements de B » ; B) par étapes (plaque de décor, puis un personnage à la fois en Klein edit). **Décision d'architecture pour Astra.**

## 6. Parcours P0 : ce qui existe

| Étape | Existe ? | Où | Manque / cassé | Priorité |
|---|---|---|---|---|
| Intention | oui | bulle (`creation-bar.tsx`, `barre/thread.ts`), « Make a storyboard » (`05d49cd`) | — | — |
| Uttu Agent | partiel | `agent/uttu-comfy.ts` | L'agent conseille mais ne produit ni plans ni opérations (« never lets the model launch anything »). Le storyboard vient de `storyboard/ecrire.ts`, déterministe. | **P0 (décision)** |
| Storyboard | oui | `/storyboard` (200 en prod), `storyboard/*` | Contraste des puces, lien d'évitement sans cible (revue 31.10) | P2 |
| Workflow | oui, buggé | `storyboard/film.ts` → `tournerPlan` → `takePrompt` / `take-graph.ts` | « same person » + planche en priorité (§5) | **P0** |
| Génération Comfy | oui | `render/client.ts`, `run.ts` | #209 rouge (appel direct au solde) ; solde peu fiable sur `main` (§7) | **P0** |
| Résultat associé au plan | oui | `film/registre.ts`, `etatDuPlan`, `planFilmId` | Couvert par `film2-plan.spec.ts` (simulé) ; pas de test 3 plans storyboard → registre | P1 |
| Export | oui, limité | `montage/encode.ts`, `export-plan.ts` | 960×540, 12 i/s, 60 s max, nommé « Export ». Pas de master 1080p. | P1 (décision JD) |

## 7. Compteur de solde (347 → 360 sans recharge)

- Sur `main`, `client.balance()` (`render/client.ts` ~l. 302) lit `api.comfy.org/customers/balance` **seulement pour une session Comfy**. Avec une **clé API**, il lit `/api/billing/usage/timeseries` (via le relais), un rapport tiré des factures, « not a real-time meter ». Il retarde et peut monter après un rendu payant. Le coût mesuré = différence de deux soldes (`credits.ts measuredCost`, `landed-cost.ts`). D'où un solde qui monte et un coût faux ou absent.
- #209 `b033c70` / `49b1e62` : solde en direct pour une clé aussi, coût lu sur la ligne facturée du job (`/customers/events`, `chargeFromEvents`), repli sur le temps GPU. **C'est cet appel direct depuis le navigateur qui casse le test e2e** `uttu-agent-mobile` (qui interdit toute requête à `api.comfy.org`). Il faut choisir : passer par le relais, ou changer le contrat du test. **Décision à prendre** (sécurité : la clé reste dans le navigateur dans les deux cas).
- À vérifier : `readCents` lit `amount_cents ?? amount_micros` comme des centimes. Si Comfy renvoie de vrais micro-dollars, l'unité est fausse d'un facteur 10 000.

## 8. Régressions récentes (31.10 → 01.11)

| Constat | Preuve | État |
|---|---|---|
| #209 rouge après `49b1e62` | [run 41261148559](https://github.com/eNudimmud/U-TTU-Studio/actions/runs/41261148559) | ouvert (autre exécutant) |
| #209 × #211 : typecheck l. 303 + conflit e2e | fusion d'essai locale | correctif connu |
| `main` rouge à `5d043c7`, réparé à `d093b8c` | [run 41176697283](https://github.com/eNudimmud/U-TTU-Studio/actions/runs/41176697283) → [41178253394](https://github.com/eNudimmud/U-TTU-Studio/actions/runs/41178253394) | résolu |
| Storyboard en 404 sans drapeau (revue 31.10) | SB11 `db0b7e7`, prod 200 le 01.11 | résolu |
| Ancien film peint avant le nouveau | #211 | en attente de fusion |

## 9. Risques

1. `studio-session.tsx` porte tous les rendus : un lot sur la continuité touchera ce fichier. **Un seul propriétaire à la fois.**
2. Deux constructeurs de prompt divergents : corriger l'un ne corrige pas l'autre.
3. Le gel est mardi à 10:00 ; #209 et #211 doivent être fusionnés lundi au plus tard pour que les lots P0 partent d'une base stable.
4. Le prix FLUX.2 dev n'est pas confirmé (`FLUX2_PRICE_CONFIRMED = false`, ≈ 35 crédits réels mesurés sur une prise) : 3 plans FLUX.2 ≈ 105 crédits estimés sur un plafond de 300.

## 10. Décisions ouvertes (JD / Astra)

1. Agent Uttu : produit-il le storyboard (LLM via Comfy Router, payant) ou garde-t-on le rédacteur déterministe, l'agent ne faisant que reformuler ? (Astra)
2. Multi-personnages : méthode A (une passe, références équilibrées) ou B (par étapes, sans mélange possible, N+1 rendus) ? (Astra, puis JD pour le budget)
3. Solde : relais ou appel direct à `api.comfy.org` ? (Astra + JD)
4. Ordre de fusion : #211 puis #209 rebasée. (JD)
5. Export : rester « Épreuve 540p » pour le concours, ou master 1080p ? (JD)
6. Moteur de la démo : Klein (≈ 10–14 crédits estimés par image) ou FLUX.2 dev (≈ 35 réels) ? (JD)

## 11. Tests de non-régression proposés pour le P0 (pas encore écrits)

Tous à 0 crédit (unitaires ou Comfy simulé). À écrire dans le lot correspondant, après la décision d'architecture.

| # | Étape | Test | Type | Échoue aujourd'hui ? |
|---|---|---|---|---|
| T1 | Workflow | `takePrompt` avec deux personnages nomme chacun avec ses propres images et ne dit jamais « the same person » pour deux noms | unitaire | **oui** |
| T2 | Workflow | `tournerPlan` envoie les photos de la fiche quand elles existent, la planche seulement s'il n'y a rien d'autre | unitaire (extraire la sélection en fonction pure) | **oui** |
| T3 | Workflow | Bulle avec ≥ 2 personnages : répartition équilibrée (même nombre de vues par personnage), aucune planche si une vue propre existe | unitaire `bubbleReferenceSlots` | à vérifier (dépend de la méthode A/B) |
| T4 | Storyboard → film | `versPlanFilm` sur la démo de 3 plans : `castIds`/`decorId` exacts par plan, id `sb-<id>-<plan>` stable | unitaire | non |
| T5 | Bout en bout | Comfy simulé : storyboard 3 plans → 3 graphes ; `LoadImage` de chaque graphe = images de ses refs ; aucun `cancel` ; 3 prises rangées dans le registre ; 3 clips sur la timeline ; export actif | e2e, 390×844 et 1280×800 | à écrire |
| T6 | Génération | Un solde qui monte ne donne jamais un coût négatif ; coût lu sur la ligne du job ; aucune requête navigateur hors contrat | unitaire + e2e | contrat à trancher (§7) |
| T7 | Base | Fusion #211 + #209 : `npm run typecheck` vert | CI | **oui** (l. 303) |
