# Audit d’écarts — Studio OS

> **Relevé historique.** L’état après la refonte « studio direct » du 3 octobre 2026 est dans [DECISIONS.md](DECISIONS.md) et le [README](../README.md).



Critère produit JD, obligatoire : le studio doit permettre (1) de **réaliser sa LoRA** à partir des refs / du bootstrap, et (2) de **l’insérer dans des créations photos ou vidéos**. Le parcours a été relu dans le code et dans le JS de production (`/_next/static/chunks/app/page-e4920f2a2343ce92.js`). Aucun job payant.

| Étape | Photo | Vidéo |
| --- | --- | --- |

| Surface | État relevé |
| --- | --- |
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
  - Origine `https://u-ttu-studio.vercel.app` : `Access-Control-Allow-Origin` égal à cette origine. Pareil pour `https://enudimmud.github.io`. Origine `https://example.com` : **403** `Origine refusée.`, sans en-tête CORS. `OPTIONS` : **204**.
- **Pages arrêté.** [`.github/workflows/pages.yml`](../.github/workflows/pages.yml) vérifie tests, types et build. Il ne publie plus. Le HTML Pages ne contient ni « Compte », ni Clerk, ni `workers.dev` (figé au catalogue, avant la PR #12).

### Photo — parcours présent dans le code et le JS live

- **Train Comfy, une image dans le même run.** « Former mon look » charge `TrainLoraNode` puis `LoraModelLoader` branché sur cette sortie, et `SaveImage` (`src/lib/comfy-workflows.ts`). Le JS live le dit : « Le repli Comfy entraîne et produit une image dans le même lancement, sans fichier à emporter. »

### Vidéo — ce qui est vraiment livré

- **La phrase, pas le clip.** Les trois fiches Sphère affichent « Le burn vidéo attend le look tenu. Ici, il reste Bientôt. » (`VIDEO_BURN_NOTE`, `src/components/studio/scene-fiches.tsx`). Le JS live contient cette phrase, « Aucun rendu vidéo n’est appelé depuis cette page » (Avant) et « Aucun modèle vidéo » (Entre). `scenes/` du coffre dit « Les clips, plus tard » (`src/lib/vault.ts`), texte présent dans le même JS.
- **`BurnKind` inclut `"video"`.** `admitBurn("video", …)` n’est appelé par aucun bouton. Le seul appel UI est `admitBurn("train", …)` dans `src/components/studio/create-view.tsx`.

## PARTIEL

Le morceau existe. Il ne tient pas encore le pilier.

### Photo — la boucle n’est pas fermée

- **Comfy Former ne donne pas une LoRA réutilisable.** Pas de `SaveLoRA` sur Cloud ([COMFY-STACK.md](COMFY-STACK.md)). L’image « Avec LoRA » sort du même run. On ne peut pas reprendre ce fichier pour une autre photo.
- **Tester n’insère pas la LoRA.** `buildPromptTestWorkflow` encode le UNET nu (`src/lib/comfy-workflows.ts`). La carte dit « Sans look ». Le JS live contient « Sans look ».
- **Entre deux images — partage manquant, et ce n’est pas une insertion de LoRA.** Carte au catalogue, bouton éteint, pas de cadre (PR #14). `NEXT_PUBLIC_COMFY_ENTRE_APP_URL` est le seul crochet (`src/lib/comfy-stack.ts`, `entreShareUrl`). Vide dans `.env.example`. Un partage qui recopierait Former ou Tester est refusé. `COMFY_APPS.entre.file` est vide. Le texte de la fiche : « Aucun modèle vidéo, aucun compte, aucun envoi. »
- **Avant et Après.** Cartes « Bientôt » (`src/lib/processes.ts`). Fiches de lieu éditables. Pas d’image générée depuis ces cartes.

### Vidéo — amorce seulement

- **Aucun inserteur.** Pas de route Worker vidéo à côté de `/train` et `/gen`. Pas de nœud vidéo dans `src/lib/comfy-workflows.ts` (sorties `SaveImage` seulement). Pas de composant « Soft Error » : cette chaîne n’existe ni dans le dépôt, ni dans le JS live (les « soft » du bundle sont des mots de prompt : softbox, soft daylight).

### Reste du studio

- **Clerk sur l’hôte public.** Les clés live sont `pk_test_` (Development), pas `pk_live_`. [AUTH.md](AUTH.md) réserve Production à une autre instance, plus tard. Le parcours OAuth n’a pas été cliqué dans cet audit : les providers sont allumés dans l’environnement Clerk, la session signée n’a pas été ouverte ici.
- **Bibliothèque.** Aperçu de la session seulement. Recharger efface les images (`src/components/studio/library-panel.tsx`). Le coffre, lui, ne reçoit rien tout seul.
- **Repli Comfy.** Expert replié, second clic, crédits du visiteur. Coûts encore des fourchettes non mesurées. `SaveLoRA` toujours absent : pas de fichier LoRA côté Comfy ([COMFY-STACK.md](COMFY-STACK.md)).

## MANQUE

Pas commencé, ou bloqué hors du dépôt.

### Photo

- **Partage Comfy Entre.** Aucun `?share=` distinct dans git, les docs, ou l’environnement d’exemple. Bloqué tant que JD ne publie pas une app et ne pose pas `NEXT_PUBLIC_COMFY_ENTRE_APP_URL` sur Vercel, puis un redéploiement. Même publié, ce crochet ouvre une app Comfy : le dépôt n’a pas de graphe Entre, et le texte actuel exclut un modèle vidéo.

### Vidéo

- **Boucle LoRA → clip.** Elle n’existe pas. Entre n’est pas ce chemin (partage absent, et « Aucun modèle vidéo »). Tester est une photo sans LoRA. Aucune surface « Soft Error ». La plus petite finition, sans modèle inventé : laisser la phrase déjà en ligne sur les fiches (« Ici, il reste Bientôt ») et, le jour où JD nomme un endpoint, une seule route Worker qui prend l’URL `.safetensors` déjà rendue par `/train` et une fiche `scenes/`. Pas d’autre surface d’ici là.
- **Vente.** 0 CHF encaissé. Pas de checkout. Le formulaire d’attente `src/components/waitlist-form.tsx` n’est monté nulle part.
- **Instance Clerk Production et domaine `u-ttu.studio`.** DNS absent. Domaine en pause, côté brief. Les previews `*.vercel.app` ne sont pas dans `ALLOWED_ORIGINS` : un aperçu Vercel reçoit 403 du Worker.
- **Sync du coffre, jobs cloud, API Comfy dans le domaine, Stripe, 3D, voix.** Décidés hors de cette livraison ([DECISIONS.md](DECISIONS.md), README). `scenes/` du ZIP de départ reste vide. Le clip, lui, est un manque du critère produit (section Vidéo ci-dessus), pas un oubli de rédaction.
- **Le brief d’architecture** `studio-os-v3-comfy-auth.md` n’est pas dans ce dépôt.

## RISQUES / dette

- **Date de kill au 8 octobre 2026.** Le chemin photo est branché dans le code. Il n’a pas produit une LoRA mesurée, ni 1 CHF. La vidéo n’a pas de route : le README la classe encore hors périmètre, alors que le critère JD l’exige.
- **CORS étroit.** Live et Pages seulement. Une preview, ou `u-ttu.studio` le jour où le DNS revient, est refusée tant que `ALLOWED_ORIGINS` ne change pas et que le Worker n’est pas redéployé.
- **Clerk Development sur l’URL publique.** Conforme au brief (SSO Dev). Les quotas, le bandeau Clerk et l’interdiction de coller `pk_test_` en Production Vercel ([AUTH.md](AUTH.md)) restent vrais. Les cookies de session sont ceux de l’instance Development.
- **CPU Worker.** Plan gratuit, 10 ms. Un ZIP réel sur `/train`, ou 15 mises en file sur `/bootstrap`, n’a pas été tenu en live.
- **Docs qui contredisent le live.** Risque de redéployer « pour allumer » un rail déjà allumé, ou de croire le bouton de lot encore mort.
- **Code mort.** `WaitlistForm` (`src/components/waitlist-form.tsx`) et les événements `waitlist_*` dans `src/lib/analytics.ts` (fonction vide).

## PROPOSITION d’ordre de finition

1. **Fermer la boucle photo, une fois, au budget annoncé.** Lot 2–3 → 15 (environ 0,60 $), PASS du gate, `POST /train` court, téléchargement du `.safetensors`, puis une case de `POST /gen` avec cette URL. Noter la facture. C’est le critère « sa LoRA, puis une photo ». Ne pas ouvrir la vente sur cette seule preuve.
2. **Une ligne de journal qui vient du run.** Après ce burn, le coût réel doit pouvoir se noter dans Compte sans être inventé par le cloud. Aujourd’hui la saisie est entièrement manuelle (`src/lib/budget.ts`).
4. **Partage Entre, seulement s’il existe.** Publier l’app Comfy, poser `NEXT_PUBLIC_COMFY_ENTRE_APP_URL` (URL `https://cloud.comfy.org/?share=` distincte de Former et de Tester), redéployer Vercel. Sans cette URL, laisser « Partage manquant ».
5. **Garde-fou de dépense avant d’élargir le code.** Plafond ou limite de débit sur le Worker. Le code partagé paie avec `FAL_KEY`.
6. **Domaine et Clerk Production ensemble, pas avant.** `u-ttu.studio` ne résout pas. Le jour où il revient : origine CORS, domaine Clerk, instance Production (`pk_live_`). D’ici là, l’hôte de travail reste `u-ttu-studio.vercel.app` en Development.
