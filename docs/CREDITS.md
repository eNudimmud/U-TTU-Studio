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
- **Outil :** tracés SVG écrits à la main. Aucune image générée par une IA payante. Aucun crédit Comfy, fal ou Higgsfield.

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

