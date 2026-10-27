# Images du studio

## Décors — illustrations du dépôt

Les vignettes de DÉCOR sont des fichiers SVG dessinés pour ce studio, dans `public/images/decors/`.

| Fichier | Sujet |
| --- | --- |
| `quai.svg` | Le quai, la nuit |
| `rue.svg` | Une rue |
| `piece.svg` | Une pièce |
| `toit.svg` | Un toit |
| `gare.svg` | Une gare |
| `couloir.svg` | Un couloir |
| `silhouette.svg` | Silhouette du personnage, quand il n’a pas encore de photo |

- **Source :** dessin original du dépôt. Pas une photo, pas un export d’un service d’image.
- **Licence :** même dépôt que le code. Aucune licence tierce.
- **Outil :** tracés SVG écrits à la main. Aucune image générée par une IA payante. Aucun crédit Comfy ni Higgsfield.

Quai, Rue et Pièce restent les trois espaces déjà stockés (`previz` : `quai`, `rue`, `piece`). Toit, gare et couloir sont des images seulement : ils ne créent pas un nouvel espace dans le coffre.

Le portrait d’exemple `public/images/uttu-canon-portrait.webp` est le personnage fictif déjà dans le dépôt. Ce n’est pas une photo d’une personne réelle.

## Sons d’exemple

| Fichier | Durée | Sujet |
| --- | --- | --- |
| `public/exemples/voix-exemple.wav` | 2,4 s | Ton synthétique, mono 16 bits, 22 050 Hz. Pas une voix enregistrée. |
| `public/exemples/musique-exemple.wav` | 7 s | Nappe synthétique (220 Hz, 261,63 Hz, 329,63 Hz), même format. |

- **Source :** `scripts/exemple-audio.mjs`, synthèse originale de ce dépôt.
- **Licence :** même dépôt que le code. Aucune banque de sons tierce. Aucune personne enregistrée.

## Montage — code repris

Le montage ne copie pas un éditeur. Trois calculs viennent d’OpenCut classic, réécrits ici en secondes.

