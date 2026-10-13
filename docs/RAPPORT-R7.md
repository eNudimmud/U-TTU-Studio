# Rapport R7 — montage, maquette, repérage

Date : 2026-10-13. Base : `main` à `f57a2ad` (R6). Rien n’est mergé. 0 crédit Comfy : aucun `run_template`, `submit_workflow`, `partner_generate`, `estimate_credits`. Finaliser n’a pas été modifié.

## Ce qui est fait

### Montage (lot 0)

En prod (`https://u-ttu-studio.vercel.app/studio?demo=1#montage`, le R6 publié), la zone temps a `overflow: hidden`. À 1280×800 les pistes son font 41 px de haut. À 390×844, Voix commence à y=769 et Effets / Musique passent sous la fenêtre (y=866 et y=963) sans défilement possible. La régression vient de R5 (`e1099aa`) qui a coupé le défilement vertical de la timeline, puis de R6 (`f57a2ad`) qui a figé la colonne du montage en `overflow: hidden`.

★ Garder écrivait une note, pas une prise avec un fichier. La timeline ne recevait donc pas le plan. Le bouton ne faisait que changer d’écran.

Maintenant :

- les quatre rangées (image, voix, effets, musique) tiennent dans la fenêtre à 1280×800 et à 390×844 ;
- les pistes ont leur nom, un clip se déplace au doigt, la lecture change d’état ;
- « Envoyer au montage » écrit l’image du plan, la prise gardée (0 crédit, moteur comfy), le plan, la séquence et le cut. Un cut neuf garde la voix et la musique d’exemple, pour que les pistes ne naissent pas vides ;
- en montage, « Réaction muette » ajoute un plan muet de 2 s à la suite.

### Prise

Les huit tuiles de cadrage et les sept tuiles de caméra ont laissé la place à six tuiles : Plan large, Plan taille, Champ / contrechamp, Réaction muette, Zoom d’impact, Regard caméra. Un tap place la caméra de la maquette et réécrit la phrase. La phrase reste la source : y nommer une tuile la sélectionne.

La maquette three.js montre au plus deux mannequins. On les glisse, on tourne en glissant le fond, on pince pour zoomer. `touch-action: none` ne couvre que la scène, le défilement de la page reste libre. Le pixel ratio est plafonné à 2. Sans WebGL, un plateau 2D reprend les mêmes gestes. Le texte d’aide est dans le cadre doré.

Le cast choisi (sinon les deux premiers de la galerie, sinon Uttu et Kael) et le décor choisi (sinon le premier lieu) sont dans la scène. Le personnage d’exemple s’appelle Uttu.

« Autre essai » est gratuit et reste dans le navigateur. « Garder la pose » et « Garder la caméra » sont des cadenas. « Annuler » revient en arrière, et dit pourquoi il est éteint.

« Rendre cette prise » est éteint. Le devis affiché est « ≈ 13 crédits (hypothèse, estimation à mesurer) ». Le cadrage et la ligne de maquette entrent dans le texte de la requête, sous Détails. « Composer l'image » reste le chemin mesuré (12,5). Ce n’est pas le même geste : l’un guide une image, l’autre est le compositeur déjà en place. Aucun des deux n’envoie dans ce round.

### Décor

Repérage MapLibre, tuiles OpenFreeMap (style sombre). Quatre exemples : Montmartre, Shibuya, Brooklyn Bridge, Genève. « Y aller » interroge Nominatim une fois, via `/api/repere` (User-Agent côté serveur, 1 requête par seconde, pas d’autocomplétion). « Debout dans la rue », « Vue du dessus » et « Inclure les alentours » bougent la carte et réécrivent la même fiche. La mention « © contributeurs OpenStreetMap, ODbL » est au-dessus de la carte. Le lieu est une fiche `Lieux/` du projet, visible dans Mon studio. « Habiller ce décor » reste éteint, même hypothèse de devis.

## Hypothèses

- 13 crédits pour le graphe guidé `api_nano_banana_2_1_image_edit`. Le chemin mesuré sans guide reste 12,5. Le 13 n’est pas une mesure.
- Le même ordre de grandeur pour « Habiller ce décor ». Rien n’est envoyé.
- Le style sombre OpenFreeMap et le géocodage Nominatim se comportent comme leur documentation publique. La carte peut être vide si les tuiles ne répondent pas ; la mention ODbL reste.
- La réaction muette du montage est un plan muet enchaîné, pas une deuxième prise PRISE.

## Ce qui reste

- Mesurer le rendu guidé avant d’allumer « Rendre cette prise ».
- Brancher l’envoi de « Composer l'image ». Il dit encore que rien ne part.
- Finaliser : résolution et netteté d’une prise déjà gardée. Inchangé, toujours éteint tant que le graphe n’est pas mesuré.
- Habiller un lieu repéré. Le volume 3D du quartier n’est pas construit.
- Poses VRMA / BVH, VRM détaillé, export PSD, trait manga.

## Vérifié

`npm test` : 306 passés, 1 ignoré. `npm run typecheck`. `npm run build`. `npx playwright test` : le parcours CAST → DÉCOR → PRISE (maquette, tuile, Autre essai, cadenas) → MONTAGE (pistes visibles, glisser, lecture, envoi) passe à 1280×800 et à 390×844. Aucune requête Comfy ni fal.

Captures 1280×800 et 390×844 : `artifacts/screenshots/r7-cast-*`, `r7-decor-*`, `r7-prise-*`, `r7-montage-*`. La prod, avant correctif : `r7-prod-montage-*`.
