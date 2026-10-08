# Rapport R4 — gestes, références, galerie, montage

Date : 2026-10-08. Prod lue : https://u-ttu-studio.vercel.app. Rien n’est mergé. 0 crédit : aucun `estimate_credits`, `dry_run`, `run_template`, `submit_workflow`, `partner_generate`.

## Fait

- La prod actuelle (avant ce tour) ouvre CAST, DÉCOR, PRISE, MONTAGE et Mon studio. HTTP 200 sur `/studio` et `/mon-studio`.
- Les exemples maison de `public/exemples` ne partent pas dans un slot image : un clic ne faisait que remplir le nom et le texte.
- La galerie recadre les vignettes (`object-fit: cover`, hauteur max). Une planche multi-vues y est coupée.
- Le montage R3 a le lecteur, la timeline, scinder, supprimer, annuler et l’export MP4. Il n’a pas de chutier, ni de barre liée au plan sélectionné, ni d’aide de raccourcis visible.
- Ce tour ajoute le registre `src/lib/workflows/registre.ts`. Chaque geste cite un template du catalogue officiel. Le détail est dans `docs/WORKFLOWS.md`.
- CAST et DÉCOR ont une zone de références (dépôt, appareil photo, galerie) avec un rôle : visage, tenue, style, lieu. Les fichiers partent dans les slots `image_1`…`image_3` du graphe déjà écrit (photo personnage, photo lieu, planche, texte).
- Un clic sur un exemple charge la photo maison comme référence et le geste. L’après manquant dit « Exemple à venir ». La commande de rendus est `public/exemples/A-GENERER.json`.
- Une galerie d’assets par projet : filtres, recherche, compteur, vue détail, actions, sélection, glisser vers les références. Import d’images, vidéos et sons. Actualiser remonte un fichier déposé sans fiche. Le ZIP accepte `Sons/` et `Assets/`.
- Le montage ajoute le chutier, la barre du plan (scinder, dupliquer, vitesse, fondu, titre, supprimer), l’aimant visible, le défilement au bord pendant le glisser, et les raccourcis dans Plus.
- Les captures de ce tour sont sous `/opt/cursor/artifacts/screenshots/`. Les noms `avant-*` sont la prod. Les noms `apres-*` sont cette branche.
- `npm test` : 281 tests passés, 1 ignoré, 0 échec. `npm run typecheck` et `npm run build` passent. Pas de script `lint` séparé : la vérification CI est ce trio.

## Hypothèse

- Les devis 12/18 (texte ou photo), 24/36 (planche), voix 24,14 / 36,21 pour 1 000 caractères, effet 2,46 / 3,69 pour 5 s, musique 16 / 24 pour 30 s, Vidu 100 / 150 : déjà écrits, non remesurés ici.
- EN, DE, ES restent `_human: native_open`.
- La vitesse ne change pas la durée du plan sur la timeline. Elle ne change que l’image lue. Un plan de 4 s à vitesse 2 ne dure pas 2 s.
- Le fondu vers un plan vidéo, à l’export, passe par le noir. Le fondu vers une image superpose l’image.
- Un asset envoyé au montage sans durée connue tient 5 s. Hypothèse d’affichage, pas une mesure du fichier.
- Aucun téléphone physique. Les largeurs 360, 390, 768, 1280 et 1440 sont des fenêtres de navigateur.

## Décision

- Quatre gestes visibles par onglet, le reste derrière « Plus de gestes ». Pas de mur de templates.
- Un geste sans graphe déjà dans le studio, ou sans devis, reste à l’écran et Créer reste éteint. La raison est écrite.
- Sans compte de rendu, Créer dit « Relie ton compte de rendu pour créer. »
- On ne réimporte pas le code fal. On ne lance aucun rendu.
- Les exemples ne sont plus un remplissage de texte.

## Ce qui reste amateur

- Plusieurs gestes utiles sont des cartes seulement : autres angles, expressions, rééclairage, agrandir, volume, élargir, objet seulement quand le texte suffit au graphe photo déjà branché, image vers plan, raccord, prolonger, caméra, transfert de mouvement, lèvres, Vidu, voix, effet, musique, synchro, agrandir la vidéo, fluidifier. Le visiteur les voit. Il ne peut pas les lancer.
- Les « après » d’exemple ne sont pas rendus. L’état « Exemple à venir » est honnête et encore vide.
- La vitesse ne resserre pas les plans voisins. Ce n’est pas un vrai ralenti de timeline.
- Le titre est une ligne sur l’image, pas une piste de titrage.
- Le chutier ne montre pas la forme d’onde des sons du projet tant qu’ils ne sont pas déjà sur la timeline ou dans les prises.
- EN, DE, ES ne sont pas relus par un natif.
- Pas de vérification sur un téléphone tenu en main. Le doigt est simulé par le pointeur du navigateur.

## Captures

Avant, prod `https://u-ttu-studio.vercel.app`, fenêtres 1280×800 et 390×844. Galerie et Mon studio en page entière.

- `avant-cast-1280.png`, `avant-cast-390.png`
- `avant-decor-1280.png`, `avant-decor-390.png`
- `avant-prise-1280.png`, `avant-prise-390.png`
- `avant-montage-1280.png`, `avant-montage-390.png`
- `avant-galerie-1280.png`, `avant-galerie-390.png`
- `avant-mon-studio-1280.png`, `avant-mon-studio-390.png`

Après, cette branche. CAST et DÉCOR : un exemple a été cliqué, la référence est dans la zone, le geste est chargé. Galerie : `?galerie=1`, 32 assets, page entière, largeurs 360, 390, 768, 1280, 1440. Détail : `?detail=1`. Montage : `?barre=1`, chutier et barre du plan.

- `apres-cast-1280.png`, `apres-cast-390.png`
- `apres-decor-1280.png`, `apres-decor-390.png`
- `apres-prise-1280.png`, `apres-prise-390.png`
- `apres-montage-1280.png`, `apres-montage-390.png`
- `apres-galerie-360.png`, `apres-galerie-390.png`, `apres-galerie-768.png`, `apres-galerie-1280.png`, `apres-galerie-1440.png`
- `apres-detail-1280.png`, `apres-detail-390.png`
- `apres-mon-studio-1280.png`, `apres-mon-studio-390.png`

Le filtre de la galerie dit « Décor », pas « Décors » : ce pluriel est un libellé retiré du lexique français.
