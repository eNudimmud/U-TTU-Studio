# Repérage 3D (DÉCOR)

Un seul point d'entrée, « Repérer un lieu », dans l'écran DÉCOR. On cherche un lieu (nom, adresse,
coordonnées ou lien de carte), on cadre la vue en 3D, on choisit un rendu, puis on capture.

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
| Recherche de lieu | Photon (komoot), données OSM | Utilisation raisonnable : envoi à la validation seulement, 1 requête/s, cache 10 min |
| Photo de rue compagne | Panoramax (puis Mapillary si un jeton est configuré) | Auteur et licence affichés sous la photo |
| Rendu | three.js (MIT), décodage @mapbox/vector-tile (BSD-3) et pbf (BSD-3) | — |

Pas de Cesium ni de compte ion : le moteur (`src/components/app/reperage/engine.ts`) est chargé à la
demande (`import()` + `next/dynamic`, `ssr: false`) et ne pèse rien tant que l'outil n'est pas ouvert.
Les coordonnées et liens sont lus localement : ils n'atteignent jamais le géocodeur.

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
  attribution complète.

Le lieu apparaît dans la galerie DÉCOR et dans PRISE. L'image couleur est posée comme photo de
référence du geste « décor depuis une photo » ; l'outil affiche le devis estimé et **ne lance rien**.

## Attribution

La ligne courte reste visible sur la vue et dans chaque capture ; le détail (y compris la liste complète
des sources du relief) est sous « Sources et licences ». OpenStreetMap est toujours cité en premier.

## Tests

- `tests/reperage-3d.test.ts` : métadonnées de capture, attribution, limiteur et cache du géocodeur,
  décodage d'une tuile synthétique, soleil, détection de la Suisse.
- `e2e/reperage-3d.spec.ts` : parcours complet hors ligne (tuiles, relief, géocodeur simulés),
  variante sans WebGL, géocodeur limité (429).
- Les fixtures (`e2e/fixtures/reperage-tile.pbf`, `reperage-terrain.png`) sont synthétiques et
  régénérables : `node scripts/reperage/make-fixtures.mjs`.

## Suites possibles

- swissBUILDINGS3D et terrain 3D swisstopo (3D Tiles) pour des toits réels en Suisse.
- Hauteurs OSM : sans `height`/`building:levels`, les bâtiments retombent à une hauteur par défaut.
