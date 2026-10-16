# Audit : chaque fonction passe par son workflow Comfy dédié

Règle JD du 16 octobre 2026 : toute fonction proposée dans U*TTU Studio passe par son workflow Comfy dédié (template officiel, exporté en JSON) dès que c'est possible. Aucun crédit dépensé pour cet audit.

Vérifié par `tests/workflows-dedies.test.ts` : chaque graphe envoyé (`workflows/<onglet>/<geste>.api.json`) ne contient que des nœuds de son template officiel (`workflows/<onglet>/<geste>.json`), plus quatre ajouts nommés : `LoadImage` (photos du visiteur), `SaveImageAdvanced` (sortie image), `ImageStitch` (planche) et `ImageFromBatch` (élargir). `prise-plan` enchaîne deux templates officiels (Klein edit, puis LTX-2.5 i2v).

## Gestes branchés (24)

| Geste | Template officiel | Nœuds | Graphe envoyé |
| --- | --- | --- | --- |
| cast-photos | `image_flux3_klein_image_edit` | open weights | `workflows/cast/cast-photos.api.json` |
| cast-planche | `api_bfl_flux3_image_edit` | partenaire | `workflows/cast/cast-planche.api.json` |
| cast-texte | `image_flux3_klein_t2i` | open weights | `workflows/cast/cast-texte.api.json` |
| cast-refs | `api_bfl_flux3_image_edit` | partenaire | `workflows/cast/cast-refs.api.json` |
| cast-texte-nano | `api_nano_banana_2_1_t2i` | partenaire | `workflows/cast/cast-texte-nano.api.json` |
| cast-photos-nano | `api_nano_banana_2_1_image_edit` | partenaire | `workflows/cast/cast-photos-nano.api.json` |
| cast-tenue | `image_flux3_klein_image_edit` | open weights | `workflows/cast/cast-tenue.api.json` |
| decor-texte | `image_flux3_klein_t2i` | open weights | `workflows/decor/decor-texte.api.json` |
| decor-photo | `image_flux3_klein_image_edit` | open weights | `workflows/decor/decor-photo.api.json` |
| decor-texte-nano | `api_nano_banana_2_1_t2i` | partenaire | `workflows/decor/decor-texte-nano.api.json` |
| decor-photo-nano | `api_nano_banana_2_1_image_edit` | partenaire | `workflows/decor/decor-photo-nano.api.json` |
| decor-heure | `image_flux3_klein_image_edit` | open weights | `workflows/decor/decor-heure.api.json` |
| decor-objet | `api_bfl_flux3_image_edit` | partenaire | `workflows/decor/decor-objet.api.json` |
| prise-plan | `video_ltx2_5_i2v` | open weights | `workflows/prise/prise-plan.api.json` |
| prise-plan-h3 | `video_minimax_h3_r2v` | open weights | `workflows/prise/prise-plan-h3.api.json` |
| prise-raccord | `video_ltx2_5_flf2v` | open weights | `workflows/prise/prise-raccord.api.json` |
| prise-camera | `video_ltx2_3_ic_lora` | open weights | `workflows/prise/prise-camera.api.json` |
| prise-previs | `video_ltx2_3_ic_lora` | open weights | `workflows/prise/prise-previs.api.json` |
| prise-elargir | `template_ltx2_3_lora_video_outpainting` | open weights | `workflows/prise/prise-elargir.api.json` |
| prise-effacer | `template_ltx2_3_obscura_remova_lora_remove_object_from_video` | open weights | `workflows/prise/prise-effacer.api.json` |
| mont-voix | `api_elevenlabs_v4_text_to_speech` | partenaire | `workflows/montage/mont-voix.api.json` |
| mont-effet | `api_elevenlabs_text_to_sound_effects` | partenaire | `workflows/montage/mont-effet.api.json` |
| mont-musique | `api_sonilo_t2m` | partenaire | `workflows/montage/mont-musique.api.json` |
| montage-finaliser | `utility_nvidia_rtx_video_enhance` | open weights | `workflows/finaliser/montage-finaliser.api.json` |

