# Coûts réels du 27.10.2026 (test visiteur et lot d'exemples)

Source : activité de facturation Comfy Cloud (`get_billing_activity`, lecture seule) et graphe de chaque job (`get_job_status` avec `include_workflow`). Aucun crédit dépensé pour ce relevé.

Méthode : job GPU = `gpu_seconds × 0,001295 $/s × 211 crédits/$` (soit 0,27325 crédit par seconde, rtx_pro_6000, méthode F26). Job partenaire (API) = `credits_used` facturé. Le geste est identifié par le `filename_prefix` et les nœuds du graphe envoyé.

Fenêtre du test visiteur : 27.10.2026, 05:52 → 14:17 UTC (06:52 → 15:17, heure de Zurich). Total facturé dans la fenêtre : 756,35 crédits (le solde est passé de 4 906 à 4 149, soit 757). Le lot d'exemples (00:35 → 00:47 UTC) a coûté 40,19 crédits.

Règle du registre : `credits` = mesure arrondie, `high` = 1,5 × la mesure, arrondi au-dessus.

| Geste | Ancien devis (crédits / plafond, nature) | Coût réel (crédits) | Pour | Job | Source |
|---|---|---|---|---|---|
| `cast-photos` | 4 / 6, hypothese | **3,57** → 4 / 6 | Klein édition, 1 photo, 1 MP | `f704495a` | test visiteur |
| `decor-heure` | 4 / 6, hypothese | **4,42** → 4 / 7 | Klein édition 16:9 (lot exemples ; 2e run fa472751 : 3,19) | `ca924213` | lot d'exemples (journal du lot, PR #141) |
| `prise-plan` | 14 / 28, hypothese | **15,1** → 15 / 23 | 5 s 16:9 0,9 MP, première image Klein incluse (bab714ce : 14,66 ; 82d63ed9 : 14,55) | `d4d2fa37` | test visiteur |
| `prise-raccord` | 12 / 25, hypothese | **6,98** → 7 / 11 | 5 s 1280×720 | `e89d94be` | test visiteur |
| `prise-elargir` | 15 / 30, hypothese | **16,32** → 16 / 25 | prise de 5 s élargie | `38d04073` | test visiteur |
| `prise-effacer` | 25 / 38, hypothese | **25,11** → 25 / 38 | 5 s 1280×704 | `414e91bc` | test visiteur |
| `prise-volume-objet` | 17 / 34, hypothese | **16,65** → 17 / 25 | Trellis2, 1 objet | `8653fbd3` | test visiteur |
| `suite-modifier` | 4 / 6, hypothese | **3,81** → 4 / 6 | Klein édition 1 MP (4e7167a7 : 3,37 ; dfa1f0bb : 3,06) | `14bd97c6` | lot exemples + test |
| `suite-finaliser-image` | 2 / 4, hypothese | **1,56** → 2 / 3 | SeedVR2, 1 image | `efe8fc8e` | test visiteur |
| `suite-detourer` | 2 / 4, hypothese | **0,58** → 1 / 1 | BiRefNet, 1 image (5c8bb7c1 : 0,29) | `e7f5f0af` | facturation 27.10 (03:35 UTC, hors fenêtre du test) |
| `suite-elargir` | 2 / 4, hypothese | **5,18** → 5 / 8 | Klein extend 1,5 MP (2b32b187 : 3,61 ; ac0c40b9 : 1,18) | `79105d4e` | facturation 27.10 (03:40 UTC, hors fenêtre du test) |
| `suite-finaliser-video` | 27 / 40, hypothese | **27,5** → 28 / 42 | 5 s 832×480 → 1872×1080, 1 bloc | `414d76ab` | test visiteur |
| `suite-fluidifier` | 2 / 4, hypothese | **2,01** → 2 / 4 | 5,2 s 864×480, ×2 images/s, 1 bloc | `9bf02d99` | test visiteur |
| `suite-prolonger` | 6 / 12, hypothese | **6,11** → 6 / 10 | 5 s 0,4 MP | `1ba17b95` | test visiteur |
| `suite-parler` | 8 / 16, hypothese | **8,09** → 8 / 13 | 5 s 1280×720 | `804f983f` | test visiteur |
| `outil-img-klein` | 4 / 6, hypothese | **3,49** → 3 / 6 | 16:9 1 MP (f3758996 : 3,12) | `4c096c0d` | test visiteur |
| `outil-img-qwen` | 4 / 8, hypothese | **3,0** → 3 / 5 | 16:9 1 MP | `97dffff3` | test visiteur |
| `outil-img-flux3` | 14 / 21, hypothese | **14,48** → 14 / 22 | API, 1 image | `338e614b` | test visiteur |
| `outil-img-ideogram` | 18 / 27, hypothese | **18,1** → 18 / 28 | API, 1 image | `02bbd0d4` | test visiteur |
| `outil-img-gpt` | 5 / 8, hypothese | **1,26** → 1 / 2 | API, 1 image | `ff433a2a` | test visiteur |
| `outil-img-seedream` | 9 / 14, hypothese | **9,5** → 10 / 15 | API, 1 image | `f8d6b6d4` | test visiteur |
| `outil-img-refs` | 4 / 8, hypothese | **2,01** → 2 / 4 | 1024×1024, 1 référence | `2ac9e65b` | test visiteur |
| `outil-vid-texte` | 12 / 25, hypothese | **4,72** → 5 / 8 | 5 s 16:9 0,9 MP | `b782b20d` | test visiteur |
| `outil-vid-wan` | 12 / 25, hypothese | **8,44** → 8 / 13 | 5 s 832×480 (lot exemples ; 261e9e69 : 6,32) | `c8d97094` | lot exemples + test |
| `outil-vid-vidu` | 100 / 150, hypothese | **100,23** → 100 / 151 | API, 1 clip | `11703345` | test visiteur |
| `outil-vid-mouvement` | 15 / 30, hypothese | **16,59** → 17 / 25 | 81 images 482×854 | `6ad03f2c` | test visiteur |
| `outil-vid-detourer` | 55 / 83, hypothese | **63,3** → 63 / 95 | API, 1 clip | `74567076` | test visiteur |
| `outil-son-voix-ouverte` | 2 / 4, hypothese | **2,8** → 3 / 5 | 1 phrase | `6aba380e` | test visiteur |
| `outil-son-dialogue` | 3 / 6, hypothese | **3,57** → 4 / 6 | API 2,39 + GPU 1,18 | `23c3206b` | test visiteur |
| `outil-son-musique-ouverte` | 4 / 8, hypothese | **3,37** → 3 / 6 | 30 s | `a14b4cd4` | test visiteur |
| `outil-son-bruitage-ouvert` | 2 / 4, hypothese | **1,66** → 2 / 3 | 1 bruitage | `54ab5718` | test visiteur |

