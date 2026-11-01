# Workflows Cinema Engine — sélection et qualification

Revue du 1er novembre 2026. Le catalogue demeure `docs/WORKFLOWS.md` et `workflows/index.json`. Le dossier de licences/soumission est dans [#219](https://github.com/eNudimmud/U-TTU-Studio/pull/219). Ce document ajoute les choix d'architecture ; il ne déclare aucun nouveau workflow testé.

## Décision P0

**Qwen3-VL 8B natif → opérations validées → image clé Klein → validation artistique → LTX-2.5 I2V d'une image → montage/export existants.** Qwen Image et FLUX.2 dev restent des alternatives conditionnelles, pas des retries automatiques. Conserver la méthode A de #217 (références propres équilibrées). Le modèle n'est sélectionné qu'après filtrage par capacités, admissibilité, qualification et coût applicable.

Pour la démo, pas de fal, nouveau fournisseur, Nano Banana, Kling, H3 Max ou Seedance. La présence de H3 natif dans le catalogue #220 ne doit pas être confondue avec H3 Max Partner ; elle ne change pas le pipeline LTX retenu ici. Ne pas demander une nouvelle interface de choix de pipeline : c'est une décision interne de l'agent, expliquée à la demande.

## Comparaison utile à la production

| Pipeline | Références, qualité et stabilité | Résolution / durée | Coût et latence | Licence, disponibilité, décision |
| --- | --- | --- | --- | --- |
| Qwen3-VL 8B conversationnel | Sortie JSON sans garantie de schéma ; validateurs obligatoires. Texte seul d'abord, vision ultérieure | Profil borné, sortie suffisante pour trois plans ; pas d'image imposée pour une commande | Non mesurés ; ≈ 1–3 crédits estimés dans l'étude Cursor, hypothèse à confirmer | Original Apache-2.0 [S2] ; template natif et fichiers rapportés disponibles dans #214. Candidat principal, aucun run réussi attesté ici |
| Qwen3.5-4B / 9B natif | Comparatif possible si qualité/coût du candidat l'exige ; ne pas confondre avec l'upsampler FLUX | Texte ; template officiel propose aussi image | Non mesurés | Original 4B Apache-2.0 [S3], exemple Cloud officiel [S4]. Pas de switch automatique |
| FLUX 3 Image Klein base | Multi-références intégrées ; garder rôles/équilibre et contrôle des planches. L'identité reste à juger | Studio 1/2 MP, 16:9 / 9:16 / 1:1, max effectif 7 images ; base 50 pas, CFG 3,5 | #215 rapporte ≈ 10–14 crédits estimés pour le profil image avec refs ; latence non mesurée par Astra | FLUX Kommunity [S5]. Intégré #209, image clé prioritaire |
| Qwen Image 2.1 édition | Références numérotées ; candidat pour édition locale ou alternative image clé, pas identité garantie | Profil Studio 1/2 MP, limites exactes du graphe à conserver | Registre : ≈ 2 crédits estimés pour historique 1024²/1 ref, borne 4. Ne pas extrapoler aux multiples refs | Qwen Research [S6], pas Apache présumé. Intégré ; usages/licence à qualifier pour le profil |
| FLUX.2 dev édition | Plusieurs références ; conditionnement global, risque de mélange malgré prompt | Tailles du builder #209, limite Studio non relevée | Un job rapporté : environ 128 s GPU / 35 crédits ; prix non confirmé, aucune comparaison contrôlée ici | Licence non commerciale du modèle [S7]. Intégré, pas défaut P0 sans preuve supérieure |
| LTX-2.5 I2V | Une image clé validée réduit la recomposition ; mouvement/continuité à contrôler | Profil existant 0,9 MP ; aperçu 0,4 MP ; 5 s retenues, 8/10 s possibles | Devis exact à récupérer ; file d'attente et calcul à mesurer séparément | Licence LTX-2.x [S8], support natif [S9]. Vidéo prioritaire |
| LTX-2.5 T2V | Atmosphère sans identité verrouillée ; insuffisant seul pour Enki/Fizz | Profil existant ; ne pas promettre le maximum de la fiche modèle dans l'app | Non remesuré | Même famille, intégré ; pas le chemin personnage P0 |
| SeedVR2 3B | Restauration générative : détails potentiellement altérés ; original + comparaison | Image ×2 ; profil vidéo 1080p existant | Registre : ≈ 2 crédits estimés image ; ≈ 42 crédits estimés pour 5 s/24 fps/1080p, borne 63. Re-devis requis | Original Apache-2.0, limites connues [S10]. Intégré et forcé par #220 ; option après P0 |
| Export navigateur | Assemblage déterministe, originaux conservés | 960×540, 12 fps, 800 kb/s vidéo, 128 kb/s audio, 60 s max | Pas de génération Comfy dans cet export ; temps/mémoire navigateur à éprouver | Existant ; épreuve annoncée, pas master inventé |

Les chiffres rapportés par le dépôt ne sont pas des benchmarks Astra. Aucun coût historique, solde ou estimation n'autorise une dépense. Afficher « ≈ X crédits estimés » avec provenance/date ; si non applicable, estimation indisponible. Les licences de chaque poids auxiliaire et de chaque repack doivent être reliées au manifeste, pas déduites de la famille.

## Conditions d'entrée dans la démo

Manifestes versionnés : source/commit du template, API graph hash, compilateur, nœuds, poids/licences, formats, durées, images/roles, sorties, disponibilité Cloud, coût/provenance/date, run IDs et verdict visuel. `candidate → validated → demo`, ou `retired`. Toute modification du graphe ou profil invalide la qualification correspondante.

Template UI et JSON API sont distincts : exporter les nœuds effectifs. Valider aussi les sous-graphes et upsamplers. L'allowlist se raccorde au registre et à #220 ; ne pas maintenir deux classifications manuelles divergentes. Épingler le graphe utilisé pendant la répétition.

Agent : partir de `llm_qwen3vl_text_gen`, confirmer le fichier conversationnel 8B exact (`qwen3vl_8b_fp8_scaled` indiqué par Cursor, suffixe/version à vérifier), `CLIPLoader → TextGenerate → PreviewAny`. Tester la sortie texte de l'historique et le mode sans image. Préparer un maximum de sortie initial adapté (par exemple 1600 tokens, à mesurer), faible température et JSON validé ; aucune chaîne de pensée à afficher. Ne pas réutiliser un encodeur de conditionnement MiniMax/FLUX comme cerveau d'agent.

La découverte/validation des nœuds doit rester sans soumission. Les appels de génération même textuelle sont payants : JD exécute sur la preview après accord de tranche. Une capacité publiée dans le catalogue ne prouve ni disponibilité sur le compte ni fiabilité du profil.

## Recherche AAA ciblée

| Domaine | Solution et avantage concret | Limites / qualification requise | Horizon |
| --- | --- | --- | --- |
| Références multiples / character consistency | Bindings + images clés Klein/Qwen + collections stables | Garantir les entrées ne garantit pas l'identité visuelle. Benchmark Enki/Fizz et générique | P0 puis P1 |
| Caméra, depth, pose | Qwen InstantX déjà intégré au plan cadré ; Wan2.2 Fun Control/Camera natifs [S11] | Vraies cartes de contrôle, licence et graphe exacts ; pas de reconstruction de l'ancienne prévis retirée sans accord | P1 |
| Animation / raccord | LTX-2.5 first/last et profils multi-shot officiels ; Wan2.2 first/last en comparaison | Préserver le milieu du mouvement, éviter une scène régénérée entre endpoints | P1 |
| Inpainting | Édition masquée d'une prise source, template natif disponible à sélectionner | Comparer hors masque et identité ; ne pas promettre invariance pixel par diffusion | P1 |
| Compositing | Masques/alpha + transforms + color matching autour d'assets validés | Occlusions, couleur et provenance ; privilégier opérations déterministes quand adaptées | P1 |
| Upscale/restauration | SeedVR2 existant ou resize déterministe | Détails inventés possibles ; jamais remplacer l'original | Option P0, qualification P1 |
| Interpolation | Graphe `fluidifier` existant, poids/nœud exact à inventorier | Pas d'interpolation entre deux coupes ; artefacts d'occlusion/mouvement à mesurer | P1 |
| Son et montage avancé | Stems, timebase, sous-titres, repères rythmiques, guides narratifs | Droits, alignement et encodage ; pas de fournisseur supplémentaire maintenant | P2 |
| Export master | Plan d'export versionné et originaux ; WebCodecs/encodage adapté à évaluer | Mémoire, codecs, audio, espace couleur, compatibilité mobile | P1/P2 |

Ne pas introduire Wan, de nouveaux contrôles ou un nouveau restaurateur dans la démo sans avantage mesuré. Aucun nouveau workflow n'entre uniquement parce qu'il est ambitieux.

## Sources primaires

- S1 — [Règlement](https://comfy.org/open-source-higgsfield) : Open Weights Only exclut Partner nodes et API fermées ; échéance 3 novembre 09:00 PT = 18:00 Zurich. Bonus FLUX exige FLUX 3 central, LTX exige LTX central.
- S2 — [Qwen3-VL-8B-Instruct](https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct) ; [template Comfy](https://github.com/Comfy-Org/workflow_templates/blob/main/templates/llm_qwen3vl_text_gen.json), à épingler dans le lot.
- S3 — [Qwen3.5-4B](https://huggingface.co/Qwen/Qwen3.5-4B).
- S4 — [Qwen3.5 natif Cloud](https://comfy.org/hub/workflows/qwen3-5-text-generation-aeb71e383642/).
- S5 — [FLUX 3 Image Klein Comfy](https://huggingface.co/black-forest-labs/flux-3-image-klein-comfy) et [source BFL](https://github.com/black-forest-labs/flux-3-image-klein/blob/main/README.md).
- S6 — [Qwen Image 2.1](https://huggingface.co/Qwen/Qwen-Image-2.1).
- S7 — [FLUX.2 dev](https://huggingface.co/black-forest-labs/FLUX.2-dev).
- S8 — [LTX-2.5 modèle/licence](https://huggingface.co/Lightricks/LTX-2.5).
- S9 — [LTX-2.5 natif](https://docs.comfy.org/tutorials/video/ltx/ltx-2-5).
- S10 — [SeedVR2-3B](https://huggingface.co/ByteDance-Seed/SeedVR2-3B).
- S11 — [Wan2.2 Fun natif](https://blog.comfy.org/p/comfyui-wan22-fun-inp-support) et [templates Comfy](https://huggingface.co/Comfy-Org/Wan-2.2/blob/main/README.md).
- S12 — [API Cloud](https://docs.comfy.org/development/cloud/overview). Isoler le transport, pas de migration massive v1/v2 avant gel.
