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

## Faits

- Le catalogue Comfy Cloud contient `TrainLoraNode`, `MakeTrainingDataset`, `LoraModelLoader`, `LossGraphNode`, `CreateList`, `ImageScaleToTotalPixels` et `Basic data handling: StringSplitlinesDataList`. Il ne contient ni `SaveLoRA` ni les loaders de dataset par dossier (vérifié par MCP le 2026-09-24).
- Runs limités à 30 min en Standard et Creator, 60 min en Pro. GPU à ~0,39 crédit/s. 211 crédits ≈ 1 $. Import de LoRA réservé aux plans Creator et plus, depuis Hugging Face ou Civitai.
- `estimate_credits` renvoie 0 crédit pour les deux workflows : il ignore le temps GPU.
- Les deux workflows passent la validation `submit_workflow` en `dry_run`. Ils sont sauvegardés dans le workspace Comfy (records `e8d7c649…` et `d5746aa7…`, version 2 avec App Mode) et partagés en `?share=798eb224b972` et `?share=25954f3b0278`.
- Les graphes versionnés dans `public/comfy/` correspondent au générateur, lien par lien et valeur par valeur (`tests/comfy.test.ts`).
- QA E2E sur Chrome avec 20 images synthétiques : chaque piège est signalé, le PASS n’arrive qu’avec 15 images propres, le ZIP est valide ([QA.md](QA.md)).

## Hypothèses — à mesurer

- Vitesse d’entraînement Flux dev à 0,25 MP sur les GPU Comfy : 0,7 à 1,4 s par étape. Frais fixes de 90 à 240 s. Image 1024² de 9 à 14 s.
- 800 étapes, lr 4e-4 et rank 16 sur 15 images suffisent pour une identité reconnaissable (réglages proches des entraîneurs Flux « rapides » courants). Non vérifié sur Comfy.
- Le `TrainLoraNode` du core entraîne correctement Flux.1 [dev] : implémentation générique, flow-matching géré par `model_sampling`. Node marqué expérimental.
- Les seuils de netteté (100 absolu, 35 % de la médiane) et de couleur (3,5 MAD) détectent assez de problèmes sans trop de faux positifs sur des photos réelles. Calibrés uniquement sur des images synthétiques.
- Un lien `?share=` ouvre l’App Mode. Comfy indique qu’il peut s’ouvrir sur le graphe tant que le partage App Mode complet n’est pas disponible.

## Propositions — non vérifiées, décision JD

- **Prix** : CHF 49–149 pour un run guidé one-shot, ou crédits Comfy du client + frais de guidage. Affiché « prix pressenti, non confirmé ».
- **Licence Flux.1 [dev]** : faire valider l’usage commercial des sorties, le client exécutant le modèle sur son compte Comfy.
- **Calibration** avant toute vente : test à blanc et run réel sur un vrai dataset (≈ 300 à 650 crédits), puis `TIMING.measured = true`.
- **Phase test** : affichée jusqu’au 8 octobre 2026, date de kill.

## Archive — offre A (tuée)

La première livraison vendait le « Look-Lock Pack » (CHF 800–2 500) et une direction légère mensuelle. JD l’a tuée le 2026-09-24. Tout son contenu a été retiré du site : comparaison, grille PASS / FAIL d’U*TTU, tarifs, Sanctuaire, formulaire de brief. Le code reste consultable dans l’historique git (`9fca7e5` et antérieurs). Le portrait canonique d’U*TTU fourni par JD reste utilisé dans le hero, légendé comme référence du studio ([VISUAL-CANON.md](VISUAL-CANON.md)).
