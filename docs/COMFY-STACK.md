# Stack Comfy Cloud — Flux.1 [dev], une seule

Source unique des réglages : [`src/lib/comfy-stack.ts`](../src/lib/comfy-stack.ts). Les graphes sont générés par [`src/lib/comfy-workflows.ts`](../src/lib/comfy-workflows.ts) (`npm run comfy:build`).

## Choix : Flux.1 [dev] plutôt que SDXL

| | Flux.1 [dev] | SDXL |
| --- | --- | --- |
| Identité (visage, peau) | Meilleure | Correcte |
| Légendes « trigger + variables » en langage naturel | Encodeur T5 : adapté | CLIP : légendes plus courtes |
| Temps d’entraînement | Plus lent : entraînement à 0,25 MP pour tenir 30 min | Plus rapide |
| Fichiers présents sur Comfy Cloud | `flux1-dev.safetensors`, `clip_l.safetensors`, `t5xxl_fp16.safetensors`, `ae.safetensors` | Oui |

**Décision :** Flux.1 [dev], parce que la qualité d’identité est ce qu’on vend. Le risque de durée est contenu par la résolution d’entraînement (0,25 MP), 800 étapes par défaut, un test à blanc obligatoire et un plafond d’étapes calculé par plan. SDXL n’est pas proposé en parallèle.

**Licence — à vérifier par JD.** Les poids Flux.1 [dev] sont sous licence non commerciale BFL. Les sorties sont décrites comme utilisables commercialement. Le client exécute le modèle sur son propre compte Comfy Cloud : U*TTU n’héberge pas le modèle. À faire valider avant de facturer.

## Faits Comfy Cloud vérifiés le 24.09.2026

