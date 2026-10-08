# Rapport R6 — PRISE compose les plans

Date : 2026-10-08. Base : `main` à `e1099aa`. Rien n’est mergé. 0 crédit Comfy : aucun `run_template`, `submit_workflow`, `partner_generate`, `estimate_credits`. Finaliser n’envoie rien.

## Ce qui est là

PRISE n’est plus une liste de gestes. Le visiteur compose un plan : Qui, Où, Cadrage, Action, Caméra, Durée. Paroles et Enchaîner sont repliés. Le format du projet est 16:9 par défaut, 9:16 dans l’en-tête. Il n’y a pas de ligne Qualité.

La carte « Ce que l’app va faire » dit le graphe en mots simples, la phrase « Pourquoi » telle qu’elle est dans la table, le devis et le plafond (1,5 × le devis). La première ligne qui correspond gagne. Une seule colonne de prise : le Final n’est plus une deuxième génération.

Boutons ouverts seulement quand le devis est mesuré : composer l’image (`api_nano_banana_2_1_image_edit`, 12,5, plafond 18,75) et l’essai rapide (`video_minimax_h3_r2v`, 4,3, plafond 6,45) tant qu’il n’y a pas d’image clé. Tout le reste reste éteint, avec la raison écrite dessous. Une hypothèse affiche le nombre et le bouton reste éteint : « Pas encore mesuré : un rendu de mesure doit être validé ».

Le texte envoyé est sous Détails › Texte envoyé, en lecture seule. Échafaudage anglais, répliques françaises entre guillemets. `<Picture N>` seulement pour les graphes H3 ouverts. Les autres graphes nomment « image N ». La timeline est 40 % de mise en place et 60 % d’action. « (portrait + planche) » n’est ajouté que si la fiche a déjà une planche.

Après ★ Garder, le panneau Finaliser s’ouvre pour la prise et pour l’image. Trois réglages : Résolution (1080p, 4K éteint : « Aucun graphe vérifié ne va au-delà du 1080p. »), Netteté et détails (allumé), Fluidifier (éteint, vidéo seulement). La carte dit : « On garde ta prise telle quelle et on augmente sa résolution et sa netteté. » Une image dit la même phrase avec « ton image ». Une fois finalisé, l’aperçu a un curseur Avant / Après. Mon studio garde l’original et le fichier `-final`. Le montage accepte Gardée ou Finalisée. Un essai n’entre pas dans le cut.

| Réglage | Graphe | Devis | Choisi |
| --- | --- | --- | --- |
| Vidéo, netteté allumée, 1080p | `api_bytedance_vcube_video_enhance` | ≈ 10 / 5 s, hypothèse | oui, par défaut |
| Vidéo, netteté coupée | `api_wavespeed_flshvsr_video_upscale` | ≈ 19 / 5 s, hypothèse | seulement si la netteté est coupée |
| Vidéo, restauration ouverte | `utility_seedvr2_3b_int8_upscale_video` | GPU ?, inconnu | non : pas de devis |
| Fluidifier | `utility_video_frame_interpolation` | inconnu | seulement si le visiteur l’allume, et alors le devis tombe à inconnu |
| Image, netteté allumée | `utility_seedvr2_7b_int8_upscale_image` | inconnu | oui, par défaut |
| Image, netteté coupée | `api_wavespeed_seedvr2_ai_image_fix` | ≈ 2,11, hypothèse | seulement si la netteté est coupée |
| Image, détail fin | `api_magnific_image_upscale_precise` | ≈ 35,91, hypothèse | non : la restauration ouverte passe d’abord |
| 4K | aucun graphe vérifié | — | bouton éteint |

Le bouton Finaliser reste éteint : aucun de ces graphes n’est mesuré.

## Vérifié

`npm test` : 300 passés, 1 ignoré. `npm run typecheck`. `npm run build`.

Captures sous `/opt/cursor/artifacts/screenshots/` : `prise-1280`, `prise-compose-1280`, `prise-garder-finaliser-1280`, `prise-390`, `prise-390-compose`, `prise-360-compose`, `cast-1280`, `decor-1280`, `montage-1280`. Fenêtres 1280×800, 390×844 et 360×800. Aucun envoi : Essai rapide ouvre encore la feuille de confirmation déjà en place, et cet écran n’appelle pas la confirmation. Composer l’image dit que l’envoi n’est pas branché. Rien ne part.

## Ce qui reste

- L’envoi de l’image clé, de la prise, et de Finaliser n’est pas branché. Seul l’essai rapide atteint la feuille existante, qui dépense seulement après confirmation.
- Les lignes geste filmé, prolonger, retoucher et les 3 à 6 images clés sont dans la table, pas dans les tuiles.
- 10 s est affiché, éteint : « Pas encore mesurée ».
- Les phrases du composeur sont en français dans le code. Les calques EN, DE et ES de cet écran ne sont pas faits.
- Sur 1280×800, la colonne de droite défile : le curseur Avant / Après, la phrase et la résolution sont visibles tout de suite. Fluidifier et le bouton Finaliser sont un défilement plus bas.
- Kling n’est pas proposé. Le registre des anciens gestes PRISE reste dans le catalogue pour les tests, il n’est plus affiché sur cet écran.
