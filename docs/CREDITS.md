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

## Exemples — emplacements stables

Les vignettes SVG ne sont plus sur l’écran DÉCOR. Les rendus définitifs seront des images maison, déposées dans `public/exemples/` sous le même nom. Le manifeste `public/exemples/manifest.json` fixe les identifiants. Tant que `statut` vaut `provisoire`, le fichier est une photo libre ou un personnage fictif déjà dans le dépôt. Remplacer le fichier et passer `statut` à `maison` ne change pas l’identifiant. Les six décors sont en 16:9.

| Identifiant | Fichier | Sujet | Source | Licence |
| --- | --- | --- | --- | --- |
| `decor-quai-nuit` | `decor-quai-nuit.jpg` | Le quai, la nuit | [Unsplash 1471922694854](https://unsplash.com/photos/1471922694854-ff1b63b20054) | [Unsplash License](https://unsplash.com/license) |
| `decor-rue-pluie` | `decor-rue-pluie.jpg` | Sous la pluie (vitre mouillée) | [Unsplash 1428592953211](https://unsplash.com/photos/1428592953211-077101b2021b) | [Unsplash License](https://unsplash.com/license) |
| `decor-piece` | `decor-piece.jpg` | Une pièce vide | [Unsplash 1502672260266](https://unsplash.com/photos/1502672260266-1c1ef2d93688) | [Unsplash License](https://unsplash.com/license) |
| `decor-toit-aube` | `decor-toit-aube.jpg` | Un toit au lever du jour | [Unsplash 1449844908441](https://unsplash.com/photos/1449844908441-8829872d2607) | [Unsplash License](https://unsplash.com/license) |
| `decor-gare` | `decor-gare.jpg` | Hall de gare — photo provisoire : couloir de station vide | [Unsplash Yj0zZ5s6fAY](https://unsplash.com/photos/empty-subway-station-hallway-with-tiled-walls-and-fluorescent-lights-Yj0zZ5s6fAY) | [Unsplash License](https://unsplash.com/license) |
| `decor-couloir` | `decor-couloir.jpg` | Un couloir | [Unsplash 1497366754035](https://unsplash.com/photos/1497366754035-f200968a6e72) | [Unsplash License](https://unsplash.com/license) |
| `cast-mira` | `cast-mira.webp` | Mira, portrait fictif | copie de `public/images/uttu-canon-portrait.webp` | même dépôt |
| `cast-guide` | `cast-guide.webp` | Le guide, dessin fictif | copie de `public/images/uttu-guide-face.webp` | même dépôt |

Les décors ne montrent pas de personne identifiable. `decor-gare` est un couloir de station, en attendant le hall maison. Les deux planches `cast-*` sont des personnages fictifs déjà dans le dépôt, pas des photos de personnes réelles. Un troisième `cast-*` peut s’ajouter dans le manifeste quand une planche fictive existe.

- **Licence :** Unsplash License pour les photos. Utilisation libre, y compris commerciale. Pas d’attribution obligatoire. On la donne quand même.
- **Outil :** recadrage local en 16:9. Aucune image d’exemple n’a été générée par une IA payante. Aucun crédit Comfy n’a été dépensé.
