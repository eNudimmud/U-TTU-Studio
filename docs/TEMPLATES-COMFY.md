# Templates Comfy — CAST, DÉCOR, PRISE

Choix dans le catalogue Comfy Cloud, le 8 octobre 2026. Aucun template n’a été lancé. Aucun `estimate_credits`, `dry_run`, `run_template`, `submit_workflow` ou `partner_generate`. Les nombres CAST et DÉCOR sont des **hypothèses**. Le nombre PRISE est une mesure déjà dans le dépôt.

Le tarif de référence du dépôt : 0,39 crédit par seconde de GPU, et 211 crédits ≈ 1 $, lu dans `COMFY_CLOUD` (`src/lib/comfy-stack.ts`), vérifié le 2026-09-24. Ce n’est pas le prix d’un template partenaire.

| Geste | Template | Pourquoi | Devis affiché | Plafond affiché | Nature |
| --- | --- | --- | --- | --- | --- |
| CAST, à partir d’un texte | `api_bfl_flux3_t2i` | Une image Flux.3. Le texte demande une planche : face, trois-quarts, profil, en pied, sans texte dans l’image. | 8 | 12 | Hypothèse |
| CAST, à partir de photos | `templates-character_sheet` | Une photo chargée, deux images (gros plan et en pied), puis un assemblage. Les photos en trop restent dans le coffre pour la prise. Autre piste, non retenue : `api_bfl_flux3_image_edit`, jusqu’à dix références. | 16 | 24 | Hypothèse |
| DÉCOR, à partir d’un texte | `api_bfl_flux3_t2i` | Une image de lieu, format cinéma, sans personne. | 8 | 12 | Hypothèse |
| DÉCOR, à partir d’une photo | `api_bfl_flux3_image_edit` | La photo du lieu entre, une image de décor sort. | 8 | 12 | Hypothèse |
| PRISE | `video_minimax_h3_r2v` (graphe `takeGraph`, profil `h3-4pas-5s-vertical`) | Déjà mesuré. Le bouton ouvre la feuille de confirmation. Rien ne part sans elle. | 4 | 6 | Mesure |

Dans cette version, « Créer le personnage » et « Créer le décor » n’envoient rien. Ils écrivent la fiche, avec `cout: null`. L’écran dit que le nombre est une hypothèse et qu’une mesure réelle le remplacera.

La formation LoRA n’est pas dans ce tableau : Comfy Cloud ne montre pas de nœud pour enregistrer un fichier entraîné. Le remplacement retenu est la planche de références, pas un entraînement.
