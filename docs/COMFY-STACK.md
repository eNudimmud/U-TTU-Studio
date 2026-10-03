# Stack Comfy Cloud

## La prise — studio direct, 3 octobre 2026

L’app tourne la prise elle-même, sur le compte Comfy Cloud de la personne, par l’API documentée de Comfy Cloud. Il n’y a plus de cadre Comfy à piloter, plus d’App Mode, plus de template réécrit.

### Le graphe

[`src/lib/render/take-graph.ts`](../src/lib/render/take-graph.ts) construit un graphe au format API, sur les modèles et l’échantillonneur du template officiel `video_minimax_h3_r2v`, sans ses interrupteurs.

| Élément | Valeur |
| --- | --- |
| Modèle | `minimax_h3_ref2va_pruned_int8_convrot.safetensors` (`UNETLoader`) |
| Texte | `qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors` (`CLIPLoader`, type `minimax`) |
| VAE vidéo, audio | `minimax_h3_video_vae_int8_convrot.safetensors`, `minimax_h3_audio_vae_fp32.safetensors` |
| Rapide | `LoraLoaderModelOnly` `minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors`, 4 pas |
| Fin | sans LoRA, 20 pas |
| Références | jusqu’à 9 `LoadImage`, titrées « Picture N », branchées sur `ref_images.ref_image_N` dans l’ordre : les photos du look, puis les images du lieu |
| Taille | `ResolutionSelector` 0,4 MP, multiple de 32 ; 9:16, 16:9 ou 1:1 |
| Images | 24 / s. Au moins 5, puis le compte suivant de la forme 17k + 5 : 5 s → 124, 8 s → 192 |
| Échantillonnage | `res_multistep`, `BasicScheduler` simple, `RandomNoise` (seed tirée au hasard), `BasicGuider`, `SamplerCustomAdvanced` |
| Sortie | `CreateVideo` (vidéo + son) → `SaveVideo` MP4 H.264, préfixe `uttu/prise` |

Le texte ([`take-prompt.ts`](../src/lib/render/take-prompt.ts)) nomme les balises dans l’ordre de connexion : « <Picture 1> and <Picture 2> show the same person. Keep this person for the whole shot. What does not change: … <Picture 3> shows the place, … The shot: … ».

**Fait (3 octobre 2026) :** les deux variantes (rapide et fin) passent `submit_workflow` en `dry_run` sur Comfy Cloud : « passed local pre-flight », aucun job, 0 crédit. Seul avertissement : `minimax_h3_video_vae_int8_convrot.safetensors` n’est pas dans l’index embarqué de l’outil ; c’est le fichier du template officiel. Les graphes validés sont les fixtures de `tests/take-graph.test.ts`.

### Les appels

Tout passe par le relais même origine du studio ([`src/lib/comfy-proxy.ts`](../src/lib/comfy-proxy.ts)), parce que `cloud.comfy.org` n’envoie pas d’en-têtes CORS pour ce domaine. Le relais transmet `authorization`, `x-api-key` et `content-type`, et le corps tel quel. Client : [`src/lib/render/client.ts`](../src/lib/render/client.ts), suivi : [`run.ts`](../src/lib/render/run.ts).

| Geste | Appel |
| --- | --- |
| Vérifier une clé | `GET /api/user` |
| Envoyer une photo | `POST /api/upload/image` (multipart `image`, `type=input`) → `name` |
| Mettre en file | `POST /api/prompt` `{ prompt, client_id }` → `prompt_id`. 400 : `node_errors`, nœud par nœud. 402 : crédits insuffisants. 429 : abonnement inactif ou file pleine. |
| Suivre | `GET /api/job/{id}/status` toutes les 3 s : en file, préparation, calcul, puis `success` / `completed`, ou `error`, `failed`, `lost`, `cancelled`. 35 min au plus. |
| Lire le résultat | `GET /api/jobs/{id}` : sorties, horodatages d’exécution, `execution_error` |
| Rapatrier la vidéo | `GET /api/view?filename&subfolder&type` : Comfy répond 302 vers une URL signée, le relais la suit et rend les octets sur le domaine du studio. Un 404 est rejoué comme avant (sous-dossier joint, puis recherche d’asset). |
| Annuler | `POST /api/queue` `{ delete: [id] }` |

