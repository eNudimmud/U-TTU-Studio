# Rapport R5 — gestes classés, planche, montage

Date : 2026-10-08. Base : `main` à `b2f406d`. Rien n’est mergé. 0 crédit Comfy : aucun `run_template`, `submit_workflow`, `partner_generate`, `estimate_credits`, `dry_run`. Lecture seule des templates officiels (`search_templates`, `get_template`, `get_template_schema`, `get_node`). Le dépôt `eNudimmud/U-TTU-Vault` n’est pas lisible depuis cette session (404 / 403). La vérité des templates vient du catalogue Comfy Cloud lu le 2026-10-08.

## Branché (ouvert)

Un geste est ouvert seulement s’il a un graphe déjà dans le studio, un devis, et une nature autre que `non-mesure`. Créer reste éteint tant que le solde ne couvre pas le plafond, ou tant qu’il manque une case exigée. La raison est écrite à côté du bouton.

| Geste | Onglet | Template officiel | Cases | Devis | Nature |
| --- | --- | --- | --- | --- | --- |
| cast-tenue | CAST | `api_nano_banana_2_1_image_edit` | Visage + Tenue, les deux exigées | 12 / 18 | hypothèse (même famille que les photos déjà ouvertes, Nano Banana 2.1 à 1K) |
| mont-voix | MONTAGE | `api_elevenlabs_v4_text_to_speech` | aucune case fichier, un texte | 24,14 / 36,21 pour 1 000 caractères | hypothèse, note de chaîne du 2026-10-08. La feuille arrondit (1 000 caractères → 24, plafond 36) pour que le bouton et le devis affiché soient le même nombre |
| mont-effet | MONTAGE | `api_elevenlabs_text_to_sound_effects` | un texte, durée envoyée 5 s | 2,46 / 3,69 | hypothèse, note de chaîne (29,54 / min). La feuille arrondit à 2, plafond 3 |
| mont-musique | MONTAGE | `api_sonilo_t2m` | un texte, durée envoyée 30 s | 16 / 24 | hypothèse, note de chaîne. L’exemple du catalogue est à 60 s ; le studio envoie 30 s pour que ce chiffre s’applique |

La planche n’est pas un geste nouveau. Son prix change.

| Geste | Template | Devis affiché | Nature |
| --- | --- | --- | --- |
| cast-planche | `templates-character_sheet` | environ 71, plafond 100 | fait. Mesure 70,74 (35,41 + 35,33), deux `GeminiImage2` en 2K, `prompt_id` `6387ad5a-c3e6-4bfd-aff3-b844acdc34c4`. L’écran arrondit à 71. Le graphe du studio envoie la planche en 2K |

Voix, effet et musique ouvrent une feuille depuis l’onglet du chutier. Créer part sur le compte du visiteur après cette feuille, si le solde couvre le plafond. Ce tour n’a lancé aucun de ces rendus.

Les gestes déjà ouverts avant R5 restent ouverts : photos, texte, planche (CAST) ; texte, photo, heure, objet (DÉCOR) ; le plan mesuré à 4 crédits, plafond 6 (PRISE).

## Reste sous Bientôt

Chaque carte fermée a une ligne, sans nom de nœud. La raison technique est ici.

| Geste | Template officiel | Pourquoi il reste fermé | Cases montrées |
| --- | --- | --- | --- |
| cast-angle | `templates-1_click_multiple_character_angles-v1.0` | Qwen local, aucun nœud payant, coût non chiffré | Visage |
| cast-expressions | `templates_liveportrait.app` | LivePortrait local, coût non chiffré | Visage + Clip (vidéo) |
| cast-eclair | `template_character_portrait_relighting` | local, coût non chiffré | Visage + Style |
| cast-agrandir | `utility_seedvr2_3b_int8_upscale_image` | SeedVR local, coût non chiffré | Visage |
| cast-volume | `api_hunyuan3d_image_to_model` | pas de prix fiable pour ce tour | Visage |
| decor-angles | `templates-1_click_multiple_scene_angles-v1.0` | Qwen local, aucun nœud payant | Lieu |
| decor-elargir | `template_sirolim_any_aspect_ratio_nb2` | `GeminiNanoBanana2` en 4K. Ce palier n’est pas mesuré. On n’invente pas un prix 4K, et on ne descend pas en silence à 1K en appelant ça le template officiel | Lieu |
| decor-volume | `3d_pixal3d_trellis2_image_to_model` | local, coût non chiffré | Lieu |
| prise-image | `video_minimax_h3_i2v` | même famille que la prise, pas le profil mesuré à 4 crédits | Lieu |
| prise-raccord | `video_minimax_h3_multiframe_reference` | graphe local, pas le profil mesuré | Début + Fin |
| prise-prolonger | `video_minimax_h3_i2v_continuation` | première image, pas le profil mesuré | Plan |
| prise-camera | `video_minimax_h3_fun_controlnet_union` | ControlNet local, coût non chiffré | Plan (vidéo) |
| prise-mouvement | `video_wan_animate2` | local, coût non chiffré | Visage |
| prise-levres | `video_ltx2_3_ia2v` | LTX local, aucun nœud payant | Visage + Voix (audio) |
| prise-vidu | `api_vidu_q4_preview_r2v` | hypothèse de chaîne 100 / 150, mais aucun graphe dans le studio. `still` reste nul, donc la carte est fermée | Visage + Lieu |
| mont-levres | `video_ltx2_3_ia2v` | LTX local, coût non chiffré | Plan (vidéo) + Voix (audio) |
| mont-agrandir | `utility_seedvr2_3b_int8_upscale_video` | SeedVR local, coût non chiffré | Plan (vidéo) |
| mont-fluide | `utility_video_frame_interpolation` | local, coût non chiffré | aucune |

