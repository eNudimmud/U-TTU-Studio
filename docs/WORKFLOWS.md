# Gestes du studio

## Bulle de création — P0-0

Les graphes de la bulle réutilisent les templates officiels déjà intégrés. Les noms, les photos et les options restent dans une seule demande ; chaque dépense attend sa confirmation. [Fonctionnement, sources et validation](CREATION-REFERENCES.md).

| Geste | Template | Devis de l’exemple 480p, 5 s | État |
| --- | --- | --- | --- |
| creation-image-texte | `image_flux3_klein_t2i` | ≈ 2 crédits estimés | ouvert, prompt seul |
| creation-image | `image_flux3_klein_image_edit` | ≈ 3 crédits estimés | ouvert, deux références dans l’exemple, sept au plus |
| creation-video-texte | `video_ltx2_5_t2v` | ≈ 5 crédits estimés | ouvert, prompt seul |
| creation-video-refs | `video_minimax_h3_r2v` | ≈ 5 crédits estimés | ouvert, deux références dans l’exemple, sept au plus, audio facultatif |

Ces quatre gestes utilisent un devis dynamique (résolution, format, durée, références). Ils n’ajoutent aucune mesure réelle au registre. La réserve de solde n’est pas un plafond garanti de facturation.

Un geste est une carte. Le template Comfy reste derrière. Chaque geste a son fichier dans `workflows/<onglet>/<id>.json` (le template officiel, à ouvrir dans ComfyUI) et, s’il est branché, `workflows/<onglet>/<id>.api.json` (le graphe exact que le studio envoie). `workflows/index.json` dit lequel passe par un nœud partenaire. Régénérer : `node --experimental-strip-types scripts/export-workflows.mjs`.

Moteurs (concours Comfy « Open Source Higgsfield ») : **FLUX 3 Image Klein** (open weights) pour les images de CAST et DÉCOR, **FLUX 3 Image** (nœud partenaire) pour plusieurs références et la planche, **LTX-2.5** pour la prise par défaut, **MiniMax H3** en second moteur. Nano Banana reste une option, éteinte par défaut. « Open weights seulement » cache tout geste à nœud partenaire.

`premier` : visible tout de suite. Les autres sont derrière « Plus de gestes ».

`ouvert` : le studio a déjà un graphe et un devis, le bouton Créer peut partir après confirmation. `fermé` : la carte reste, Créer reste éteint, rien ne part.

