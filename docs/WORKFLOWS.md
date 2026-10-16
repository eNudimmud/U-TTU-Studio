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
| prise-prolonger | Prolonger | `video_minimax_h3_i2v_continuation` | non mesuré | fermé, premier, open weights |
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

## Finaliser

Finaliser agrandit et rend plus net ce qui existe déjà. Il ne refait jamais la prise ni l’image. Ses templates sont exportés dans `workflows/finaliser/`.
