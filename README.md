# U*TTU Studio — C micro

> **Ta première LoRA, pas à pas. Comprendre → Préparer → Entraîner → Créer.**

Site vitrine et outil guidé, en français (FR-CH), pour C micro : dataset gate → LoRA → image(s). Le site vérifie le dataset dans le navigateur et bloque l’entraînement tant qu’il reste un problème. La PR #5 ajoute un rail fal expérimental, avec LoRA téléchargeable et grille de 3 images ; Comfy Cloud reste le repli. **Vente HOLD.** L’identité produite n’est pas encore validée.

**État fal :** code présent, Worker non déployé dans cette reprise, UI désactivée tant que `NEXT_PUBLIC_FAL_PROXY_URL` est vide (« Script seul » après PASS). [Contrat, preuves et checklist](docs/FAL-SPIKE.md) · [déploiement Worker en 8 commandes](workers/fal-proxy/README.md#déployer-jd--8-commandes).

## Date de kill : 8 octobre 2026

| Règle | Valeur |
| --- | --- |
| Démarrage | 24 septembre 2026 |
| Date de kill | **8 octobre 2026** (J+14) |
| Condition de survie | **1 CHF payant** avant cette date (passation JD du 25 septembre) |
| Sinon | C micro est arrêté, comme l’offre A |
| Qui décide | JD, le 8 octobre, sans prolongation par défaut |

L’offre A (« Look-Lock » : forfait de direction artistique et ZIP-juge) a été arrêtée le 24 septembre 2026. Elle ne figure plus nulle part sur le site et n’a pas de page d’archive. Son code reste dans l’historique git, jusqu’au commit `9fca7e5`.

## Ce que fait le site

1. **Comprendre.** Un tutoriel court explique le modèle de base, la LoRA, le prompt et le mot d’appel. La référence U*TTU est clairement distinguée d’un résultat d’entraînement.
2. **Préparer.** Le client nomme son personnage, définit ses traits constants et importe ses images. Une planche de vignettes permet de choisir l’image à trier et décrire. Une seule fiche est éditable à la fois. Le résumé indique la prochaine action ; les 20 contrôles et le coaching des légendes se déplient à la demande. Le gate exige toujours exactement 15 images et les 5 confirmations ([règles détaillées](docs/DATASET-GATE.md)).
3. **Entraîner.** Le client télécharge le ZIP, copie les légendes dans Comfy et confirme les trois sorties du test court payant à 20 étapes. Les coûts restent visibles ; le choix du plan et les réglages se déplient.
4. **Créer.** Le client règle la scène, reporte les valeurs dans Comfy et lance l’entraînement final avec son image. Le budget et la limite de durée restent contrôlés. Les diagnostics, la grille de comparaison et le test de prompt sont repliés.

Un écran est affiché à la fois. Les étapes visitées restent montées pour conserver la sélection, les réglages et les tâches en cours lors d’un aller-retour ; une fermeture ou un rechargement de page efface la session locale. Les composants et styles du travail sur les images sont chargés à la demande.

L’option **fal**, dans les outils avancés de « Créer », conserve le gate de **15 images et légendes**, les coûts estimés et le statut expérimental **HOLD**. Aucun service distant n’est lancé par la navigation.

**Hors périmètre :** Look-Lock et ZIP-juge, vidéo (clips, storyboards, pubs), 3D, voix, avatars, plateforme d’identité et menu combinant plusieurs offres. Le rail fal et le repli Comfy restent dans C micro.

## Démarrer

Prérequis : Node.js 22 ou plus récent, et npm.

```bash
git clone https://github.com/eNudimmud/U-TTU-Studio.git
cd U-TTU-Studio
npm ci
cp .env.example .env.local
npm run dev          # http://localhost:3000
```

| Commande | Rôle |
| --- | --- |
| `npm test` | Gate, cadrages, coaching des légendes, grille de test, mesures d’image, ZIP, workflows Comfy, coûts, proxy fal contre un faux serveur, protection des secrets et smoke sans réseau. |
| `npm run typecheck` | TypeScript strict. |
| `npm run build` | Build de production (`next build --webpack`). |
| `npm run comfy:build` | Régénère `comfy/*.api.json` à partir de `src/lib/comfy-stack.ts`. |
| `npm run fal:smoke -- /chemin/dataset.zip` | Vérifie le ZIP et affiche le plan fal ; dry par défaut, 0 réseau, 0 $. |

## Workflows Comfy Cloud

**Une seule stack : Flux.1 [dev].** Fichiers `flux1-dev.safetensors`, `clip_l.safetensors`, `t5xxl_fp16.safetensors` et `ae.safetensors`, tous présents sur Comfy Cloud. L’entraînement utilise le node officiel `TrainLoraNode` : rank 16, AdamW, learning rate 4e-4, images réduites à 0,25 mégapixel, 800 étapes par défaut. Flux a été préféré à SDXL pour la fidélité des visages ; le détail est dans [docs/COMFY-STACK.md](docs/COMFY-STACK.md).

**Pourquoi entraînement et image partent dans le même run.** Comfy Cloud ne propose pas le node qui enregistre une LoRA (`SaveLoRA`, vérifié le 24 septembre 2026). Une LoRA entraînée sur Cloud ne peut donc pas être téléchargée ni réutilisée dans un autre workflow. Le workflow principal entraîne la LoRA puis s’en sert aussitôt pour produire l’image : c’est exactement « 1 image d’usage ».

| Workflow | Rôle | App Mode | Fichier à importer |
| --- | --- | --- | --- |
| Dataset → LoRA → 1 image | Entraîne la LoRA et rend 1 à 4 images, le témoin sans LoRA et la courbe de loss. | [ouvrir](https://cloud.comfy.org/?share=798eb224b972) | [`public/comfy/c-micro-train-image.json`](public/comfy/c-micro-train-image.json) |
| Test de prompt sans LoRA | Règle la scène, le cadrage et la seed pour quelques crédits, avant de payer l’entraînement. | [ouvrir](https://cloud.comfy.org/?share=25954f3b0278) | [`public/comfy/c-micro-prompt-test.json`](public/comfy/c-micro-prompt-test.json) |

Le **test à blanc** n’est pas un troisième workflow. C’est le premier, lancé avec 20 étapes et 1 image, qui sont ses valeurs par défaut. Les images déposées restent en place pour le vrai run.

Après un PASS du gate, le guide propose ces deux apps dans la page. Rien n’est chargé depuis Comfy avant un clic sur « Charger l’app Comfy ici », parce que Comfy charge ses propres traceurs. « Ouvrir en plein onglet » reste au-dessus de chaque panneau : la connexion Comfy dans un iframe n’est pas garantie, et une page HTTP, dont `next dev`, ne peut pas encadrer Comfy. Pour voir les cadres en local, servir le build en HTTPS.

### Créer les workflows dans Comfy Cloud

1. Se connecter à [cloud.comfy.org](https://cloud.comfy.org) avec un compte qui a des crédits.
2. Ouvrir `public/comfy/c-micro-prompt-test.json` comme workflow. Le fichier contient déjà la configuration App Mode : entrées « Prompt » et « Seed », sortie « Test de prompt sans LoRA ».
3. Ouvrir `public/comfy/c-micro-train-image.json` de la même façon. Entrées, dans l’ordre : « Image 01 » à « Image 15 », « Légendes », « Étapes d’entraînement », « Prompt », « Force LoRA », « Seed », « Nombre d’images ». Sorties : « Avec LoRA », « Témoin sans LoRA », « Courbe de loss ».
4. Partager chaque workflow pour obtenir un lien `https://cloud.comfy.org/?share=…`.
5. Mettre ces liens dans `NEXT_PUBLIC_COMFY_TRAIN_APP_URL` et `NEXT_PUBLIC_COMFY_PROMPT_APP_URL`, ou dans `COMFY_APPS` (`src/lib/comfy-stack.ts`), puis reconstruire le site.

Comfy précise qu’un lien de partage peut s’ouvrir sur le graphe plutôt que sur l’app. Les champs portent alors les mêmes noms. Ce comportement reste à vérifier au premier clic.

### Modifier la stack

Tous les réglages sont dans `src/lib/comfy-stack.ts`. Après une modification :

1. `npm run comfy:build` régénère les graphes au format API.
2. Les valider avec Comfy en mode `dry_run` : contrôle sans exécution, 0 crédit.
3. Les sauvegarder dans Comfy Cloud, configurer l’App Mode et récupérer les liens de partage.
4. Copier les versions sauvegardées dans `public/comfy/`.
5. `npm test` vérifie que ces fichiers correspondent au code, node par node.

La procédure complète, avec les outils du MCP Comfy Cloud, est dans [docs/COMFY-STACK.md](docs/COMFY-STACK.md#recréer-les-workflows-2-minutes-sans-gpu).

## Tester avant de payer

Du moins cher au plus cher. Les crédits Comfy sont à la charge du client : environ 0,39 crédit par seconde de GPU, 211 crédits ≈ 1 $.

| Étape | Coût | Ce qu’elle prouve |
| --- | --- | --- |
| `npm test` | 0 | Le gate, le ZIP, la cohérence des workflows et le plafond de durée. |
| Validation Comfy `dry_run` | 0 | Le graphe est accepté par Comfy Cloud. |
| Test de prompt sans LoRA | 7–29 crédits | Scène, cadrage et seed. |
| Test à blanc (20 étapes, 1 image) | 48–115 crédits, 2 à 5 min | Images, légendes, entraînement et rendu s’enchaînent sans erreur. |
| Run réel (800 étapes, 1 image + témoin) | 261–541 crédits (≈ 1,23–2,57 $), 11 à 23 min | La LoRA et son image. |

Ces montants sont des **estimations non mesurées** : aucun run n’a encore été lancé, donc 0 crédit dépensé à ce jour. Le premier test à blanc et le premier run réel servent de calibration. Il faut ensuite reporter les durées mesurées dans `TIMING` (`src/lib/comfy-stack.ts`) et passer `measured` à `true` ([procédure](docs/COMFY-STACK.md#coût--modèle-et-calibration)).

Un run Comfy est coupé au bout de 30 minutes en Standard et Creator, 60 minutes en Pro. Le site refuse donc plus de 950 étapes en Standard (900 avec 4 images) et plus de 2 100 en Pro. L’estimateur intégré à Comfy annonce 0 crédit pour ces workflows, parce qu’il ne compte pas le temps GPU.

## Prix — proposition non vérifiée

**CHF 49 à 149 pour un run guidé**, ou **crédits Comfy du client + frais de guidage**. Le site l’affiche comme « prix pressenti, non confirmé » et ne facture rien. Décision à prendre par JD avant la date de kill.

## Déployer

**GitHub Pages.** Chaque push sur `main` lance le workflow [pages.yml](.github/workflows/pages.yml) : installation, tests, export statique, puis publication sur **https://enudimmud.github.io/U-TTU-Studio/**. La version en ligne est toujours celle de `main`. Le site fonctionne sans serveur : analyse des images, ZIP et formulaire tournent dans le navigateur. Pour reproduire l’export en local :

```bash
GITHUB_PAGES=true NEXT_PUBLIC_BASE_PATH=/U-TTU-Studio NEXT_PUBLIC_SITE_URL=https://enudimmud.github.io/U-TTU-Studio npm run build
# résultat dans out/, à servir sous /U-TTU-Studio/
```

**Vercel.** Importer le dépôt comme projet Next.js (`npm ci`, `npm run build`).

| Variable | Rôle |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | URL publique HTTPS, pour la carte OG, l’URL canonique et le sitemap. Facultative sur Vercel. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Adresse de contact. `HelveticVault@gmail.com` par défaut, provisoire. |
| `NEXT_PUBLIC_COMFY_TRAIN_APP_URL`, `NEXT_PUBLIC_COMFY_PROMPT_APP_URL` | Facultatives : remplacent les liens App Mode. |
| `NEXT_PUBLIC_BASE_PATH`, `GITHUB_PAGES` | Réservées à l’export GitHub Pages. |
| `NEXT_PUBLIC_FAL_PROXY_URL` | URL publique du Worker, variable de dépôt GitHub Actions lue au build Pages. Vide = rail fal désactivé. |

Aucun secret n’est nécessaire au site statique. Le rail fal utilise les secrets `FAL_KEY` et `ACCESS_TOKEN` uniquement dans le Worker ([configuration](workers/fal-proxy/README.md)). Ne pas les placer dans le build Pages. Le repli Comfy s’exécute sur le compte Comfy du client.

## Confidentialité

- Les images sont analysées et converties dans le navigateur du client. Le gate seul ne les envoie pas.
- Le ZIP est créé localement. Le réencodage en JPEG retire les métadonnées EXIF, localisation GPS comprise.
- Les images n’arrivent chez Comfy que lorsque le client les dépose lui-même dans l’app.
- Avec fal activé, un clic sur « Entraîner chez fal » envoie les 15 JPEG et légendes via le Worker vers le stockage fal ; rapport et noms d’origine restent locaux. L’effacement demandé et les limites sont détaillés dans [FAL-SPIKE.md](docs/FAL-SPIKE.md#secrets-et-vie-privée).
- Le lien de contact ouvre la messagerie (`mailto:`), sans envoi automatique.
- Aucun cookie, aucun stockage local, aucun outil de mesure d’audience (`src/lib/analytics.ts` est inerte).

## Organisation du code

```text
src/app/page.tsx              page unique : guide progressif, questions fréquentes, contact
src/components/guide/         tutoriel et parcours en 4 étapes, styles chargés à la demande
src/lib/gate/                 règles du gate, légendes, mesures d’image, rapport, export ZIP
src/lib/comfy-stack.ts        réglages Flux.1 dev, coûts, durées, liens App Mode
src/lib/comfy-workflows.ts    générateur des graphes Comfy
comfy/*.api.json              graphes générés, format API
public/comfy/*.json           graphes tels que sauvegardés dans Comfy Cloud, avec App Mode
tests/                        tests unitaires (node --test)
docs/                         documentation
```

## Documentation

| Document | Contenu |
| --- | --- |
| [docs/DATASET-GATE.md](docs/DATASET-GATE.md) | Les 20 contrôles, leurs seuils, le repère de cadrage, le coaching des légendes et le contenu du ZIP. |
| [docs/COMFY-STACK.md](docs/COMFY-STACK.md) | Choix de Flux, faits vérifiés sur Comfy Cloud, graphes, calcul du coût, calibration, grille de test, risques. |
| [docs/FAL-SPIKE.md](docs/FAL-SPIKE.md) | Rail fal expérimental, coûts USD/CHF, preuves, limites et checklist de revue. |
| [workers/fal-proxy/README.md](workers/fal-proxy/README.md) | Déploiement Cloudflare, secrets, CORS et variable Pages. |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Registre des faits, hypothèses, propositions et décisions. |
| [docs/UX-GUIDE.md](docs/UX-GUIDE.md) | Refonte du guide, mesures de chargement et vérifications restantes. |
| [docs/QA.md](docs/QA.md) | Contrôles exécutés avant livraison, et leurs limites. |
| [docs/VISUAL-CANON.md](docs/VISUAL-CANON.md) | Direction artistique U*TTU et provenance du portrait. |

## Captures de la version précédente

Ces captures datent du 24 septembre 2026. Elles ne représentent pas la refonte du 27 septembre ; sa revue visuelle reste à effectuer. Voir [le rapport de refonte](docs/UX-GUIDE.md).

![Hero sur ordinateur](docs/screenshots/hero-desktop.jpg)

Le compteur de cadrages suit l’étiquetage. Ici, 7 gros plans pour un repère de 3 à 5 : À NOTER, le gate reste en PASS.

![Repère de cadrage en À NOTER](docs/screenshots/framing-meter-desktop.jpg)

Au-dessus des cartes : ce qu’une légende ne doit pas dire, et ce qu’elle doit dire.

![Légendes FAIL et PASS](docs/screenshots/caption-coach-desktop.jpg)

Une légende réécrit un invariant (« green eyes ») : la carte le signale, le gate passe en FAIL et l’étape 2 se referme.

![Gate en FAIL](docs/screenshots/gate-fail-desktop.jpg)

Étape 2 : ZIP, lien vers l’app Comfy, coût estimé et plafond de durée.

![Étape 2](docs/screenshots/train-step-desktop.jpg)

Étape 3 : la grille de test, la case choisie à reporter dans l’app, et sa lecture.

![Grille de test](docs/screenshots/test-grid-desktop.jpg)

Sur mobile, le verdict du gate reste visible en bas de l’écran pendant le tri.

<img src="docs/screenshots/hero-mobile.jpg" width="390" alt="Hero sur mobile" /> <img src="docs/screenshots/guide-mobile.jpg" width="390" alt="Parcours sur mobile avec le bandeau du gate" />

Les captures du parcours utilisent des images de test synthétiques, générées avec ffmpeg. Ce ne sont pas des résultats d’entraînement.
