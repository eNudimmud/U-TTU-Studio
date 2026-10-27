# Repérage 3D (DÉCOR)

Un seul outil de lieu, « Repérer un lieu », dans l'écran DÉCOR. On cherche un lieu (nom, adresse,
coordonnées, lien de carte ou fichier KML/KMZ/GeoJSON), on cadre la vue en 3D, on choisit un rendu,
puis on capture.

L'ancienne carte 2D (MapLibre, photos de rue, « Garder ce lieu ») est fondue dans cet outil depuis la v2 :
plus de bloc en double sous l'entrée, plus de devis « ≈ 13 crédits » (guide de maquette non mesuré).
Ce que la carte 2D apportait est repris dans la feuille 3D :

- ouverture d'un fichier de lieu (KML, KMZ, GeoJSON), lu localement ;
- photos de rue libres autour du lieu (Panoramax, puis Mapillary si un jeton est configuré), avec
  précédente / suivante, « Chercher jusqu'à 1000 m », vue 360° recadrable (Photo Sphere Viewer) ;
- le pâté de maisons autour de la vue (`Lieux/<id>.quartier.json`) part avec chaque capture : la
  maquette de PRISE l'affiche comme avant.

## Pourquoi pas Google

Les conditions de Google Maps Platform interdisent de capturer ou d'exporter Street View, Map Tiles
et Photorealistic 3D Tiles, et de les envoyer à un modèle d'IA (voir
`/workspace/concours/STREETVIEW-CONDITIONS.md`, hors dépôt). Cet outil n'utilise aucune donnée Google.

## Pile technique

| Rôle | Source | Licence / conditions |
| --- | --- | --- |
| Bâtiments, routes, eau, parcs (monde) | OpenStreetMap via les tuiles vectorielles OpenFreeMap (schéma OpenMapTiles, z14) | ODbL 1.0, « © contributeurs OpenStreetMap », « OpenFreeMap © OpenMapTiles » |
| Relief (monde) | Terrain Tiles, Mapzen / Tilezen sur AWS Open Data (Terrarium, z13) | Attribution requise : voir https://github.com/tilezen/joerd/blob/master/docs/attribution.md |
| Sol en Photo-carte (Suisse) | SWISSIMAGE, WMTS swisstopo (z16) | OGD swisstopo, « © swisstopo » |
| Bâtiments réels, toits compris (Suisse) | swissBUILDINGS3D 2.0, 3D Tiles publiques de swisstopo (`3d.geo.admin.ch/ch.swisstopo.swissbuildings3d.3d/v1/`), b3dm + Draco | OGD swisstopo, « Bâtiments : swissBUILDINGS3D © swisstopo » |
| Recherche de lieu | Photon (komoot), données OSM | Utilisation raisonnable : envoi à la validation seulement, 1 requête/s, cache 10 min |
| Photo de rue compagne | Panoramax (puis Mapillary si un jeton est configuré) | Auteur et licence affichés sous la photo |
| Rendu | three.js (MIT), décodage @mapbox/vector-tile (BSD-3) et pbf (BSD-3) | — |

Pas de Cesium ni de compte ion (ni de librairie 3D Tiles : `3d-tiles-renderer` exige three ≥ 0.167) : le moteur (`src/components/app/reperage/engine.ts`) est chargé à la
demande (`import()` + `next/dynamic`, `ssr: false`) et ne pèse rien tant que l'outil n'est pas ouvert.
Les coordonnées et liens sont lus localement : ils n'atteignent jamais le géocodeur.

## Toits réels en Suisse (swissBUILDINGS3D)

Quand le lieu est en Suisse (`inSwitzerland`), la ville OSM s'affiche d'abord, puis les vrais bâtiments
swisstopo la remplacent autour du lieu (« Toits réels swisstopo en chargement… » sur la vue, puis
« Toits réels swissBUILDINGS3D : N bâtiments » sous le nom du lieu). Code : `src/lib/repere3d/swiss-buildings.ts`
(fonctions pures, testées) et `decodeSwiss` / `loadSwiss` dans le moteur.

- **Lecture** : le tileset racine, puis ses tilesets externes, sont parcourus et seules les tuiles de
  contenu qui touchent le cercle sont gardées, les plus proches d'abord (rayon 560 m, 160 tuiles max ;
  téléphone 360 m, 70 tuiles). Seul l'hôte `3d.geo.admin.ch` en https est suivi.
- **Décodage** : b3dm → glTF (Draco) avec `GLTFLoader` + `DRACOLoader` de three ; le décodeur Draco est
  servi par le site (`public/draco/`, Apache-2.0), aucun CDN. Les sommets passent de glTF (Y en haut) à
  ECEF (+ `RTC_CENTER`), puis en latitude, longitude et hauteur ellipsoïdale, puis dans le repère local.