Authentification : `X-API-Key` (clé créée sur `platform.comfy.org`, abonnement payant) ou `Authorization: Bearer` avec le jeton Firebase de la session ouverte dans la feuille « Me connecter ici ». Le jeton est rafraîchi comme le fait le SDK web (`securetoken.googleapis.com`), avec une marge de 60 s.

Les photos sont réduites à 1 536 px avant l’envoi : la limite de corps d’une requête sur Vercel est d’environ 4,5 Mo, et le modèle réduit les références de toute façon (`ref_image_size: match`).

### Les crédits

- **Solde.** Session : `GET https://api.comfy.org/customers/balance` (ce domaine accepte l’origine du studio). Clé, ou à défaut : `GET /api/billing/usage/timeseries?granularity=month&months=1`, champ `summary.balance`. Comfy rend des cents malgré le nom `amount_micros` ; crédits = cents × 211 / 100.
- **Coût mesuré.** Le solde est lu juste avant la confirmation, puis après la prise, jusqu’à 4 fois à 5 s d’écart tant qu’il n’a pas bougé. La différence est le coût. Une recharge entre les deux lectures rend la mesure illisible : rien n’est inventé.
- **Annonce.** Clé de calibration : `h3-<pas>pas-<durée>s-<format>`. Sans prise mesurée à ce réglage : « non calibré », aucun chiffre. Ensuite : la plus chère des trois dernières mesures. « Tourner » s’éteint si le solde est illisible, vide, ou sous ce chiffre.
- **Temps de calcul.** Lu dans les horodatages du job, affiché à titre d’information. `estimate_credits` répond 0 pour ce graphe : il ne compte pas le temps GPU. L’ancien barème `TAKE_TIMING` (240–720 s, 90–240 s, jamais mesuré) n’est plus affiché nulle part.

### Pages Comfy relayées

