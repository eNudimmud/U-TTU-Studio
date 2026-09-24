# Registre — C micro

Registre de vérité U*TTU : chaque ligne est un **fait**, une **hypothèse**, une **proposition** ou une **décision**. Dernière mise à jour : 2026-09-24.

## Décisions

| Décision | Par | Date |
| --- | --- | --- |
| Tuer A (Look-Lock, forfait DA et ZIP-juge) : retrait du site, de la nav, des métadonnées et de la carte OG, sans route d’archive. | JD (mission) | 2026-09-24 |
| C micro est l’unique offre : dataset propre → LoRA → 1 image. | JD (mission) | 2026-09-24 |
| Date de kill au 2026-10-08, ou 1 client payant avant. | JD (mission) | 2026-09-24 |
| Une seule stack : Flux.1 [dev] sur Comfy Cloud, pas de SDXL en parallèle. | Livraison ([COMFY-STACK.md](COMFY-STACK.md)) | 2026-09-24 |
| Entraînement et image dans le même run Comfy. | Livraison, imposé par l’absence de `SaveLoRA` sur Cloud | 2026-09-24 |
| Dataset fixé à 15 images exactement. | Livraison, imposé par les emplacements fixes de l’App Mode | 2026-09-24 |
| FAIL réservé aux violations ; information manquante en « À faire » ; PASS exige tout en PASS. | Livraison, après QA | 2026-09-24 |
| Aucun crédit Comfy dépensé pendant la livraison. Premier run = calibration par JD. | Livraison | 2026-09-24 |
| Après PASS, les deux apps Comfy s’affichent dans la page (iframe), avec « Ouvrir en plein onglet » au-dessus de chaque cadre. Pas de proxy, pas de crédits Studio, pas de préremplissage des 15 images. Ne débloque pas la vente. | Livraison | 2026-09-24 |
| Cadres Comfy chargés au clic seulement (« Charger l’app Comfy ici ») : Comfy charge ses propres traceurs, il faut le consentement des visiteurs CH/UE. « Ouvrir en plein onglet » reste disponible sans charger le cadre. | JD | 2026-09-24 |
| Doctrine LoRA 2026 intégrée au guide, sans changer la stack ni le statut de vente : repère de cadrage, coaching des légendes, grille de test. Pas de pile Pony, Kohya ou SDXL, pas d’auto-bootstrap (4 à 8 références → mini-LoRA → régénération). | JD (mission) | 2026-09-24 |
| Répartition visée des 15 images : 20–30 % gros plans, 40–50 % buste, 20–30 % plein pied, soit 3–5 / 6–8 / 3–5. Contrôle G20 en À NOTER, jamais bloquant ; G13 reste le minimum bloquant ([DATASET-GATE.md](DATASET-GATE.md#repère-de-cadrage-g20)). | JD (mission) | 2026-09-24 |
| Coaching des légendes : principe « ce qui change / ce que le trigger tient », exemples FAIL et PASS, aide sur chaque carte. Aucune règle nouvelle. | JD (mission) | 2026-09-24 |
| Grille de test à l’étape 3 : 3 prompts fixes × forces 0,60 / 0,75 / 0,90, seed de l’étape 3. Faute de `SaveLoRA`, ni checkpoint ni LoRA réutilisable : comparaison avec/sans LoRA et variation de force. Une case = un run complet, coût affiché ([COMFY-STACK.md](COMFY-STACK.md#grille-de-test-étape-3)). | JD (mission) | 2026-09-24 |
| Étapes d’entraînement par défaut inchangées (800). 1 200 à reconsidérer après calibration. | JD (mission) | 2026-09-24 |

## Faits

- Le catalogue Comfy Cloud contient `TrainLoraNode`, `MakeTrainingDataset`, `LoraModelLoader`, `LossGraphNode`, `CreateList`, `ImageScaleToTotalPixels` et `Basic data handling: StringSplitlinesDataList`. Il ne contient ni `SaveLoRA` ni les loaders de dataset par dossier (vérifié par MCP le 2026-09-24).
- Runs limités à 30 min en Standard et Creator, 60 min en Pro. GPU à ~0,39 crédit/s. 211 crédits ≈ 1 $. Import de LoRA réservé aux plans Creator et plus, depuis Hugging Face ou Civitai.
- `estimate_credits` renvoie 0 crédit pour les deux workflows : il ignore le temps GPU.
- Les deux workflows passent la validation `submit_workflow` en `dry_run`. Ils sont sauvegardés dans le workspace Comfy (records `e8d7c649…` et `d5746aa7…`, version 2 avec App Mode) et partagés en `?share=798eb224b972` et `?share=25954f3b0278`.
- Les graphes versionnés dans `public/comfy/` correspondent au générateur, lien par lien et valeur par valeur (`tests/comfy.test.ts`).
- QA E2E sur Chrome avec 20 images synthétiques : chaque piège est signalé, le PASS n’arrive qu’avec 15 images propres, le ZIP est valide ([QA.md](QA.md)).
- `cloud.comfy.org` envoie `frame-ancestors 'self' https:`, sans `X-Frame-Options` (2026-09-24). Après le clic, Chrome affiche la connexion Comfy dans les cadres du guide servi en HTTPS ; une page HTTP est refusée ([QA.md](QA.md#cadre-comfy-dans-le-guide)).
- La page de connexion Comfy appelle `www.googleadservices.com` et `px.ads.linkedin.com` (journal réseau Chrome, 2026-09-24). Avant le clic sur « Charger l’app Comfy ici », le guide ne contacte aucun domaine `comfy.org`.
- Frontend Comfy (`useSharedWorkflowUrlLoader.ts`, `workflowService.ts`) : un `?share=` passe par la connexion, puis la fenêtre « Open shared workflow », puis charge le graphe dans la vue donnée par `extra.linearMode`. Les snapshots `798eb224b972` et `25954f3b0278` ont `linearMode: true`.
- Le workflow d’entraînement a un seul prompt (`CLIPTextEncode`) et une seule force (`LoraModelLoader`) : un run rend une seule case de la grille de test, plus son témoin.

## Hypothèses — à mesurer

- Vitesse d’entraînement Flux dev à 0,25 MP sur les GPU Comfy : 0,7 à 1,4 s par étape. Frais fixes de 90 à 240 s. Image 1024² de 9 à 14 s.
- 800 étapes, lr 4e-4 et rank 16 sur 15 images suffisent pour une identité reconnaissable (réglages proches des entraîneurs Flux « rapides » courants). Non vérifié sur Comfy.
- Le `TrainLoraNode` du core entraîne correctement Flux.1 [dev] : implémentation générique, flow-matching géré par `model_sampling`. Node marqué expérimental.
- Les seuils de netteté (100 absolu, 35 % de la médiane) et de couleur (3,5 MAD) détectent assez de problèmes sans trop de faux positifs sur des photos réelles. Calibrés uniquement sur des images synthétiques.
- Un lien `?share=` ouvre l’App Mode une fois connecté. C’est ce que fait le code du frontend Comfy ; l’écran connecté n’a pas été vu.
- La connexion Comfy fonctionne dans le cadre. Sa session vit en localStorage et IndexedDB, partitionnés dans un cadre tiers : une connexion de plus est attendue. Non vérifié sans compte tiers ; repli : « Ouvrir en plein onglet ».
- La répartition 20–30 / 40–50 / 20–30 % et la bande d’usage 0,70–0,85 viennent des pratiques LoRA 2026 pour Flux. Elles ne sont pas calibrées sur ce stack (0,25 MP, 800 étapes, rank 16).
- Chaque run Comfy Cloud réentraîne la LoRA. En local, ComfyUI réutilise la sortie d’un node dont les entrées n’ont pas changé ; rien n’indique que Comfy Cloud le fasse d’un run à l’autre. À vérifier pendant la calibration ([COMFY-STACK.md](COMFY-STACK.md#coût--modèle-et-calibration), étape 5).
- Même dataset, mêmes étapes et seed d’entraînement fixe (42) : d’un run à l’autre, la LoRA ne varie que par les écarts de calcul du GPU. C’est ce qui rend les cases de la grille comparables. Non mesuré.

## Propositions — non vérifiées, décision JD

- **Prix** : CHF 49–149 pour un run guidé one-shot, ou crédits Comfy du client + frais de guidage. Affiché « prix pressenti, non confirmé ».
- **Licence Flux.1 [dev]** : faire valider l’usage commercial des sorties, le client exécutant le modèle sur son compte Comfy.
- **Calibration** avant toute vente : test à blanc et run réel sur un vrai dataset (≈ 300 à 650 crédits), puis `TIMING.measured = true`.
- **Phase test** : affichée jusqu’au 8 octobre 2026, date de kill.
- **Force par défaut de l’étape 3** : 1,00, valeur du workflow Comfy, au-dessus de la bande d’usage. Le guide l’explique sans la changer. Passer le guide à 0,75 tient en une ligne.
- **Grille en un seul run** : un workflow qui rendrait les 3 forces après un seul entraînement ferait passer une ligne de la grille de 3 runs complets à 1 run et 3 rendus de 9 à 14 s. Il faudrait régénérer, valider, sauvegarder et repartager les workflows Comfy : hors de cette livraison.

## Archive — offre A (tuée)

La première livraison vendait le « Look-Lock Pack » (CHF 800–2 500) et une direction légère mensuelle. JD l’a tuée le 2026-09-24. Tout son contenu a été retiré du site : comparaison, grille PASS / FAIL d’U*TTU, tarifs, Sanctuaire, formulaire de brief. Le code reste consultable dans l’historique git (`9fca7e5` et antérieurs). Le portrait canonique d’U*TTU fourni par JD reste utilisé dans le hero, légendé comme référence du studio ([VISUAL-CANON.md](VISUAL-CANON.md)).
