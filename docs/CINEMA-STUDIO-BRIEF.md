# Cinéma — Look, Plateau, Take

Verrou produit JD, 2026-10-02. Registre de vérité : chaque ligne est un **fait**, une **hypothèse**, une **proposition** ou une **décision**.

Ce document fixe l’étoile du nord. Il n’ouvre aucun appel payant, aucune route fal nouvelle, aucun rendu vidéo.

## Décision — l’étoile

- **Décision JD (2026-10-02) :** le studio se raconte en trois gestes, dans cet ordre. **Look**, puis **Plateau**, puis **Take**.
- **Look** : ce qui ne change pas. Le visage, la lumière, l’allure. À l’écran, en français clair : « Ton style ».
- **Plateau** : la scène, avant la prise. Le lieu, les angles, le cadre. À l’écran : « Ta scène ».
- **Take** : la prise. Un plan qui continue les autres. À l’écran : « La prise ».
- **Décision :** l’accueil (`/`) montre cette étoile, sans nom de moteur. Le shell de travail est derrière, sur `/studio`. Il s’ouvre toujours sur Créer. La doctrine create-first ne bouge pas une fois dedans.
- **Décision inchangée :** vente HOLD. Pas de Stripe. Pas de mur de compte devant Créer.

## Fait — ce qui existe déjà

- **Fait :** la phase 0 ferme une boucle photo. Deux ou trois photos, un lot de quinze, une LoRA, une ou plusieurs images fixes. Le rail fal est le chemin principal quand le proxy est branché. Comfy Cloud reste le repli, plié sous « Expert ». Détail : [FAL-SPIKE.md](FAL-SPIKE.md), [COMFY-STACK.md](COMFY-STACK.md).
- **Fait :** deux apps Comfy sont au catalogue (« Former mon look », « Tester un prompt »). Le coffre Obsidian local existe ([VAULT.md](VAULT.md)). Sphère tient des fiches de lieu, sans rendu vidéo. Clerk ouvre Compte sans bloquer Créer ([AUTH.md](AUTH.md)).
- **Fait :** ce dépôt n’appelle pas Seedance. Il n’embarque pas Blender. Il ne contient pas de décor « Night City ». Le verrou du 2026-10-02 n’ajoute aucune route fal.
- **Fait :** la direction artistique reste celle de [VISUAL-CANON.md](VISUAL-CANON.md). Noir, anthracite, bronze, or ancien. Pas de bleu néon.

## Décision — ce que v0 ne fait pas

- **Décision :** pas de Blender dans le navigateur. La préviz se prépare dans Blender, sur le bureau, puis s’exporte. Le studio web ne lance pas Blender et n’ouvre pas un fichier `.blend`.
- **Décision :** Take, plus tard, passe par Seedance dans le cloud. Ce n’est pas branché ici. Pas de nouvelle route fal. Pas de burn vidéo payant dans cette livraison.
- **Décision :** pas de Night City. Ni comme décor de démo, ni comme direction. Le canon visuel ne bascule pas vers une ville néon.
- **Décision :** la phase 0 ne s’interrompt pas. Fermer la boucle photo reste le geste qui marche dans Créer. Le cinéma ne le remplace pas : il le nomme comme le début de Look.
- **Décision inchangée :** les apps Comfy et le coffre restent. On ne les retire pas pour faire place au cinéma.

## Hypothèse — non mesurée

- **Hypothèse :** un export de préviz depuis Blender bureau suffit pour alimenter Plateau, sans moteur 3D dans la page. Le format (quelles images, quelles caméras, quelles notes) n’est pas choisi.
- **Hypothèse :** Seedance, appelé plus tard depuis le cloud, peut tenir le Look d’un plan à l’autre. Aucun appel n’a été fait. Coût, durée et fidélité sont inconnus. 0 $.
- **Hypothèse :** une personne comprend le produit avec Look, Plateau et Take, sans lire les noms des moteurs. La page d’accueil sert à le vérifier.

## Proposition — suite, hors de cette livraison

- **Proposition :** figer le contrat d’export Blender avant d’écrire un dépôt Plateau. Jusque-là, les fiches Sphère et `scenes/` restent le lieu de la scène.
- **Proposition :** un bouton Take reste éteint tant qu’une route Seedance n’est pas décidée à part, avec un coût affiché et un second clic. Pas dans le même changement que l’accueil.
- **Proposition :** les noms Seedance, Comfy, fal et LoRA restent dans la doc et dans le repli Expert. L’accueil dit Look, Plateau, Take, Ton style, Ta scène, La prise.

## Cette livraison

- **Décision :** l’accueil est `/`. Le shell est `/studio`. Les anciens liens `/#creer` et `/#compte` rejoignent `/studio` avec le même hash, pour que le retour Clerk continue d’ouvrir Créer ou Compte.
- **Fait :** aucun crédit dépensé, aucun appel Seedance, aucune route fal nouvelle.
- **Décision de ton :** le détail d’interface est dans [LANDING-AND-UX.md](LANDING-AND-UX.md).
