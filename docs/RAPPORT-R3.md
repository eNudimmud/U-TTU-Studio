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
- `npm test` : 270 tests passés, 1 ignoré, 0 échec. `tsc --noEmit` et `npm run build` passent. Il n’y a pas de script `lint` séparé : la vérification CI est ce trio. Le job `verify` du premier commit de la PR est vert.
- Lecture de l’exemple : l’horloge passe de `0:00 / 0:07` à `0:01 / 0:07`.
- Export de l’exemple, Chrome headless de cette machine, sans rognage : fichier `exemple-montage.mp4`, 187 684 octets (environ 188 Ko), boîtier `ftyp isom`, image AVC (`avcC`), son Opus. L’écran annonçait « 7 s · environ 812 Ko » avant le geste. La barre de progression a été lue à 58 % puis à 68 %.
- L’aperçu Vercel répond 302 vers l’authentification Vercel. Les captures sont donc celles du `next start` de ce commit, aux largeurs 1280 et 390. Huit images et le MP4 sont dans les artefacts.

## Hypothèse

- La taille annoncée (800 kbit/s d’image + 128 kbit/s de son) n’est pas le fichier. Sur cet exemple d’images fixes, le MP4 mesuré fait 188 Ko, pas 812 Ko. Le chiffre à l’écran reste une estimation haute. Un plan filmé peut s’en rapprocher. Une seule mesure ne change pas la formule.
- Safari sur iPhone n’a pas été ouvert ici. L’export cherche le premier codec MP4 que l’appareil sait écrire. H.264 et AAC passent en premier. Ici, l’AAC manquait et le fichier est sorti en AVC et Opus. S’il ne reste aucun codec, le bouton affiche « Cet appareil n’écrit pas le MP4. Chrome ou Edge, sur ordinateur, le font. » Que Safari iOS encode, ou non, n’a pas été mesuré sur un téléphone.
- Au-delà de 60 secondes, le bouton d’export reste éteint (« Soixante secondes au plus dans le navigateur. »). La limite vient de la mémoire d’un onglet, pas d’une mesure sur un grand film.
- Les devis voix (24,14 crédits / 1 000 caractères) et effet (29,54 crédits / minute) viennent de la note de chaîne. Ils ne sont pas mesurés.
- EN, DE et ES portent `_human: native_open`.

## Passe visuelle — 8 octobre 2026

- **Fait :** la bande « Lecture / temps / Plein écran » n’est plus sur l’image. Les contrôles sont sous le cadre noir. Les outils sont une rangée d’icônes. La timeline a une règle, une tête or avec poignée, des vignettes sur les plans, une icône par piste. Le « + » de chaque piste audio remplace les liens « Déposer un son » et les deux gros boutons vides. « Exporter » est dans l’en-tête du montage. Sur 390 px, la chaîne est collée sous l’en-tête du studio, plus en bas de l’écran.
- **Hypothèse :** la proximité avec CapCut web n’a pas été mesurée sur un compte CapCut. Les captures du studio sont celles du `next start` local. L’aperçu Vercel reste derrière l’authentification.

## Ce qui manque

- Créer une voix ou un effet ne lance rien. Les boutons préparent le devis seulement.
- Pas de titre, pas de transition, pas de plusieurs pistes vidéo.
- L’image exportée est 960×540, 12 images par seconde. Ce n’est pas la prise d’origine.
- Les sons d’exemple sont des tons synthétiques, pas une voix enregistrée. Voir [CREDITS.md](CREDITS.md).