## Bureau

La table à trois colonnes de R4 reste : gestes, travail, galerie, à partir de 1024 px. La colonne de gestes montre au plus quatre gestes ouverts (les premiers d’abord). Le surplus ouvert est groupé sous « Plus de gestes ». Les fermés sont seulement sous « Bientôt », groupés par catégorie quand il y en a plusieurs. `?geste=` sélectionne un geste après le montage de la page, et la tuile choisie se range dans la colonne.

Le bloc Créer est dans le flux, sous le texte, pas collé par-dessus. Le bouton porte le devis quand il existe (« Créer le personnage · environ 12 crédits »). La ligne sous le bouton est le plafond, hypothèse ou mesuré. Un geste fermé n’affiche pas de prix : le bouton dit seulement « Créer le décor », et la raison reste à côté. Les tuiles de geste sont compactes : à 1280×800, « Depuis un texte » et « Voir un exemple » tiennent dans la colonne, avec Tenue.

## Montage

À 1280×800 la page ne défile pas. Le chutier fait 196 px, à gauche du lecteur. Les onglets sont en deux par deux, pour que Musique tienne. Chaque carte est une liste verticale : la vignette, puis le nom sur sa ligne (deux lignes au plus). Les trois décors de l’exemple tiennent en entier, ainsi que la ligne qui dit pourquoi Agrandir et Fluidifier restent fermés. Il n’y a plus de lien « Bientôt » seul en bas du chutier.

Le lecteur est le cadre noir de la colonne (environ 1052×429). L’image 16:9 à l’intérieur mesure environ 759×427. Rien n’est écrit par-dessus, à part l’heure de lecture. La barre du plan (Scinder, Dupliquer, vitesse, Fondu, titre, Supprimer) est dans la rangée d’outils, au-dessus de la timeline, et seulement quand un plan est choisi. Elle ne double pas Scinder ni Supprimer.

À 390 et à 360, le titre et Exporter sont une rangée au-dessus du lecteur. La capture au repos laisse le chutier fermé : lecteur, lecture et timeline visibles. La feuille ouverte (`r5-montage-390-chutier.png`) reste sous les contrôles de lecture. Elle dit « Bientôt · Agrandir, Fluidifier », en une ligne.

## Captures

Fenêtres 1280×800 et 390×844. Montage aussi à 360 pour les libellés. Fichiers sous `/opt/cursor/artifacts/screenshots/`.

- `r5-cast-1280.png`, `r5-cast-390.png`
- `r5-cast-tenue-1280.png`, `r5-cast-tenue-390.png` — geste branché, cases Visage et Tenue
- `r5-decor-1280.png`, `r5-decor-390.png`
- `r5-decor-elargir-1280.png`, `r5-decor-elargir-390.png` — case Lieu et la ligne qui dit pourquoi ça reste éteint
- `r5-prise-1280.png`, `r5-prise-390.png`
- `r5-prise-raccord-1280.png`, `r5-prise-raccord-390.png` — cases Début et Fin
- `r5-montage-1280.png`, `r5-montage-390.png`, `r5-montage-360.png`

## Vérification

- `npm test` : 286 tests passés, 1 ignoré, 0 échec (287 au total). `npm run typecheck` et `npm run build` passent. 0 crédit Comfy.
- À 1280×800, `scrollHeight` du montage est 800. La timeline finit dans la fenêtre. Le cadre du lecteur fait environ 1052×429, l’image 16:9 environ 759×427. La barre du plan est sous l’image (`top` 604, bas de l’image 595). Aucune phrase d’explication dans le lecteur.
- Les libellés Médias, Voix, Effets, Musique tiennent en entier à 1280, 390 et 360 (`scrollWidth` égal à `clientWidth`). Les noms « Le quai, la nuit », « Sous la pluie », « Une pièce » et « Voix d’exemple » aussi.
- Tenue : le champ Texte finit au-dessus du bloc Créer (bas du champ 543, haut du bloc 687). Le bouton dit « environ 12 crédits », et « Plafond 18, hypothèse. » est en dessous. Les quatre tuiles, dont « Voir un exemple », tiennent dans la colonne (bas 650, colonne 788).
- Élargir : bouton « Créer le décor », sans prix. La tuile dit « Bientôt : prix pas encore vérifié. » Raccord montre Début et Fin, avec la même ligne.
- Le cadre « Vide » sous le texte n’est plus là tant qu’il n’y a pas d’image.
- À 390, la feuille ouverte ne couvre pas le bouton lecture. Les pistes voix et musique montrent le nom en entier.