| Fait | Source | Conséquence |
| --- | --- | --- |
| `TrainLoraNode`, `MakeTrainingDataset`, `LoraModelLoader` et `LossGraphNode` existent (core) | Catalogue MCP Comfy Cloud | Entraînement possible dans un workflow. |
| `SaveLoRA` (« Save LoRA Weights ») est **absent** du catalogue Cloud | `get_node` → missing | La LoRA ne peut pas être exportée. Elle vit le temps du run : entraînement et image partent dans le **même** run. |
| Les loaders de dataset par dossier sont absents | `get_node` → missing | 15 nodes `LoadImage`, assemblés par `CreateList`. |
| Import de LoRA : plans Creator et plus, depuis Hugging Face ou Civitai uniquement | [docs.comfy.org/cloud/import-models](https://docs.comfy.org/cloud/import-models) | Réutiliser une LoRA exigerait un plan payant supérieur et un fichier qu’on ne peut pas produire sur Cloud : hors périmètre. |
| Durée max d’un run : 30 min (Standard, Creator), 60 min (Pro) | [comfy.org/cloud](https://comfy.org/cloud/) | Au-delà, le run est coupé et les crédits sont perdus : plafond d’étapes dans l’UI. |
| GPU : ~0,39 crédit/s (RTX PRO 6000 Blackwell, 96 Go) | [Blog Comfy, déc. 2025](https://blog.comfy.org/p/comfy-cloud-update-unified-credit-system) | Base du calcul de coût. |
| 211 crédits ≈ 1 $ ; Standard 20 $ / 4 200 crédits ; Free 400 crédits/mois | [comfy.org/pricing](https://comfy.org/pricing/) | Conversion affichée. |
| `estimate_credits` renvoie **0 crédit** pour ces workflows | Outil MCP | Il ne compte que les nodes partenaires, pas le temps GPU. Le site calcule donc lui-même. |

## Les workflows

| Workflow | Lien App Mode | Record Comfy | Fichier importable | Source API |
| --- | --- | --- | --- | --- |
| **Dataset → LoRA → 1 image** | [cloud.comfy.org/?share=798eb224b972](https://cloud.comfy.org/?share=798eb224b972) | `e8d7c649-0cb5-466b-be1a-4d7caa9204c2` | [`public/comfy/c-micro-train-image.json`](../public/comfy/c-micro-train-image.json) | [`comfy/c-micro-train-image.api.json`](../comfy/c-micro-train-image.api.json) |
| **Test de prompt sans LoRA** | [cloud.comfy.org/?share=25954f3b0278](https://cloud.comfy.org/?share=25954f3b0278) | `d5746aa7-b780-4e09-b877-0cf39309e875` | [`public/comfy/c-micro-prompt-test.json`](../public/comfy/c-micro-prompt-test.json) | [`comfy/c-micro-prompt-test.api.json`](../comfy/c-micro-prompt-test.api.json) |

Le **test à blanc** n’est pas un troisième workflow : c’est le premier, lancé avec 20 étapes et 1 image, pour que les images restent déposées entre le test et le vrai run.

### 1. Dataset → LoRA → 1 image

```text
Image 01…15 (LoadImage) ─► CreateList ×3 ─► ImageScaleToTotalPixels (0,25 MP, pas 16)
Légendes (texte multiligne) ─► splitlines (basic_data_handling) ─┐
                                                                ▼
UNETLoader flux1-dev ─► TrainLoraNode ◄─ MakeTrainingDataset (VAE ae, CLIP clip_l + t5xxl)
                           │  rank 16 · AdamW · lr 4e-4 · bf16 · seed 42
                           ├─► LossGraphNode ─► « Courbe de loss »
                           └─► LoraModelLoader (Force LoRA) ─► KSampler ─► « Avec LoRA » (1 à 4 images)
UNETLoader flux1-dev ─────────────────────────────────────────► KSampler ─► « Témoin sans LoRA »
Prompt (CLIPTextEncode) ─► FluxGuidance 3,5 ─► les deux KSampler · Seed (PrimitiveInt, fixe) ─► les deux KSampler
```

- **Entrées App Mode, dans l’ordre** : Image 01 à Image 15 ; Légendes (15 lignes) ; Étapes d’entraînement ; Prompt ; Force LoRA ; Seed ; Nombre d’images.
- **Sorties App Mode** : Avec LoRA ; Témoin sans LoRA (même prompt, même seed) ; Courbe de loss.
- **Valeurs par défaut sûres** : 20 étapes et 1 image, soit un test à blanc si le client clique Run sans rien changer. Le texte par défaut des légendes fait 2 lignes. Une seule ligne serait recopiée en silence pour les 15 images par `MakeTrainingDataset` ; 2 lignes pour 15 images provoquent une erreur immédiate, avant l’entraînement.
- **Images non déposées** : leur valeur par défaut `DEPOSER-IMAGE-NN.png` n’existe pas, donc Comfy refuse le run à la validation, sans GPU.
- **Échantillonnage** : Flux dev, 1024×1024, 20 pas, euler / simple, cfg 1, FluxGuidance 3,5.

### 2. Test de prompt sans LoRA

UNETLoader, encodeurs Flux, `CLIPTextEncode`, FluxGuidance, KSampler (seed partagé), `SaveImage`. Entrées : Prompt, Seed. Il sert à régler scène, cadrage et lumière pour 7 à 29 crédits (estimation) avant de payer l’entraînement. Le trigger n’y a aucun effet.

## Recréer les workflows (2 minutes, sans GPU)

**Avec le MCP Comfy Cloud**, c’est la méthode utilisée ici :

1. `npm run comfy:build` régénère `comfy/*.api.json` depuis `src/lib/comfy-stack.ts`.
2. `submit_workflow` avec `dry_run: true` sur chaque fichier : validation sans exécution, 0 crédit.
3. `save_workflow` avec le JSON API et `name` égal à `c-micro-train-image` puis `c-micro-prompt-test`. Comfy convertit en format éditeur.
4. `create_app` avec les entrées et sorties listées dans `trainAppInputs()` / `trainAppOutputs()` (et leurs équivalents prompt).
5. `get_app_mode_url` avec `saved_workflow_filename` : lien `?share=`, à reporter dans `COMFY_APPS` ou dans les variables `NEXT_PUBLIC_COMFY_*_APP_URL`.
6. `get_saved_workflow`, puis copier `workflow_json` dans `public/comfy/*.json`. `npm test` vérifie que ces fichiers correspondent au générateur, lien par lien et valeur par valeur.

**À la main dans Comfy Cloud** : Workflow → Open → `public/comfy/c-micro-train-image.json`, puis bouton App Mode pour choisir les mêmes entrées et sorties. Même chose pour le test de prompt.

> Les liens `?share=` sont des instantanés publics du workflow, sans image ni clé. Selon Comfy, un lien de partage peut s’ouvrir sur le graphe tant que le partage App Mode complet n’est pas disponible. Les champs portent alors les mêmes titres. **À vérifier par JD au premier clic.**

## Affichage dans le guide

Après PASS, `ComfyRunPanel` propose `COMFY_APPS.train.url` en bas de l’étape 2 et `COMFY_APPS.prompt.url` en bas de l’étape 3. Rien n’est chargé depuis `cloud.comfy.org` avant un clic sur « Charger l’app Comfy ici » : le panneau dit ce qui va se charger et que Comfy peut charger ses propres traceurs. Au clic, un iframe de 640 à 900 px de haut remplace ce panneau ; « Recharger l’app » le recrée. Chaque étape se charge séparément. Le ZIP, les légendes et le coût restent au-dessus. Le client dépose toujours lui-même les 15 images et colle les légendes dans Comfy. « Ouvrir en plein onglet », même URL, reste au-dessus de chaque panneau, chargé ou non.

| Fait (2026-09-24) | Source | Conséquence |
| --- | --- | --- |
| La page de connexion Comfy appelle `www.googleadservices.com` et `px.ads.linkedin.com`. | Journal réseau Chrome | Chargement au clic seulement : sans action du visiteur, ni Comfy ni ses traceurs ne sont contactés (consentement, visiteurs CH/UE). |
| `cloud.comfy.org` envoie `frame-ancestors 'self' https:`, sans `X-Frame-Options`. | En-têtes HTTP | Cadre accepté depuis GitHub Pages. Refusé depuis une page HTTP, dont `next dev` : le panneau affiche un avertissement à la place du bouton de chargement. |
| Dans Chrome, après le clic, chaque cadre charge la page de connexion Comfy ; son `?share=` reste dans `previousFullPath`. | Smoke sur le build Pages ([QA.md](QA.md#cadre-comfy-dans-le-guide)) | L’embed fonctionne jusqu’à la connexion, et chaque cadre garde son workflow. |
| Après connexion, un `?share=` ouvre la fenêtre « Open shared workflow », puis charge le graphe dans la vue donnée par `extra.linearMode`. | Frontend Comfy : `useSharedWorkflowUrlLoader.ts`, `workflowService.ts` | Les deux snapshots ont `linearMode: true` : App Mode attendu. Liens non régénérés. |
| La session Comfy (Firebase) est gardée dans le localStorage et l’IndexedDB de `cloud.comfy.org`. | Frontend Comfy : `firebaseIdentity.ts` | Ce stockage est partitionné dans un cadre tiers : le client se connecte une fois dans le cadre, même s’il l’est déjà dans un autre onglet. |

Non vérifié sans compte Comfy tiers : la connexion (Google, GitHub ou e-mail) dans le cadre et l’écran App Mode connecté. Repli : « Ouvrir en plein onglet ».

## Coût : modèle et calibration

```text
durée   = frais fixes + étapes × s/étape + (images + témoin) × s/image
crédits = durée × 0,39      dollars = crédits / 211
```

| Hypothèse (`TIMING`, `measured: false`) | Basse | Haute |
| --- | --- | --- |
| Frais fixes : chargement du modèle, encodage | 90 s | 240 s |
| Entraînement Flux dev à 0,25 MP | 0,7 s/étape | 1,4 s/étape |
| Image 1024², 20 pas | 9 s | 14 s |

| Run | Estimation |
| --- | --- |
| Test de prompt (1 image) | 7–29 crédits (≈ 0,04–0,14 $) |
| Test à blanc (20 étapes, 1 image) | 48–115 crédits (≈ 0,23–0,55 $), 2–5 min |
| Run réel (800 étapes, 1 image + témoin) | 261–541 crédits (≈ 1,23–2,57 $), 11–23 min |

Plafond sûr = (limite du plan × 0,9 − frais fixes hauts − images × s/image haute) / s/étape haute, arrondi à 50 : **950 étapes** en Standard avec 1 image, **2 100** en Pro. L’UI refuse d’aller au-delà et barre la case « Run réel lancé ».

**Calibration, à faire par JD avant la première vente**, environ 300 à 650 crédits :

1. Lancer le test à blanc sur un vrai dataset (20 étapes), puis noter la durée affichée par Comfy.
2. Lancer un run réel de 800 étapes, puis noter la durée totale.
3. s/étape ≈ (durée réelle − durée du test) / 780. Frais fixes ≈ durée du test − 20 × s/étape − 2 × s/image.
4. Reporter les valeurs dans `TIMING`, passer `measured: true`, puis `npm test && npm run build`. Le site affiche alors « Durées mesurées ».
5. Facultatif : relancer le run réel en ne changeant que « Force LoRA ». ComfyUI réutilise en local la sortie d’un node dont les entrées n’ont pas changé ; si Comfy Cloud le fait aussi d’un run à l’autre, ce second run ne dure que le temps du rendu. Jusqu’à 541 crédits de plus. Noter le résultat dans [DECISIONS.md](DECISIONS.md) : il fixe le coût réel d’une case de la grille de test.

Aucun run n’a été lancé pendant cette livraison : **0 crédit dépensé**. La validité des graphes repose sur la validation `dry_run` de Comfy et sur la lecture du code des nodes (`comfy_extras/nodes_train.py`, `nodes_dataset.py`, `nodes_toolkit.py`). Le premier run réel reste le vrai test.

### Grille de test (étape 3)

La grille compare 3 prompts fixes (trigger seul sur fond neutre, pose et lumière jamais vues, autre style en option) à 3 forces : 0,60, 0,75 et 0,90, autour de la bande d’usage 0,70–0,85. La seed de l’étape 3 sert partout, et chaque run rend aussi son témoin sans LoRA. Les réglages sont dans [`src/lib/test-grid.ts`](../src/lib/test-grid.ts).

Le workflow ne rend qu’un prompt et une force par run, et la LoRA disparaît à la fin du run. **Une case = un run réel complet**, entraînement compris : 261–541 crédits à 800 étapes, estimation non mesurée. Le guide l’affiche à côté de la grille et propose un ordre : case 1 à 0,75, puis 0,90 ou 0,60 selon la lecture, puis les lignes 2 et 3. Chaque prompt peut d’abord passer dans le test sans LoRA, pour 7 à 29 crédits.

Pas de checkpoint intermédiaire non plus : sans `SaveLoRA`, impossible de comparer l’étape 400 à l’étape 800. La grille remplace cette comparaison par la paire avec/sans LoRA et par la variation de force.

## Risques connus

| Risque | Parade |
| --- | --- |
| `TrainLoraNode` est marqué expérimental par Comfy. | Test à blanc obligatoire (≤ 115 crédits). Si le node casse, il casse là. |
| Le pack `basic_data_handling` (découpage des légendes) disparaît de Cloud. | Le remplacer par 15 nodes `PrimitiveString` et un `CreateList`, puis régénérer. |
| La durée réelle dépasse les hypothèses. | Calibration, puis mise à jour de `TIMING` ; le plafond d’étapes suit automatiquement. |
| Qualité à 0,25 MP jugée insuffisante. | Passer `megapixels` à 0,39 dans `comfy-stack.ts`, avec environ 1,5 fois plus de temps par étape, et recalibrer. |
