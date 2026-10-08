# Gestes du studio

Un geste est une carte. Le template Comfy reste derrière. Les identifiants ci-dessous sont ceux du catalogue officiel lu le 2026-10-08 (`docs/TEMPLATES-COMFY.md` et les fichiers de catalogue joints). Rien d’autre n’est cité.

`premier` : visible tout de suite. Les autres sont derrière « Plus de gestes ».

`ouvert` : le studio a déjà un graphe et un devis, le bouton Créer peut partir après confirmation. `fermé` : la carte reste, Créer reste éteint, rien ne part.

Les coûts marqués hypothèse ne sont pas une mesure de ce tour. Le seul coût mesuré ici est la prise MiniMax H3 R2V, environ 4 crédits, plafond 6.

## CAST

| Geste | Carte | Template | Devis | État |
| --- | --- | --- | --- | --- |
| cast-photos | Depuis des photos | `api_nano_banana_2_1_image_edit` | 12 / 18, hypothèse | ouvert, premier |
| cast-planche | Planche de vues | `templates-character_sheet` | 24 / 36, hypothèse | ouvert, premier |
| cast-texte | Depuis un texte | `api_nano_banana_2_1_t2i` | 12 / 18, hypothèse | ouvert, premier |
| cast-tenue | Tenue ou coiffure | `api_nano_banana_2_1_image_edit` | 12 / 18, hypothèse | ouvert, premier |
| cast-angle | Autre angle | `templates-1_click_multiple_character_angles-v1.0` | non mesuré | fermé |
| cast-expressions | Expression | `templates_liveportrait.app` | non mesuré | fermé |
| cast-eclair | Rééclairer | `template_character_portrait_relighting` | non mesuré | fermé |
| cast-agrandir | Agrandir | `utility_seedvr2_3b_int8_upscale_image` | non mesuré | fermé |
| cast-volume | Volume | `api_hunyuan3d_image_to_model` | non mesuré | fermé |

Slots CAST : `cast-photos` envoie visage, visage, style vers `image_1`, `image_2`, `image_3`. `cast-tenue` envoie visage et tenue vers `image_1` et `image_2`. `cast-planche` envoie le visage vers `image_1`.

## DÉCOR

| Geste | Carte | Template | Devis | État |
| --- | --- | --- | --- | --- |
| decor-texte | Depuis un texte | `api_nano_banana_2_1_t2i` | 12 / 18, hypothèse | ouvert, premier |
| decor-photo | Depuis une photo | `api_nano_banana_2_1_image_edit` | 12 / 18, hypothèse | ouvert, premier |
| decor-heure | Heure et météo | `api_nano_banana_2_1_image_edit` | 12 / 18, hypothèse | ouvert, premier |
| decor-angles | Autres angles | `templates-1_click_multiple_scene_angles-v1.0` | non mesuré | fermé, premier |
| decor-elargir | Élargir le cadre | `template_sirolim_any_aspect_ratio_nb2` | non mesuré | fermé |
| decor-objet | Objet | `api_nano_banana_2_1_image_edit` | 12 / 18, hypothèse | ouvert |
| decor-volume | Volume du lieu | `3d_pixal3d_trellis2_image_to_model` | non mesuré | fermé |

Le lieu part du rôle `lieu` vers `image_1`.

## PRISE

| Geste | Carte | Template | Devis | État |
| --- | --- | --- | --- | --- |
| prise-plan | Personnage dans le décor | `video_minimax_h3_r2v` | 4 / 6, mesuré | ouvert, premier |
| prise-image | Image vers plan | `video_minimax_h3_i2v` | non mesuré | fermé, premier |
| prise-raccord | Raccord | `video_minimax_h3_multiframe_reference` | non mesuré | fermé, premier |
| prise-prolonger | Prolonger | `video_minimax_h3_i2v_continuation` | non mesuré | fermé, premier |
| prise-camera | Caméra | `video_minimax_h3_fun_controlnet_union` | non mesuré | fermé |
| prise-mouvement | Transfert de mouvement | `video_wan_animate2` | non mesuré | fermé |
| prise-levres | Lèvres | `video_ltx2_3_ia2v` | non mesuré | fermé |
| prise-vidu | Autre plan, références | `api_vidu_q4_preview_r2v` | 100 / 150, hypothèse de la note de chaîne | fermé |

`prise-plan` est le chemin déjà mesuré. Les autres cartes ne lancent rien.

## MONTAGE / SON

| Geste | Carte | Template | Devis | État |
| --- | --- | --- | --- | --- |
| mont-voix | Voix | `api_elevenlabs_v4_text_to_speech` | 24,14 / 36,21 pour 1 000 caractères, hypothèse | fermé, premier |
| mont-effet | Effet sonore | `api_elevenlabs_text_to_sound_effects` | 2,46 / 3,69 pour 5 s, hypothèse | fermé, premier |
| mont-musique | Musique | `api_sonilo_t2m` | 16 / 24 pour 30 s, hypothèse | fermé, premier |
| mont-levres | Synchro labiale | `video_ltx2_3_ia2v` | non mesuré | fermé, premier |
| mont-agrandir | Agrandir la vidéo | `utility_seedvr2_3b_int8_upscale_video` | non mesuré | fermé |
| mont-fluide | Fluidifier | `utility_video_frame_interpolation` | non mesuré | fermé |

La voix et l’effet ouvrent la feuille déjà en place. Créer y reste éteint : le devis n’est pas mesuré.
