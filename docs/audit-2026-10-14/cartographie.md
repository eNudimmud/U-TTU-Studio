# Cartographie — diagnostic et correctif proposé

Base inspectée : `338d0150ddc700831e22ec90d8638309032a63de` (main, PR #103).
Inspection commencée le 13 octobre 2026, poursuivie le 14 octobre. Aucun rendu payant lancé.

## Défauts confirmés

| Criticité | Constat | Preuve | Correction |
| --- | --- | --- | --- |
| P0 | La recherche par nom s’auto-bloque entre géocodage et recherche de photos | Sur le site public, « Lausanne Place Saint-François » trouve 46.5196, 6.6330 puis affiche « Une recherche à la fois. » | Un seul contrôle de débit pour le chargement du lieu ; Photon conserve son contrôle propre |
| P0 | Les photos attendent la fin d’Overpass, même après #103 | `Promise.all` attend les deux réponses | Chargement indépendant des photos et bâtiments, délai réseau borné |
| P1 | Des origines du catalogue fédéré sont exclues | Catalogue officiel `/api/instances` contient notamment des domaines canadiens et néerlandais absents de la liste statique | Autorisation exacte des hôtes HTTPS déclarés par le catalogue officiel |
| P1 | Rayon fixe et photos de séquences voisines masquées | Recherche limitée à 300 m, parcours limité à la séquence la plus proche | Élargissement volontaire à 1 puis 3 km ; conservation des autres séquences et affichage de la distance |
| P1 | Licence manquante remplacée arbitrairement, version CC perdue | Ancien `licenseLabel` | Conservation de la licence exacte ; copie désactivée si licence/auteur insuffisants ; liens source et licence |
| P1 | Mapillary perd position, projection et qualité | Coordonnées de recherche recopiées sur toutes les photos, miniature seulement, élimination des sphères | Bbox, géométrie réelle, vue 1024 si fournie, projection conservée |
| P1 | Une réponse ancienne peut remplacer la nouvelle recherche | Pas d’identifiant de requête | Réponses obsolètes ignorées |

## Preuves non simulées

- Production : défaut de recherche par nom reproduit dans Chrome, interface réelle, sans clé.
- API publique Panoramax : requête `https://api.panoramax.xyz/api/search?place_position=6.6330,46.5196&place_distance=0-300&limit=20` → 20 photographies au moment du contrôle. La photo `1b15b784-e306-4eef-beb0-30930eac6eed` porte le crédit `jo2sm`, licence `CC-BY-SA-4.0`. Cela démontre une disponibilité locale masquée par le parcours ; cela ne démontre pas une couverture mondiale.
- Catalogue public `/api/instances` lu effectivement.
- Nouveau contrôle public le 15 octobre : la même recherche retourne cette fois une photo de `jo2sm`. Le blocage dépend donc notamment du délai de géocodage ; il n’est pas systématique. Le lecteur affiche « Your browser does not seem to support WebGL » dans le navigateur distant utilisé. Un repli affiche désormais la photographie entière lorsque le panorama est indisponible, sans créer une image simulée.

## Tests et limites

- 16 tests unitaires cartographiques réussis (parseurs, rayons, licences, fédération, chaînes).
- Régression Playwright ajoutée : recherche par nom rapide, Overpass en panne, photos visibles, attribution et boutons tactiles. Ses services externes sont simulés : ce test ne certifie pas la disponibilité des fournisseurs.
- Exécution Playwright locale bloquée par le système avant ouverture de page (`socket() failed: Operation not permitted`). Le binaire Chromium a bien été installé. Aucun succès navigateur local n’est revendiqué.
- CI sur `18bfd5e` : 325 tests, 324 réussis, 1 ignoré, 0 échec ; types et build réussis ; 4 tests Playwright réussis (ordinateur/mobile). [Exécution 38544492900](https://github.com/eNudimmud/U-TTU-Studio/actions/runs/38544492900).
- Prévisualisation Vercel déployée, mais protégée par une connexion Vercel : contrôle manuel du correctif non réalisé.
- Intégration de main `2e4f4d38` (R8/R9). CI `38660191878` : 332 tests unitaires réussis, 1 ignoré ; types et build réussis ; 6 tests navigateur réussis, 2 échecs sur la lecture de la vidéo R8 dans Chromium. Ces échecs ne sont pas dissimulés : la suite passe sur Chrome pour tester les codecs MP4, et une régression sans WebGL est ajoutée.
- Pas de jeton Mapillary fourni : son appel authentifié réel reste à valider. La documentation Meta détaillée a présenté une page de connexion pendant l’inspection.
- Ni Panoramax ni Mapillary ne garantissent une photo à chaque adresse. Une erreur réseau se distingue désormais d’une recherche vide.
- Les copies sont limitées aux licences ouvertes reconnues avec attribution. Le recadrage et les liens d’origine sont conservés. Les obligations de partage à l’identique doivent accompagner les médias réutilisés ; aucune licence n’est déduite d’une absence de métadonnée.

Sources officielles : [API Panoramax](https://docs.panoramax.fr/backend/api/api/), [catalogue fédéré](https://docs.panoramax.fr/federated-catalog/), [licence des images Mapillary](https://help.mapillary.com/hc/en-us/articles/115001770409-CC-BY-SA-license-for-open-data).