Déjà mesurés avant ce relevé et confirmés par le test : `outil-img-360` (job 09d3b886, 73,19 s GPU = 20,00 crédits), `outil-img-croquis` (job e6108bb3, 61,64 s = 16,84), `prise-plan-h3` (job fb09db80, 13,41 s = 3,66), `outil-vid-levres` (job d1b14669, sync-3, 277,57). Non modifiés.

## Pas mesurés

- `mont-musique` et `outil-son-musique-video` (Sonilo) : 18,99 crédits facturés à 08:43 UTC sans identifiant de job. On ne peut pas dire si c'était texte → musique ou vidéo → musique. Les deux restent « hypothese ».
- `prise-vidu` : même template que `outil-vid-vidu`, mais le job mesuré (11703345) vient de l'outil, pas de PRISE.
- Cadre 3D (InstantX, jobs e1ac3303, e90f0162, 39c28257, 79425bed : 3,50 à 4,54 crédits) : ce n'est pas une ligne du registre (devis `DECOR_PHOTO_QUOTE` dans `src/lib/creation/still.ts`).
- Tous les autres gestes : aucun job réel ce jour-là.

Hors studio, exclus : `app-proxy/openjutsu` (240 crédits, 04:47 UTC), `gpt-image-2.5-sunburst` (7,4) et `gpt-5-nano` (0,05) sans job ; jobs de mise au point 02:47 → 04:13 UTC (préfixes `ComfyUI`, `Qwen_image_2.1`, cadres Klein).
