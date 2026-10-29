# Top 10 des workflows manquants — mesures du 29.10.2026

Demande de JD (29.10, 20:16, heure de Zurich) : « Tout le top 10, et enlève du studio les choses que ça remplace si c’est mieux ».
Budget accordé : environ 90 crédits Comfy pour les mesures, plafond 95.

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
