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

## Cadre Comfy dans le guide

Vérification du 2026-09-24, branche `cursor/comfy-click-to-load-1a7e` : chargement au clic, ajouté après le cadre de #2. Build GitHub Pages (`GITHUB_PAGES=true`, `NEXT_PUBLIC_BASE_PATH=/U-TTU-Studio`) servi sous le sous-chemin, en HTTPS local (certificat autosigné) puis en HTTP. Chrome headless, 15 images synthétiques jusqu’au PASS, clics souris réels, journal réseau de la page. Sans compte Comfy tiers, rien n’est vérifié après la page de connexion Comfy. Aucun run Comfy : 0 crédit.

| Contrôle | Résultat |
| --- | --- |
| `npm test` (39/39), `npm run typecheck`, `npm run build`, build Pages | PASS |
| Avant PASS : étapes 2 et 3 fermées | PASS |
| Après PASS, avant clic : aucun iframe, aucune requête vers `*.comfy.org` (journal réseau et Resource Timing), même après avoir fait défiler les deux panneaux | PASS |
| Panneau avant chargement : ce qui va se charger (Comfy Cloud en mode app, `cloud.comfy.org`), traceurs tiers de Comfy, bouton « Charger l’app Comfy ici » | PASS |
| « Ouvrir en plein onglet » disponible sans rien charger : même URL, `target="_blank"`, `rel="noopener noreferrer"` | PASS |
| Clic sur « Charger l’app Comfy ici » à l’étape 2 : iframe sur `?share=798eb224b972`, 900 px de haut à 1 440 × 1 100, focus dans le cadre ; la première requête Comfy est ce partage ; Chrome charge la page de connexion Comfy, `previousFullPath` garde le `?share=` | PASS |
| Charger l’étape 2 ne charge pas l’étape 3 | PASS |
| « Recharger l’app » : nouvel iframe, même URL, nouvelle requête | PASS |
| Étape 3 : même comportement, iframe sur `?share=25954f3b0278` | PASS |
| ZIP, « Copier les 15 lignes » et coût au-dessus du panneau ; « Coût avant le run » et « Lire le résultat » jamais par-dessus les cadres chargés | PASS |
| Note sous le panneau : compte et crédits du client, test à blanc d’abord, images locales jusqu’au dépôt, repli plein onglet | PASS |
| HTTP : avertissement inchangé à la place du bouton, aucune requête vers `*.comfy.org` | PASS |
| 390 et 320 px : pas de débordement horizontal, avant et après chargement | PASS |
| Aucune trace de Look-Lock dans le HTML ; nav : Le piège, Le parcours, Le coût, Accès anticipé | PASS |
| Aucune erreur JavaScript sur la page du studio | PASS |

Défaut trouvé et corrigé pendant #2 : les panneaux collants « Coût avant le run » et « Lire le résultat » passaient par-dessus le cadre pendant le défilement. Le panneau Comfy est sorti de leur grille.

### Smoke manuel sur Pages

1. Ouvrir https://enudimmud.github.io/U-TTU-Studio/, puis les outils de développement, onglet Réseau, filtre `comfy.org`.
2. Amener le gate au PASS (15 images gardées). Les étapes 2 et 3 s’ouvrent ; le filtre reste vide.
3. Étape 2 : « Charger l’app Comfy ici ». Le cadre affiche la connexion Comfy et le filtre montre `cloud.comfy.org`.
4. Se connecter dans le cadre, puis accepter « Open shared workflow ». Attendu : l’App Mode avec Image 01 à 15, Légendes, Étapes d’entraînement, Prompt, Force LoRA, Seed et Nombre d’images.
5. Connexion impossible dans le cadre : « Ouvrir en plein onglet » ouvre la même app. Le ZIP, les légendes et le coût restent dans l’onglet du studio.
6. Étape 3 : même chose pour le test de prompt.

## Captures

| Écran | Fichier |
| --- | --- |
| Hero desktop | [hero-desktop.jpg](screenshots/hero-desktop.jpg) |
| Gate PASS | [gate-pass-desktop.jpg](screenshots/gate-pass-desktop.jpg) |
| Gate FAIL (G15) | [gate-fail-desktop.jpg](screenshots/gate-fail-desktop.jpg) |
| Étape 2, coût | [train-step-desktop.jpg](screenshots/train-step-desktop.jpg) |
| Étape 2, app Comfy avant le clic | [comfy-consent-desktop.jpg](screenshots/comfy-consent-desktop.jpg) |
| Étape 2, app Comfy chargée | [comfy-panel-desktop.jpg](screenshots/comfy-panel-desktop.jpg) |
| Étape 3 | [image-step-desktop.jpg](screenshots/image-step-desktop.jpg) |
| Mobile | [hero-mobile.jpg](screenshots/hero-mobile.jpg), [guide-mobile.jpg](screenshots/guide-mobile.jpg) |

## Limites

- Aucun entraînement réel n’a été exécuté. Le comportement de `TrainLoraNode` sur Flux.1 [dev] dans Comfy Cloud, les durées et la qualité restent à mesurer par la calibration ([COMFY-STACK.md](COMFY-STACK.md#coût--modèle-et-calibration)).
- Les seuils du gate sont validés sur des images synthétiques, pas sur des datasets clients.
- Vérifié dans Chrome uniquement : ni Safari, ni Firefox, ni appareil physique.
- L’écran App Mode connecté n’a pas été vu sans compte Comfy tiers. Le frontend Comfy ouvre un partage dans la vue de `extra.linearMode`, qui vaut `true` pour les deux snapshots.
- Connexion Comfy dans le cadre : non vérifiée. Repli : « Ouvrir en plein onglet », même URL.
