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

Chaque personnage ajouté se place sur une ligne, face caméra, avec une couleur à lui et son nom au-dessus de la tête. « Rendre cette prise » et le devis ≈ 13 ne sont plus à côté du compositeur. Il reste un seul bouton principal, « Composer l'image », et un seul devis (12,5, mesuré). « Essai rapide » reste le second bouton, sans deuxième devis. Le panneau « Ce que l'app va faire » lit le cast, le lieu et le cadrage de la maquette : trois personnages et Montmartre ne laissent plus « Devis : inconnu » ni « Choisis au moins un personnage ou un lieu ». Le clic dit encore que rien ne part. « Créer le décor », dans DÉCOR, garde l’hypothèse « estimation à mesurer ». Le cadrage et la ligne de maquette entrent dans le texte de la requête, sous Détails.

« Ce qui se passe » n’est écrit qu’une fois. « Qui ? » montre les personnages réellement dans la scène. Un plan qui a un cast, un lieu ou une action dit « En place », plus « Vide ». Tourner et Retirer sont des puces, plus des rangées hautes.

### Décor

Trois gestes, tout en open source. Aucune clé Google, aucun Street View, aucune tuile Google. Un lien Google collé est seulement lu.

1. On touche un point n’importe où sur la carte (MapLibre GL, style OpenFreeMap). Le champ « Où ? » accepte aussi un nom, des coordonnées, un lien, ou un fichier KML, KMZ ou GeoJSON. Quatre exemples : Montmartre, Shibuya, Brooklyn Bridge, Genève.
2. La vue depuis le sol s’ouvre en three.js. On tourne la tête au doigt pour choisir l’angle. Les bâtiments viennent d’abord d’Overture Maps (tuile PMTiles publique `2026-09-23.1`, hauteurs ou nombre d’étages), sinon d’OpenStreetMap via Overpass. Les rues viennent d’Overpass. Le relief vient des tuiles Terrarium. Les photos de rue proches viennent d’abord de Panoramax (ouvert, sans jeton), puis de Mapillary si `MAPILLARY_TOKEN` est présent. Un tap choisit une photo et l’enregistre dans les références du décor, avec l’auteur et la licence (Panoramax, souvent etalab-2.0 ou CC BY-SA ; Mapillary, CC BY-SA).
3. « Créer le décor » affiche le devis avant envoi : ≈ 13 crédits, hypothèse, estimation à mesurer. En démo le bouton reste éteint, avec sa raison : rien n’est envoyé. Hors démo il reste éteint aussi, tant que ce graphe n’est pas mesuré. Aucune dépense. « Garder ce lieu » écrit déjà le volume 3D dans Mon studio (`Lieux/<id>.quartier.json`). PRISE le reprend comme fond de la maquette, mannequins dans la rue.

Les mentions restent visibles : © contributeurs OpenStreetMap, ODbL, OpenFreeMap, relief Terrarium, et, quand la tuile répond, « Bâtiments : Overture Maps, ODbL ». Une requête à la fois, un cache d’environ dix minutes, un User-Agent. Sur mobile le rayon est plus court, le plafond de bâtiments plus bas, et le relief moins détaillé. En démo, et donc en CI, le quartier et les photos sont factices : aucun appel Overpass, Nominatim, Terrarium, Overture, Panoramax, Mapillary ni Google.

**`MAPILLARY_TOKEN` est absent dans cet environnement.** Panoramax n’en a pas besoin. Sans jeton, Mapillary reste éteint et le dit, sans griser les photos Panoramax et sans planter.

## Hypothèses

- 13 crédits pour le graphe guidé `api_nano_banana_2_1_image_edit`, celui de « Créer le décor » (capture au sol et photos choisies, style du projet). Le chemin mesuré sans guide reste 12,5. Le 13 n’est pas une mesure. Rien n’est envoyé.
- OpenFreeMap, Nominatim, Overpass, les tuiles Terrarium, la tuile bâtiments Overture et l’API Panoramax se comportent comme leur documentation publique. Chacun peut échouer ou limiter le débit : le message le dit, et la mention ODbL reste. La démo et les tests n’appellent pas ces services.
- L’API Graph Mapillary demande un jeton client gratuit. Il manque ici (`MAPILLARY_TOKEN` vide). Panoramax passe devant et n’en a pas besoin. Les photos de la démo sont peintes dans le navigateur.
- La réaction muette du montage est un plan muet enchaîné, pas une deuxième prise PRISE.
- Douze personnages est le plafond de la maquette, pour que la scène reste légère. Le bouton + Personnage dit pourquoi il s’éteint.

## Ce qui reste

- Brancher l’envoi de « Composer l'image ». Il dit encore que rien ne part. Le devis affiché est 12,5, mesuré.
- Finaliser : résolution et netteté d’une prise déjà gardée. Inchangé, toujours éteint tant que le graphe n’est pas mesuré.
- Allumer « Créer le décor » une fois le graphe NB2.1 mesuré. Le volume 3D et les références sont déjà gardés. Le bouton reste éteint, y compris en démo, et rien n’est envoyé.
- Fournir `MAPILLARY_TOKEN` seulement pour compléter Panoramax. Le volet et l’attribution sont déjà en place.
- Poses VRMA / BVH, VRM détaillé, export PSD, trait manga.

## Vérifié

`npm test` : 319 passés, 1 ignoré. `npm run typecheck`. `npx playwright test` : le parcours CAST → DÉCOR (toucher la carte, vue depuis le sol, tourner la tête, photo Panoramax d’Ada Rue en CC BY-SA, « Créer le décor » éteint en démo avec le devis ≈ 13, « Garder ce lieu », aucune requête Overpass, Nominatim, Terrarium, Overture, Panoramax, Google, Mapillary ni fbcdn) → PRISE (le lieu 3D en fond, un mannequin puis trois espacés dans la rue, retrait, tuile, Autre essai, cadenas, un seul bouton « Composer l'image », un seul devis 12,5, panneau qui lit le cast, le lieu et le cadrage) → MONTAGE (statut Prêt, libellés entiers, pistes visibles, glisser, lecture, envoi) passe à 1280×800 et à 390×844. Aucune requête Comfy ni fal.

Captures 1280×800 et 390×844 : `artifacts/screenshots/r7-pas-1-*` (carte), `r7-pas-2-*` (depuis le sol), `r7-pas-3-*` (créer le décor), `r7-cast-*`, `r7-decor-*`, `r7-prise-1-*`, `r7-prise-3-*`, `r7-montage-*`. La prod, avant correctif : `r7-prod-montage-*`.
