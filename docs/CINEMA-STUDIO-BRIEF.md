# Cinéma — Look, Plateau, Take

Verrou produit JD, 2026-10-02. Registre de vérité : chaque ligne est un **fait**, une **hypothèse**, une **proposition** ou une **décision**.

Ce document fixe l’étoile du nord. Il n’ouvre aucun appel payant, aucune route fal nouvelle, aucun rendu vidéo.

## Décision — l’étoile

- **Décision JD (2026-10-02) :** le studio se raconte en trois gestes, dans cet ordre. **Look**, puis **Plateau**, puis **Take**.
- **Look** : ce qui ne change pas. Le visage, la lumière, l’allure. À l’écran, en français clair : « Ton style ».
- **Plateau** : la scène, avant la prise. Le lieu, les angles, le cadre. À l’écran : « Ta scène ».
- **Take** : la prise. Un plan qui continue les autres. À l’écran : « La prise ».
- **Décision :** l’accueil (`/`) montre cette étoile, sans nom de moteur. Le shell de travail est derrière, sur `/studio`. Il s’ouvre sur Ton style (Look). La boucle photo vit dans Look. Elle n’est pas tout le produit.
- **Décision inchangée :** vente HOLD. Pas de Stripe. Pas de mur de compte devant Ton style.

## Fait — ce qui existe déjà

- **Fait :** la phase 0 ferme une boucle photo. Deux ou trois photos, un lot de quinze, une LoRA, une ou plusieurs images fixes. Le rail fal est le chemin principal quand le proxy est branché. Comfy Cloud reste le repli, plié sous « Expert ». Détail : [FAL-SPIKE.md](FAL-SPIKE.md), [COMFY-STACK.md](COMFY-STACK.md).
- **Fait :** deux apps Comfy sont au catalogue (« Former mon look », « Tester un prompt »). Le coffre Obsidian local existe ([VAULT.md](VAULT.md)). Sphère tient des fiches de lieu, sans rendu vidéo. Clerk ouvre Compte sans bloquer Créer ([AUTH.md](AUTH.md)).
- **Fait :** ce dépôt n’appelle pas Seedance. Il n’embarque pas Blender. Il ne contient pas de décor « Night City ». Le verrou du 2026-10-02 n’ajoute aucune route fal.
- **Fait :** la direction artistique reste celle de [VISUAL-CANON.md](VISUAL-CANON.md). Noir, anthracite, bronze, or ancien. Pas de bleu néon.

## Décision — tourner dans un monde

- **Décision JD (2026-10-02, suite) :** le sommet est de tourner dans un monde virtuel créé. Look, Plateau et Take ne sont pas une coquille autour de la photo. Le chemin du tournage est : le monde, le look tenu, puis une prise courte.
- **Décision :** Plateau est l’endroit où le monde arrive. L’artiste le construit à son bureau, en préviz Blender, puis le dépose : images fixes, suite d’images, notes d’angles. Le studio ne lance pas Blender et n’ouvre pas un fichier `.blend`.
- **Décision :** Take est le tournage dans ce monde. Plus tard, dans le cloud (Seedance, ou un chemin équivalent), à partir de cette préviz et du look tenu. Ce n’est pas une boîte texte-vers-vidéo. Dans cette livraison le bouton ne lance rien : il note un plan sur l’appareil, une fois le monde posé et le look tenu.
- **Décision :** le shell montre trois gestes — Ton style, Ta scène, La prise. Une ligne reste visible : « Le monde, le look tenu, puis une prise courte. » Les noms Blender et Seedance sont dans l’aide, pas sur les boutons. Sphère, Identité, Bibliothèque, Studio et Compte restent à côté.
- **Décision :** `#creer` ouvre Ton style, pour les retours Clerk. `#compte` ouvre Compte. L’accueil entre par `/studio?step=look`.
- **Fait :** Plateau et Take n’envoient rien. Aucune route fal nouvelle. Aucun burn vidéo. 0 $.

## Décision — ce que v0 ne fait pas

- **Décision :** pas de Blender dans le navigateur. La préviz se prépare dans Blender, sur le bureau, puis s’exporte. Le studio web ne lance pas Blender et n’ouvre pas un fichier `.blend`.
- **Décision :** Take, plus tard, passe par Seedance dans le cloud. Ce n’est pas branché ici. Pas de nouvelle route fal. Pas de burn vidéo payant dans cette livraison.
- **Décision :** pas de Night City. Ni comme décor de démo, ni comme direction. Le canon visuel ne bascule pas vers une ville néon.
- **Décision :** la phase 0 ne s’interrompt pas. Fermer la boucle photo reste le geste qui marche dans Créer. Le cinéma ne le remplace pas : il le nomme comme le début de Look.
- **Décision inchangée :** les apps Comfy et le coffre restent. On ne les retire pas pour faire place au cinéma.

## Hypothèse — non mesurée

- **Hypothèse :** des images, une suite et des notes suffisent à porter une préviz Blender bureau dans Plateau, sans moteur 3D dans la page. Le détail des caméras n’est pas mesuré.
- **Hypothèse :** Seedance, appelé plus tard depuis le cloud, peut tenir le Look d’un plan à l’autre. Aucun appel n’a été fait. Coût, durée et fidélité sont inconnus. 0 $.
- **Hypothèse :** une personne comprend le produit avec Look, Plateau et Take, sans lire les noms des moteurs. La page d’accueil sert à le vérifier.

## Proposition — suite, hors de cette livraison

- **Décision :** le dépôt Plateau existe, sur l’appareil (lieu, images, suites, notes), à côté des fiches Sphère. Le contrat fin d’export Blender (quelles caméras, quels fichiers) n’est pas figé. Le dépôt n’ouvre pas Blender.
- **Proposition :** un bouton Take qui lance un tournage reste éteint tant qu’une route Seedance n’est pas décidée à part, avec un coût affiché et un second clic. Noter un plan sur l’appareil n’est pas ce lancement.
- **Proposition :** les noms Seedance, Comfy, fal et LoRA restent dans la doc et dans le repli Expert. L’accueil dit Look, Plateau, Take, Ton style, Ta scène, La prise.

## Cette livraison

- **Décision :** l’accueil est `/`. Le shell est `/studio`, et le produit à l’écran est Look, Plateau, Take. L’accueil entre sur Ton style (`/studio?step=look`). Les anciens liens `/#creer` et `/#compte` rejoignent `/studio` avec le même hash : `#creer` ouvre Ton style, `#compte` ouvre Compte.
- **Fait :** Plateau garde le monde sur cet appareil. Take montre la chaîne et refuse le tournage. Aucun crédit dépensé, aucun appel Seedance, aucune route fal nouvelle.
- **Décision de ton :** le détail d’interface est dans [LANDING-AND-UX.md](LANDING-AND-UX.md).
