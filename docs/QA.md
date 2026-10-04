# Contrôles de livraison — C micro

## Personnage, préviz, remise à zéro, écran large — 4 octobre 2026

Branche `cursor/role-previz-desk-386f`. Aucune formation réelle, aucun rendu réel : **0 $ dépensé**. fal et le compte de rendu sont simulés dans le navigateur (soldes et prix seulement). Aucun `POST` vers `/api/prompt`, `/api/upload`, `/api/queue`, ni vers la file fal.

| Contrôle | Résultat | Périmètre |
| --- | --- | --- |
| Tests unitaires | PASS : 159/159 | `npm test`. GLB réel (5 nœuds pour la pièce, 60 faces, pas une image), graphe `Load3DAdvanced` → `RenderMesh` → `SaveImage`, porte sans prix inventé, photos du personnage, remises à zéro, rail à 1080 px. |
| TypeScript | PASS | `tsc --noEmit`. Le build de production (`next build --webpack`) passe aussi. |
| Look | PASS | Pas de « Former ton double ». Le fil porte Rôle. « Poser la scène » reste le geste principal. |
| Personnage | PASS | Faits (clips, photos, ce que le fichier fera et ne fera pas) et prix `15,00 $` avant tout envoi. « Former ce personnage » ne part pas : le jeu de clips n’est pas prêt, et le bouton de débit n’est pas pressé. |
| Remise à zéro | PASS | « Remettre ce personnage à zéro » efface le nom Lina. Mira, déjà au coffre, reste. |
| Préviz | PASS | Plan Pièce : fichier `scenes/gare.glb`, magie `glTF`, 5 nœuds, 1004 octets, pas un JPEG. Le texte dit « Aucune image tant que le rendu n’en a pas renvoyé. » Aucune image n’est peinte. La feuille « Rendre l’image du lieu ? » dit que Blender ne tourne pas ici et que le montant n’est pas connu d’avance. Elle est fermée sans envoi. |
| Écran large | PASS | À 1440 px : rail à gauche (232 px, dès 65 px du haut), marge du contenu 232 px, deux colonnes (648 px et 440 px). Pas de défilement horizontal. |
| Téléphone | PASS | À 390 px : colonne unique (354 px), fil en bas (du haut 767 au bas 844), marge 0. Le fil montre Look, Rôle, Scène, Prise, Sphère. Pas de défilement horizontal. |
| Console | PASS | 0 erreur. 0 requête Clerk. |

**Non vérifié ici :** un vrai rendu `RenderMesh` sur un compte Comfy (la première image sera la première qui s’affiche), une vraie formation fal. La relecture vidéo par un modèle externe n’a pas pu démarrer (quota). Les images de la prise ont été relues à la main.

## Délier les comptes — 3 octobre 2026

Branche `cursor/unlink-accounts-386f`. Aucun envoi vers un compte réel : **0 $ dépensé**. Le compte de rendu et fal sont simulés dans le navigateur.

| Contrôle | Résultat | Périmètre |
| --- | --- | --- |
| Tests unitaires | PASS : 155/155 | `npm test`. La feuille « Comptes » porte « Délier le compte de rendu » et « Délier le compte fal ». Les fonctions n’effacent ni le coffre ni un fichier formé. |
| Feuille ouverte une fois relié | PASS | Après la liaison Comfy, le compteur ouvre « Comptes » et le bouton de déliaison y est. fal n’a le sien qu’une fois relié. |
| Chacun de son côté | PASS | « Délier le compte fal » retire seulement `u-ttu-fal`. « Délier le compte de rendu » retire ensuite `u-ttu-rendu`. L’autre compte reste jusqu’à son propre geste. |
| Le coffre reste | PASS | Deux photos, le nom Mira et les deux traits sont encore là après les deux déliaisons. Le compteur redevient « Relier ». |
| Rien n’est lancé | PASS | 0 `POST /api/prompt`, 0 requête vers la file fal, Comfy ou Clerk. 0 erreur console. |

## Former son double — 3 octobre 2026

Branche `cursor/lora-fal-h3-386f`. Aucune formation réelle, aucune prise réelle : **0 $ dépensé**. fal est simulé dans le navigateur (CDP Fetch sur `api.fal.ai`, `queue.fal.run`, `rest.fal.ai`, `v3.fal.media`). Tout autre hôte est refusé. Le seul appel réseau hors de ce simulacre aurait été visible dans le journal : il n’y en a pas eu.