## Migrations faites dans cette passe

- **CAST et DÉCOR, FLUX 3 Klein** (texte et photo) : le graphe était construit à la main (mêmes modèles, même sampler). Il part maintenant de l'export du template `image_flux3_klein_t2i` / `image_flux3_klein_image_edit` (`src/lib/render/klein-base.ts`). Ce qui est retiré : les aperçus, la comparaison d'images et l'éditeur de zones. Le « prompt upsampler » du template reste dans le graphe derrière son propre interrupteur, coupé, comme lors des rendus mesurés.
- **PRISE, MiniMax H3** : la prise était construite à la main. Elle part maintenant de l'export de `video_minimax_h3_r2v` (`src/lib/render/h3-base.ts`), interrupteurs du template gardés (Lightning LoRA = mode rapide).
- **Finaliser (MONTAGE)** : c'est l'étape RTX Video Super Resolution du template officiel `utility_nvidia_rtx_video_enhance`, sans HDR ni génération d'images. Le graphe est maintenant exporté (`workflows/finaliser/montage-finaliser.*`). Le README annonçait à tort SeedVR2 : corrigé.
- **Déjà conformes, sans changement** : FLUX 3 Image (partenaire), Nano Banana (option), LTX-2.5 i2v / flf2v, LTX-2.3 IC-LoRA (caméra, caméra maîtrisée), élargir, effacer, voix, effet, musique (ElevenLabs et Sonilo en nœuds partenaires Comfy).

## Gestes affichés « Bientôt » (template choisi, pas encore branché)

- cast-angle : `templates-1_click_multiple_character_angles-v1.0`
- cast-expressions : `templates_liveportrait.app`
- cast-eclair : `template_character_portrait_relighting`
- cast-agrandir : `utility_seedvr2_3b_int8_upscale_image`
- cast-volume : `api_hunyuan3d_image_to_model`
- decor-angles : `templates-1_click_multiple_scene_angles-v1.0`
- decor-elargir : `template_sirolim_any_aspect_ratio_nb2`
- decor-volume : `3d_pixal3d_trellis2_image_to_model`
- prise-image : `video_minimax_h3_i2v`
- prise-prolonger : `video_minimax_h3_i2v_continuation`
- prise-mouvement : `video_wan_animate2`
- prise-levres : `video_ltx2_3_ia2v`
- prise-vidu : `api_vidu_q4_preview_r2v`
- mont-levres : `video_ltx2_3_ia2v`
- mont-agrandir : `utility_seedvr2_3b_int8_upscale_video`
- mont-fluide : `utility_video_frame_interpolation`

## Fonctions sans workflow Comfy possible, et pourquoi

| Fonction | Ce qu'elle fait | Pourquoi pas Comfy |
| --- | --- | --- |
| Repérage de lieux (DÉCOR) | Carte OpenFreeMap, recherche Nominatim et Photon, photos de rue Panoramax et Mapillary, bâtiments Overture | Ce sont des données (cartes, adresses, photos sous licence), pas de la génération. Aucun nœud Comfy ne les fournit. |
| Maquette 3D (PRISE) | Mise en place des personnages et de la caméra (three.js), prévis filmée dans le navigateur | Interaction temps réel sur l'appareil du visiteur. La vidéo de prévis, elle, part dans le workflow Comfy `video_ltx2_3_ic_lora`. |
| Montage (timeline, export) | Coupe, ordre, volumes, export MP4 dans l'onglet (WebCodecs) | Édition locale, rien n'est généré. Le Finaliser, lui, passe par Comfy. |
| Mon studio / galeries / coffre | Fichiers, fiches Markdown, galeries CAST/DÉCOR/prises | Stockage local (dossier ou navigateur). Pas un rendu. |
| Compte de rendu | Clé API ou session Comfy (jeton Comfy via `securetoken.googleapis.com`), solde | C'est l'authentification Comfy elle-même. |
| Connexion au site | Clerk | Authentification du site, hors rendu. |
| Partage | Lien vers X | Simple lien de publication, rien n'est envoyé sans le visiteur. |
