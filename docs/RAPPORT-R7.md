# Rapport R7 — montage, maquette, repérage

Date : 2026-10-13. Base : `main` à `f57a2ad` (R6). Rien n’est mergé. 0 crédit Comfy : aucun `run_template`, `submit_workflow`, `partner_generate`, `estimate_credits`. Finaliser n’a pas été modifié.

## Ce qui est fait

### Montage (lot 0)

En prod (`https://u-ttu-studio.vercel.app/studio?demo=1#montage`, le R6 publié), la zone temps a `overflow: hidden`. À 1280×800 les pistes son font 41 px de haut. À 390×844, Voix commence à y=769 et Effets / Musique passent sous la fenêtre (y=866 et y=963) sans défilement possible. La régression vient de R5 (`e1099aa`) qui a coupé le défilement vertical de la timeline, puis de R6 (`f57a2ad`) qui a figé la colonne du montage en `overflow: hidden`.

★ Garder écrivait une note, pas une prise avec un fichier. La timeline ne recevait donc pas le plan. Le bouton ne faisait que changer d’écran.

Maintenant :

- les quatre rangées (image, voix, effets, musique) tiennent dans la fenêtre à 1280×800 et à 390×844 ;
- Voix, Effets et Musique s'écrivent en entier dans la colonne des pistes, y compris à 1280 px ;
- l'onglet MONTAGE dit « Prêt » quand le cut affiché a des clips (l'exemple en a), et « Vide » seulement quand le cut enregistré est vide ;
- les pistes ont leur nom, un clip se déplace au doigt, la lecture change d’état ;
- « Envoyer au montage » écrit l’image du plan, la prise gardée (0 crédit, moteur comfy), le plan, la séquence et le cut. Un cut neuf garde la voix et la musique d’exemple, pour que les pistes ne naissent pas vides ;
- en montage, « Réaction muette » ajoute un plan muet de 2 s à la suite.

### Prise

Les huit tuiles de cadrage et les sept tuiles de caméra ont laissé la place à six tuiles : Plan large, Plan taille, Champ / contrechamp, Réaction muette, Zoom d’impact, Regard caméra. Un tap place la caméra de la maquette et réécrit la phrase. La phrase reste la source : y nommer une tuile la sélectionne.

La maquette three.js ouvre sur un seul mannequin, debout, les pieds sur le sol. Le corps ne tangue plus : seul le lacet change. « + Personnage » en ajoute d’autres, pris dans le cast ou laissés neutres, jusqu’à douze. Chacun se retire, se déplace et se tourne seul. Plan taille, champ / contrechamp et réaction muette demandent deux personnages : avec un seul, la tuile dit pourquoi et indique + Personnage. La phrase suit le nombre. On glisse un personnage pour le déplacer, le fond pour tourner la caméra, on pince pour zoomer. `touch-action: none` ne couvre que la scène. Le pixel ratio est plafonné à 2. Sans WebGL, un plateau 2D reprend les mêmes gestes. Le texte d’aide est dans le cadre doré.

Le premier du cast (sinon Uttu) et le décor choisi (sinon le premier lieu) sont dans la scène. Le personnage d’exemple s’appelle Uttu.

« Autre essai » est gratuit et reste dans le navigateur. « Garder la pose » et « Garder la caméra » sont des cadenas. « Annuler » revient en arrière, et dit pourquoi il est éteint.

Chaque personnage ajouté se place sur une ligne, face caméra, avec une couleur à lui et son nom au-dessus de la tête. « Rendre cette prise » et le devis ≈ 13 ne sont plus à côté du compositeur. Il reste un seul bouton principal, « Composer l'image », et un seul devis (12,5, mesuré). « Essai rapide » reste le second bouton, sans deuxième devis. Le panneau « Ce que l'app va faire » lit le cast, le lieu et le cadrage de la maquette : trois personnages et Montmartre ne laissent plus « Devis : inconnu » ni « Choisis au moins un personnage ou un lieu ». Le clic dit encore que rien ne part. « Habiller ce décor » garde l’hypothèse « estimation à mesurer ». Le cadrage et la ligne de maquette entrent dans le texte de la requête, sous Détails.

