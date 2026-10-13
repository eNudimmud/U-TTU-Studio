# Rapport R7 — montage, maquette, repérage

Date : 2026-10-13. R7 est dans `main` (`cb6ac1a`). R7.1 part de là. 0 crédit Comfy : aucun `run_template`, `submit_workflow`, `partner_generate`, `estimate_credits`. Finaliser n’a pas été modifié.

## R7.1 — la vue de rue

En prod (`https://u-ttu-studio.vercel.app/studio`, sans `?demo=1`), DÉCOR sur « Lausanne Place Saint-François » ne montrait pas de rue. Le diagnostic Playwright :

- le mode démo n’est pas actif (pas de `?demo=1`, pas de photo factice Ada Rue) ;
- aucune en-tête Content-Security-Policy, et le navigateur joint bien Photon, OpenFreeMap et Overpass ;
- Overpass a répondu que le quartier n’avait pas pu être chargé. Les photos n’étaient demandées qu’après ce quartier, donc Panoramax n’était même pas appelé ;
- quand les photos partaient, l’écran ne montrait que des vignettes, pas une vue où l’on regarde autour de soi.

Les photos existent. `place_position=6.6323,46.5197` avec `place_distance=0-300` renvoie des images sur `panoramax.openstreetmap.fr` (auteur, licence CC BY-SA, liens prev/next). L’ancienne recherche ne couvrait que 50 à 80 m : à Lausanne la plus proche est plus loin.

Maintenant, le point choisi ouvre tout de suite la photo Panoramax la plus proche, dans un rayon de 300 m. Photo Sphere Viewer (le moteur du visualiseur Panoramax) affiche l’image HD ou SD : on glisse pour regarder, « Photo suivante » et « Photo précédente » avancent le long de la séquence, et le marqueur de la mini-carte suit la photo. « Prendre cette vue » enregistre le cadrage affiché, avec l’auteur et la licence. « Créer le décor » reste un devis, éteint en démo. « Garder ce lieu » écrit le lieu dans Mon studio. La vue 3D Overpass ne s’ouvre que s’il n’y a aucune photo dans les 300 m, avec la phrase qui le dit.

À 390 px la vue passe en plein écran (`position: fixed` sur le viewport, `touch-action: none` sur l’image). Le doigt tourne la tête sans faire défiler la page. « Quitter la vue » rend le reste de l’écran.

Vérifié hors démo, avec de vrais appels, le 2026-10-13 :

- Lausanne, Place Saint-François : photo `1b15b784-e306-4eef-beb0-30930eac6eed`, jo2sm, CC BY-SA. La séquence en contient 9 dans le rayon. « Photo précédente » ouvre `847445f6-…`. Le glisser change le cap (336° à 1280, 334° à 390).
- Paris, Montmartre : photo `47f259eb-e482-40bf-a0d2-3477a15ffc0a`, pyrog, CC BY-SA. « Photo suivante » ouvre `365dd2c5-…`. Le cap passe à 355° (1280) et 356° (390).
- « Prendre cette vue » répond « Photo ajoutée aux références. © jo2sm, Panoramax, CC BY-SA » (et de même pour pyrog).
- Captures 1280 et 390 de Lausanne et de Paris, jointes à la PR. Elles ne sont pas dans le dépôt : ce sont des photos CC BY-SA.

La CI reste en `?demo=1`. Les routes Overpass, Photon et Panoramax y sont coupées. La vue de démo est peinte dans le navigateur (Ada Rue, Nils Quai, CC BY-SA) et le glisser change quand même le cap. Le visualiseur Panoramax complet (`@panoramax/web-viewer`) n’est pas embarqué : il remplace la page par sa propre carte et il demande MapLibre 6, alors que la carte du studio est en MapLibre 4. Photo Sphere Viewer est le moteur qu’il utilise pour regarder autour.

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

À 1280, le champ « Ce qui se passe » et le panneau « Ce que l’app va faire » sont dans la même colonne de droite. Elle défile toute seule : le panneau ne recouvre plus le champ, et le texte n’est plus coupé. Le devis se lit « Au maximum 18,75 crédits (mesuré). » Le même tour de phrase vaut partout : « Au maximum 18 crédits (estimation). » à la place de « Plafond 18, hypothèse. »

### Décor

Trois gestes, tout en open source. Aucune clé Google, aucun Street View, aucune tuile Google. Un lien Google collé est seulement lu.

