# Reprise de #112 sur le Studio actuel

Branche neuve depuis `main` (`7ea692b`). L’ancienne branche `concours/composer-carte-intentions` et la PR #112 ne sont pas modifiées. `repere-carte.tsx` n’est pas restauré.

## Ce qui est livré

| Sujet de #112 | Où c’est maintenant | Ce que ça fait |
|---|---|---|
| Image clé | `src/lib/creation/keyframe.ts` | Graphe Klein (poids ouverts) : personnage puis décor, 4 images au plus, devis hypothèse 4–6. Aucun envoi. |
| Couverture | `src/lib/repere/couverture.ts`, crédit dans `reperage-3d.tsx` | Panoramax toujours ; Mapillary seulement si un jeton public est configuré. Le jeton n’est pas affiché. Aucune tuile n’est téléchargée. |
| Secours Mapillary | `tilesAround`, `nearestImageIds` dans `mapillary.ts` | Choisit des identifiants déjà lus. Le champ panorama et la séquence actuels restent. |
| Intention caméra | `src/lib/prise/camera-travel.ts`, ligne `[caméra]` de `prompt.ts` | La distance écrite (FR/EN/DE/ES) est ajoutée à la ligne déjà produite par `camera-words.ts`. Au-delà de 20 m, le chiffre est ramené à 20. |

## Tests gratuits

`node --test tests/reprise-112.test.ts`

Aucun appel Comfy, Mapillary ou Panoramax. Pas d’image générée.

## À qualifier par JD

- Lancer une image clé réelle sur son compte Comfy et lire le coût. Le devis 4–6 n’est pas une mesure.
- Brancher le téléchargement des tuiles de couverture dans le repérage 3D s’il veut les voir dessinées. Le studio n’a plus de carte 2D.
- Confirmer que « about N m » dans le texte envoyé correspond au mouvement qu’il veut. Le graphe vidéo n’a pas été relancé.
- Décider du sort de l’ancienne PR #112, qui reste en conflit avec `main`.