- **Calage en hauteur** : la médiane de l'écart entre la base de chaque bâtiment et le relief Terrain Tiles
  sous lui (le géoïde, ~50 m, plus l'erreur locale) est retirée une fois.
- **Couture** : bâtiments swisstopo dans le rayon, volumes OSM au-delà (centre de l'emprise), un seul
  maillage. Les couleurs swisstopo sont adoucies (toits brique, murs clairs) pour rester sobres.
- **Repli** : réseau refusé, tuile manquante ou rien de trouvé → volumes OSM, message « Toits réels
  indisponibles ». La capture attend au plus 8 s que les toits arrivent.

## Gestes

- Souris : glisser = déplacer, clic droit ou Maj + glisser = tourner et incliner, molette = zoom.
- Tactile, 1 doigt : déplacer. 2 doigts, **un seul sens à la fois** (`src/lib/repere3d/gesture.ts`) :
  tourner les doigts = pivoter, glisser les deux doigts vers le haut ou le bas = incliner, pincer = zoomer.
  Zone morte : 9° de rotation, 16 px de glissé commun, 8 % d'écart ; le premier seuil franchi gagne et reste
  jusqu'au lever des doigts. Glisser vers le haut couche la caméra vers l'horizon.
- Boutons (44 px) sous la vue, jamais sur le cadre 16:9 : tourner, incliner, rapprocher / éloigner
  (ou avancer / reculer en vue rue).

## Rendus

- **Photo-carte** : sol coloré (ou SWISSIMAGE en Suisse), volumes éclairés.
- **Volumes** : maquette grise, contours légers.
- **Trait** : lignes d'encre (profondeur + normales), aplat blanc.
- **Trait + ombres** : idem, ombres portées en trame de points.

Réglages (repliés) : azimut et hauteur du soleil, focale (FOV), épaisseur du trait, densité de trame.
Préréglages lumière : matin, midi, soir (position solaire réelle du jour, bornée au-dessus de l'horizon).

## Capture

« Capturer ce cadrage » enregistre dans le coffre local, dossier `Lieux/` :

- `<id>-3d-<horodatage>.jpg` : image couleur 1536×864 ;
- `.depth.png` : profondeur linéaire, proche = blanc, bornes `near`/`far` dans le JSON ;
- `.lines.png` : carte de traits ;
- `.json` : lieu, caméra (lat/lng, cap, inclinaison, FOV, focale 24×36, hauteur), soleil, rendu, sources,
  attribution complète ;
- `<id>.quartier.json` : bâtiments OSM et rues autour de la vue (130 m, 70 m sur téléphone, le double
  si la vue tombe sur une place), relief relatif, pour la maquette de PRISE.

Le lieu apparaît dans la galerie DÉCOR et dans PRISE. L'image couleur est le cadre structurel du
geste « décor depuis un cadre » (InstantX + Lotus, ≈ 5 crédits) ; l'outil affiche le devis estimé et **ne lance rien** avant confirmation.

## Attribution

La ligne courte reste visible sur la vue et dans chaque capture ; le détail (y compris la liste complète
des sources du relief) est sous « Sources et licences ». OpenStreetMap est toujours cité en premier.

## Tests

- `tests/reperage-3d.test.ts` : métadonnées de capture, attribution, limiteur et cache du géocodeur,
  décodage d'une tuile synthétique, soleil, détection de la Suisse.
- `tests/reperage-3d-v2.test.ts` : ECEF ↔ géodésique, glTF → repère local, découpe b3dm, parcours du
  tileset (hôte swisstopo seul), calage en hauteur, attribution swisstopo, décodeur Draco local, gestes à
  deux doigts (zone morte, rotation, inclinaison, zoom).
- `e2e/reperage-3d.spec.ts` : parcours complet hors ligne (tuiles, relief, géocodeur, swissBUILDINGS3D
  simulés), toits réels prêts, boutons sous la vue, geste de rotation sans inclinaison et l'inverse,
  plus de carte 2D en DÉCOR ; variante sans WebGL, géocodeur limité (429).
- `e2e/rue-photos.spec.ts` : photos de rue dans la feuille 3D même si la carte est refusée, avec et sans
  WebGL, précédente / suivante, cibles 44 px.
- `e2e/parcours.spec.ts` : DÉCOR → capture 3D → maquette PRISE avec le pâté de maisons.
- Les fixtures (`e2e/fixtures/reperage-tile.pbf`, `reperage-terrain.png`) sont synthétiques et
  régénérables : `node scripts/reperage/make-fixtures.mjs`. `swissbuildings-lausanne.b3dm` est une vraie
  tuile swissBUILDINGS3D de Lausanne (12 Ko, OGD « © swisstopo »).

## Limites connues

- Toits réels seulement en Suisse et seulement dans le rayon (560 m / 360 m) : au-delà, et partout ailleurs
  dans le monde, ce sont des volumes OSM à toit plat. La couture se voit en plan large.
- swissBUILDINGS3D n'a pas de textures de façade : murs et toits sont des aplats colorés.
- Le calage en hauteur est global : sur une pente forte, un bâtiment peut flotter ou s'enfoncer de 1 à 2 m.
- Hors Suisse, les hauteurs OSM sans `height`/`building:levels` retombent à une hauteur par défaut.
- Photos de rue : dépendent de Panoramax (et de Mapillary avec jeton). Si le service ne répond pas, la
  section le dit et propose de chercher plus loin.
- Le geste à deux doigts est testé par des pointeurs simulés dans Chromium ; à valider sur un vrai téléphone.

## Suites possibles

- Terrain 3D swisstopo (swissALTI3D) à la place de Terrain Tiles en Suisse.
- Toits réels ailleurs quand une source ouverte existe (ex. bâtiments 3D ouverts d'autres pays).
