# Rapport — R3, montage

8 octobre 2026. Quatrième geste de la chaîne. JD valide sur l’aperçu. Rien n’est mergé.

## Décision

- Le montage est la section **MONTAGE**, après PRISE. « Lire la séquence » y mène. Le détail est dans [DECISIONS.md](DECISIONS.md).
- L’export MP4 reste dans le navigateur. La voix et l’effet sonore ne partent pas : le devis affiché est une hypothèse, le bouton « Créer » reste éteint.

## Fait

- La chaîne a quatre onglets. Un studio vide ouvre l’exemple : trois décors (`decor-quai-nuit`, `decor-rue-pluie`, `decor-piece`), une voix synthétique de 2,4 s, une musique synthétique de 7 s. Rien n’est écrit dans Mon studio tant que le visiteur ne change pas le montage.
- Le visualiseur lit la séquence en continu (lecture, pause, tête de lecture, temps, plein écran). La timeline réordonne les plans, rogne, scinde à la tête, supprime, cale les sons, montre une forme d’onde, règle volume et fondus, zoome (molette avec Ctrl ou Cmd, pincement, boutons), aimante, annule et rétablit.
- « Partir de zéro » vide le montage et l’enregistre. Rouvrir le projet relit `Projets/{slug}/Sequences/{id}-montage.md` (`type: sequence`, `gesture: montage`). Le chargeur ne prend pas cette fiche pour une seconde séquence.
- « Ajouter une voix » et « Ajouter un effet sonore » sont éteints sans compte. La raison affichée est « Relie ton compte de rendu pour créer. »
- 0 crédit. Aucun `estimate_credits`, `dry_run`, `run_template`, `submit_workflow`, `partner_generate`.
- `npm test` : 270 tests passés, 1 ignoré, 0 échec. `tsc --noEmit` et `npm run build` passent. Il n’y a pas de script `lint` séparé : la vérification CI est ce trio.

## Hypothèse

- La taille annoncée avant l’export (800 kbit/s d’image + 128 kbit/s de son, 960×540, 12 images/s) n’est pas une mesure du fichier. Le fichier lui-même, une fois écrit, est la mesure. Elle sera notée ici après l’export de l’exemple.
- Safari sur iPhone n’a pas été ouvert ici. Le code refuse l’export si l’encodeur H.264 ou AAC manque, et affiche « Cet appareil n’écrit pas le MP4. Chrome ou Edge, sur ordinateur, le font. » C’est le comportement prévu quand WebCodecs ne propose pas ces codecs. Que Safari iOS les propose, ou non, n’a pas été mesuré sur un téléphone.
- Au-delà de 60 secondes, le bouton d’export reste éteint (« Soixante secondes au plus dans le navigateur. »). La limite vient de la mémoire d’un onglet, pas d’une mesure sur un grand film.
- Les devis voix (24,14 crédits / 1 000 caractères) et effet (29,54 crédits / minute) viennent de la note de chaîne. Ils ne sont pas mesurés.
- EN, DE et ES portent `_human: native_open`.

## Ce qui manque

- Créer une voix ou un effet ne lance rien. Les boutons préparent le devis seulement.
- Pas de titre, pas de transition, pas de plusieurs pistes vidéo.
- L’image exportée est 960×540, 12 images par seconde. Ce n’est pas la prise d’origine.
- Les sons d’exemple sont des tons synthétiques, pas une voix enregistrée. Voir [CREDITS.md](CREDITS.md).