| Contrôle | Résultat | Périmètre |
| --- | --- | --- |
| TypeScript strict | PASS | `next build` (Webpack) typecheck inclus, Next.js 16.3.6. `/studio` statique. |
| Tests unitaires | PASS : 154/154 | `npm test` : devis fal, jeu de clips, envoi de formation (archive `clipNN` + références, pas de découpe, mise à l’échelle), prise qui recharge le fichier du coffre, client fal, coffre et ZIP, porte sur le solde. |
| Page avant le geste | PASS | « Former ton double » explique les clips, les photos du look, ce que le fichier fera et ne fera pas. Le seul bouton est « Relier mon compte fal ». Aucun envoi. |
| Porte sur le solde | PASS | Dix clips, solde 1,00 $ : « Solde trop bas » pour 15,00 $, « Former mon double » désactivé, rien en file. Après relecture à 40,00 $, la feuille « Former ton double ? » s’ouvre et fal n’a toujours rien reçu. |
| Formation puis recharge | PASS | Un seul envoi vers `minimax/h3/ref2va/trainer`. L’archive apparie chaque clip aux photos du look. Le coffre reçoit les octets exacts du `.safetensors` rendu. La prise suivante envoie ce fichier et `minimax/h3/reference-to-video/lora` le charge par cette URL (`loras[0].path`, échelle 1), avec les deux photos et l’image du lieu. Débits lus : 15,00 $ puis 0,38 $. |
| Clé | PASS | La clé reste dans le navigateur. Elle n’est dans aucun fichier du coffre. La feuille coffre le dit. |
| Hôtes | PASS | 0 requête vers Clerk, Comfy ou un traceur. 0 erreur console. |

**Ce que l’adhérent relie encore :** un compte fal avec du crédit, et une clé API de portée Admin créée une fois sur fal.ai/dashboard/keys. Le compte de rendu Comfy n’est pas requis pour ce chemin.

## Studio direct — 3 octobre 2026

Branche `cursor/studio-direct-386f`. Aucune prise réelle, rien publié : **0 crédit dépensé**.

| Contrôle | Résultat | Périmètre |
| --- | --- | --- |
| TypeScript strict | PASS | `npm run typecheck` |
| Tests unitaires | PASS : 132/132 | `npm test` : graphe de prise égal aux graphes acceptés en `dry_run`, client de rendu et prise complète contre un faux Comfy Cloud (envoi, file, suivi, vidéo, coût mesuré, refus, annulation, réseau qui saute), crédits et porte, coffre et ZIP, session, Clerk hors du studio, page Comfy relayée. |
| Build de production | PASS | `npm run build` (Next.js 16.3.6, Webpack). `/studio` et `/compte` statiques. |
| Graphe de prise sur Comfy Cloud | PASS | `submit_workflow` en `dry_run`, variantes rapide et fine : « passed local pre-flight », aucun job. |
| Parcours complet dans Chrome | PASS : 48/48 | Build de production, téléphone 390 × 844. Comfy Cloud simulé dans le navigateur (CDP Fetch) : chaque `/api/*` est servi localement, tout autre hôte est refusé, et le frontal local refuse en plus `POST /api/prompt`, `/api/upload`, `/api/queue`. Look, scène, liaison par clé, prise non calibrée, confirmation, suivi, vidéo, coût mesuré (55 crédits), annonce calibrée, Sphère (vignette en pixels), lecteur, crédits, coffre et export ZIP (ouvert par `unzip -t`), Soft Error, rechargement pendant une prise (même job repris, pas de second envoi), focus des feuilles, aucune requête vers Comfy, Clerk ou un traceur. 0 erreur console. |
| Clerk hors du studio | PASS | Build avec une clé publique de l’instance Development et une clé secrète factice : 0 requête Clerk et 0 cookie sur `/` et `/studio` ; la poignée de main Clerk seulement sur `/compte` ; `/studio#compte` mène à `/compte`. |

**Non vérifié ici :** une prise réelle sur un vrai compte (la première sera aussi la première calibration), la connexion Comfy dans la feuille avec un vrai compte, la feuille de partage d’un téléphone réel, le stockage persistant sur Safari iOS.

## Livraison du 24 septembre 2026

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

## Doctrine : cadrages, légendes, grille de test

Vérification du 2026-09-24, branche `cursor/doctrine-ui-bf83`. Build GitHub Pages servi sous le sous-chemin, en HTTPS local (certificat autosigné). Chrome headless piloté par puppeteer-core, avec de vrais clics, sélections et saisies. Jeu de test : 20 images synthétiques générées par ffmpeg, soit 15 compositions distinctes (au moins 17 bits de dHash entre elles) et les 5 pièges habituels. Aucun run Comfy : 0 crédit.

