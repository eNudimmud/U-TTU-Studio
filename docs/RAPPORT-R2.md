# Rapport — un seul compte, galeries, Mon studio

8 octobre 2026. À relire sur l’aperçu. Pas de merge dans cette note.

## Fait

- Le second compte sort de l’interface et des catalogues FR, EN, DE, ES. Le HTML de `/studio` ne contient plus « Solde du compte fal », « Relier le compte fal », « Recharge ton compte fal », ni l’étiquette « fal : pas connecté ».
- Le graphe client (`studio-session`, `stage-screens`, `atelier-page`) n’importe plus ces chemins. Les fichiers historiques restent sur le disque, non branchés : `src/lib/fal/`, `src/lib/lora/`, `studio-context.tsx`, `sheets.tsx`, `studio-drawer.tsx`, les écrans de formation, `workers/fal-proxy/`, `scripts/fal-smoke.mjs`.
- CAST : « Décris ton personnage » ou « À partir de tes photos » (2, 3 au plus). Devis avant le geste. Bouton « Créer le personnage · environ N crédits ». La galerie a de grandes cartes, le statut Prêt, renommer, dupliquer, supprimer, copier vers un autre projet.
- DÉCOR : un texte, des suggestions, ou une photo. Les exemples maison sont dans `public/exemples/` (`.webp`, `statut: maison`). Sur ordinateur ils sont à côté du formulaire. Un clic remplit le texte.
- « Créer » envoie le rendu sur le compte Comfy du visiteur, après la feuille de confirmation. Sans compte, le bouton est éteint. L’image revient dans la galerie et dans Mon studio. Le coût réel s’écrit quand il est connu.
- PRISE choisit dans ces galeries. Le devis mesuré ne change pas : environ 4 crédits, plafond 6, profil `h3-4pas-5s-vertical`.
- `/mon-studio` classe par projet, puis personnages, lieux, prises, séquences et notes. Recherche, filtre, ouverture, réutilisation d’un geste. « Relier mon coffre Obsidian » utilise la File System Access API. Sans elle, la page le dit, et propose l’export ZIP et l’import.
- `npm test`, `tsc --noEmit` et `npm run build` passent. 0 crédit : `estimate_credits`, `dry_run`, `run_template`, `submit_workflow` et `partner_generate` n’ont pas été appelés.

## Limites

- « Créer » demande l’image au compte du visiteur. Cette vérification n’envoie aucun job : le client est simulé.
- Sans image revenue, la fiche n’est pas écrite. Une carte sans image montre une icône, pas une lettre.
- La formation d’un fichier n’a pas d’équivalent enregistrable (pas de nœud pour sauver un LoRA dans le catalogue consulté). Elle est retirée de l’écran. Le remplacement est la planche de références, pas un entraînement.
- Le dossier Obsidian se relie sur Chrome et Edge, ordinateur. Safari, Firefox et le téléphone restent sur IndexedDB, ZIP, ou import d’un dossier. Les chemins de plus de quatre segments ne sont pas repris.
- `?demo=1` montre des exemples. Ils ne sont pas écrits dans le coffre et ne lancent rien.
- EN, DE et ES sont à `_human: native_open`.
- Un `rg -i fal` brut sur tout le build rencontre encore des mots d’autres bibliothèques (`Falling`, `falsch`, `faltan`, `fallido`) et l’échappement `\xfa` de « última ». Le mot isolé `fal`, `fal.ai` et les phrases du second compte n’y sont pas.

## Template et coût estimé

| Geste | Template | Environ | Plafond | Nature |
| --- | --- | --- | --- | --- |
| CAST, texte | `api_nano_banana_2_1_t2i` | 12 | 18 | Hypothèse |
| CAST, photos | `templates-character_sheet` | 24 | 36 | Hypothèse, 12 par image |
| DÉCOR, texte | `api_nano_banana_2_1_t2i` | 12 | 18 | Hypothèse |
| DÉCOR, photo | `api_nano_banana_2_1_image_edit` | 12 | 18 | Hypothèse |
| PRISE | `video_minimax_h3_r2v`, profil `h3-4pas-5s-vertical` | 4 | 6 | Mesure déjà au dépôt |

Détail : `docs/TEMPLATES-COMFY.md`.
