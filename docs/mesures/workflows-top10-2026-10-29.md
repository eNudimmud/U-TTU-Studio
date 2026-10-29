# Top 10 des workflows manquants — mesures du 29.10.2026

Demande de JD (29.10, 20:16, heure de Zurich) : « Tout le top 10, et enlève du studio les choses que ça remplace si c’est mieux ».
Budget accordé : environ 90 crédits Comfy pour les mesures, plafond 95. Plafond levé par JD le 29.10.2026 à 20 h 37 (heure de Zurich) : un rendu réel par workflow, sans rendu inutile, avec un devis annoncé avant chaque dépense.

Méthode (docs/CREDITS.md) :
- job GPU : `gpu_seconds × 0,27325` crédits (rtx_pro_6000), lu dans l’activité de facturation Comfy Cloud ;
- job partenaire : `credits_used` de la même activité.

Aucun job n’a été annulé. Entrées : le portrait d’Uttu (`public/exemples/uttu-portrait-640.webp`) et le quai de nuit (`public/exemples/decor-quai-nuit-640.webp`). Miniatures : `docs/preuves/top10/`.

## Lot 1 — angles (n° 1 et 2)

| N° | Outil du studio | Template | Job | GPU s | Crédits réels | Devis du registre |
| --- | --- | --- | --- | --- | --- | --- |
| 1a | Huit angles du personnage (`ret-angles-perso`, geste `cast-angle`) | `templates-1_click_multiple_character_angles-v1.0` | `d68df6c9` | 39,77 | **10,87** | 11 / 17 |
| 1b | Huit angles du décor (`ret-angles-decor`, geste `decor-angles`) | `templates-1_click_multiple_scene_angles-v1.0` | `03ceae25` | 33,14 | **9,05** | 9 / 14 |
| 2 | Déplacer la caméra (`ret-camera`, geste `outil-ret-camera`) | `template_qwen_multiangle.app` | `4a23ca60` | 12,04 | **3,29** | 3 / 5 |
| — | Contrôle du câblage Batch Images (LoadImage → BatchImagesNode → SaveImage, sans modèle) | graphe d’essai | `308d954a` | non facturé à la lecture | ≈ 0 | — |

Sous-total du lot 1 : **23,21 crédits**.