Devis : « mesuré » veut dire qu’un vrai job a été facturé et cité ; « hypothèse » ou « estimé » n’est pas une mesure. 38 gestes sur 84 sont mesurés. Le relevé du 27.10.2026 (test visiteur et lot d’exemples, facturation Comfy lue en lecture seule) en a ajouté 31, dont la prise LTX-2.5 (15,10 crédits pour 5 s 16:9), le raccord (6,98), élargir (16,32) et effacer (25,11) : chaque job et son coût sont dans [docs/mesures/test-visiteur-2026-10-27.md](mesures/test-visiteur-2026-10-27.md). Avant : la prise MiniMax H3 R2V (environ 4 crédits ; 3,66 le 27.10), les images FLUX 3 Klein (2,6 à 4 crédits, exemples DÉCOR #109), la vue 360 et le croquis. Règle du registre : `credits` = mesure arrondie, `high` = 1,5 × la mesure. Le devis de la prise affiché dans l’app reste marqué « Estimé » tant qu’aucun profil facturé n’est enregistré pour la prise ; le maximum sert de plafond face au solde.

## CAST

| Geste | Carte | Template | Devis | État |
| --- | --- | --- | --- | --- |
| cast-photos | Depuis des photos | `image_flux3_klein_image_edit` | 4 / 6, mesuré | ouvert, premier, open weights |
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
| decor-heure | Heure et météo | `image_flux3_klein_image_edit` | 4 / 7, mesuré | ouvert, premier, open weights |
| decor-angles | Autres angles | `templates-1_click_multiple_scene_angles-v1.0` | non mesuré | fermé, premier, open weights |
| decor-elargir | Élargir le cadre | `template_sirolim_any_aspect_ratio_nb2` | non mesuré | fermé, nœud partenaire, option Nano Banana, éteinte par défaut |
| decor-objet | Objet | `api_bfl_flux3_image_edit` | 14 / 21, hypothèse | ouvert, nœud partenaire |
| decor-volume | Volume du lieu | `3d_pixal3d_trellis2_image_to_model` | non mesuré | fermé, open weights |

## PRISE

| Geste | Carte | Template | Devis | État |
| --- | --- | --- | --- | --- |
| prise-plan | Personnage dans le décor | `video_ltx2_5_i2v` | 15 / 23, mesuré | ouvert, premier, open weights |
| prise-plan-h3 | Plan, second moteur | `video_minimax_h3_r2v` | 4 / 6, mesuré | ouvert, premier, open weights |
| prise-image | Image vers plan | `video_minimax_h3_i2v` | non mesuré | fermé, open weights |
| prise-raccord | Raccord | `video_ltx2_5_flf2v` | 7 / 11, mesuré | ouvert, premier, open weights |
| prise-prolonger | Prolonger | `video_minimax_h3_i2v_continuation` | non mesuré | fermé, open weights |
| prise-previs | Caméra maîtrisée (prévis maquette 3D → plan) | `video_ltx2_3_ic_lora` | 15 / 30, estimé | ouvert, premier, open weights |
| prise-volume-perso | Personnage en 3D (portrait → mannequin GLB de la maquette) | `3d_hunyuan3d-v2.1` | 8 / 16, estimé | ouvert dans la maquette, open weights |
| prise-volume-objet | Objet ou décor en 3D (photo → GLB, 40 000 faces pour mobile) | `3d_pixal3d_trellis2_image_to_model` | 17 / 25, mesuré | ouvert dans la maquette, open weights |
| prise-camera | Caméra | `video_ltx2_3_ic_lora` | 15 / 30, estimé | ouvert, open weights |
| prise-mouvement | Transfert de mouvement | `video_wan_animate2` | non mesuré | fermé, open weights |
| prise-levres | Lèvres | `video_ltx2_3_ia2v` | non mesuré | fermé, open weights |
| prise-vidu | Autre plan, références | `api_vidu_q4_preview_r2v` | 100 / 150, hypothèse | fermé, nœud partenaire |
| prise-elargir | Élargir le plan | `template_ltx2_3_lora_video_outpainting` | 16 / 25, mesuré | ouvert, open weights |
| prise-effacer | Effacer un objet | `template_ltx2_3_obscura_remova_lora_remove_object_from_video` | 25 / 38, mesuré | ouvert, open weights |

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

Menu « Et ensuite ? » sur un asset (panneau de détail de Mes créations) et sur une prise de PRISE. Chaque outil est un template officiel, poids ouverts, converti en API par Comfy Cloud puis élagué (aperçus retirés) : `src/lib/suite/base.ts`. Le résultat est un nouvel asset, l’original n’est que lu. Devis : la plupart mesurés le 27.10.2026 (colonne Devis) ; le bouton les affiche « estimé » ; les gestes vidéo sont comptés par tranche de 5 s.

| Geste | Carte | Template | Devis | État |
| --- | --- | --- | --- | --- |
| suite-modifier | Modifier (texte libre) | `image_flux3_klein_image_edit` | 4 / 6, mesuré | ouvert, open weights |
| suite-finaliser-image | Finaliser une image (restaure ×2, ne refait rien) | `utility_seedvr2_3b_int8_upscale_image` | 2 / 3, mesuré | ouvert, open weights |
| suite-detourer | Détourer (PNG transparent ; SaveImage ajouté au template) | `utility_birefnet_remove_background` | 1 / 1, mesuré | ouvert, open weights |
| suite-elargir | Élargir le cadre (Flux.2 Klein 9B) | `templates_doc_workbox_klein_9b_image_extend` | 5 / 8, mesuré | ouvert, open weights |
| suite-animer | Animer une image (5 s) | `video_minimax_h3_i2v` | 4 / 8, estimé | ouvert, open weights |
| suite-finaliser-video | Finaliser une prise ou le montage (1080p, + fluidifier en option) | `utility_seedvr2_3b_int8_upscale_video` | 28 / 42 par 5 s, mesuré | ouvert, open weights |
| suite-fluidifier | Fluidifier (images intermédiaires ×2) | `utility_video_frame_interpolation` | 2 / 4 par 5 s, mesuré | ouvert, open weights |
| suite-prolonger | Prolonger (depuis la dernière image, 5 s) | `video_minimax_h3_i2v_continuation` | 6 / 10, mesuré | ouvert, open weights |
| suite-parler | Faire parler (image + voix, 5 s) | `video_ltx2_3_ia2v` | 8 / 13, mesuré | ouvert, open weights |

« Passer en 3D » reprend `prise-volume-objet` et `prise-volume-perso` (mêmes graphes que la maquette). Avec « Poids ouverts seulement », Finaliser du MONTAGE passe par `suite-finaliser-video` au lieu de RTX.

## OUTILS

Le hub « Outils » (barre du haut de /studio et de Mes créations) range chaque outil de la carte Scenario ↔ Comfy qui a un template officiel. Les lignes `outil-*` ci-dessous sont les graphes ajoutés par le hub : template officiel converti en API par Comfy Cloud (stockage seulement, aucun run), élagué (aperçus retirés), puis seules les entrées du visiteur sont remplacées (`src/lib/outils/generique.ts`, `src/lib/outils/base.ts`). Les autres cartes du hub réutilisent les gestes déjà branchés plus haut. Devis estimés, sauf les lignes marquées « mesuré » (job cité dans `docs/mesures/test-visiteur-2026-10-27.md`).

| Geste | Template | Devis | État |
| --- | --- | --- | --- |
| outil-img-klein | `image_flux3_klein_t2i` | 3 / 6, mesuré | ouvert, open weights |
| outil-img-qwen | `image_qwen_image_2_1_t2i` | 3 / 5, mesuré | ouvert, open weights |
| outil-img-flux3 | `api_bfl_flux3_t2i` | 14 / 22, mesuré | partenaire |
| outil-img-ideogram | `api_ideogram_v4_5_t2i` | 18 / 28, mesuré | partenaire |
| outil-img-gpt | `api_openai_gpt_image_2_t2i` | 1 / 2, mesuré | partenaire |
| outil-img-seedream | `api_bytedance_seedream_5_0_pro_t2i` | 10 / 15, mesuré | partenaire |
| outil-img-nano | `api_nano_banana_2_1_t2i` | 12 / 18, estimé | partenaire |
| outil-img-refs | `image_qwen_image_2_1_image_edit` | 2 / 4, mesuré | ouvert, open weights |
| outil-img-360 | `template_qwen_Image_2512_360_lora` | 20 / 30, mesuré | ouvert, open weights |
| outil-img-croquis | `image_qwen_Image_2512_controlnet` | 17 / 26, mesuré | ouvert, open weights |
| outil-vid-texte | `video_ltx2_5_t2v` | 5 / 8, mesuré | ouvert, open weights |
| outil-vid-kling | `api_kling_v3_video` | 177 / 266, estimé | partenaire |
| outil-vid-seedance | `api_seedance2_5_r2v` | 352 / 528, estimé | partenaire |
| outil-vid-wan | `video_wan2_2_14B_i2v` | 8 / 13, mesuré | ouvert, open weights |
| outil-vid-vidu | `api_vidu_q4_preview_r2v` | 100 / 151, mesuré | partenaire |
| outil-vid-h3max | `api_minimax_h3_max_r2v` | 181 / 272, estimé | partenaire |
| outil-vid-mouvement | `video_wan_animate2` | 17 / 25, mesuré | ouvert, open weights |
| outil-3d-tripo | `api_tripo_p2_image_to_model` | 232 / 348, estimé | partenaire |
| outil-3d-hunyuan | `api_hunyuan3d_image_to_model` | 190 / 285, estimé | partenaire |
| outil-3d-meshy | `api_meshy7_1_image_to_model` | 362 / 543, estimé | partenaire |
| outil-son-voix-ouverte | `audio-chatterbox_tts_multilingual` | 3 / 5, mesuré | ouvert, open weights |
| outil-son-dialogue | `api_elevenlabs_v4_text_to_dialogue` | 4 / 6, mesuré | partenaire |
| outil-son-musique-ouverte | `audio_ace_step1_5_xl_turbo` | 3 / 6, mesuré | ouvert, open weights |
| outil-son-bruitage-ouvert | `audio_stable_audio_3_medium` | 2 / 3, mesuré | ouvert, open weights |
| outil-ret-eclairer | `template_character_portrait_relighting` | 18 / 27, estimé | partenaire |
| outil-vid-prolonger-grok | `api_grok_video_extend` | 136 / 204, estimé | partenaire |
| outil-vid-detourer | `api_bria_remove_video_background` | 63 / 95 par 5 s, mesuré | partenaire |
| outil-vid-levres | `api_sync_so_lip_sync_video` | 280 / 420 par 5 s, mesuré | partenaire |
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

## PRISE — cadrage contrôlé (P0-2)

`prise-plan-cadre` : `video_ltx2_5_i2v` + `image_flux3_klein_image_edit` + `image_qwen_image_instantx_controlnet`. Graphe exact : `workflows/prise/prise-plan-cadre.api.json`. Sources officielles conservées dans l’index et `workflows/prise/sources/`.

Les références de personnages et de décor donnent l’apparence initiale à Klein. La passe finale de l’image clé utilise Qwen Image InstantX Union avec deux `ControlNetApplyAdvanced` : profondeur native à 1, contours à 0,8, du début à la fin. Son latent part de l’image Klein redimensionnée aux dimensions des contrôles, avec débruitage 0,7. Aucune photo n’est reliée aux entrées de contrôle. Aucun Lotus ne ré-estime la profondeur exportée. Le décodage **après** contrôle est enregistré en PNG par Comfy et devient l’unique première image de LTX. Aucun passage d’édition ne peut ensuite contourner les contrôles.

Profil de coût séparé `ltx25-cadre-v1-<durée>s-<format>` (ou `cadre-v1-apercu-…`). Majoration estimée de 8 crédits, plafond de 16, par image clé contrôlée, ajoutée une seule fois au devis de la prise. Pour 5 s, qualité finale : **≈ 23 crédits estimés**, plafond 39. Aperçu : **≈ 14 crédits estimés**, plafond 28. Ces montants sont des hypothèses ; la mesure d’une prise ordinaire ne vaut pas pour ce graphe.

Disponibilité vérifiée par les sources officielles le 28.10.2026 (lecture, aucun rendu) :
- https://docs.comfy.org/tutorials/image/qwen/qwen-image#qwen-image-instantx-controlnet-workflow
- https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_qwen_image_instantx_controlnet.json
- https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_qwen_Image_2512_controlnet.json (`GetImageSize`)
- https://github.com/Comfy-Org/ComfyUI/blob/master/nodes.py (`ImageScale`)

Ces sources confirment nœuds et modèles, pas la qualité du nouveau chaînage. Le test réel A/B de cadrage reste nécessaire avant de considérer P0-2 comme validé en production. Le nouveau pipeline n’implémente pas le transfert d’apparence des photos de DÉCOR (P0-3).


## Genjutsu : remplacer un personnage

`outil-vid-genjutsu` utilise le template officiel `api_higgsfield_genjutsu_motion_transfer` : `LoadVideo` + `LoadImage` → `HiggsfieldMotionTransferNode` (`genjutsu-v1.0`) → `SaveVideo`. Le Studio envoie le graphe par son client Comfy habituel, après devis et confirmation ; le résultat revient dans Mes créations et se transfère au montage.

Le panneau reçoit une vidéo et une image de personnage, avec une deuxième image facultative de décor/style. Le template accepte jusqu’à 8 images par son entrée dynamique ; cette première interface en expose deux, comme son exemple officiel. La référence facultative est retirée du graphe lorsqu’elle n’est pas fournie. Pas de génération d’image de départ séparée.

Vidéo de 4 s au minimum ; le nœud conserve au plus les 30 premières secondes. Résolutions 480p (choix initial du Studio), 720p et 1080p. La seed sert à déclencher le recalcul et ne garantit pas un résultat déterministe. Le nœud est une API partenaire payante ; l’option « modèles du studio seulement » le masque.

Tarif publié dans `comfy_api_nodes/nodes_higgsfield.py`, vérifié le 28.10.2026 : 0,45474 / 0,97383 / 2,33376 USD par seconde pour 480p / 720p / 1080p. Le devis multiplie la durée retenue par ce tarif et 211 crédits/USD, puis arrondit au crédit supérieur. À 5 s : **≈ 480 crédits estimés**, **≈ 1 028 crédits estimés**, **≈ 2 463 crédits estimés** ; réserve de solde égale à 1,5 fois le devis arrondie au-dessus, sans garantie de plafond facturé. Le nombre du registre correspond à 5 s en 480p, pas à chaque clip. Sans durée lisible ou sous 4 s, aucun devis ni envoi.

Sources : [template officiel](https://github.com/Comfy-Org/workflow_templates/blob/main/templates/api_higgsfield_genjutsu_motion_transfer.json), [nœud et barème officiels](https://github.com/Comfy-Org/ComfyUI/blob/master/comfy_api_nodes/nodes_higgsfield.py). Le template UI et le graphe exact envoyé sont dans `workflows/outils/outil-vid-genjutsu.json` et `.api.json`, avec une entrée dans `index.json`.

Validation et limites : [GENJUTSU.md](GENJUTSU.md). Aucun rendu réel dans cette livraison ; le coût minimal estimé dépasse le budget de vérification de 60 crédits.
