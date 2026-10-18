# Gestes du studio

Un geste est une carte. Le template Comfy reste derrière. Chaque geste a son fichier dans `workflows/<onglet>/<id>.json` (le template officiel, à ouvrir dans ComfyUI) et, s’il est branché, `workflows/<onglet>/<id>.api.json` (le graphe exact que le studio envoie). `workflows/index.json` dit lequel passe par un nœud partenaire. Régénérer : `node --experimental-strip-types scripts/export-workflows.mjs`.

Moteurs (concours Comfy « Open Source Higgsfield ») : **FLUX 3 Image Klein** (open weights) pour les images de CAST et DÉCOR, **FLUX 3 Image** (nœud partenaire) pour plusieurs références et la planche, **LTX-2.5** pour la prise par défaut, **MiniMax H3** en second moteur. Nano Banana reste une option, éteinte par défaut. « Open weights seulement » cache tout geste à nœud partenaire.

`premier` : visible tout de suite. Les autres sont derrière « Plus de gestes ».

`ouvert` : le studio a déjà un graphe et un devis, le bouton Créer peut partir après confirmation. `fermé` : la carte reste, Créer reste éteint, rien ne part.

Les coûts marqués hypothèse ne sont pas une mesure. Mesurés : la prise MiniMax H3 R2V (environ 4 crédits, plafond 6) et les images FLUX 3 Klein (2,6 à 4 crédits, exemples DÉCOR #109). FLUX 3 Image : 14 crédits par image lus avec `estimate_credits` le 2026-10-16. La prise LTX-2.5 et les gestes vidéo (raccord, caméra, élargir, effacer) n’ont pas encore de mesure : leur devis est affiché « Estimé » (jamais « mesuré »), avec confirmation du maximum ; le maximum estimé sert de plafond face au solde.

## CAST

| Geste | Carte | Template | Devis | État |
| --- | --- | --- | --- | --- |
| cast-photos | Depuis des photos | `image_flux3_klein_image_edit` | 4 / 6, hypothèse | ouvert, premier, open weights |
| cast-planche | Planche de vues | `api_bfl_flux3_image_edit` | 28 / 42, hypothèse | ouvert, premier, nœud partenaire |
| cast-texte | Depuis un texte | `image_flux3_klein_t2i` | 4 / 6, mesuré | ouvert, premier, open weights |
| cast-refs | Plusieurs références | `api_bfl_flux3_image_edit` | 14 / 21, hypothèse | ouvert, nœud partenaire |
| cast-texte-nano | Texte (Nano Banana) | `api_nano_banana_2_1_t2i` | 12 / 18, hypothèse | ouvert, nœud partenaire, option Nano Banana, éteinte par défaut |
| cast-photos-nano | Photos (Nano Banana) | `api_nano_banana_2_1_image_edit` | 12 / 18, hypothèse | ouvert, nœud partenaire, option Nano Banana, éteinte par défaut |
| cast-tenue | Tenue ou coiffure | `image_flux3_klein_image_edit` | 4 / 6, hypothèse | ouvert, premier, open weights |
| cast-angle | Autre angle | `templates-1_click_multiple_character_angles-v1.0` | non mesuré | fermé, open weights |
| cast-expressions | Expression | `templates_liveportrait.app` | non mesuré | fermé, open weights |
| cast-eclair | Rééclairer | `template_character_portrait_relighting` | non mesuré | fermé, nœud partenaire |
| cast-agrandir | Agrandir | `utility_seedvr2_3b_int8_upscale_image` | non mesuré | fermé, open weights |
| cast-volume | Volume | `api_hunyuan3d_image_to_model` | non mesuré | fermé, nœud partenaire |

## DÉCOR

| Geste | Carte | Template | Devis | État |
| --- | --- | --- | --- | --- |
| decor-texte | Depuis un texte | `image_flux3_klein_t2i` | 4 / 6, mesuré | ouvert, premier, open weights |
| decor-photo | Depuis une photo | `image_flux3_klein_image_edit` | 4 / 6, mesuré | ouvert, premier, open weights |
| decor-texte-nano | Texte (Nano Banana) | `api_nano_banana_2_1_t2i` | 12 / 18, hypothèse | ouvert, nœud partenaire, option Nano Banana, éteinte par défaut |
| decor-photo-nano | Photo (Nano Banana) | `api_nano_banana_2_1_image_edit` | 12 / 18, hypothèse | ouvert, nœud partenaire, option Nano Banana, éteinte par défaut |
| decor-heure | Heure et météo | `image_flux3_klein_image_edit` | 4 / 6, hypothèse | ouvert, premier, open weights |
| decor-angles | Autres angles | `templates-1_click_multiple_scene_angles-v1.0` | non mesuré | fermé, premier, open weights |
| decor-elargir | Élargir le cadre | `template_sirolim_any_aspect_ratio_nb2` | non mesuré | fermé, nœud partenaire, option Nano Banana, éteinte par défaut |
| decor-objet | Objet | `api_bfl_flux3_image_edit` | 14 / 21, hypothèse | ouvert, nœud partenaire |
| decor-volume | Volume du lieu | `3d_pixal3d_trellis2_image_to_model` | non mesuré | fermé, open weights |

## PRISE

| Geste | Carte | Template | Devis | État |
| --- | --- | --- | --- | --- |
| prise-plan | Personnage dans le décor | `video_ltx2_5_i2v` | 12 / 25, estimé | ouvert, premier, open weights |
| prise-plan-h3 | Plan, second moteur | `video_minimax_h3_r2v` | 4 / 6, mesuré | ouvert, premier, open weights |
| prise-image | Image vers plan | `video_minimax_h3_i2v` | non mesuré | fermé, open weights |
| prise-raccord | Raccord | `video_ltx2_5_flf2v` | 12 / 25, estimé | ouvert, premier, open weights |
| prise-prolonger | Prolonger | `video_minimax_h3_i2v_continuation` | non mesuré | fermé, open weights |
| prise-previs | Caméra maîtrisée (prévis maquette 3D → plan) | `video_ltx2_3_ic_lora` | 15 / 30, estimé | ouvert, premier, open weights |
| prise-volume-perso | Personnage en 3D (portrait → mannequin GLB de la maquette) | `3d_hunyuan3d-v2.1` | 8 / 16, estimé | ouvert dans la maquette, open weights |
| prise-volume-objet | Objet ou décor en 3D (photo → GLB, 40 000 faces pour mobile) | `3d_pixal3d_trellis2_image_to_model` | 15 / 30, estimé | ouvert dans la maquette, open weights |
| prise-camera | Caméra | `video_ltx2_3_ic_lora` | 15 / 30, estimé | ouvert, open weights |
| prise-mouvement | Transfert de mouvement | `video_wan_animate2` | non mesuré | fermé, open weights |
| prise-levres | Lèvres | `video_ltx2_3_ia2v` | non mesuré | fermé, open weights |
| prise-vidu | Autre plan, références | `api_vidu_q4_preview_r2v` | 100 / 150, hypothèse | fermé, nœud partenaire |
| prise-elargir | Élargir le plan | `template_ltx2_3_lora_video_outpainting` | 15 / 30, estimé | ouvert, open weights |
| prise-effacer | Effacer un objet | `template_ltx2_3_obscura_remova_lora_remove_object_from_video` | 15 / 30, estimé | ouvert, open weights |

## MONTAGE / SON

| Geste | Carte | Template | Devis | État |
| --- | --- | --- | --- | --- |
| mont-voix | Voix | `api_elevenlabs_v4_text_to_speech` | 24,14 / 36,21, hypothèse | ouvert, premier, nœud partenaire |
| mont-effet | Effet sonore | `api_elevenlabs_text_to_sound_effects` | 2,46 / 3,69, hypothèse | ouvert, premier, nœud partenaire |
| mont-musique | Musique | `api_sonilo_t2m` | 16 / 24, hypothèse | ouvert, premier, nœud partenaire |
| mont-levres | Synchro labiale | `video_ltx2_3_ia2v` | non mesuré | fermé, premier, open weights |
| mont-agrandir | Agrandir la vidéo | `utility_seedvr2_3b_int8_upscale_video` | non mesuré | fermé, open weights |
| mont-fluide | Fluidifier | `utility_video_frame_interpolation` | non mesuré | fermé, open weights |

## ET ENSUITE ?

Menu « Et ensuite ? » sur un asset (panneau de détail de Mon studio) et sur une prise de PRISE. Chaque outil est un template officiel, poids ouverts, converti en API par Comfy Cloud puis élagué (aperçus retirés) : `src/lib/suite/base.ts`. Le résultat est un nouvel asset, l’original n’est que lu. Devis estimés, jamais encore mesurés ; ils s’affichent « estimé » sur le bouton.

| Geste | Carte | Template | Devis | État |
| --- | --- | --- | --- | --- |
| suite-modifier | Modifier (texte libre) | `image_flux3_klein_image_edit` | 4 / 6, estimé | ouvert, open weights |
| suite-finaliser-image | Finaliser une image (restaure ×2, ne refait rien) | `utility_seedvr2_3b_int8_upscale_image` | 2 / 4, estimé | ouvert, open weights |
| suite-detourer | Détourer (PNG transparent ; SaveImage ajouté au template) | `utility_birefnet_remove_background` | 2 / 4, estimé | ouvert, open weights |
| suite-elargir | Élargir le cadre (Flux.2 Klein 9B) | `templates_doc_workbox_klein_9b_image_extend` | 2 / 4, estimé | ouvert, open weights |
| suite-animer | Animer une image (5 s) | `video_minimax_h3_i2v` | 4 / 8, estimé | ouvert, open weights |
| suite-finaliser-video | Finaliser une prise ou le montage (1080p, + fluidifier en option) | `utility_seedvr2_3b_int8_upscale_video` | 8 / 16 par 5 s, estimé | ouvert, open weights |
| suite-fluidifier | Fluidifier (images intermédiaires ×2) | `utility_video_frame_interpolation` | 2 / 4 par 5 s, estimé | ouvert, open weights |
| suite-prolonger | Prolonger (depuis la dernière image, 5 s) | `video_minimax_h3_i2v_continuation` | 4 / 8, estimé | ouvert, open weights |
| suite-parler | Faire parler (image + voix, 5 s) | `video_ltx2_3_ia2v` | 12 / 25, estimé | ouvert, open weights |

« Passer en 3D » reprend `prise-volume-objet` et `prise-volume-perso` (mêmes graphes que la maquette). Avec « Poids ouverts seulement », Finaliser du MONTAGE passe par `suite-finaliser-video` au lieu de RTX.

## OUTILS

Le hub « Outils » (barre du haut de /studio et de Mon studio) range chaque outil de la carte Scenario ↔ Comfy qui a un template officiel. Les lignes `outil-*` ci-dessous sont les graphes ajoutés par le hub : template officiel converti en API par Comfy Cloud (stockage seulement, aucun run), élagué (aperçus retirés), puis seules les entrées du visiteur sont remplacées (`src/lib/outils/generique.ts`, `src/lib/outils/base.ts`). Les autres cartes du hub réutilisent les gestes déjà branchés plus haut. Devis estimés, jamais mesurés.

| Geste | Template | Devis | État |
| --- | --- | --- | --- |
| outil-img-klein | `image_flux3_klein_t2i` | 4 / 6, estimé | ouvert, open weights |
| outil-img-qwen | `image_qwen_image_2_1_t2i` | 4 / 8, estimé | ouvert, open weights |
| outil-img-flux3 | `api_bfl_flux3_t2i` | 14 / 21, estimé | partenaire |
| outil-img-ideogram | `api_ideogram_v4_5_t2i` | 18 / 27, estimé | partenaire |
| outil-img-gpt | `api_openai_gpt_image_2_t2i` | 5 / 8, estimé | partenaire |
| outil-img-seedream | `api_bytedance_seedream_5_0_pro_t2i` | 9 / 14, estimé | partenaire |
| outil-img-nano | `api_nano_banana_2_1_t2i` | 12 / 18, estimé | partenaire |
| outil-img-refs | `image_qwen_image_2_1_image_edit` | 4 / 8, estimé | ouvert, open weights |
| outil-img-360 | `template_qwen_Image_2512_360_lora` | 4 / 8, estimé | ouvert, open weights |
| outil-img-croquis | `image_qwen_Image_2512_controlnet` | 4 / 8, estimé | ouvert, open weights |
| outil-vid-texte | `video_ltx2_5_t2v` | 12 / 25, estimé | ouvert, open weights |
| outil-vid-kling | `api_kling_v3_video` | 177 / 266, estimé | partenaire |
| outil-vid-seedance | `api_seedance2_5_r2v` | 352 / 528, estimé | partenaire |
| outil-vid-wan | `video_wan2_2_14B_i2v` | 12 / 25, estimé | ouvert, open weights |
| outil-vid-vidu | `api_vidu_q4_preview_r2v` | 100 / 150, estimé | partenaire |
| outil-vid-h3max | `api_minimax_h3_max_r2v` | 181 / 272, estimé | partenaire |
| outil-vid-mouvement | `video_wan_animate2` | 15 / 30, estimé | ouvert, open weights |
| outil-3d-tripo | `api_tripo_p2_image_to_model` | 232 / 348, estimé | partenaire |
| outil-3d-hunyuan | `api_hunyuan3d_image_to_model` | 190 / 285, estimé | partenaire |
| outil-3d-meshy | `api_meshy7_1_image_to_model` | 362 / 543, estimé | partenaire |
| outil-son-voix-ouverte | `audio-chatterbox_tts_multilingual` | 2 / 4, estimé | ouvert, open weights |
| outil-son-dialogue | `api_elevenlabs_v4_text_to_dialogue` | 24 / 48, estimé | partenaire |
| outil-son-musique-ouverte | `audio_ace_step1_5_xl_turbo` | 4 / 8, estimé | ouvert, open weights |
| outil-son-bruitage-ouvert | `audio_stable_audio_3_medium` | 2 / 4, estimé | ouvert, open weights |
| outil-ret-eclairer | `template_character_portrait_relighting` | 18 / 27, estimé | partenaire |
| outil-vid-prolonger-grok | `api_grok_video_extend` | 136 / 204, estimé | partenaire |
| outil-vid-detourer | `api_bria_remove_video_background` | 55 / 83 par 5 s, estimé | partenaire |
| outil-vid-levres | `api_sync_so_lip_sync_video` | 200 / 300 par 5 s, estimé | partenaire |
| outil-son-musique-video | `api_sonilo_v2m` | 10 / 15 par 5 s, estimé | partenaire |

Cartes « bientôt » (template officiel repéré, pas encore branché, raison affichée sur la carte) :

- vid-multi — `video_minimax_h3_multiframe_reference` — multi
- vid-h3-audio — `video_minimax_h3_r2v` — h3Audio
- 3d-uv — `api_hunyuan3d_model2uv` — entree3d
- 3d-parties — `api_hunyuan3d_part` — entree3d
- 3d-monde — `3d_triposplat_image_to_gaussian_splat` — splat
- son-clone — `audio-chatterbox_vc` — clone
- son-transcrire — `api_elevenLabs_speech_to_text` — texte
- txt-decrire — `llm_qwen3vl_text_gen` — texte
- ret-gommer — `image_flux.1_fill_dev_OneReward` — masque
- ret-vectoriser — `api_quiver_arrow2_image_to_svg` — svg

## Finaliser

Finaliser agrandit et rend plus net ce qui existe déjà. Il ne refait jamais la prise ni l’image. Ses templates sont exportés dans `workflows/finaliser/`.
