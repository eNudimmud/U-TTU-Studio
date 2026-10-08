# Gestes du studio

Un geste est une carte. Le template Comfy reste derrière. Les identifiants ci-dessous sont ceux du catalogue officiel lu le 2026-10-08 (`docs/TEMPLATES-COMFY.md` et les fichiers de catalogue joints). Rien d’autre n’est cité.

`premier` : visible tout de suite. Les autres sont derrière « Plus de gestes ».

`ouvert` : le studio a déjà un graphe et un devis, le bouton Créer peut partir après confirmation. `fermé` : la carte reste, Créer reste éteint, rien ne part.

Les coûts marqués hypothèse ne sont pas une mesure de ce tour. Deux coûts sont mesurés : la prise MiniMax H3 R2V, environ 4 crédits, plafond 6, et la planche `templates-character_sheet`, 70,74 crédits lus le 2026-10-08, affichés 71, plafond 100.

## CAST

| Geste | Carte | Template | Devis | État |
| --- | --- | --- | --- | --- |
| cast-photos | Depuis des photos | `api_nano_banana_2_1_image_edit` | 12 / 18, hypothèse | ouvert, premier |
| cast-planche | Planche de vues | `templates-character_sheet` | 71 / 100, mesuré (70,74) | ouvert, premier |
| cast-texte | Depuis un texte | `api_nano_banana_2_1_t2i` | 12 / 18, hypothèse | ouvert, premier |
| cast-tenue | Tenue ou coiffure | `api_nano_banana_2_1_image_edit` | 12 / 18, hypothèse | ouvert, premier. Cases Visage et Tenue, les deux exigées |
| cast-angle | Autre angle | `templates-1_click_multiple_character_angles-v1.0` | non mesuré | fermé. Qwen local, aucun nœud payant |
| cast-expressions | Expression | `templates_liveportrait.app` | non mesuré | fermé. LivePortrait local, cases Visage et Clip |
| cast-eclair | Rééclairer | `template_character_portrait_relighting` | non mesuré | fermé |
| cast-agrandir | Agrandir | `utility_seedvr2_3b_int8_upscale_image` | non mesuré | fermé |
| cast-volume | Volume | `api_hunyuan3d_image_to_model` | non mesuré | fermé |

Slots CAST : `cast-photos` dessine les trois cases Visage que le graphe envoie, `image_1`, `image_2`, `image_3`. `cast-tenue` envoie visage et tenue vers `image_1` et `image_2`. `cast-planche` envoie le visage vers `image_1`.

## DÉCOR

| Geste | Carte | Template | Devis | État |
| --- | --- | --- | --- | --- |
| decor-texte | Depuis un texte | `api_nano_banana_2_1_t2i` | 12 / 18, hypothèse | ouvert, premier |
| decor-photo | Depuis une photo | `api_nano_banana_2_1_image_edit` | 12 / 18, hypothèse | ouvert, premier |
| decor-heure | Heure et météo | `api_nano_banana_2_1_image_edit` | 12 / 18, hypothèse | ouvert, premier |
| decor-angles | Autres angles | `templates-1_click_multiple_scene_angles-v1.0` | non mesuré | fermé, premier. Qwen local, aucun nœud payant |
| decor-elargir | Élargir le cadre | `template_sirolim_any_aspect_ratio_nb2` | non mesuré | fermé. Un `GeminiNanoBanana2` en 4K. Ce palier n’est pas mesuré. Case Lieu |
| decor-objet | Objet | `api_nano_banana_2_1_image_edit` | 12 / 18, hypothèse | ouvert |
| decor-volume | Volume du lieu | `3d_pixal3d_trellis2_image_to_model` | non mesuré | fermé |

Le lieu part du rôle `lieu` vers `image_1`.

## PRISE

| Geste | Carte | Template | Devis | État |
| --- | --- | --- | --- | --- |
| prise-plan | Personnage dans le décor | `video_minimax_h3_r2v` | 4 / 6, mesuré | ouvert, premier |
| prise-image | Image vers plan | `video_minimax_h3_i2v` | non mesuré | fermé, premier |
| prise-raccord | Raccord | `video_minimax_h3_multiframe_reference` | non mesuré | fermé, premier. Graphes locaux, pas le profil mesuré. Cases Début et Fin |
| prise-prolonger | Prolonger | `video_minimax_h3_i2v_continuation` | non mesuré | fermé, premier. Première image, pas le profil mesuré. Case Plan |
| prise-camera | Caméra | `video_minimax_h3_fun_controlnet_union` | non mesuré | fermé. ControlNet local. Case Plan (vidéo) |
| prise-mouvement | Transfert de mouvement | `video_wan_animate2` | non mesuré | fermé |
| prise-levres | Lèvres | `video_ltx2_3_ia2v` | non mesuré | fermé. LTX local, sans nœud payant. Cases Visage et Voix |
| prise-vidu | Autre plan, références | `api_vidu_q4_preview_r2v` | 100 / 150, hypothèse de la note de chaîne | fermé |

`prise-plan` est le chemin déjà mesuré. Les autres cartes ne lancent rien.

## MONTAGE / SON

| Geste | Carte | Template | Devis | État |
| --- | --- | --- | --- | --- |
| mont-voix | Voix | `api_elevenlabs_v4_text_to_speech` | 24,14 / 36,21 pour 1 000 caractères, hypothèse | ouvert, premier. Nœud `ElevenLabsTextToSpeech`, modèle eleven_v4 |
| mont-effet | Effet sonore | `api_elevenlabs_text_to_sound_effects` | 2,46 / 3,69 pour 5 s, hypothèse | ouvert, premier. Nœud `ElevenLabsTextToSoundEffects`, 5 s |
| mont-musique | Musique | `api_sonilo_t2m` | 16 / 24 pour 30 s, hypothèse | ouvert, premier. Nœud `SoniloTextToMusic`, durée envoyée 30 s (l’exemple du catalogue est à 60 s) |
| mont-levres | Synchro labiale | `video_ltx2_3_ia2v` | non mesuré | fermé, premier. LTX local. Cases Plan et Voix |
| mont-agrandir | Agrandir la vidéo | `utility_seedvr2_3b_int8_upscale_video` | non mesuré | fermé. SeedVR local. Case Plan |
| mont-fluide | Fluidifier | `utility_video_frame_interpolation` | non mesuré | fermé |

La voix, l’effet et la musique ouvrent une feuille. Le devis est une hypothèse lue dans la note de chaîne du 2026-10-08, pas une mesure de ce tour. Créer part sur le compte du visiteur après cette feuille, si le solde couvre le plafond. Les gestes sans devis restent sous Bientôt, avec une ligne qui dit pourquoi.
