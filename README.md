# U*TTU Studio — C micro

**On t’empêche de cramer une LoRA. Dataset → train → 1 image.**

Site FR-CH, une seule offre. Une checklist dans le navigateur bloque l’entraînement tant que le dataset est sale. Ensuite, un seul run Comfy Cloud (Flux.1 [dev]) entraîne la LoRA et rend 1 image, ou une grille de 4. Le run fournit aussi un témoin sans LoRA et la courbe de loss. Le coût Comfy est affiché avant chaque run.

## Critères de kill — non négociables

| | |
| --- | --- |
| Démarrage | 2026-09-24 |
| **Date de kill** | **2026-10-08** (J+14) |
| Critère de survie | **1 client payant** avant la date de kill. Sinon C est tué, comme A. |
| Décision | JD, le 2026-10-08 : nombre de clients payants, 0 ou ≥ 1. Pas de prolongation par défaut. |

L’offre **A**, « Look-Lock » (forfait DA et ZIP-juge), a été **tuée le 2026-09-24**. Elle est retirée du site, de la navigation, des métadonnées et de la carte OG, sans route d’archive. Son code reste dans l’historique git, dernier commit A : `9fca7e5`.

## Périmètre

**C micro, c’est :** un dataset propre (gate de 19 contrôles), un entraînement LoRA sur une seule stack (Flux.1 [dev] sur Comfy Cloud), puis 1 usage image.

**Hors périmètre :** Look-Lock et ZIP-juge ; clips, storyboards, pubs vidéo ; 3D ; voix ; avatars ; plateforme d’identité ; menu A + C ; autres backends d’entraînement.

## Définition du done

| Critère | État | Preuve |
| --- | --- | --- |
| Le site ne propose que C micro | FAIT | Page, nav, métadonnées et carte OG réécrites ; aucune mention de Look-Lock dans le HTML (E2E). |
| Checklist interactive, un FAIL bloque l’entraînement | FAIT | 19 contrôles ([docs/DATASET-GATE.md](docs/DATASET-GATE.md)). Étape 2 verrouillée hors PASS, export ZIP refusé hors PASS. |
| Parcours dataset → LoRA → 1 image, documenté et exécutable | FAIT, **non exécuté** | 2 workflows sauvegardés dans Comfy Cloud, avec App Mode et validation `dry_run`. **0 crédit dépensé** : premier run = calibration par JD. |
| Pas de A, ZIP-juge, 3D ni voix dans la nav | FAIT | Nav : Le piège, Le parcours, Le coût, Accès anticipé. |
| README et critères de kill | FAIT | Ce fichier. |
| Build OK, mobile OK | FAIT | `npm run build`, export GitHub Pages, 38 tests unitaires, E2E Chrome, aucun débordement de 320 à 1 024 px ([docs/QA.md](docs/QA.md)). |

## Le parcours

1. **Dataset propre.** Trigger, invariants, import. Analyse locale : résolution, netteté, doublons, miroirs, couleur hors norme. Le client trie « garder » ou « rejeter », étiquette angle et cadrage, décrit les variables et coche 5 confirmations. Tant qu’un contrôle n’est pas en PASS, l’étape 2 reste fermée.
2. **Entraîner.** ZIP (15 JPEG sans EXIF, légendes, rapport), puis lien App Mode et légendes à coller. Coût estimé avant le run, avec un plafond d’étapes selon le plan Comfy. Test à blanc à 20 étapes obligatoire avant le run réel.
3. **Utiliser une fois : 1 image.** Prompt (trigger + scène, sans redire l’identité), force LoRA, seed, 1 ou 4 images. Ces réglages vont dans le même formulaire Comfy : Comfy Cloud n’exporte pas la LoRA (`SaveLoRA` absent), elle vit le temps du run. Un diagnostic aide à lire le résultat.

## Stack Comfy Cloud — une seule

