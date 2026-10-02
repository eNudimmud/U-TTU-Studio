# Accueil et doctrine d’interface

Verrou du 2026-10-02. L’étoile cinéma est dans [CINEMA-STUDIO-BRIEF.md](CINEMA-STUDIO-BRIEF.md). Ici : comment on la montre, et comment on parle.

## Décision — deux temps, puis un bouton

- **Décision :** la personne comprend en deux temps, sans mode d’emploi.
  1. Ce que c’est. Une phrase : ton style, ta scène, la prise. Le visage et la lumière restent.
  2. Comment. Trois gestes, dans l’ordre : Look, Plateau, Take.
- **Décision :** un seul appel à l’action, répété, jamais un tarif. Le libellé est « Entrer dans le studio ». Il mène à `/studio`, qui s’ouvre sur Créer.
- **Décision :** la promesse tenue à l’écran est courte. On te reconnaît d’un plan à l’autre. Elle ne promet pas un film déjà rendu : Take n’est pas branché.

## Décision — pas de jargon au premier plan

- **Décision :** l’accueil ne nomme pas les moteurs. Interdits dans le texte visible de `/` : Seedance, Comfy, fal, LoRA, Flux, Blender, Night City.
- **Décision :** la correspondance publique est celle-ci.

| Geste | Dit juste à côté | Dans le shell, aujourd’hui | Nom technique, doc ou Expert seulement |
| --- | --- | --- | --- |
| Look | Ton style | Créer, puis Identité | boucle photo, LoRA |
| Plateau | Ta scène | Sphère, fiches, `scenes/` | préviz Blender bureau, plus tard |
| Take | La prise | pas de burn | Seedance cloud, plus tard, éteint |

- **Décision :** le shell garde ses mots de travail (Créer, gate, repli Expert). On ne les efface pas. On ne les met pas sur l’accueil.
- **Décision :** « Vente HOLD » reste dans le bandeau du shell, pas dans le héros de l’accueil. L’accueil dit « Rien à payer. » et « Tu commences par ton style. »

## Décision — le chemin

- **Décision :** l’accueil est une page à part (`/`). Le shell est `/studio`. Plus net pour l’App Router qu’un studio replié sous le héros : Créer, le rail fal et Clerk ne partagent pas le premier écran.
- **Décision :** dans le shell, Créer reste le premier mode. Compte reste en fin de navigation. Pas de mur.
- **Décision :** le mot-symbole du shell ramène à Créer (`#creer`). Un lien « Accueil » ramène à `/`.
- **Décision :** `/#creer`, `/#compte` et les autres hash de mode reconduisent vers `/studio` avec le même hash. Les retours Clerk déjà posés en `NEXT_PUBLIC_CLERK_*_FALLBACK_REDIRECT_URL=/#compte` continuent d’atterrir au bon endroit. Les props Clerk du code pointent déjà vers `/studio#compte` et `/studio#creer`.
- **Fait :** le portrait du héros est la référence du studio (`public/images/uttu-canon-portrait.webp`). Légende d’accueil : « Référence du studio. Pas une image faite ici. » Le tutoriel, dans le tiroir Expert, garde la phrase du canon (« Pas un résultat d’entraînement. »).

## Décision — accessibilité

- **Décision :** la page est en `fr-CH`, avec le lien d’évitement déjà dans le layout (« Aller au contenu » → `#contenu`).
- **Décision :** un seul `h1`. Les trois gestes sont une liste ordonnée. Chaque section a un titre.
- **Décision :** le bouton et les liens font au moins 44 px de haut. Le focus visible reste l’anneau or déjà défini.
- **Décision :** le mouvement décoratif n’existe pas. Les transitions de boutons existantes s’éteignent avec `prefers-reduced-motion`.
- **Décision :** le texte courant est clair sur le noir (`--text` / `--muted`). L’or est réservé au surtitre, aux numéros et au mot accentué du titre, en grand.
- **Décision :** l’image a un texte de remplacement qui décrit le portrait, pas la promesse du produit.

## Décision — mobile d’abord

- **Décision :** en colonne, l’ordre est : titre, phrase, bouton, portrait, trois gestes, promesse, bouton. Le bouton du héros est au-dessus de la pliure, avant l’image.
- **Décision :** sous 720 px, le bouton du bandeau est masqué : la ligne ne tient pas à côté du mot-symbole. Le bouton du héros passe en pleine largeur.
- **Décision :** à partir de 900 px, le portrait se place à droite du titre. Les trois gestes passent côte à côte à partir de 800 px.
- **Décision :** pas de défilement horizontal. Les gouttières suivent celles du shell (32 px sous 700 px).

## Décision — direction

- **Décision :** la page reprend [VISUAL-CANON.md](VISUAL-CANON.md). Fond `#0A0A0B`, surfaces `#111112`, filet bronze, or `#C4A574`, Syne pour les titres, Manrope pour le texte. Pas de dégradé cyan ou magenta.
- **Décision :** tutoiement, phrases courtes. Le symbole `iii` reste dans le surtitre et le pied, pas comme un mystère à expliquer.
- **Fait :** la vente n’a pas de formulaire sur cette page. Le contact reste un `mailto:`.
