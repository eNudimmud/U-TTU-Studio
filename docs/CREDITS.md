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
| `cast-mira` | `cast-mira.webp` | Mira, canon | copie de `public/images/uttu-canon-portrait.webp`, personnage fictif du dépôt |

Les photos libres qui servaient d’attente ont été retirées. Mira n’est pas un rendu Seedream : c’est le portrait fictif déjà dans le dépôt. Le guide n’est plus un exemple.