Le relais sert toujours les pages Comfy (la connexion de la feuille « Relier », et `/comfy-embed` s’il est ouvert à la main). Leur script ([`src/lib/comfy-media.ts`](../src/lib/comfy-media.ts)) garde les correctifs médias (tuiles en `blob:`, rejeu `/api/view`) et retient tout `POST /api/prompt` derrière « Lancer ce rendu ? ». Cette fenêtre nomme le rendu et montre le solde lu, mais n’annonce plus de coût : dans la page de Comfy, le studio n’a rien mesuré. La réécriture du template H3 (#31) est retirée : l’app tourne la prise elle-même.

### Risques

| Risque | Parade |
| --- | --- |
| La session dépend du stockage Firebase de Comfy et de son rafraîchissement. Un changement chez Comfy la casse. | Le chemin par clé ne dépend que de l’API documentée. L’erreur ramène à « Relier à nouveau ». |
| Aucune prise réelle n’a été tournée par cette livraison. | Le graphe passe le `dry_run`, le client est testé contre un faux Comfy. La première prise d’un compte est le premier vrai test. |
| Une vidéo longue traverse le relais. | Elle est diffusée en flux, comme les tuiles Sphère avant elle. |
| Le fichier VAE vidéo n’est pas dans l’index de l’outil `dry_run`. | C’est le fichier du template officiel. À surveiller à la première prise. |

## Archive — Flux.1 [dev], parcours LoRA (dormant)

Tout ce qui suit décrit l’ancien parcours : dataset de 15 images, entraînement de LoRA, apps « Former mon look » et « Tester un prompt », cadre H3. L’app ne l’ouvre plus. Les bibliothèques restent dans le dépôt, testées. Les fichiers `comfy/*.api.json` et `public/comfy/*.json` ont été retirés ; ils restent dans l’historique git.

Source des réglages : [`src/lib/comfy-stack.ts`](../src/lib/comfy-stack.ts).

### Choix : Flux.1 [dev] plutôt que SDXL

| | Flux.1 [dev] | SDXL |
| --- | --- | --- |
| Identité (visage, peau) | Meilleure | Correcte |
| Légendes « trigger + variables » en langage naturel | Encodeur T5 : adapté | CLIP : légendes plus courtes |
| Temps d’entraînement | Plus lent : entraînement à 0,25 MP pour tenir 30 min | Plus rapide |
| Fichiers présents sur Comfy Cloud | `flux1-dev.safetensors`, `clip_l.safetensors`, `t5xxl_fp16.safetensors`, `ae.safetensors` | Oui |

**Décision :** Flux.1 [dev], parce que la qualité d’identité est ce qu’on vend. Le risque de durée est contenu par la résolution d’entraînement (0,25 MP), 800 étapes par défaut, un test à blanc obligatoire et un plafond d’étapes calculé par plan. SDXL n’est pas proposé en parallèle.

**Licence — à vérifier par JD.** Les poids Flux.1 [dev] sont sous licence non commerciale BFL. Les sorties sont décrites comme utilisables commercialement. Le client exécute le modèle sur son propre compte Comfy Cloud : U*TTU n’héberge pas le modèle. À faire valider avant de facturer.

### Faits Comfy Cloud vérifiés le 24.09.2026

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

### Les workflows

| Workflow | Lien App Mode | Record Comfy | Fichier importable | Source API |
| --- | --- | --- | --- | --- |
| **Dataset → LoRA → 1 image** | [cloud.comfy.org/?share=798eb224b972](https://cloud.comfy.org/?share=798eb224b972) | `e8d7c649-0cb5-466b-be1a-4d7caa9204c2` | [`public/comfy/c-micro-train-image.json`](../public/comfy/c-micro-train-image.json) | [`comfy/c-micro-train-image.api.json`](../comfy/c-micro-train-image.api.json) |
| **Test de prompt sans LoRA** | [cloud.comfy.org/?share=25954f3b0278](https://cloud.comfy.org/?share=25954f3b0278) | `d5746aa7-b780-4e09-b877-0cf39309e875` | [`public/comfy/c-micro-prompt-test.json`](../public/comfy/c-micro-prompt-test.json) | [`comfy/c-micro-prompt-test.api.json`](../comfy/c-micro-prompt-test.api.json) |

Le **test à blanc** n’est pas un troisième workflow : c’est le premier, lancé avec 20 étapes et 1 image, pour que les images restent déposées entre le test et le vrai run.

Dans le studio, ces deux apps sont les processus live du catalogue (`src/lib/processes.ts`) : « Former mon look » et « Tester un prompt ». Sphère les ouvre dans le cadre déjà consenti. Pas de troisième app.

#### 1. Dataset → LoRA → 1 image

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

#### 2. Test de prompt sans LoRA

UNETLoader, encodeurs Flux, `CLIPTextEncode`, FluxGuidance, KSampler (seed partagé), `SaveImage`. Entrées : Prompt, Seed. Il sert à régler scène, cadrage et lumière pour 7 à 29 crédits (estimation) avant de payer l’entraînement. Le trigger n’y a aucun effet.

### Recréer les workflows (2 minutes, sans GPU)

**Avec le MCP Comfy Cloud**, c’est la méthode utilisée ici :

1. `npm run comfy:build` régénère `comfy/*.api.json` depuis `src/lib/comfy-stack.ts`.
2. `submit_workflow` avec `dry_run: true` sur chaque fichier : validation sans exécution, 0 crédit.
3. `save_workflow` avec le JSON API et `name` égal à `c-micro-train-image` puis `c-micro-prompt-test`. Comfy convertit en format éditeur.
4. `create_app` avec les entrées et sorties listées dans `trainAppInputs()` / `trainAppOutputs()` (et leurs équivalents prompt).
5. `get_app_mode_url` avec `saved_workflow_filename` : lien `?share=`, à reporter dans `COMFY_APPS` ou dans les variables `NEXT_PUBLIC_COMFY_*_APP_URL`.
6. `get_saved_workflow`, puis copier `workflow_json` dans `public/comfy/*.json`. `npm test` vérifie que ces fichiers correspondent au générateur, lien par lien et valeur par valeur.

**À la main dans Comfy Cloud** : Workflow → Open → `public/comfy/c-micro-train-image.json`, puis bouton App Mode pour choisir les mêmes entrées et sorties. Même chose pour le test de prompt.

> Les liens `?share=` sont des instantanés publics du workflow, sans image ni clé. Selon Comfy, un lien de partage peut s’ouvrir sur le graphe tant que le partage App Mode complet n’est pas disponible. Les champs portent alors les mêmes titres. **À vérifier par JD au premier clic.**

### Affichage dans le guide (ancien cadre)

Après PASS, `ComfyRunPanel` propose `COMFY_APPS.train.url` en bas de l’étape 2 et `COMFY_APPS.prompt.url` en bas de l’étape 3. Rien n’est chargé depuis `cloud.comfy.org` avant un clic sur « Charger l’app Comfy ici » : le panneau dit ce qui va se charger et que Comfy peut charger ses propres traceurs. Au clic, un iframe de 640 à 900 px de haut remplace ce panneau ; sa source est `/comfy-embed?share=` sur l’hôte du studio, pas `cloud.comfy.org`. Le proxy (`src/lib/comfy-proxy.ts`) relaie ce document, `/assets`, `/api` (dont `/api/view`) et les polices. La grille lit `thumbnail_url` ou `preview_url` tels quels ; une vidéo sans ces champs charge `/api/assets/{id}/content?disposition=inline`. Ces URLs partent en `<img>` ou `<video>`, qui n’envoient pas l’`Authorization` déjà porté par le `fetch` de la liste (`Bearer` Firebase, jeton de workspace, ou `X-API-KEY`). Le document proxifié copie cet en-tête, retélécharge la tuile et assigne un `blob:` : la première `src` native est un fichier. Une URL `https://storage.googleapis.com`, `storage.cloud.google.com` ou `*.googleusercontent.com` passe par `GET /comfy-media-file`, sans y joindre le jeton. Comfy pose les vidéos en `preload=metadata` ; le script les passe en `auto` pour décoder une image. Si la réponse n’est pas un fichier, `#uttu-media-note` affiche le statut, le chemin (`/api/view` y ajoute `filename`, ou la requête si ce paramètre manque) et le type. Un second bandeau, `#uttu-run-note`, recopie le message du nœud quand l’overlay d’erreur de l’app est ouvert, ou quand `POST /api/prompt` renvoie `node_errors`. Un GET `/api/view` ou `/api/viewvideo` qui répond 404 est rejoué avec le nom `sous-dossier/fichier`, puis, avec le même jeton, cherché par `GET /api/assets?name_contains=` et renvoyé depuis `/api/assets/{id}/content`. Un 200 ou un 302 ne passe pas par cette recherche : les tuiles Sphère qui reçoivent déjà un fichier restent sur le `blob:`. `__Host-uttu_media` et `/comfy-media-sw.js` restent en secours. Un GLB reste une icône : `Media3DTop` n’assigne une image que si un aperçu `preview_url` existe. Après déploiement : rechargement forcé de `/studio#sphere`, en restant connecté dans le cadre. « Recharger l’app » recrée le cadre. Chaque étape se charge séparément. Le ZIP, les légendes et le coût restent au-dessus. Le client dépose toujours lui-même les 15 images et colle les légendes dans Comfy. Les 15 champs Image 01 à Image 15 partent avec `DEPOSER-IMAGE-01.png` … `DEPOSER-IMAGE-15.png` : ce ne sont pas des fichiers du compte. Comfy les signale par « Une entrée média requise n’a pas de fichier sélectionné. » Tant qu’un champ garde ce nom, le run est refusé. « Ouvrir en plein onglet » reste l’URL `cloud.comfy.org`, au-dessus de chaque panneau, chargé ou non.

La prise, une fois le monde posé et le look tenu, charge le template officiel `video_minimax_h3_r2v` par `/comfy-embed?template=video_minimax_h3_r2v`. Le proxy n’accepte que cet identifiant, et seulement ce paramètre : `source=custom`, `mode`, ou un `share` en plus, sont refusés. L’amont est `https://cloud.comfy.org/?template=video_minimax_h3_r2v`. Le document va chercher `/templates/video_minimax_h3_r2v.json`. Cette adresse ne porte pas les octets des photos ni le texte du plan. Au clic sur « Charger la prise ici », le studio écrit le brief dans IndexedDB (`uttu-take`, magasin `brief`, clé `current`). Le boot du cadre, en voyant ce JSON, écrit le texte dans le nœud 138 et n’envoie les fichiers (nœud 137 identité, nœud 139 lieu ou seconde photo) que par `POST /api/assets`. Seul un `name` sûr remplace l’exemple. Le plein onglet ne lit pas ce brief. Ouvrir la page ne poste pas `/api/prompt`. Le LoRA turbo est le nœud 145, champ `lora_name` (`minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors`) ; l’interrupteur nœud 146 est éteint. Le LoRA d’échange de personnage se substitue à ce fichier, à la main. Le look Flux n’y entre pas. Les tuiles Sphère, le rejeu `/api/view`, et l’avertissement Image 01–15 ne changent pas.

Le boot retient chaque `POST /api/prompt` du cadre derrière une fenêtre « Lancer ce rendu ? ». Elle nomme le rendu (La prise 20 pas ou turbo 4 pas, d’après `MiniMaxH3ReferenceToVideo` et le booléen « Lightning » ; Former mon look d’après `TrainLoraNode.steps` ; une image), affiche l’estimation en crédits, le solde lu, et une ligne de décision. « Lancer » reste éteint si le solde lu est sous l’estimation basse. « Annuler » renvoie un 400 `uttu_gate` : rien ne part. Le studio ne poste jamais `/api/prompt` lui-même. Le solde vient de la session Comfy du visiteur : réponse de `GET https://api.comfy.org/customers/balance` ou `GET /api/billing/balance`, ou le store Pinia `auth`. Comfy rend des cents malgré le suffixe `micros` ; crédits = cents × 211 / 100. Le boot l’envoie à la page par `postMessage` sur la même origine, sans le stocker. L’estimation d’une prise est une hypothèse : 240 à 720 s de GPU pour 20 pas, 90 à 240 s en turbo, à 0,39 crédit par seconde (`TAKE_TIMING`, `measured: false`). `estimate_credits` sur `video_minimax_h3_r2v` répond 0 crédit d’API : le coût est le temps GPU, que l’outil exclut.

| Fait (2026-09-24) | Source | Conséquence |
| --- | --- | --- |
| La page de connexion Comfy appelle `www.googleadservices.com` et `px.ads.linkedin.com`. | Journal réseau Chrome | Chargement au clic seulement : sans action du visiteur, ni Comfy ni ses traceurs ne sont contactés (consentement, visiteurs CH/UE). |
| `cloud.comfy.org` envoie `frame-ancestors 'self' https:`, sans `X-Frame-Options`. | En-têtes HTTP | Cadre accepté depuis GitHub Pages. Refusé depuis une page HTTP, dont `next dev` : le panneau affiche un avertissement à la place du bouton de chargement. |
| Dans Chrome, après le clic, chaque cadre charge la page de connexion Comfy ; son `?share=` reste dans `previousFullPath`. | Smoke sur le build Pages ([QA.md](QA.md#cadre-comfy-dans-le-guide)) | L’embed fonctionne jusqu’à la connexion, et chaque cadre garde son workflow. |
| Après connexion, un `?share=` ouvre la fenêtre « Open shared workflow », puis charge le graphe dans la vue donnée par `extra.linearMode`. | Frontend Comfy : `useSharedWorkflowUrlLoader.ts`, `workflowService.ts` | Les deux snapshots ont `linearMode: true` : App Mode attendu. Liens non régénérés. |
| La session Comfy (Firebase) est gardée dans le localStorage et l’IndexedDB de l’origine du document. | Frontend Comfy : `firebaseIdentity.ts` | Le cadre est maintenant l’origine du studio. Une session ouverte dans un onglet `cloud.comfy.org` ne s’y retrouve pas : la connexion se refait dans le cadre. |
| `__Host-comfy_session` est HttpOnly, Secure, `SameSite=Lax`, sans `Domain`. `/api/view` sans cookie ni jeton répond 401. La liste, elle, envoie `Authorization: Bearer` depuis `getAuthHeader()` (Firebase, workspace, ou `X-API-KEY`). Les tuiles lisent `thumbnail_url` ou `preview_url` bruts, souvent une URL signée qui ne passe pas par `/api/view`. | Frontend live `cb65375` (`authStore`, `MediaAssetCard`), en-têtes du 2026-10-02, grille de JD après le #26 | Le boot recopie l’en-tête de la liste sur la tuile et peint un `blob:`. Le jeton lu dans le stockage au démarrage n’est pas celui qui fait réussir la liste. |

Non vérifié sans compte Comfy tiers : la connexion (Google, GitHub ou e-mail) dans le cadre et l’écran App Mode connecté. Repli : « Ouvrir en plein onglet ».

### Coût : modèle et calibration

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

#### Grille de test (étape 3)

La grille compare 3 prompts fixes (trigger seul sur fond neutre, pose et lumière jamais vues, autre style en option) à 3 forces : 0,60, 0,75 et 0,90, autour de la bande d’usage 0,70–0,85. La seed de l’étape 3 sert partout, et chaque run rend aussi son témoin sans LoRA. Les réglages sont dans [`src/lib/test-grid.ts`](../src/lib/test-grid.ts).

Le workflow ne rend qu’un prompt et une force par run, et la LoRA disparaît à la fin du run. **Une case = un run réel complet**, entraînement compris : 261–541 crédits à 800 étapes, estimation non mesurée. Le guide l’affiche à côté de la grille et propose un ordre : case 1 à 0,75, puis 0,90 ou 0,60 selon la lecture, puis les lignes 2 et 3. Chaque prompt peut d’abord passer dans le test sans LoRA, pour 7 à 29 crédits.

Pas de checkpoint intermédiaire non plus : sans `SaveLoRA`, impossible de comparer l’étape 400 à l’étape 800. La grille remplace cette comparaison par la paire avec/sans LoRA et par la variation de force.

### Risques connus (parcours LoRA)

| Risque | Parade |
| --- | --- |
| `TrainLoraNode` est marqué expérimental par Comfy. | Test à blanc obligatoire (≤ 115 crédits). Si le node casse, il casse là. |
| Le pack `basic_data_handling` (découpage des légendes) disparaît de Cloud. | Le remplacer par 15 nodes `PrimitiveString` et un `CreateList`, puis régénérer. |
| La durée réelle dépasse les hypothèses. | Calibration, puis mise à jour de `TIMING` ; le plafond d’étapes suit automatiquement. |
| Qualité à 0,25 MP jugée insuffisante. | Passer `megapixels` à 0,39 dans `comfy-stack.ts`, avec environ 1,5 fois plus de temps par étape, et recalibrer. |
