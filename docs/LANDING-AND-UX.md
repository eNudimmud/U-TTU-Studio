# Accueil — une appli, pas une brochure

Verrou du 2026-10-02, resserré le même jour. L’étoile cinéma est dans [CINEMA-STUDIO-BRIEF.md](CINEMA-STUDIO-BRIEF.md). Ici : le moins de mots possible.

## Décision — l’écran d’accueil

- **Décision :** `/` est un écran d’appli. Une ligne, trois pastilles, un bouton. Pas une page qui explique.
- **Décision :** la ligne est « Ton style, ta scène, la prise. » Look, Plateau et Take sont des pastilles : le nom, et le mot d’à côté (Ton style, Ta scène, La prise). Pas de paragraphe sous chaque geste.
- **Décision :** le geste principal est « Entrer dans le studio », vers `/studio`. Il est répété dans le bandeau à partir de 720 px. À côté du bouton : « Rien à payer. »
- **Décision :** pas de seconde section, pas de promesse, pas de mode d’emploi. Le portrait reste, légende « Référence du studio. »

## Décision — pas de jargon au premier plan

- **Décision :** l’accueil ne nomme pas les moteurs. Interdits dans le texte visible de `/` : Seedance, Comfy, fal, LoRA, Flux, Blender, Night City.
- **Décision :** la correspondance, pour la doc.

| Geste | Sur la pastille | Dans le shell, aujourd’hui | Nom technique, doc ou Expert |
| --- | --- | --- | --- |
| Look | Ton style | Créer, dépôt de photos | boucle photo, LoRA |
| Plateau | Ta scène | Sphère, fiches | préviz, plus tard |
| Take | La prise | pas branché | Seedance, plus tard, éteint |

- **Décision :** « Vente HOLD » reste une décision de doc. Le bandeau du shell dit « Rien à payer » et la date. L’accueil ne le répète qu’une fois, à côté du bouton.

## Décision — le studio

- **Décision :** `/studio` est l’appli. Il s’ouvre sur Créer. Le premier mot est « Dépose tes photos. » Le dépôt est le clic. La suite (« Former mon look ») dit qu’elle s’ouvre après. Le rappel « Avant un long entraînement » est replié : il ne précède pas le dépôt.
- **Décision :** les libellés du premier écran sont du français de tous les jours. LoRA, fal, Comfy, gate et PASS ne sont pas sur ce premier écran. Ils restent dans Expert, le rail, et les tiroirs.
- **Décision :** Créer reste le premier mode. Compte en fin de navigation. Pas de mur. Le mot-symbole ramène à Créer (`#creer`). « Accueil » ramène à `/`.
- **Décision :** `/#creer`, `/#compte` et les autres hash de mode reconduisent vers `/studio` avec le même hash. Les retours Clerk déjà posés continuent d’atterrir au bon endroit.

## Décision — accessibilité

- **Décision :** la page est en `fr-CH`. Lien d’évitement « Aller au contenu » → `#contenu`. Un seul `h1`. Les trois gestes sont une liste ordonnée.
- **Décision :** le bouton fait au moins 44 px de haut. Le focus visible reste l’anneau or. Pas de mouvement décoratif. `prefers-reduced-motion` coupe les transitions de boutons.
- **Décision :** le texte courant est clair sur le noir. L’or est réservé au mot accentué, aux numéros, et au premier filet.
- **Décision :** l’image a un texte de remplacement qui décrit le portrait.

## Décision — mobile d’abord

- **Décision :** en colonne, le portrait est court (plafonné), puis la ligne, les pastilles, le bouton. Le bouton tient dans le premier écran.
- **Décision :** sous 720 px, le bouton du bandeau est masqué. Le bouton principal passe en pleine largeur.
- **Décision :** à partir de 900 px, le portrait occupe la colonne de droite, sur la hauteur de l’écran. Les pastilles restent en trois colonnes.
- **Décision :** pas de défilement horizontal. Les gouttières suivent celles du shell (32 px sous 700 px).

## Décision — direction

- **Décision :** la page reprend [VISUAL-CANON.md](VISUAL-CANON.md). Fond `#0A0A0B`, surfaces `#111112`, filet bronze, or `#C4A574`, Syne et Manrope. Pas de dégradé cyan ou magenta.
- **Décision :** tutoiement, phrases courtes. Le symbole `iii` reste dans le pied.
- **Fait :** pas de formulaire de vente. Le contact est un `mailto:`.
- **Fait :** le portrait est `public/images/uttu-canon-portrait.webp`. Le tutoriel, dans Expert, garde « Pas un résultat d’entraînement. »
