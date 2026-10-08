# Templates Comfy — CAST, DÉCOR, PRISE

Choix dans le catalogue Comfy Cloud, le 8 octobre 2026. Aucun template n’a été lancé. Aucun `estimate_credits`, `dry_run`, `run_template`, `submit_workflow` ou `partner_generate`. Les nombres CAST et DÉCOR sont des **hypothèses**. Le nombre PRISE est une mesure déjà dans le dépôt.

Le tarif de référence du dépôt : 0,39 crédit par seconde de GPU, et 211 crédits ≈ 1 $, lu dans `COMFY_CLOUD` (`src/lib/comfy-stack.ts`), vérifié le 2026-09-24. Ce n’est pas le prix d’un template partenaire.

| Geste | Template | Pourquoi | Devis affiché | Plafond affiché | Nature |
| --- | --- | --- | --- | --- | --- |
| CAST, à partir d’un texte | `api_nano_banana_2_1_t2i` | Une image Nano Banana 2.1. Le texte demande une planche : face, trois-quarts, profil, en pied. Environ 12 crédits par image. | 12 | 18 | Hypothèse |
| CAST, à partir de photos | `templates-character_sheet` | La planche de vues : une photo, deux images (visage et corps), puis un assemblage. Deux images, donc 24. Les photos en trop restent à côté de la fiche. | 24 | 36 | Hypothèse |
| DÉCOR, à partir d’un texte | `api_nano_banana_2_1_t2i` | Une image de lieu, 16:9, sans personne. | 12 | 18 | Hypothèse |
| DÉCOR, à partir d’une photo | `api_nano_banana_2_1_image_edit` | La photo du lieu entre, une image de décor sort. | 12 | 18 | Hypothèse |
| PRISE | `video_minimax_h3_r2v` (graphe `takeGraph`, profil `h3-4pas-5s-vertical`) | Déjà mesuré. Le bouton ouvre la feuille de confirmation. Rien ne part sans elle. | 4 | 6 | Mesure |
| Voix, depuis MONTAGE | `api_elevenlabs_v4_text_to_speech` | Note de chaîne, 2026-10-08 : 24,14 crédits pour 1 000 caractères. Le bouton « Créer » reste éteint. Rien n’est lancé. | environ 24,1 / 1 000 car. | plafond × 1,5 | Hypothèse |
| Effet sonore, depuis MONTAGE | `api_elevenlabs_text_to_sound_effects` | Note de chaîne, 2026-10-08 : 29,54 crédits par minute. L’écran montre 5 secondes. Le bouton « Créer » reste éteint. | environ 29,5 / min | plafond × 1,5 | Hypothèse |

« Créer » part sur le compte Comfy du visiteur, par le même client que la prise (clé, proxy, feuille de confirmation). Le bouton reste éteint sans compte, ou si le solde ne couvre pas le plafond. Le coût réel, lu sur deux soldes, s’écrit dans la fiche quand il est connu. Sans image, rien n’est rangé.

La formation LoRA n’est pas dans ce tableau : Comfy Cloud ne montre pas de nœud pour enregistrer un fichier entraîné. Le remplacement retenu est la planche de références, pas un entraînement.
