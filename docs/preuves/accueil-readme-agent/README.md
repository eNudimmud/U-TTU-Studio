# Accueil, README et Uttu — preuves (29.10.2026)

Serveur de dev local (`node scripts/dev.mjs`), branche `studio/accueil-readme-agent`, sans compte Comfy relié, aucun crédit dépensé.

| Capture | Tailles | Débordement horizontal | Cibles < 44 px |
|---|---|---|---|
| `accueil-fr-*` (+ `-full` page entière) | 390×844, 844×390, 1024×600, 1280×800 | aucun | seul le lien d’évitement « Aller au contenu » (1×1 px, masqué hors focus) |
| `accueil-en-*` | mêmes tailles | aucun | idem (« Skip to content ») |
| `uttu-fr-*`, `uttu-en-*` : studio, « Demander à Uttu » ouvert, question « Quel outil choisir ? » | mêmes tailles | aucun | aucune dans le panneau ; « Fermer l’assistant » 44×44 |

`avant-accueil-fr-844x390*.jpg` : l’accueil sur main avant ce changement, où FINALISER était coupé à droite de « Comment ça marche » en 844×390. Après : les cinq étapes tiennent sur une ligne.

Sans compte relié, Uttu invite à relier Comfy (≈ 0,2 crédit estimé par message au plus, calculé par `perMessageCeiling`) ; la réponse du modèle n’est donc pas filmée ici.