« Ce qui se passe » n’est écrit qu’une fois. « Qui ? » montre les personnages réellement dans la scène. Un plan qui a un cast, un lieu ou une action dit « En place », plus « Vide ». Tourner et Retirer sont des puces, plus des rangées hautes.

### Décor

Le repérage couvre le monde entier. Un seul champ « Où ? » accepte un nom, un lien Google Maps ou Google Earth (lien court compris ; l’orientation de la caméra est reprise quand Earth la donne), des coordonnées décimales ou en degrés-minutes-secondes, ou un fichier KML, KMZ ou GeoJSON. Aucune clé Google : le lien est seulement lu.

Le quartier s’affiche en 3D : bâtiments extrudés et rues via l’API Overpass (`overpass-api.de`, OpenStreetMap), carte OpenFreeMap, relief en tuiles Terrarium (AWS Open Data), recherche Nominatim. On se place debout dans la rue au doigt, puis « Garder ce lieu » crée la fiche décor du projet dans Mon studio. Le volume est à côté, dans `Lieux/<id>.quartier.json`, pas dans la note. Quatre exemples : Montmartre, Shibuya, Brooklyn Bridge, Genève. « Debout dans la rue », « Vue du dessus » et « Inclure les alentours » règlent la caméra et, hors démo, le rayon. Les mentions restent visibles : © contributeurs OpenStreetMap, ODbL, OpenFreeMap, et le relief Terrarium. Une requête à la fois, un cache d’environ dix minutes, un User-Agent, et un message clair si Overpass ou Nominatim refuse. Sur mobile le rayon est plus court et le relief moins détaillé. En démo, et donc en CI, le quartier est factice : aucun appel Overpass, Nominatim, Terrarium ni Google. « Habiller ce décor » reste éteint, même hypothèse de devis.

Dans PRISE, ce lieu 3D devient le fond de la maquette. Les mannequins sont posés dans la rue. Le cadrage et la ligne « Dans la rue » entrent dans le texte de la requête, sous Détails, avec le devis 12,5.

## Hypothèses

- 13 crédits pour le graphe guidé `api_nano_banana_2_1_image_edit`. Le chemin mesuré sans guide reste 12,5. Le 13 n’est pas une mesure.
- Le même ordre de grandeur pour « Habiller ce décor ». Rien n’est envoyé.
- OpenFreeMap, Nominatim, Overpass et les tuiles Terrarium se comportent comme leur documentation publique. Chacun peut échouer ou limiter le débit : le message le dit, et la mention ODbL reste. La démo et les tests n’appellent pas ces services.
- La réaction muette du montage est un plan muet enchaîné, pas une deuxième prise PRISE.
- Douze personnages est le plafond de la maquette, pour que la scène reste légère. Le bouton + Personnage dit pourquoi il s’éteint.

## Ce qui reste

- Brancher l’envoi de « Composer l'image ». Il dit encore que rien ne part. Le devis affiché est 12,5, mesuré.
- Finaliser : résolution et netteté d’une prise déjà gardée. Inchangé, toujours éteint tant que le graphe n’est pas mesuré.
- Habiller un lieu repéré. Le volume 3D est là ; l’habillage reste éteint tant que le graphe n’est pas mesuré.
- Poses VRMA / BVH, VRM détaillé, export PSD, trait manga.

## Vérifié

`npm test` : 314 passés, 1 ignoré. `npm run typecheck`. `npm run build`. `npx playwright test` : le parcours CAST → DÉCOR (quartier 3D factice, « Garder ce lieu », aucune requête Overpass, Nominatim, Terrarium ni Google) → PRISE (le lieu 3D en fond, un mannequin puis trois espacés dans la rue, retrait, tuile, Autre essai, cadenas, un seul bouton « Composer l'image », un seul devis 12,5, panneau qui lit le cast, le lieu et le cadrage) → MONTAGE (statut Prêt, libellés entiers, pistes visibles, glisser, lecture, envoi) passe à 1280×800 et à 390×844. Aucune requête Comfy ni fal.

Captures 1280×800 et 390×844 : `artifacts/screenshots/r7-cast-*`, `r7-decor-*`, `r7-prise-1-*`, `r7-prise-3-*`, `r7-montage-*`. La prod, avant correctif : `r7-prod-montage-*`.
