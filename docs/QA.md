# Contrôles de livraison — C micro

Vérification du 2026-09-24, sur la branche `cursor/c-micro-lora-guide-f6f7`. Aucun run Comfy Cloud n’a été lancé : **0 crédit dépensé**.

## Automatisés, rejouables

| Contrôle | Résultat | Commande / périmètre |
| --- | --- | --- |
| TypeScript strict | PASS | `npm run typecheck` |
| Tests unitaires | PASS : 38/38 | `npm test` : chaque règle du gate en FAIL au moins une fois, linter de légendes, trigger, netteté, dHash et miroir, statistiques robustes, CRC-32, ZIP accepté par `unzip -t` puis extrait à l’identique, rapport, manifeste, cohérence des workflows Comfy, coûts et plafond de 30 min. |
| Build de production | PASS | `npm run build` (Next.js 16.3.6, Webpack) : page statique. |
| Export GitHub Pages | PASS | Build avec `GITHUB_PAGES=true` et `NEXT_PUBLIC_BASE_PATH=/U-TTU-Studio`, servi sous le sous-chemin : hydratation OK, `/U-TTU-Studio/comfy/c-micro-train-image.json` en 200 (40 nodes, App Mode actif), OG en URL absolue, aucune ressource en erreur. |
| Workflows Comfy | PASS | `submit_workflow` en `dry_run` sur les 2 graphes : validation Cloud sans exécution. |

## E2E dans Chrome (puppeteer-core, serveur de production)

Jeu de test : 20 images synthétiques générées par ffmpeg. 15 compositions distinctes à 1 600 × 2 000 px, plus 5 pièges : un recadrage à 97 % (doublon), un flou de boîte, un miroir, une version sombre en noir et blanc, un 640 × 480.

| Contrôle | Résultat |
| --- | --- |
| Hero : « On t’empêche de cramer une LoRA. » ; aucune trace de Look-Lock dans le HTML ; nav sans A, ZIP-juge, 3D ni voix | PASS |
| Étape 2 verrouillée au chargement | PASS |
| 640 × 480 refusée d’office (« Garder » désactivé) | PASS |
| Flou → « Flou ? » ; miroir → « Miroir ? » ; noir et blanc sombre → « Hors norme » ; recadrage → décision humaine exigée | PASS |
| 15 images gardées, étiquetées et décrites, 4 pièges rejetés, 5 confirmations → gate PASS, emplacements 01–15 | PASS |
| Invariant « green eyes » réécrit dans une légende → FAIL G15, étape 2 refermée ; correction → PASS | PASS |
| ZIP téléchargé : 34 fichiers (15 JPEG, 15 .txt, `captions_comfy.txt`, rapport, `gate.json`, `LISEZMOI.txt`), `unzip -t` sans erreur | PASS |
| `captions_comfy.txt` : 15 lignes commençant par le trigger ; JPEG sans marqueur EXIF ; long côté ≤ 1 536 px ; rapport « Verdict : PASS » | PASS |
| 1 150 étapes en plan Standard → « Réglage refusé » ; 800 → « Au pire 23 min sur 30 » | PASS |
| Étape 3 : prompt = trigger + scène ; « green eyes » dans la scène → avertissement | PASS |
| Pas de débordement horizontal à 320, 390, 768 et 1 024 px, cartes du parcours comprises | PASS |
| Mobile 390 px : bandeau du gate collant visible pendant le tri | PASS |
| Aucune erreur JavaScript ni console | PASS |

## Défauts trouvés et corrigés pendant la QA

- Un doublon recadré à 3 % tombait entre 7 et 10 bits de distance et ne recevait qu’un badge informatif. De 6 à 12 bits, une décision humaine est maintenant exigée ; ≤ 5 bits reste une paire bloquante.
- Juste après l’import, le gate affichait FAIL en rouge alors que rien n’était faux. L’information manquante apparaît maintenant « À faire » ; FAIL est réservé aux violations. Le PASS reste aussi strict.
- Étape 3 : boutons radio collés à leur libellé, bouton « Nouveau seed » sur deux lignes, tableau de diagnostic trop serré. Corrigés, le diagnostic devient une liste.

## Captures

| Écran | Fichier |
| --- | --- |
| Hero desktop | [hero-desktop.jpg](screenshots/hero-desktop.jpg) |
| Gate PASS | [gate-pass-desktop.jpg](screenshots/gate-pass-desktop.jpg) |
| Gate FAIL (G15) | [gate-fail-desktop.jpg](screenshots/gate-fail-desktop.jpg) |
| Étape 2, coût | [train-step-desktop.jpg](screenshots/train-step-desktop.jpg) |
| Étape 3 | [image-step-desktop.jpg](screenshots/image-step-desktop.jpg) |
| Mobile | [hero-mobile.jpg](screenshots/hero-mobile.jpg), [guide-mobile.jpg](screenshots/guide-mobile.jpg) |

## Limites

- Aucun entraînement réel n’a été exécuté. Le comportement de `TrainLoraNode` sur Flux.1 [dev] dans Comfy Cloud, les durées et la qualité restent à mesurer par la calibration ([COMFY-STACK.md](COMFY-STACK.md#coût--modèle-et-calibration)).
- Les seuils du gate sont validés sur des images synthétiques, pas sur des datasets clients.
- Vérifié dans Chrome uniquement : ni Safari, ni Firefox, ni appareil physique.
- L’ouverture du lien de partage en App Mode côté client n’a pas pu être vérifiée sans compte Comfy tiers. Les snapshots importés ont `linearMode: true`. Un navigateur non connecté est renvoyé vers la connexion Comfy, y compris dans l’iframe.
- Connexion Comfy à l’intérieur de l’iframe : non vérifiée (cookies tiers). Repli prévu : « Ouvrir en plein onglet », même URL.
