# Audit d’écarts — Studio OS

> **Relevé historique.** L’état après la refonte « studio direct » du 3 octobre 2026 est dans [DECISIONS.md](DECISIONS.md) et le [README](../README.md).

Relevé du **29 septembre 2026, 00:01 UTC**, sur `main` (`55f23a5`, PR #18 fusionnée) et sur l’hôte live. Aucun `POST /bootstrap`, `/train` ou `/gen` : pas de burn fal payant dans ce relevé.

Direction verrouillée, absente comme fichier dans ce dépôt (`studio-os-v3-comfy-auth.md` n’y est pas) et lue dans [DECISIONS.md](DECISIONS.md) plus le brief JD : **processus Comfy** · **Compte Clerk (Google / GitHub) et tableau** · **coffre Obsidian local** · **Créer d’abord** · **vente HOLD** · **rail fal live via le Worker**.

Critère produit JD, obligatoire : le studio doit permettre (1) de **réaliser sa LoRA** à partir des refs / du bootstrap, et (2) de **l’insérer dans des créations photos ou vidéos**. Le parcours a été relu dans le code et dans le JS de production (`/_next/static/chunks/app/page-e4920f2a2343ce92.js`). Aucun job payant.

| Étape | Photo | Vidéo |
| --- | --- | --- |
| Entraîner la LoRA | **Partiel.** Rail fal `POST /train` et Comfy Former sont dans la page. Aucun burn live. | Le fichier LoRA est le même. Aucun entraînement vidéo. |
| Garder le fichier | **Partiel.** Lien `.safetensors` fal, le temps de la page. `loras/` et `jobs.md` ne reçoivent rien. | **Manque.** Pas de fichier à insérer dans un clip. |
| Insérer la LoRA | **Partiel.** `POST /gen` (`fal-ai/flux-lora`) et l’image du même run Comfy. Tester est sans LoRA. | **Manque.** Pas de route, pas de bouton, pas de modèle. |

| Surface | État relevé |
| --- | --- |
| Studio | `https://u-ttu-studio.vercel.app` — HTML 200, Clerk Development, rail fal compilé dans le JS |
| Worker | `https://uttu-fal-proxy.helveticvault.workers.dev` — secrets présents |
| Catalogue Pages | `https://enudimmud.github.io/U-TTU-Studio/` — figé, `Last-Modified` 28 septembre 2026 16:13 UTC |
| Domaine | `u-ttu.studio` — le nom ne se résout pas |

## FAIT

Livré et visible, ou vérifié par une requête qui ne lance pas de job.

- **Créer d’abord.** Le shell s’ouvre sur Créer (`src/lib/studio-modes.ts`, `modeFromHash` retombe sur `creer`). La page live affiche « Deux photos. Une identité. », le dépôt 2–3 photos, le plan de 15 cadrages, et l’en-tête **Vente HOLD · 8 octobre 2026** (`src/components/studio/shell.tsx`). Aucune route n’est protégée (`src/proxy.ts`).
- **Vente HOLD.** Pas de Stripe dans l’app. Le texte de Créer dit que la page ne facture pas (`src/components/studio/create-view.tsx`). L’échéance reste le 8 octobre 2026, ou 1 CHF, dans [DECISIONS.md](DECISIONS.md). Look-Lock reste hors du site.
- **Processus Comfy, deux apps.** « Former mon look » `?share=798eb224b972` (record `e8d7c649-0cb5-466b-be1a-4d7caa9204c2`) et « Tester un prompt » `?share=25954f3b0278` (record `d5746aa7-b780-4e09-b877-0cf39309e875`) dans `src/lib/processes.ts` et `src/lib/comfy-stack.ts`. Sphère les montre en cartes « Lancer ». Le cadre ne charge qu’après « Charger l’app Comfy ici » (`src/components/guide/comfy-run-panel.tsx`). Les deux URL répondent HTTP 200 : c’est la coque `cloud.comfy.org`, pas une relecture du graphe dans cet audit.
- **Coffre local.** Mode Studio : schéma `refs/`, `dataset/`, `loras/`, `scenes/`, `processes/`, `jobs.md`, `CANON.md`, ZIP `public/vault/U-TTU-Studio.zip` (`src/lib/vault.ts`). L’URL live du ZIP répond 200. Le site n’écrit pas dans le dossier. Les fiches Sphère s’exportent en `scenes/avant.md`, `scenes/apres.md`, `scenes/entre.md` et restent dans `localStorage` (`u-ttu-scenes`, `src/lib/scenes.ts`, PR #16).
- **Compte Clerk, instance Development.** App `app_3JxoXh0l1EQ`. L’hôte charge `https://ideal-wasp-4637.clerk.accounts.dev`. L’environnement public Clerk dit `instance_environment_type: development`, Google et GitHub **activés** (`oauth_google`, `oauth_github`), accueil `https://u-ttu-studio.vercel.app`, chemins `/sign-in` et `/sign-up`. `/sign-in` répond 200 avec le composant `SignIn`. Créer et le ZIP restent ouverts sans session (`src/components/studio/account-panel.tsx`, [AUTH.md](AUTH.md), PR #12).
- **Journal de budget, une fois signé.** Lignes locales, clé `u-ttu-budget:` + identifiant Clerk, extrait `jobs-extrait.md` (`src/lib/budget.ts`, `src/components/studio/budget-journal.tsx`, PR #15). Anonyme : le texte d’attente, pas de seau.
- **Doctrine du burn.** Avant un entraînement long, le canon s’affiche ; les fixes ne sont pas bloquées ; confirmation si le look n’est pas tenu (`src/lib/doctrine.ts`, `src/components/studio/doctrine-burn.tsx`, PR #13).
- **Rail fal branché, auth et CORS seulement.**
  - Workflow [`.github/workflows/deploy-fal-proxy.yml`](../.github/workflows/deploy-fal-proxy.yml) (PR #18). Run GitHub Actions `36498953144`, succès, 28 septembre 2026 23:37 UTC, 43 s.
  - `GET /status` sans jeton : **401** `{"error":"Code d’accès refusé."}` — donc `FAL_KEY` et `ACCESS_TOKEN` (≥ 24 caractères) sont posés. Un secret manquant répondrait **503** (`workers/fal-proxy/src/proxy.ts`).
  - Origine `https://u-ttu-studio.vercel.app` : `Access-Control-Allow-Origin` égal à cette origine. Pareil pour `https://enudimmud.github.io`. Origine `https://example.com` : **403** `Origine refusée.`, sans en-tête CORS. `OPTIONS` : **204**.
  - Le JS de production contient `https://uttu-fal-proxy.helveticvault.workers.dev`. Le HTML de Créer montre le champ « Code d’accès du studio » et la phrase « La clé fal du studio paie » (`src/components/studio/create-panel.tsx`), qui n’apparaissent que si `NEXT_PUBLIC_FAL_PROXY_URL` est compilée (`src/lib/site.ts`).
  - CORS Vercel : PR #17, `ALLOWED_ORIGINS` dans `workers/fal-proxy/wrangler.toml`.
- **Pages arrêté.** [`.github/workflows/pages.yml`](../.github/workflows/pages.yml) vérifie tests, types et build. Il ne publie plus. Le HTML Pages ne contient ni « Compte », ni Clerk, ni `workers.dev` (figé au catalogue, avant la PR #12).

### Photo — parcours présent dans le code et le JS live

- **Train fal.** Après PASS du gate, Identité montre « Entraîner chez fal » (`src/components/guide/fal-rail.tsx`). Le Worker met `fal-ai/flux-lora-fast-training` en file (`workers/fal-proxy/src/proxy.ts`, `src/lib/fal-stack.ts`). Le lot 2–3 → 15 passe par `POST /bootstrap` (`fal-ai/flux-pro/kontext/multi`). Le JS live contient `/train`, `/bootstrap` et la phrase « flux-lora-fast-training, puis flux-lora ».
- **Train Comfy, une image dans le même run.** « Former mon look » charge `TrainLoraNode` puis `LoraModelLoader` branché sur cette sortie, et `SaveImage` (`src/lib/comfy-workflows.ts`). Le JS live le dit : « Le repli Comfy entraîne et produit une image dans le même lancement, sans fichier à emporter. »
- **Gen photo fal, contrat seulement.** `POST /gen` attend `{ lora, prompt, scale, seed }` et appelle `fal-ai/flux-lora` en 1024². La grille 0,60 / 0,75 / 0,90 ne part qu’avec l’URL rendue par l’entraînement (`src/components/guide/fal-rail.tsx`). Le JS live contient la route `/gen`.

### Vidéo — ce qui est vraiment livré

- **La phrase, pas le clip.** Les trois fiches Sphère affichent « Le burn vidéo attend le look tenu. Ici, il reste Bientôt. » (`VIDEO_BURN_NOTE`, `src/components/studio/scene-fiches.tsx`). Le JS live contient cette phrase, « Aucun rendu vidéo n’est appelé depuis cette page » (Avant) et « Aucun modèle vidéo » (Entre). `scenes/` du coffre dit « Les clips, plus tard » (`src/lib/vault.ts`), texte présent dans le même JS.
- **`BurnKind` inclut `"video"`.** `admitBurn("video", …)` n’est appelé par aucun bouton. Le seul appel UI est `admitBurn("train", …)` dans `src/components/studio/create-view.tsx`.

## PARTIEL

Le morceau existe. Il ne tient pas encore le pilier.

### Photo — la boucle n’est pas fermée

- **Train et gen fal, non fumés.** Boutons et routes sont là. **`POST /bootstrap`, `/train` et `/gen` n’ont pas été appelés sur le Worker live.** La preuve du 25 septembre (100 étapes, dataset synthétique, machine U*TTU) n’est pas rejouée. `TIMING.measured` reste `false`.
- **Téléchargement fal, lien temporaire.** Après un train réussi, le bouton ouvre `diffusers_lora_file` dans un nouvel onglet (`src/components/guide/fal-rail.tsx`). La FAQ live le promet (« un fichier .safetensors à télécharger »). L’URL meurt avec la page. Rien n’est écrit dans `loras/`, ni dans `jobs.md`. Le ZIP de départ ne contient qu’une ligne modèle « LoRA déposée » à effacer (`jobsTemplate` dans `src/lib/vault.ts`).
- **Comfy Former ne donne pas une LoRA réutilisable.** Pas de `SaveLoRA` sur Cloud ([COMFY-STACK.md](COMFY-STACK.md)). L’image « Avec LoRA » sort du même run. On ne peut pas reprendre ce fichier pour une autre photo.
- **Tester n’insère pas la LoRA.** `buildPromptTestWorkflow` encode le UNET nu (`src/lib/comfy-workflows.ts`). La carte dit « Sans look ». Le JS live contient « Sans look ».
- **Entre deux images — partage manquant, et ce n’est pas une insertion de LoRA.** Carte au catalogue, bouton éteint, pas de cadre (PR #14). `NEXT_PUBLIC_COMFY_ENTRE_APP_URL` est le seul crochet (`src/lib/comfy-stack.ts`, `entreShareUrl`). Vide dans `.env.example`. Un partage qui recopierait Former ou Tester est refusé. `COMFY_APPS.entre.file` est vide. Le texte de la fiche : « Aucun modèle vidéo, aucun compte, aucun envoi. »
- **Avant et Après.** Cartes « Bientôt » (`src/lib/processes.ts`). Fiches de lieu éditables. Pas d’image générée depuis ces cartes.

### Vidéo — amorce seulement

- **Aucun inserteur.** Pas de route Worker vidéo à côté de `/train` et `/gen`. Pas de nœud vidéo dans `src/lib/comfy-workflows.ts` (sorties `SaveImage` seulement). Pas de composant « Soft Error » : cette chaîne n’existe ni dans le dépôt, ni dans le JS live (les « soft » du bundle sont des mots de prompt : softbox, soft daylight).

### Reste du studio

- **Tableau Compte.** Connecté : profil, `UserButton`, « Tes runs » (aucun run cloud), « Ton studio cloud » (vide). Le journal est une saisie libre, 24 lignes, pas un solde, pas un chiffre venu de fal (`src/lib/budget.ts`). Clerk n’est pas lié au Worker : le code d’accès fal est un secret partagé, tapé dans la page, gardé en mémoire jusqu’au rechargement (`src/components/guide/fal-rail.tsx`).
- **Clerk sur l’hôte public.** Les clés live sont `pk_test_` (Development), pas `pk_live_`. [AUTH.md](AUTH.md) réserve Production à une autre instance, plus tard. Le parcours OAuth n’a pas été cliqué dans cet audit : les providers sont allumés dans l’environnement Clerk, la session signée n’a pas été ouverte ici.
- **Rail fal, détail du non-fumé.** Le bouton de lot s’allume avec trigger, 2 ou 3 photos, deux traits et le code (`src/lib/prepare-preflight.ts`). L’entraînement et la grille sont dans Identité, après PASS (`src/components/studio/identity-panel.tsx`). Le non-fumé payant est dans la section Photo. Taux `1 USD = 0,82 CHF` marqué non vérifié (`src/lib/fal-stack.ts`).
- **Bibliothèque.** Aperçu de la session seulement. Recharger efface les images (`src/components/studio/library-panel.tsx`). Le coffre, lui, ne reçoit rien tout seul.
- **Repli Comfy.** Expert replié, second clic, crédits du visiteur. Coûts encore des fourchettes non mesurées. `SaveLoRA` toujours absent : pas de fichier LoRA côté Comfy ([COMFY-STACK.md](COMFY-STACK.md)).
- **Docs en retard sur le déploiement.** README, [FAL-SPIKE.md](FAL-SPIKE.md), [VAULT.md](VAULT.md) et le statut en tête de `workers/fal-proxy/README.md` disent encore que le Worker n’est pas déployé, ou « pas de Worker fal ». Le workflow #18 a réussi et `/status` répond 401. [DECISIONS.md](DECISIONS.md) s’arrête à la note CORS du 28 septembre, qui dit aussi que le Worker n’est pas déployé par cette note.

## MANQUE

Pas commencé, ou bloqué hors du dépôt.

### Photo

- **Ranger la LoRA et la réutiliser plus tard.** Le site ne copie pas le `.safetensors` dans `loras/`, n’ajoute pas de ligne réelle à `jobs.md`, et ne recharge pas un fichier du coffre dans `/gen`. Seule l’URL fal encore en mémoire alimente la grille.
- **Partage Comfy Entre.** Aucun `?share=` distinct dans git, les docs, ou l’environnement d’exemple. Bloqué tant que JD ne publie pas une app et ne pose pas `NEXT_PUBLIC_COMFY_ENTRE_APP_URL` sur Vercel, puis un redéploiement. Même publié, ce crochet ouvre une app Comfy : le dépôt n’a pas de graphe Entre, et le texte actuel exclut un modèle vidéo.
- **Burn payant du rail photo.** Pas de lot Kontext live, pas d’entraînement `fal-ai/flux-lora-fast-training`, pas de grille `fal-ai/flux-lora` depuis le site. Fidélité d’identité non mesurée. Facture fal non rapprochée des estimations (lot ≈ 0,60 $, 1 000 étapes + 1 image ≈ 2,04 $, dans [FAL-SPIKE.md](FAL-SPIKE.md)).

### Vidéo

- **Boucle LoRA → clip.** Elle n’existe pas. Entre n’est pas ce chemin (partage absent, et « Aucun modèle vidéo »). Tester est une photo sans LoRA. Aucune surface « Soft Error ». La plus petite finition, sans modèle inventé : laisser la phrase déjà en ligne sur les fiches (« Ici, il reste Bientôt ») et, le jour où JD nomme un endpoint, une seule route Worker qui prend l’URL `.safetensors` déjà rendue par `/train` et une fiche `scenes/`. Pas d’autre surface d’ici là.
- **Métrage.** Le budget n’écoute pas le Worker. « Tes runs » ne se remplit pas. Pas de plafond global : qui a `ACCESS_TOKEN` dépense (`workers/fal-proxy/README.md`, limite connue).
- **Vente.** 0 CHF encaissé. Pas de checkout. Le formulaire d’attente `src/components/waitlist-form.tsx` n’est monté nulle part.
- **Instance Clerk Production et domaine `u-ttu.studio`.** DNS absent. Domaine en pause, côté brief. Les previews `*.vercel.app` ne sont pas dans `ALLOWED_ORIGINS` : un aperçu Vercel reçoit 403 du Worker.
- **Sync du coffre, jobs cloud, API Comfy dans le domaine, Stripe, 3D, voix.** Décidés hors de cette livraison ([DECISIONS.md](DECISIONS.md), README). `scenes/` du ZIP de départ reste vide. Le clip, lui, est un manque du critère produit (section Vidéo ci-dessus), pas un oubli de rédaction.
- **Le brief d’architecture** `studio-os-v3-comfy-auth.md` n’est pas dans ce dépôt.

## RISQUES / dette

- **Date de kill au 8 octobre 2026.** Le chemin photo est branché dans le code. Il n’a pas produit une LoRA mesurée, ni 1 CHF. La vidéo n’a pas de route : le README la classe encore hors périmètre, alors que le critère JD l’exige.
- **Le lien fal n’est pas un coffre.** Même après un train réussi, fermer l’onglet perd l’URL. `loras/` reste un dossier vide du ZIP.
- **Code d’accès partagé.** Un seul `ACCESS_TOKEN`, pas de compte, pas de limite de débit, pas de Turnstile. Le champ est dans Créer dès que le proxy est compilé. Vider `NEXT_PUBLIC_FAL_PROXY_URL` n’éteint pas le Worker : il faut révoquer le secret (README Worker).
- **CORS étroit.** Live et Pages seulement. Une preview, ou `u-ttu.studio` le jour où le DNS revient, est refusée tant que `ALLOWED_ORIGINS` ne change pas et que le Worker n’est pas redéployé.
- **Clerk Development sur l’URL publique.** Conforme au brief (SSO Dev). Les quotas, le bandeau Clerk et l’interdiction de coller `pk_test_` en Production Vercel ([AUTH.md](AUTH.md)) restent vrais. Les cookies de session sont ceux de l’instance Development.
- **Session fragile.** Photos et lot meurent au rechargement. Un bootstrap lancé puis une fermeture d’onglet laisse la facture chez fal et rien dans le journal.
- **Effacement fal non mesuré.** Expiration demandée 24 h (ZIP) et 7 jours (sorties), `X-Fal-Store-IO: 0`. Les URL `fal.media` restent lisibles par qui les connaît ([FAL-SPIKE.md](FAL-SPIKE.md)).
- **CPU Worker.** Plan gratuit, 10 ms. Un ZIP réel sur `/train`, ou 15 mises en file sur `/bootstrap`, n’a pas été tenu en live.
- **Docs qui contredisent le live.** Risque de redéployer « pour allumer » un rail déjà allumé, ou de croire le bouton de lot encore mort.
- **Pages et Vercel divergent.** Le catalogue figé n’a ni Compte ni rail. Ne pas y republier `NEXT_PUBLIC_FAL_PROXY_URL`.
- **Code mort.** `WaitlistForm` (`src/components/waitlist-form.tsx`) et les événements `waitlist_*` dans `src/lib/analytics.ts` (fonction vide).

## PROPOSITION d’ordre de finition

1. **Fermer la boucle photo, une fois, au budget annoncé.** Lot 2–3 → 15 (environ 0,60 $), PASS du gate, `POST /train` court, téléchargement du `.safetensors`, puis une case de `POST /gen` avec cette URL. Noter la facture. C’est le critère « sa LoRA, puis une photo ». Ne pas ouvrir la vente sur cette seule preuve.
2. **Une ligne de journal qui vient du run.** Après ce burn, le coût réel doit pouvoir se noter dans Compte sans être inventé par le cloud. Aujourd’hui la saisie est entièrement manuelle (`src/lib/budget.ts`).
3. **Aligner les docs sur le live.** README, [FAL-SPIKE.md](FAL-SPIKE.md), [VAULT.md](VAULT.md), tête de `workers/fal-proxy/README.md`, et une entrée [DECISIONS.md](DECISIONS.md) : Worker déployé, `/status` en 401, jobs payants non fumés, vente HOLD.
4. **Partage Entre, seulement s’il existe.** Publier l’app Comfy, poser `NEXT_PUBLIC_COMFY_ENTRE_APP_URL` (URL `https://cloud.comfy.org/?share=` distincte de Former et de Tester), redéployer Vercel. Sans cette URL, laisser « Partage manquant ».
5. **Garde-fou de dépense avant d’élargir le code.** Plafond ou limite de débit sur le Worker. Le code partagé paie avec `FAL_KEY`.
6. **Domaine et Clerk Production ensemble, pas avant.** `u-ttu.studio` ne résout pas. Le jour où il revient : origine CORS, domaine Clerk, instance Production (`pk_live_`). D’ici là, l’hôte de travail reste `u-ttu-studio.vercel.app` en Development.
7. **Vidéo : ne pas la loger dans Entre ni dans Tester.** La boucle LoRA → clip est un manque. La finition minimale est la phrase déjà live sur les fiches, jusqu’à ce que JD nomme un endpoint. Ensuite, une route qui consomme l’URL fal déjà produite par `/train` et une fiche `scenes/`. Aucun modèle choisi dans cet audit.