1. On touche un point n’importe où sur la carte (MapLibre GL, style OpenFreeMap). Le champ « Où ? » accepte aussi un nom, des coordonnées, un lien, ou un fichier KML, KMZ ou GeoJSON. Quatre exemples : Montmartre, Shibuya, Brooklyn Bridge, Genève.
2. La photo de rue la plus proche s’ouvre dans la vue immersive (Photo Sphere Viewer, images Panoramax). On glisse pour regarder, on avance de photo en photo, le marqueur suit sur la mini-carte. « Prendre cette vue » garde le cadrage, l’auteur et la licence. S’il n’y a aucune photo à moins de 300 m, la vue 3D Overpass prend le relais et le dit. Mapillary n’est appelé que si `NEXT_PUBLIC_MAPILLARY_TOKEN` est présent, et seulement quand Panoramax n’a rien.
3. « Créer le décor » est le seul coût affiché : ≈ 13 crédits, hypothèse, estimation à mesurer. En démo le bouton reste éteint, avec sa raison. Rien n’est envoyé. « Garder ce lieu » écrit le lieu dans Mon studio. Le bouton doré dit « Au maximum 18 crédits (estimation). »

Aucun serveur n’est hébergé pour ça, et aucun service payant n’est appelé. Le navigateur parle directement à OpenFreeMap, à Photon (recherche d’un nom), à Overpass et à Panoramax. Un lien complet ou des coordonnées se lisent sur l’appareil. Un lien court demande le lien complet. Chaque service est limité à une requête par seconde et gardé dix minutes. Les mentions restent visibles : © contributeurs OpenStreetMap, ODbL, OpenFreeMap, Photon, et pour chaque photo l’auteur avec Panoramax ou Mapillary. Sur mobile le rayon est plus court. En démo, et donc en CI, le quartier et les photos sont factices : aucun appel Overpass, Photon, Panoramax, Mapillary ni Google.

**Le jeton Mapillary est absent.** Panoramax n’en a pas besoin. Sans jeton, Mapillary n’est pas appelé et le dit, sans griser les photos Panoramax.

## Hypothèses

- 13 crédits pour le graphe guidé `api_nano_banana_2_1_image_edit`, celui de « Créer le décor » (capture au sol et photos choisies, style du projet). Le chemin mesuré sans guide reste 12,5. Le 13 n’est pas une mesure. Rien n’est envoyé.
- OpenFreeMap, Photon, Overpass et Panoramax se comportent comme leur documentation publique. Chacun peut échouer ou limiter le débit : le navigateur attend une seconde, garde la réponse dix minutes, et la mention reste. La démo et les tests n’appellent pas ces services.
- Mapillary reste optionnel, avec un jeton client gratuit dans `NEXT_PUBLIC_MAPILLARY_TOKEN`. Il est vide ici. Panoramax passe devant. Les photos de la démo sont peintes dans le navigateur.
- La réaction muette du montage est un plan muet enchaîné, pas une deuxième prise PRISE.
- Douze personnages est le plafond de la maquette, pour que la scène reste légère. Le bouton + Personnage dit pourquoi il s’éteint.

## Ce qui reste

- Brancher l’envoi de « Composer l'image ». Il dit encore que rien ne part. Le devis affiché est 12,5, mesuré.
- Finaliser : résolution et netteté d’une prise déjà gardée. Inchangé, toujours éteint tant que le graphe n’est pas mesuré.
- Allumer « Créer le décor » une fois le graphe NB2.1 mesuré. Le volume 3D et les références sont déjà gardés. Le bouton reste éteint, y compris en démo, et rien n’est envoyé.
- Fournir `NEXT_PUBLIC_MAPILLARY_TOKEN` seulement pour compléter Panoramax. Le volet et l’attribution sont déjà en place.
- Poses VRMA / BVH, VRM détaillé, export PSD, trait manga.

## Vérifié

`npm test` : 319 passés, 1 ignoré. `npm run typecheck`. `npx playwright test` : le parcours CAST → DÉCOR (toucher la carte, vue depuis le sol, tourner la tête, photo Panoramax d’Ada Rue en 360° et CC BY-SA, « Créer le décor » éteint en démo avec le devis ≈ 13, « Garder ce lieu », aucune requête Overpass, Photon, Panoramax, Google, Mapillary ni fbcdn) → PRISE (le lieu 3D en fond, un mannequin puis trois espacés dans la rue, retrait, tuile, Autre essai, cadenas, un seul bouton « Composer l'image », un seul devis 12,5, panneau qui lit le cast, le lieu et le cadrage) → MONTAGE (statut Prêt, libellés entiers, pistes visibles, glisser, lecture, envoi) passe à 1280×800 et à 390×844. Aucune requête Comfy ni fal.

Relecture des captures : à 1280 et à 390, « Ce qui se passe » et « Ce que l’app va faire » ne se recouvrent pas, le texte du champ tient en entier, les deux légendes photo se lisent sur deux lignes (« Nils Quai · Panoramax · CC BY-SA · 360° »), et le plafond dit « Au maximum 18 crédits (estimation). » ou « Au maximum 18,75 crédits (mesuré). »

Captures 1280×800 et 390×844 : `artifacts/screenshots/r7-pas-1-*` (carte), `r7-pas-2-*` (depuis le sol), `r7-pas-3-*` (créer le décor), `r7-cast-*`, `r7-decor-*`, `r7-prise-1-*`, `r7-prise-3-*`, `r7-montage-*`. La prod, avant correctif : `r7-prod-montage-*`.