Flux.1 [dev] : `flux1-dev.safetensors`, `clip_l.safetensors` + `t5xxl_fp16.safetensors`, `ae.safetensors`. Entraînement avec le `TrainLoraNode` du core, rank 16, AdamW, lr 4e-4, 0,25 MP, 800 étapes par défaut. Choix, faits vérifiés et risques : [docs/COMFY-STACK.md](docs/COMFY-STACK.md).

| Workflow | App Mode | Fichier |
| --- | --- | --- |
| Dataset → LoRA → 1 image (+ témoin, + courbe) | [cloud.comfy.org/?share=798eb224b972](https://cloud.comfy.org/?share=798eb224b972) | [`public/comfy/c-micro-train-image.json`](public/comfy/c-micro-train-image.json) |
| Test de prompt sans LoRA | [cloud.comfy.org/?share=25954f3b0278](https://cloud.comfy.org/?share=25954f3b0278) | [`public/comfy/c-micro-prompt-test.json`](public/comfy/c-micro-prompt-test.json) |

### Créer ou recréer les workflows

1. **Test de prompt** : importer `public/comfy/c-micro-prompt-test.json` dans Comfy Cloud (Workflow → Open), passer en App Mode, exposer Prompt et Seed, puis partager.
2. **Dataset → LoRA → 1 image** : importer `public/comfy/c-micro-train-image.json`, passer en App Mode, exposer Image 01 à 15, Légendes, Étapes d’entraînement, Prompt, Force LoRA, Seed et Nombre d’images, puis partager.
3. **Test à blanc** : le même workflow que le 2, lancé avec 20 étapes et 1 image. Ce sont d’ailleurs ses valeurs par défaut.

Pour les modifier, changer `src/lib/comfy-stack.ts`, lancer `npm run comfy:build`, valider en `dry_run`, puis sauvegarder via le MCP Comfy. La procédure complète est dans [docs/COMFY-STACK.md](docs/COMFY-STACK.md#recréer-les-workflows-2-minutes-sans-gpu). Les liens peuvent être remplacés sans toucher au code avec `NEXT_PUBLIC_COMFY_TRAIN_APP_URL` et `NEXT_PUBLIC_COMFY_PROMPT_APP_URL`.

## Coût — honnête, non mesuré

Crédits Comfy à la charge du client : GPU à ~0,39 crédit/s, 211 crédits ≈ 1 $.

| Run | Estimation |
| --- | --- |
| Test de prompt sans LoRA | 7–29 crédits (≈ 0,04–0,14 $) |
| Test à blanc (20 étapes) | 48–115 crédits (≈ 0,23–0,55 $), 2–5 min |
| Run réel (800 étapes, 1 image + témoin) | 261–541 crédits (≈ 1,23–2,57 $), 11–23 min |

Ce sont des hypothèses, qui s’afficheront comme mesures après la calibration par JD ([procédure](docs/COMFY-STACK.md#coût--modèle-et-calibration)). L’estimateur de Comfy renvoie 0 crédit pour ces workflows, parce qu’il ignore le temps GPU.

## Prix — PROPOSITION NON VÉRIFIÉE

**CHF 49–149 pour un run guidé one-shot**, ou **crédits Comfy du client + frais de guidage**. Le site l’affiche comme « prix pressenti, non confirmé » et ne facture rien. Décision à prendre par JD avant la date de kill.

## Installer, tester, construire

Node.js ≥ 22 et npm. Les tests utilisent le test runner de Node avec `--experimental-strip-types`, inclus dans le script.

```bash
git clone https://github.com/eNudimmud/U-TTU-Studio.git
cd U-TTU-Studio
npm ci
cp .env.example .env.local
npm run dev          # http://localhost:3000
npm test             # 38 tests : gate, légendes, pixels, ZIP (unzip -t), workflows Comfy, coûts
npm run typecheck
npm run build        # next build --webpack
npm run comfy:build  # régénère comfy/*.api.json depuis src/lib/comfy-stack.ts
```

## Déployer

**GitHub Pages** : le workflow [.github/workflows/pages.yml](.github/workflows/pages.yml) publie l’export statique `out/` à chaque push sur `main`, à l’URL **https://enudimmud.github.io/U-TTU-Studio/**. Activation initiale : Settings → Pages → Source → GitHub Actions. Le site fonctionne sans serveur : analyse, ZIP et formulaire tournent dans le navigateur. Pour reproduire l’export en local :

```bash
GITHUB_PAGES=true NEXT_PUBLIC_BASE_PATH=/U-TTU-Studio NEXT_PUBLIC_SITE_URL=https://enudimmud.github.io/U-TTU-Studio npm run build
```

**Vercel** : importer le dépôt (framework Next.js, `npm ci`, `npm run build`). Variables :

| Variable | Rôle |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | URL publique HTTPS, pour l’OG, l’URL canonique et le sitemap. Facultative sur Vercel. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | `HelveticVault@gmail.com` par défaut (adresse provisoire). |
| `NEXT_PUBLIC_BASE_PATH`, `GITHUB_PAGES` | Réservées à l’export GitHub Pages. |
| `NEXT_PUBLIC_COMFY_TRAIN_APP_URL`, `NEXT_PUBLIC_COMFY_PROMPT_APP_URL` | Facultatives : remplacent les liens App Mode. |

Aucun secret requis : pas de clé Comfy côté site. L’API Comfy Cloud (plans Creator et Pro, clé côté serveur) n’est pas branchée, parce que le site est statique. Le client lance le run dans l’App Mode, sur son propre compte.

## Confidentialité

- Les images sont analysées et converties dans le navigateur. Rien n’est envoyé au studio.
- Le ZIP est produit localement, et le réencodage JPEG supprime l’EXIF, GPS compris.
- Le formulaire d’accès anticipé prépare un e-mail (`mailto:`), sans envoi automatique.
- Aucun cookie, aucun stockage local, aucun tracking : `src/lib/analytics.ts` reste inerte.
- Les images partent chez Comfy seulement quand le client les dépose dans l’app.

## Structure

```text
src/app/page.tsx                 page unique : hero, piège, parcours, coût, accès anticipé
src/components/guide/            parcours en 3 étapes (gate, entraînement, image)
src/lib/gate/                    règles du gate, légendes, mesures d’image, rapport, export ZIP
src/lib/comfy-stack.ts           stack Flux.1 dev : modèles, réglages, coûts, liens App Mode
src/lib/comfy-workflows.ts       générateur des graphes Comfy (format API)
comfy/*.api.json                 graphes générés (source)
public/comfy/*.json              graphes tels que sauvegardés dans Comfy Cloud (App Mode)
tests/                           tests unitaires (node --test)
docs/                            gate, stack Comfy, décisions, QA, canon visuel
```

## Documentation

- [docs/DATASET-GATE.md](docs/DATASET-GATE.md) : critères FAIL, seuils, export.
- [docs/COMFY-STACK.md](docs/COMFY-STACK.md) : stack, faits Comfy vérifiés, workflows, coûts, calibration, risques.
- [docs/DECISIONS.md](docs/DECISIONS.md) : registre fait, hypothèse, proposition, décision.
- [docs/QA.md](docs/QA.md) : contrôles exécutés.
- [docs/VISUAL-CANON.md](docs/VISUAL-CANON.md) : DA U*TTU et provenance du portrait.

## Captures

Hero, desktop :

![Hero desktop](docs/screenshots/hero-desktop.jpg)

Gate en FAIL : une légende redit l’invariant « green eyes », l’étape 2 est refermée.

![Gate FAIL](docs/screenshots/gate-fail-desktop.jpg)

Étape 2 : ZIP, lien App Mode, coût avant le run, plafond de 30 min.

![Étape 2](docs/screenshots/train-step-desktop.jpg)

Mobile :

<img src="docs/screenshots/hero-mobile.jpg" width="390" alt="Hero mobile" /> <img src="docs/screenshots/guide-mobile.jpg" width="390" alt="Parcours mobile avec le bandeau du gate" />

Les captures du parcours utilisent 20 images de test synthétiques générées par ffmpeg. Ce ne sont pas des résultats d’entraînement.
