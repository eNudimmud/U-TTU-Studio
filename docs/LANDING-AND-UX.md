# Accueil — une appli, pas une brochure

Verrou du 2026-10-02, resserré le même jour. L’étoile cinéma est dans [CINEMA-STUDIO-BRIEF.md](CINEMA-STUDIO-BRIEF.md). Ici : le moins de mots possible.

## Décision — l’écran d’accueil

- **Décision :** `/` est un écran d’appli. Une ligne, trois pastilles, un bouton. Pas une page qui explique.
- **Décision :** la ligne est « Ton style, ta scène, la prise. » Look, Plateau et Take sont des pastilles : le nom, et le mot d’à côté (Ton style, Ta scène, La prise). Pas de paragraphe sous chaque geste.
- **Décision :** le geste principal est « Entrer dans le studio », vers `/studio?step=look`. Il s’ouvre sur Ton style. Il est répété dans le bandeau à partir de 720 px. À côté du bouton : « Rien à payer. »
- **Décision :** pas de seconde section, pas de promesse, pas de mode d’emploi. Le portrait reste, légende « Référence du studio. »

## Décision — pas de jargon au premier plan

- **Décision :** l’accueil ne nomme pas les moteurs. Interdits dans le texte visible de `/` : Seedance, Comfy, fal, LoRA, Flux, Blender, Night City.
- **Décision :** la correspondance, pour la doc.

| Geste | Sur la pastille | Dans le shell, aujourd’hui | Nom technique, doc ou aide seulement |
| --- | --- | --- | --- |
| Look | Ton style | Ton style : planche contact, carte du look, « Poser le monde » | boucle photo, LoRA |
| Plateau | Ta scène | Ta scène : le monde, images, suites, notes | préviz Blender, sur le bureau |
| Take | La prise | Look tenu et monde posé : un bouton charge la page ici et y écrit le plan. Les images partent si le compte les accepte. Le plein onglet n’a pas ce brief. Le tournage payant ne part pas tout seul | MiniMax H3 R2V (`video_minimax_h3_r2v`), texte au nœud 138, images 137 et 139 après `/api/assets` ; LoRA au nœud 145 à la main ; Seedance plus tard |

- **Décision :** le shell parle d’abord Ton style, Ta scène, La prise. Blender et Seedance restent dans l’aide de Ta scène et de La prise, pas sur les boutons. On ne les met pas sur l’accueil.
- **Décision :** « Vente HOLD » reste une décision de doc. Le menu « Plus » du shell dit « Rien à payer ici » et la date. L’accueil ne le répète qu’une fois, à côté du bouton.

## Décision — l’app, 3 octobre 2026

- **Décision :** `/studio` a une seule barre. À gauche le mot-symbole, au centre la chaîne 01 Ton style · 02 Ta scène · 03 La prise, avec la marque « Tenu », « Posé » ou « Prête ». À droite : « Crédits », « Sphère », « Plus ». Sous 760 px, la chaîne devient une barre d’onglets en bas de l’écran. Pas de pied de page.
- **Décision :** Sphère est l’étagère des images et des prises, pas un second produit. Identité, Bibliothèque, Studio et Compte vivent dans « Plus ». Les noms anglais des pas ne sont plus dans la page.
- **Décision :** Ton style est une fiche de casting : les photos en planche contact, une carte avec la première photo, le mot d’appel en grand, les traits en pastilles, les quatre marques du look et « Noté dans CANON.md ». Un seul bouton plein : « Poser le monde ». Les 15 images, Former mon look et Expert sont dans « Aller plus loin ».
- **Décision :** `/manifest.webmanifest` rend le studio installable, plein écran, ouvert sur `/studio?step=look`.

## Décision — le studio

- **Décision :** `/studio` est l’appli. Il s’ouvre sur Ton style. Le premier mot est « Dépose tes photos. » Le dépôt est le clic. Le statut « Look tenu » est sur cet écran. La suite dit qu’elle s’ouvre après. Le rappel « Avant un long entraînement » est replié : il ne précède pas le dépôt.
- **Décision :** les libellés du premier écran sont du français de tous les jours. LoRA, fal, Comfy, gate et PASS ne sont pas sur ce premier écran. Ils restent dans Expert, le rail, et les tiroirs.
- **Décision :** trois gestes d’abord : Ton style, Ta scène, La prise. Ta scène reçoit le monde (images, suites, notes). La prise montre monde → look tenu → prise courte, et charge la page du tournage quand les deux sont prêts. Rien n’est envoyé avant le lancement dans le cadre. Compte est dans « Plus ». Pas de mur.
- **Décision :** le mot-symbole ramène à Ton style (`#look`). `#creer` ouvre la même surface. « Accueil » ramène à `/`.
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