| Contrôle | Résultat |
| --- | --- |
| `npm test` (47/47), `npm run typecheck`, `npm run build`, build Pages | PASS |
| Avant import : « 20 contrôles à faire », G20 en À FAIRE, pas encore de bloc légendes | PASS |
| 8 images sur 15 étiquetées : compteur à 3 / 3 / 2, « 7 images gardées sans cadrage », aucun manque affiché | PASS |
| 15 images en 5 / 6 / 4 : G20 en PASS, verdict « PASS · 20 contrôles » | PASS |
| Deux cartes passées en gros plan (7 / 5 / 3) : G20 en À NOTER, excédent de 2 hachuré, manque de 1, deux messages ; verdict « PASS · 20 contrôles · 1 à noter », étape 2 ouverte | PASS |
| « Voir les 7 gros plans » surligne les 7 cartes | PASS |
| ZIP : `RAPPORT_GATE.txt` annonce 20 contrôles et contient la ligne `WARN G20` avec les comptes ; `unzip -t` sans erreur | PASS |
| Bloc légendes après import : principe, légende FAIL (6 traits soulignés), légende PASS, trigger du client | PASS |
| Carte vide : « Pose, tenue, décor, lumière, expression. Pas le visage. » et `[ce qui change]` dans l’aperçu. Carte remplie : plus d’aide | PASS |
| « green eyes » dans une carte : message sur la carte, champ en `aria-invalid`, G15 en FAIL | PASS |
| Étape 3, force : « Force haute… » à 1,00, « Bande d’usage » à 0,75, « Sous la bande d’usage » à 0,60 | PASS |
| Grille : colonnes 0.60, 0.75 (bande d’usage) et 0.90, 3 prompts commençant par le trigger, case 1 · 0,75 par défaut. Valeurs reportées : prompt, 0.75, seed, 1 image, 800 étapes | PASS |
| Case 2 · 0,60 : prompt et force suivent. « Copier » met le prompt, puis « 0.60 », dans le presse-papiers | PASS |
| Seed passée à 777 : la grille suit | PASS |
| Note de coût : pas de `SaveLoRA`, pas de checkpoint, une case = un run complet, avec son estimation | PASS |
| Aucun iframe et aucune requête vers `*.comfy.org` sans clic sur « Charger l’app Comfy ici » | PASS |
| Pas de débordement horizontal à 320, 390, 768, 1 024 et 1 440 px | PASS |
| Aucune erreur JavaScript ni console | PASS |

Défauts trouvés et corrigés pendant la QA :

- En cours d’étiquetage, le compteur affichait « −3 » ou « −6 » sur des cadrages encore incomplets. Un manque n’apparaît plus tant qu’une image gardée n’a pas de cadrage ; un excédent apparaît tout de suite.
- À 1 440 × 900, la note de coût de la grille sortait de l’écran. La lecture de la grille passe sur toute la largeur, sous la case choisie.

## Captures

| Écran | Fichier |
| --- | --- |
| Hero desktop | [hero-desktop.jpg](screenshots/hero-desktop.jpg) |
| Gate PASS | [gate-pass-desktop.jpg](screenshots/gate-pass-desktop.jpg) |
| Gate FAIL (G15), message sur la carte | [gate-fail-desktop.jpg](screenshots/gate-fail-desktop.jpg) |
| Repère de cadrage en À NOTER (G20) | [framing-meter-desktop.jpg](screenshots/framing-meter-desktop.jpg) |
| Légendes FAIL et PASS | [caption-coach-desktop.jpg](screenshots/caption-coach-desktop.jpg) |
| Étape 2, coût | [train-step-desktop.jpg](screenshots/train-step-desktop.jpg) |
| Étape 2, app Comfy avant le clic | [comfy-consent-desktop.jpg](screenshots/comfy-consent-desktop.jpg) |
| Étape 2, app Comfy chargée | [comfy-panel-desktop.jpg](screenshots/comfy-panel-desktop.jpg) |
| Étape 3 | [image-step-desktop.jpg](screenshots/image-step-desktop.jpg) |
| Étape 3, grille de test | [test-grid-desktop.jpg](screenshots/test-grid-desktop.jpg) |
| Mobile | [hero-mobile.jpg](screenshots/hero-mobile.jpg), [guide-mobile.jpg](screenshots/guide-mobile.jpg) |

## Limites

- Aucun entraînement réel n’a été exécuté. Le comportement de `TrainLoraNode` sur Flux.1 [dev] dans Comfy Cloud, les durées et la qualité restent à mesurer par la calibration ([COMFY-STACK.md](COMFY-STACK.md#coût--modèle-et-calibration)).
- Les seuils du gate sont validés sur des images synthétiques, pas sur des datasets clients.
- Le repère de cadrage et la bande d’usage 0,70–0,85 viennent de la pratique, pas d’une calibration sur ce stack. Le coût d’une case de grille suppose un réentraînement à chaque run : non mesuré.
- Vérifié dans Chrome uniquement : ni Safari, ni Firefox, ni appareil physique.
- L’écran App Mode connecté n’a pas été vu sans compte Comfy tiers. Le frontend Comfy ouvre un partage dans la vue de `extra.linearMode`, qui vaut `true` pour les deux snapshots.
- Connexion Comfy dans le cadre : non vérifiée. Repli : « Ouvrir en plein onglet », même URL.