Notes :
- Les deux templates « 8 angles » enregistrent chacun leurs 8 images par 8 nœuds SaveImage. Le studio ne lit qu’un nœud final (#166). `scripts/build-top10-bases.mjs` remplace donc les 8 sauvegardes par un nœud `BatchImagesNode` (990) et un seul `SaveImage` (991) ; les aperçus sont retirés. L’essai `308d954a` confirme qu’un seul nœud rend bien plusieurs fichiers (3 sur 3).
- Ordre des 8 images (`ANGLES_LOT`) : 45° gauche, 45° droite, 90° gauche, 90° droite, gros plan, plan large, contre-plongée, plongée.
- Chaque image du lot devient son propre asset dans Mes créations (`<id>.png`, puis `<id>-2.png` … `<id>-8.png`). Le devis et le coût réel sont sur la note de la première image.
- Défaut connu du template personnage : la vue « 90° gauche » est sortie pivotée sur le côté (`docs/preuves/top10/ca-90left.webp`). Le décor n’a pas ce défaut.
- Si la page est rechargée pendant le rendu, « Récupérer le rendu » ne reprend que la première image du lot. Les autres restent dans l’historique Comfy.
- Pour mesurer les 8 angles du personnage, un workflow `uttu-top10-character-angles-base` a été enregistré dans l’espace Comfy. Il ne sert qu’à lire la conversion API du template (graphe trop gros pour la lecture directe du job). Rien n’a été lancé avec.

Preuves : `docs/preuves/top10/planche-cast.webp` (entrée, gros plan, 90° gauche, contre-plongée, caméra 45°) et `docs/preuves/top10/planche-decor.webp` (entrée et 3 angles).

Remplacement : aucun. Ces outils ne remplacent rien. « Autre angle » et « Autres angles » étaient des cartes fermées (« Bientôt ») : elles sont rouvertes, pas dupliquées. Leurs cartes vivent maintenant dans la bande d’outils de CAST et DÉCOR.

## Lot 3 — son (n° 6 et 10)

Devis annoncés avant de lancer (29.10.2026, heure de Zurich) :
- n° 10, séparer voix et musique (`audio_melbandroformer_audio_separation`), mixage voix + musique de 6 s : **≈ 1 crédit estimé** (GPU seul, `estimate_credits` : 0 nœud partenaire).
- n° 6, bruitage calé sur l’image (`api_mirelo_video_to_sfx`), prise d’Uttu sur le quai (5,04 s) : **≈ 15 à 18 crédits estimés** (`estimate_credits` : 3 crédits/s, nœud partenaire).

Résultats :

| N° | Outil du studio | Template | Job | Mesure | Crédits réels | Devis du registre |
| --- | --- | --- | --- | --- | --- | --- |
| 10 | Séparer voix et musique (`son-separer`, geste `outil-son-separer`) | `audio_melbandroformer_audio_separation` | `e17c6f9a` (essai 1) | 2,24 s GPU | 0,61 | — |
| 10 | idem | idem | `28e6846d` (mesure retenue) | 1,57 s GPU | **0,43** | 1 / 1 |
| 6 | Bruitage d’une vidéo (`son-bruitage-video`, geste `outil-son-bruitage-video`) | `api_mirelo_video_to_sfx` | `f5d1f00a` | partenaire `sfx-2.0` | **14,26** | 15 / 18 par tranche de 5 s |

Sous-total du lot son : **15,30 crédits** (dont 0,61 pour l’essai 1).

Notes :
- Essai 1 de MelBand : l’entrée mêlait `voix-exemple.wav` et la musique d’exemple. Or `voix-exemple.wav` est un ton synthétique, pas une voix (docs/CREDITS.md). La piste voix est donc sortie muette (−91 dB) et tout est allé dans la musique : le modèle a eu raison. L’essai 2 utilise une phrase dite en français sur la même musique : voix −21,9 dB, musique −29,9 dB, comme le mélange.
- MelBand sauve deux fichiers (voix, instruments) par deux nœuds. Le studio n’en lit qu’un : la base garde le nœud 4 et un choix « Voix / Musique » le rebranche sur la sortie 0 ou 1 du séparateur. Changer de piste demande un nouveau rendu (≈ 0,4 crédit).
- Mirelo rend trois choses : la piste de bruitage, la piste de voix gardée et la vidéo remixée. Le studio garde la piste de bruitage (nœud 2), qui se pose sur la frise de MONTAGE sous la prise ; la voix d’origine reste sur la prise. Le texte est facultatif et guide les sons.
- Tarif : 14,26 crédits pour 5,04 s, soit 2,83 crédits/s. Le devis par tranche de 5 s est donc 15 (haut 18).
- Vignettes : `public/exemples/vignettes/son-bruitage-video.webp` (image de la prise et enveloppe réelle du bruitage) et `son-separer.webp` (enveloppes réelles des deux pistes).

Remplacement : aucun. `mont-effet` et `son-bruitage-ouvert` créent un effet depuis un texte, sans vidéo : ce n’est pas le même geste. Rien ne séparait les pistes avant.

## Lot 2 — PRISE vidéo (n° 3, 4, 5, 8 et 9)

Devis annoncés avant de lancer (29.10.2026, heure de Zurich), tous en GPU (`estimate_credits` : 0 nœud partenaire) :
- n° 8, brouillon rapide H3 (`video_fasth3_ominiref_r2v`), 5 s : **≈ 3 crédits estimés** ; comparaison avec `prise-plan-h3` sur la même image : **≈ 4 crédits estimés**.
- n° 4, H3 Multiframe (`video_minimax_h3_multiframe_reference`), 5 s, 2 images clés : **≈ 6 crédits estimés**.
- n° 5, LTX planche de référence (`template_ltx2_3_ic_lora_ingredients`), 5 s : **≈ 15 crédits estimés**.
- n° 9, transition de style LTX (`template_ltx2_3_style_transition`) : **≈ 10 crédits estimés**.
- n° 3, chaîne multi-caméra : aucun nouveau rendu, somme des mesures (angles + prise H3).
- Ajout (après la mesure du n° 8, plus chère que prévu) : FastH3 refait à 0,4 MP, la taille de `prise-plan-h3`, pour comparer à taille égale : **≈ 5 crédits estimés**.
- Ajout : n° 5 refait, le premier rendu (job ef795de3, 14,85 crédits) a pris le texte de démonstration du template (le texte remplacé allait au réécrivain de prompt, éteint) : **≈ 15 crédits estimés**.
- n° 9, image de fin pour la mesure : Uttu en aquarelle avec FLUX 3 Klein (`image_flux3_klein_image_edit`) : **≈ 4 crédits estimés**.

### Résultats du lot 2 (facturation Comfy lue après chaque job, GPU × 0,27325)

| N° | Workflow | Job | GPU | Crédits | Décision |
| --- | --- | --- | --- | --- | --- |
| 8 | `video_fasth3_ominiref_r2v`, 1 MP, 8 pas | 15b82e38 | 47,78 s | 13,05 | non intégré |
| 8 | même graphe à 0,4 MP (taille de `prise-plan-h3`) | fa72eebe | 32,42 s | 8,86 | non intégré |
| 8 | comparaison `prise-plan-h3` (H3 R2V, rapide 4 pas, 0,4 MP) même image, même texte, même graine | 152182d8 | 13,68 s | 3,74 | gardé |
| 4 | `video_minimax_h3_multiframe_reference`, 5 s 16:9, 20 pas | 47a49f52 | 51,25 s | 14,00 | intégré : `vid-multi` ouvert |
| 5 | `template_ltx2_3_ic_lora_ingredients`, 1er essai (texte de démo resté actif) | ef795de3 | 54,34 s | 14,85 | — |
| 5 | même graphe, texte Uttu sur l’entrée active | 66a817df | 53,26 s | 14,55 | non intégré |
| 9 | image de fin : Uttu en aquarelle, FLUX 3 Klein (graphe `suite-modifier`) | 4521b91c | 13,44 s | 3,67 | entrée de mesure |
| 9 | `template_ltx2_3_style_transition`, 6 s 720×1280 | 1aa1b714 | 25,32 s | 6,92 | intégré : `vid-transition-style` |
| 3 | chaîne multi-caméra | aucun | — | 0 | documentée, voir plus bas |

Sous-total du lot 2 : **79,64 crédits** (dont 14,85 perdus sur le premier essai du n° 5).

Notes :
- n° 8, FastH3 : sur la même image d’Uttu, même texte et même graine, la prise H3 du studio en mode rapide (3,74 crédits) garde mieux les fissures dorées et tourne la tête vers l’objectif comme demandé ; FastH3 coûte 2,4 fois plus à taille égale (8,86) et 3,5 fois plus à sa taille native (13,05). Le « brouillon rapide » n’est pas moins cher sur Comfy Cloud : pas de carte, `prise-plan-h3` reste. Planche : `/workspace/top10/planche-fasth3-vs-h3.png` sur la box (ligne 1 H3 studio, ligne 2 FastH3 0,4 MP, ligne 3 FastH3 1 MP).
- n° 4, images clés : l’image 1 est la référence du personnage (164), l’image 2 l’image clé à 5 s (167). Les deux guides du milieu (1,5 s et 3 s) sont retirés : le studio n’a que deux entrées d’image ; le coût dépend des pas et de la taille, pas du nombre de guides. Le rendu part du portrait et finit sur le gros plan demandé. Pas un remplacement de `vid-raccord` (LTX-2.5, interpolation stricte début → fin, sans son) : ici H3 garde l’identité et fait le son.
- n° 5, planche de référence : le premier essai a pris le texte de démonstration (le texte remplacé allait au réécrivain de prompt, éteint par défaut ; l’entrée active est `129:211.on_false`). Le second essai, avec le bon texte, recopie la mise en page de la planche pendant ~1,5 s (vues du quai en mosaïque) puis montre Uttu au milieu d’un cadre noir : la planche composée à la main avait des marges noires. Trop cher (≈ 15 crédits) pour un résultat qui dépend autant de la planche : non exposé. À reprendre avec une planche pleine page (sortie de `cast-planche`).
- n° 9, transition de style : passe bien de la photo à l’aquarelle (0 s → 6 s). Pas un remplacement de `vid-raccord` : c’est un raccord spécialisé (LoRA de transition), le raccord généraliste reste.
- n° 3, chaîne multi-caméra : pas de nouveau rendu. La chaîne du studio est « Huit angles du personnage » (`ret-angles-perso`, 10,17 crédits mesurés) puis une prise par angle choisi (`prise-plan-h3` rapide, 3,74 crédits mesurés ci-dessus) : ≈ 14 crédits pour un plan d’un nouvel angle, ≈ 40 pour trois angles. Aucune carte en plus : les deux cartes existent déjà.

### Connaissance de l’agent Uttu à mettre à jour (étape suivante)

L’agent lit le catalogue en direct (`src/lib/agent/studio-map.ts`, `capabilities.ts`) : une carte ouverte lui apparaît sans liste à tenir. À ajouter au prompt et au catalogue décrit de l’agent :
- `vid-multi` « Images clés fidèles » (PRISE) : ouvert, 14 / 21 crédits ; image 1 = personnage de référence, image 2 = image de fin à 5 s ; texte requis ; son généré.
- `vid-transition-style` « Transition de style » (PRISE) : nouveau, 7 / 11 crédits, 6 s ; image de début, image de fin dans l’autre style (par ex. sortie de « Modifier ») ; le mot `zhuanchang` est ajouté tout seul.
- Ne pas proposer FastH3 ni la planche de référence LTX : non intégrés.
- Chaîne multi-caméra à décrire comme recette : « Huit angles du personnage » puis « Plan, second moteur » sur l’angle choisi.

## Lot 3 — Rééclairer en poids ouverts (n° 7)

Devis annoncés avant de lancer :
- `image_qwen_image_edit_2509_relight` (Qwen Image Edit 2509 + LoRA Relight, 4 pas Lightning), portrait d’Uttu, consigne « contre-jour coucher de soleil » : **≈ 2 crédits estimés**.
- `templates-portrait_light_migration` (Qwen Image Edit 2509 + LoRA Light Migration), Uttu éclairé comme le quai de nuit, Lightning activé (4 pas au lieu de 20) : **≈ 2 crédits estimés**.
- Comparaison avec `ret-eclairer` (`template_character_portrait_relighting`, partenaire, devis 18 crédits non mesuré) : **non lancée**, plus de 15 crédits. Les deux restent si le nouveau marche.
- Light Migration en 4 pas : effet à peine visible sur Uttu. Un essai au réglage du template (20 pas, CFG 4, sans Lightning), consigne sans la fin de démo « glass orb » : **≈ 7 crédits estimés**.

### Résultats du lot 3

| N° | Workflow | Job | GPU | Crédits | Décision |
| --- | --- | --- | --- | --- | --- |
| 7 | `image_qwen_image_edit_2509_relight`, portrait d’Uttu, « sunset backlight », 4 pas | 416ef414 | 13,21 s | 3,61 | intégré : `ret-eclairer-ouvert` |
| 7 | `templates-portrait_light_migration`, Uttu + lumière du quai, Lightning 4 pas | 17e4bc26 | 13,82 s | 3,78 | non intégré |
| 7 | même graphe, réglage du template (20 pas), consigne sans « glass orb » | e86f2d4c | 41,95 s | 11,46 | non intégré |

Sous-total du lot 3 : **18,85 crédits**.

Notes :
- Rééclairer par consigne : contre-jour orangé net, visage et fissures dorées gardés. Il devient le modèle par défaut de la carte « Changer la lumière » (intention `ret-eclairer-ouvert`, 4 / 6 crédits) ; l’ancien `ret-eclairer` (partenaire, devis 18 / 27 non mesuré) reste comme second modèle « Portrait studio ». Pas de comparaison : son rendu dépasse 15 crédits, donc les deux restent, sans carte en plus.
- Raccord lumière par image (Light Migration) : en 4 pas, le portrait ressort presque inchangé ; en 20 pas, il prend une teinte ambrée proche du quai, mais l’effet reste léger pour 11,46 crédits, trois fois le rééclairage par consigne. Non exposé.
- Planche : `/workspace/top10/planche-relight.png` sur la box (Uttu d’origine, lumière du quai, Light Migration 4 pas, Light Migration 20 pas, Relight par consigne).

Connaissance de l’agent Uttu : la carte « Changer la lumière » (CAST) a maintenant deux modèles, « Lumière par consigne » (poids ouverts, ≈ 4 crédits, par défaut) et « Portrait studio » (partenaire, ≈ 18 crédits). Proposer le premier d’abord ; ne pas proposer de raccord lumière par image de référence.

## Nettoyage des doublons (branche `top10-doublons`, empilée sur `top10-lumiere`)

Aucun rendu, donc 0 crédit.

**Regroupé (clairement redondant)**
- `vid-vidu` (« Vidéo à références multiples », Vidu Q4 r2v, partenaire, 100 / 151 crédits) et `vid-h3-refs` (« Vidéo fidèle aux références », H3 r2v, 4 crédits) prenaient les mêmes entrées (deux images, une consigne, format) pour le même résultat. Il n’y a plus qu’une carte : « Vidéo fidèle aux références ». Modèle par défaut « Fidèle, économique » (H3) ; second modèle « Deux images mêlées » (Vidu). Vidu n’est pas supprimé : il reste à un clic, derrière « Changer de modèle ». Résultat : 42 → 41 cartes, 44 → 43 outils.

**Examinés et gardés (pas clairement redondants)**
- Les six cartes texte → image (`img-klein`, `img-flux3`, `img-seedream`, `img-gpt`…) : chacune a une force différente (vitesse, qualité, photo, respect de la consigne).
- `vid-genjutsu` et `vid-mouvement` : l’un remplace un personnage dans un clip, l’autre fait reprendre un geste ; workflows et entrées différents.
- `vid-h3-audio` : déjà caché (« bientôt »).
- `img-refs` et `ret-modifier` : l’un crée à partir de références, l’autre retouche une image existante.

**À reprendre dans la connaissance de l’agent Uttu**
- Plus de carte « Vidéo à références multiples ». Pour une vidéo à partir de références, proposer « Vidéo fidèle aux références » (≈ 4 crédits). Ne parler de Vidu (« Deux images mêlées », ≈ 100 crédits) que si on le demande. L’agent lit le catalogue en direct (`studio-map.ts`, `capabilities.ts`), donc rien à coder ; seul le texte de prompt et du README qui citerait l’ancienne carte est à revoir.

## Audit des trois échecs (n° 5, 8, 7) — 29.10.2026, 22 h

JD : « peut-être que c’est toi qui as fait une erreur ». Pour chaque échec, j’ai relu le template officiel (`cloud.comfy.org/templates/<nom>.json`, identique à `Comfy-Org/workflow_templates`), ses notes et la page du modèle ou du LoRA, puis je les ai comparés au graphe réellement envoyé (`get_job_status`, graphe du job).

### n° 5 — LTX-2.3 IC-LoRA Ingredients (`template_ltx2_3_ic_lora_ingredients`)

Réglages recommandés (note du template et fiche `Lightricks/LTX-2.3-22b-IC-LoRA-Ingredients`) :
- Entrée : **une seule planche composite, sans texte, un panneau propre par élément** : le personnage en gros plan de face **et en vue tournante du corps entier** (face, trois-quarts, profil, dos), chaque accessoire en rendu produit, **un seul panneau de lieu**. La planche est donnée à la résolution de la sortie. « Plus un élément occupe de place, mieux il passe » : l’exemple officiel (`german_shepherd_news_anchor_ref.png`, 1376×768) remplit tout le cadre, sans marge.
- Consigne en deux parties : `### Reference Sheet Description …` puis `### Target Description …` (ou `Reference sheet:` / `Generated video:`).
- Template (modèle distillé) : LoRA 1,0, 8 pas, CFG 1, euler_ancestral, linear_quadratic, 1280×720, 5 s à 25 i/s, réécrivain de consigne éteint. La fiche (modèle dev) conseille LoRA 1,4, 30 pas, CFG 4, 768×448, 121 images, 24 i/s.

Envoyé (jobs `ef795de3`, puis `66a817df`) : mêmes réglages que le template (LoRA 1, 8 pas, CFG 1, 1280×720, 5 s, 25 i/s) et une consigne au bon format pour le second essai. Mais la planche (`/workspace/top10/ref-sheet.png`) ne suivait pas la fiche :
- Environ 40 % du cadre restait vide (marges noires), donc des panneaux petits.
- Pas de vue tournante du corps entier.
- Deux gros plans presque identiques.
- Les panneaux du personnage gardaient leur décor (voûte, colonnes), donc ce n’étaient pas des panneaux propres.

Le premier essai avait en plus pris le texte de démonstration.

**Erreur de notre côté : oui.** La planche ne respectait pas le format d’entrée attendu par le LoRA ; un collage clairsemé est reproduit comme une image. Correction : une planche conforme à 1280×720, remplie bord à bord. À gauche en haut, deux gros plans de face et de trois-quarts ; à gauche en bas, une vue tournante du corps entier sur fond uni, faite avec FLUX 3 Klein. À droite, un seul panneau de lieu (le quai). La consigne décrit ces panneaux. Réglages du template inchangés.

### n° 8 — FastH3 OmniRef (`video_fasth3_ominiref_r2v`)

Réglages recommandés (note du template et fiche `FastVideo/FastH3-OmniRef-Comfy`) : 8 pas, guidage 1, euler simple, décalage vidéo 12 et audio 3, attention creuse `vsa` à 10 %, 5 s = 124 images à 24 i/s, 1344×768 (1 MP), `ref_image_size: match`. Jusqu’à 9 images de référence (le template en câble deux : `<Picture 1>` identité, `<Picture 2>` lieu). La consigne est **structurée** : `subject_definitions` (`<Subject N> is … in <Picture N>`), `summary: [reference generation] …`, `retention_analysis`, `detailed_description` par plan, `overall_soundscape`, `non_diegetic_music`.

Envoyé (jobs `15b82e38` à 1 MP, `fa72eebe` à 0,4 MP) : le graphe est identique au template (8 pas, euler, 12/3, vsa 10, comfy kitchen attention). Deux écarts :
- Une seule référence au lieu de deux.
- Une consigne courte en trois lignes au lieu du format structuré.

La comparaison `152182d8` opposait FastH3 en 8 pas à H3 R2V avec le LoRA turbo 4 pas du studio, avec la même consigne courte.

**Erreur de notre côté : en partie.** Les réglages étaient bons ; le coût mesuré (32 s de GPU à 0,4 MP contre 13,7 s pour H3 turbo) ne vient pas de nous. Mais le test de qualité a été fait hors du format de consigne documenté, avec une seule référence, alors que la force annoncée de FastH3 est le multi-référence. Nouvel essai à réglages équivalents : FastH3 et H3 turbo du studio, mêmes deux références (Uttu et le quai), même consigne structurée, 0,4 MP, 5 s, graine 4242.

### n° 7 — Light Migration (`templates-portrait_light_migration`)

Réglages recommandés (fiche `dx8152/Qwen-Edit-2509-Light-Migration`, version « app » du template `templates_rob_portrait_light_migration.app`, guide de la communauté) : **image 1 = sujet, image 2 = référence de lumière**. Consigne par défaut, à garder en chinois : `参考色调，移除图1原有的光照并参考图2的光照和色调对图1重新照明` (« retire la lumière de l’image 1 et rééclaire-la d’après la lumière et les tons de l’image 2 »). Lightning 4 ou 8 pas avec CFG 1, ou 20 pas avec CFG 4 sans Lightning ; LoRA à 1 (1,25 dans l’espace de démonstration).

Envoyé (jobs `17e4bc26` en 4 pas, `e86f2d4c` en 20 pas) : **la lumière entrait sur `image3`, et `image2` restait vide**. Ce câblage vient de la version de janvier du template (nœud 6 relié au slot 2 du sous-graphe). La version « app » de mars, aussi au catalogue, le corrige en reliant la lumière à `image2`. La consigne demandait donc la lumière d’une « image 2 » absente. Le premier essai gardait en plus la fin de démonstration « maintain canny edge of interior glass orb ».

**Erreur de notre côté : oui.** Le défaut vient du template de janvier, mais la version corrigée existait et la consigne elle-même désigne l’image 2 ; je ne l’ai pas vérifié. Correction : la lumière sur `image2` pour les deux encodeurs, consigne par défaut seule, Lightning 4 pas, CFG 1, LoRA 1, graine 4242, mêmes images (Uttu, quai de nuit).

### Devis des nouveaux essais (annoncés avant la dépense)
- Vue tournante d’Uttu pour la planche, FLUX 3 Klein (graphe `suite-modifier`) : **≈ 4 crédits estimés**.
- n° 5, Ingredients avec la planche conforme, réglages du template : **≈ 15 crédits estimés**.
- n° 8, FastH3 0,4 MP, deux références, consigne structurée : **≈ 9 crédits estimés** ; H3 turbo du studio, mêmes entrées : **≈ 4 crédits estimés**.
- n° 7, Light Migration câblée sur `image2`, Lightning 4 pas : **≈ 4 crédits estimés**.

Total annoncé : **≈ 36 crédits estimés**.

Ajout à 22 h 25, avant dépense : le rendu n° 7 corrigé ressemble encore à l’ancien. Uttu est déjà éclairée en ambre sombre, comme le quai, donc il n’y a presque rien à migrer. Un essai témoin avec la référence de lumière officielle du template (`woman_with_sunbeam.jpg`, un rai de soleil orange sur fond sombre), même graphe corrigé : **≈ 3 crédits estimés**. Total annoncé : **≈ 39 crédits estimés**.

### Résultats de l’audit (facturation Comfy lue après chaque job, GPU × 0,27325)

| Job | Essai | GPU (s) | Crédits |
| --- | --- | --- | --- |
| `dc45fea8` | n° 7, Light Migration corrigée (lumière sur `image2`), Uttu + quai | 12,37 | 3,38 |
| `cf1fc7cd` | n° 7, témoin : Uttu + `woman_with_sunbeam.jpg` | 6,29 | 1,72 |
| `a895ef99` | n° 5, vue tournante d’Uttu (FLUX 3 Klein) pour la planche | 10,67 | 2,92 |
| `5ed8173c` | n° 5, Ingredients, planche conforme 1280×720 | 48,93 | 13,37 |
| `ddd54cb2` | n° 8, FastH3, deux références, consigne structurée, 864×480 | 28,47 | 7,78 |
| `97560f18` | n° 8, H3 R2V turbo du studio, mêmes entrées | 23,97 | 6,55 |

Total réel : **35,72 crédits** (≈ 39 annoncés). Le job `c6a969be` (Ingredients, cycle dans le graphe que j’avais modifié) a échoué à la validation, sans facturation. Aucun job annulé.

Planches avant / après, sur la box :
- n° 7 : `/workspace/top10/planche-audit-lumiere.png`. On y voit Uttu, la lumière du quai, l’ancien rendu en 4 pas, l’ancien rendu en 20 pas (lumière sur `image3`), puis le rendu corrigé avec le quai, la lumière officielle et le rendu corrigé avec cette lumière.
- n° 5 : `/workspace/top10/planche-audit-ingredients.png`. En haut, l’ancienne planche et ses images ; en bas, la nouvelle planche et ses images.
- n° 8 : `/workspace/top10/planche-audit-fasth3.png`. Quatre lignes : FastH3 avant, FastH3 avec deux références, H3 turbo avant, H3 turbo avec deux références.

### Verdicts

**n° 7, Light Migration — erreur de notre côté : oui. Intégré.** Avec la lumière sur `image2`, le rendu sur le quai ressemble à l’ancien (écart moyen identique). La cause n’est plus le câblage : la paire de test était faible, Uttu et le quai sont tous deux ambrés, il n’y avait rien à migrer. Le témoin avec la lumière officielle le prouve : un rai orange se pose sur le visage, le fond passe en froid, le visage et les fissures dorées restent ceux d’Uttu. Ajouté comme second modèle de « Changer la lumière » (`ret-lumiere-image`, « Copier la lumière d’une image ») : deux cases nommées, « Portrait » et « Lumière à copier », sans consigne. Devis 3 / 6, mesuré. Note pour l’agent Uttu : il faut une image de lumière qui contraste avec le portrait (direction, couleur), sinon le rendu change peu.

**n° 5, Ingredients — erreur de notre côté : oui, pour la planche. Pas intégré.** Avec la planche conforme, la mosaïque et le cadre noir de l’ancien essai disparaissent : Uttu apparaît sur le quai, avec les bittes d’amarrage et la corde. Mais trois faux titres s’affichent à l’écran. Ce défaut vient de l’outil : à CFG 1, la consigne négative n’a aucun effet. Essai suivant possible : ajouter « no on-screen text, no titles » dans la consigne positive. Note pour l’agent Uttu : une planche conforme est remplie bord à bord, avec des panneaux propres sur fond uni, une vue tournante du corps entier et un seul panneau de lieu.

**n° 8, FastH3 — erreur de notre côté : en partie. Pas intégré pour l’instant, à décider par JD.** À réglages équivalents (deux références, consigne structurée, 0,4 MP, 5 s, graine 4242) :
- FastH3 garde nettement mieux le lieu : corde, bittes et brume sont là.
- H3 turbo invente des immeubles, mais garde mieux les fissures dorées du visage.
- Coût : 7,78 crédits pour FastH3 contre 6,55 pour H3 turbo (+19 %). Avec deux références, H3 turbo passe aussi de 13,7 s à 24 s de GPU.

Là où FastH3 est meilleur :
- Fidélité au lieu dès qu’il y a plusieurs références.
- Pas de LoRA à charger.
- Jusqu’à 9 images de référence, plus des références vidéo et audio.

Note pour l’agent Uttu : FastH3 n’est bon qu’avec la consigne structurée (`subject_definitions`, `summary [reference generation]`, `retention_analysis`, `detailed_description`, `overall_soundscape`, `non_diegetic_music`).