| Pièce | Dépôt | Licence | Ce qui est repris |
| --- | --- | --- | --- |
| Aimantation | [OpenCut-app/opencut-classic](https://github.com/OpenCut-app/opencut-classic) `apps/web/src/timeline/snapping/resolve.ts` | MIT | Le point le plus proche dans le seuil. À égalité, le premier reste. Seuil 10 px (`DEFAULT_TIMELINE_SNAP_THRESHOLD_PX`). |
| Mixage | même dépôt, `apps/web/src/media/audio.ts` (`mixAudioChannels`) | MIT | Interpolation linéaire, un gain par échantillon. Les fondus sont à nous. |
| Crêtes | même dépôt, `computePeakBuckets` | MIT | Une crête par barre. L’écran dessine la forme avec wavesurfer.js. |

- **wavesurfer.js** 7.9.8, [BSD-3-Clause](https://github.com/katspaugh/wavesurfer.js/blob/main/LICENSE). Forme d’onde des pistes audio.
- **mediabunny** 1.61.3, [MPL-2.0](https://github.com/Vanilagy/mediabunny/blob/main/LICENSE). Export MP4 dans le navigateur. Le dépôt OpenCut réécrit en Rust n’est pas utilisé.

## Exemples — rendus maison

Les vignettes SVG ne sont plus sur l’écran DÉCOR. Les exemples sont les fichiers de `public/exemples/`, listés par `manifest.json`. Les six décors et les trois planches `cast-coursiere`, `cast-vieil-homme`, `cast-dj` sont des rendus Seedream 4.5, en 16:9 (1600×899), générés par JD sur son compte Comfy, avec son accord. `statut` vaut `maison`.

| Identifiant | Fichier | Sujet | Source |
| --- | --- | --- | --- |
| `decor-quai-nuit` | `decor-quai-nuit.webp` | Le quai, la nuit | Rendu maison U*TTU, généré avec Seedream 4.5 via Comfy Cloud |
| `decor-rue-pluie` | `decor-rue-pluie.webp` | Sous la pluie | Rendu maison U*TTU, généré avec Seedream 4.5 via Comfy Cloud |
| `decor-piece` | `decor-piece.webp` | Une pièce | Rendu maison U*TTU, généré avec Seedream 4.5 via Comfy Cloud |
| `decor-toit-aube` | `decor-toit-aube.webp` | Un toit au lever du jour | Rendu maison U*TTU, généré avec Seedream 4.5 via Comfy Cloud |
| `decor-gare` | `decor-gare.webp` | Un hall de gare | Rendu maison U*TTU, généré avec Seedream 4.5 via Comfy Cloud |
| `decor-couloir` | `decor-couloir.webp` | Un couloir | Rendu maison U*TTU, généré avec Seedream 4.5 via Comfy Cloud |
| `cast-coursiere` | `cast-coursiere.webp` | La coursière | Rendu maison U*TTU, généré avec Seedream 4.5 via Comfy Cloud |
| `cast-vieil-homme` | `cast-vieil-homme.webp` | Le vieil homme | Rendu maison U*TTU, généré avec Seedream 4.5 via Comfy Cloud |
| `cast-dj` | `cast-dj.webp` | DJ | Rendu maison U*TTU, généré avec Seedream 4.5 via Comfy Cloud |
| `cast-uttu` | `cast-uttu.webp` | Uttu, canon | copie de `public/images/uttu-canon-portrait.webp`, personnage fictif du dépôt |

Les photos libres qui servaient d’attente ont été retirées. Uttu n’est pas un rendu Seedream : c’est le portrait fictif déjà dans le dépôt. Le guide n’est plus un exemple.

## Après d’exemple — Nano Banana 2.1 (2026-10-08)

Cinq images « après » pour CAST et DÉCOR, générées sur le compte Comfy Cloud de JD avec son accord explicite (plafond 130 ; planche non lancée, reste insuffisant).

| Identifiant | Fichier | Template | Credits (mesure) | prompt_id |
| --- | --- | --- | --- | --- |
| `apres-cast-photos` | `apres-cast-photos.webp` | `api_nano_banana_2_1_image_edit` | 11,53 | `cdc498f1-0a22-44de-a83a-93b02feed6f2` |
| `apres-cast-texte` | `apres-cast-texte.webp` | `api_nano_banana_2_1_t2i` | 13,17 | `79ba4035-d5ca-4fc4-8042-b927ea441617` |
| `apres-decor-photo` | `apres-decor-photo.webp` | `api_nano_banana_2_1_image_edit` | 13,10 | `b9382512-2900-47db-958b-789357c8e66b` |
| `apres-decor-heure` | `apres-decor-heure.webp` | `api_nano_banana_2_1_image_edit` | 12,86 | `047644bb-8be0-43d7-8a4a-79f685146aa5` |
| `apres-decor-texte` | `apres-decor-texte.webp` | `api_nano_banana_2_1_t2i` | 11,87 | `4ca1188f-4f73-435e-a42b-65f258a19e8e` |

- **Source :** Rendu maison U*TTU, généré avec Nano Banana 2.1 via Comfy Cloud.
- **Licence :** même dépôt que le code. Personnages et lieux fictifs.
- **Total utile mesuré :** 62,53 crédits. Total session mesuré 90,48 (dont 14,85 d’un job annulé encore facturé + 13,10 d’un essai démo sans override de prompt).
- **Planche :** rendue ensuite (voir section suivante). Affichage du studio : environ 71 crédits, plafond 100. Fait : 70,74 arrondis à 71.

## Après d’exemple — planche templates-character_sheet (2026-10-08)

Une planche « après » pour CAST, générée sur le compte Comfy Cloud de JD avec son accord explicite (plafond session 160 ; devis ~68 ; mesure 70,74).

| Identifiant | Fichier | Template | Credits (mesure) | prompt_id |
| --- | --- | --- | --- | --- |
| `apres-cast-planche` | `apres-cast-planche.webp` | `templates-character_sheet` (2× GeminiImage2 @2K + stitch) | 70,74 (35,41 + 35,33), affiché 71, plafond 100 | `6387ad5a-c3e6-4bfd-aff3-b844acdc34c4` |

- **Source :** Rendu maison U*TTU, généré avec `templates-character_sheet` via Comfy Cloud. Référence visage : crop de `cast-coursiere.webp` (upload `be23612a…png`).
- **Licence :** même dépôt que le code. Personnage fictif.
- **Session :** 90,48 (cinq Nano Banana + essais) + 70,74 = **161,22** (plafond 160 dépassé de 1,22 : devis 68, mesure 70,74). Un seul run, pas d’annulation.
- **Qualité :** même personne que la coursière (taches de rousseur, cheveux bouclés, imper jaune, sac olive) sur 4 vues corps + grille de close-ups. Identité stable. Pas de texte.


## Export AAC local — ajout de fiabilité

`@mediabunny/aac-encoder` **1.61.0**, paquet non modifié, licence **MPL-2.0**, auteur Vanilagy. Il fournit un encodeur AAC-LC WebAssembly basé sur libavcodec/FFmpeg quand le navigateur ne propose pas cet encodeur. Le calcul et le média restent dans l’onglet ; le paquet est servi avec l’application, sans appel de génération cloud.

- [Sources et instructions de compilation](https://github.com/Vanilagy/mediabunny/tree/v1.61.0/packages/aac-encoder).
- [Licence distribuée](../public/licenses/mediabunny-aac-encoder-MPL-2.0.txt).
- [Documentation officielle](https://mediabunny.dev/guide/extensions/aac-encoder).

Les dépendances et leur version exacte sont conservées dans `package-lock.json`.

## Mise à jour utilisateur R10b — 16 octobre 2026

La PR #109 remplace les quatre décors `decor-quai-nuit`, `decor-rue-pluie`, `decor-toit-aube` et `decor-gare`, et ajoute `cast-uttu-planche.webp`. Les fichiers sont conservés tels quels dans les branches d’audit. Leur source déclarée dans le manifeste v4 est FLUX 3 Image Klein via Comfy Cloud pour les décors, et Nano Banana Pro pour la planche d’Uttu (badge NEUKO retouché par l’auteur). Ces indications proviennent de la mise à jour utilisateur ; aucun nouveau rendu ni paiement n’a été effectué par l’audit.

Le [manifeste courant](../public/exemples/manifest.json) fait foi pour ces fichiers ; le tableau Seedream ci-dessus décrit leur version historique.

## Données cartographiques — Repérer un lieu

Le repérage 3D et la carte affichent des données ouvertes. Elles ne sont pas générées et ne coûtent aucun crédit.

| Donnée | Source | Licence / mention |
| --- | --- | --- |
| Rues, bâtiments, noms de lieux | [OpenStreetMap](https://www.openstreetmap.org/copyright) | © les contributeurs d’OpenStreetMap, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) |
| Tuiles vectorielles | [OpenFreeMap](https://openfreemap.org) | OpenFreeMap · © OpenMapTiles ; tuiles BSD-3 / CC-BY 4.0 (schéma OpenMapTiles), données © OpenStreetMap |
| Relief | [Terrain Tiles (Mapzen, AWS Open Data)](https://registry.opendata.aws/terrain-tiles/) | Sources ouvertes (USGS SRTM / GMTED / 3DEP, Copernicus EU-DEM, NOAA ETOPO1 et autres) : [mentions complètes](https://github.com/tilezen/joerd/blob/master/docs/attribution.md) |
| Données suisses | [swisstopo](https://www.swisstopo.admin.ch/fr/conditions-utilisation-geodonnees-et-geoservices-gratuit) | © swisstopo, OGD (usage libre, source obligatoire) |
| Bâtiments 3D en Suisse | [swissBUILDINGS3D](https://www.swisstopo.admin.ch/fr/modele-du-territoire-swissbuildings3d-2-0) | Bâtiments : swissBUILDINGS3D © swisstopo, OGD (usage libre, source obligatoire) |
| Recherche d’un lieu | [Photon (komoot)](https://photon.komoot.io) | Géocodage sur les données © OpenStreetMap (ODbL) |
| Photos de rue | [Panoramax](https://panoramax.fr) | Licence et auteur de chaque photo affichés ; seules les licences ouvertes identifiées (CC0, CC-BY, CC-BY-SA, etalab-2.0) peuvent être copiées dans un projet |

Les mêmes mentions sont listées dans `src/lib/repere3d/sources.ts`, affichées sur la carte du studio et enregistrées avec chaque capture.

## Exemple du repérage — Place Saint-François, Lausanne (2026-10-24)

Trois images dans `public/exemples/reperage/`, montrées dans la fiche « Repérer un lieu » (Outils et DÉCOR). Chaque affichage porte la mention « Illustration d’exemple, faite hors Comfy » en FR/EN/DE/ES.

| Fichier | Ce que c’est | Source et licence |
| --- | --- | --- |
| `sf-vue3d.webp` | Cadre 3D sorti du repérage du studio | Données © les contributeurs d’OpenStreetMap (ODbL 1.0), tuiles OpenFreeMap / OpenMapTiles, bâtiments swissBUILDINGS3D © swisstopo (OGD) |
| `sf-rue.webp` | Photo de rue recadrée (960×540) | Panoramax, © jo2sm, [CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/), 31.10.2024. Photo `0f13a6f6-fe7a-48cf-be24-09ff5144b107`, séquence `67184522-eb44-4243-8270-6f64996ca64d` ([API](https://api.panoramax.xyz/api/collections/67184522-eb44-4243-8270-6f64996ca64d/items/0f13a6f6-fe7a-48cf-be24-09ff5144b107)). Auteur retrouvé par comparaison visuelle avec les photos Panoramax du lieu (toutes de jo2sm dans un rayon de ~100 m) : à confirmer avant diffusion large. Le recadrage reste sous CC-BY-SA-4.0. |
| `sf-exemple.webp` | Résultat d’exemple | Illustration faite hors Comfy (test gratuit, pas un rendu Comfy), à partir des deux images ci-dessus ; partagée sous CC-BY-SA-4.0 par prudence, car elle dérive de la photo de jo2sm |

Les photos de rue ajoutées par le visiteur comme références d’un décor gardent leur auteur et leur licence Panoramax (CC0, CC-BY, CC-BY-SA, etalab-2.0) dans Mes créations › Lieux. Une photo CC-BY-SA rend le décor qui en dérive partageable dans les mêmes conditions : garde la mention avec le décor.

## Vignettes des outils (2026-10-23, v2)

Les 37 vignettes de `public/exemples/vignettes/` sont des illustrations générées avec Grok Imagine (images, et quatre clips vidéo pour « Animer une image », « Vidéo depuis un texte », « Faire parler » et « Synchroniser les lèvres »), puis composées par `scripts/brand/make_vignettes.py` (Pillow, numpy, OpenCV, ffmpeg). Aucun crédit Comfy n’est dépensé. Les sources sont dans `scripts/brand/vignettes-sources/`.

- **Ce sont des illustrations de ce que fait l’outil, pas des rendus du modèle de la carte.** Les avant/après (croquis → image, modifier, lumière, effacer, maquette → rendu) sont des paires d’illustrations ; « Effacer un objet » est retouché à la main dans le script (l’objet remplacé par le sable voisin).
- Les détourages (« Détourer », « Détourer une vidéo ») sont calculés par le script (GrabCut sur fond uni), pas par le modèle de la carte.
- Les formes d’onde, barres d’égaliseur, barres de temps et le squelette de pose sont dessinés.
- Uttu apparaît sur « Image polyvalente », « Image avec références », « Vidéo fidèle aux références », « Faire parler » et « Copier un mouvement », d’après son portrait officiel.
- 640×400 webp et 1280×800 `@2x.webp` pour chaque carte ; 23 cartes ont aussi une boucle muette de 3 à 4 s (`.webm` VP9 + `.mp4` H.264, moins de 400 Ko), dont l’image fixe est l’affiche et le repli « mouvement réduit ».
- `public/exemples/outils/plan-exemple.mp4` est un mouvement de caméra sur une image fixe, pas un rendu d’un modèle vidéo : ses images servent seulement d’entrée (clip donné).


## Lot d’exemples — Comfy Cloud (2026-10-27, plafond 45)

Rendus maison sur le compte Comfy Cloud de JD (accord [pt615u]). Coût réel = `gpu_seconds × 0,27325` (MESURE F26). Cumul arrêté à **40,19** crédits (Musique non lancée : reste 4,81 < 10).

| Identifiant | Fichier | Moteur | Crédits (mesure) | prompt_id |
| --- | --- | --- | --- | --- |
| `prise-uttu-quai` | `outils/prise-uttu-quai.mp4` | `video_ltx2_5_i2v` (ltxTakeGraph, 1 ref) | 9,87 | `23b176b7-4e3f-415d-ac5c-bb5ce40b386a` |
| `wan-gare` | `outils/wan-gare.mp4` | `video_wan2_2_14B_i2v` (LoRA 4 pas) | 8,44 | `c8d97094-bcb4-4c1f-95d4-6b0b7ff349eb` |
| `apres-finaliser-wan` | `apres-finaliser-wan.webp` | SeedVR2 ×2 (`utility_seedvr2_3b_int8_upscale_image`) | 0,83 | `ad17b5dc-0d13-4cea-865f-09277d74de6f` |
| `apres-retoucher-neige` | `apres-retoucher-neige.webp` | FLUX 3 Image Klein edit (`ret-modifier`) | 3,81 | `14bd97c6-82db-4798-b5e6-f8b38afb9224` |
| `apres-decor-photo` | `apres-decor-photo.webp` | FLUX 3 Image Klein edit (`decor-photo`) — remplace le Nano Banana | 2,53 | `e32f8dea-0231-4e04-a9f8-5de0af8d4285` |
| `apres-cadre-vue3d` | `apres-cadre-vue3d.webp` | FLUX 3 Image Klein edit (`cadre-decor`, 0 photo) | 4,05 | `59fff4c7-2961-4a9e-b3df-553b19bd0382` |

- **Non remplacé :** `apres-decor-heure.webp` reste le Nano Banana du 2026-10-08. Trois essais Klein sur `decor-rue-pluie` ont produit une bouillie de couleurs (coût ~10,67, sorties rejetées). Journal : `/workspace/lot-exemples/LOG.md`.
- **Correctif collatéral :** le checkpoint Klein sur Comfy Cloud s’appelle désormais `flux3-image-klein-base-int8-convrot.safetensors` (tirets). Wan i2v active la LoRA 4 pas et sort en 832×480 / 480×832.
