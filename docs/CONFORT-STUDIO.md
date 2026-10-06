# Confort studio — pour JD

6 octobre 2026. Lu sur `main` au commit `5c219c4` (prise #39). Chaque ligne est un **fait**, une **décision** ou un **écart**. Ce brief ne remplace pas [CINEMA-STUDIO-BRIEF.md](CINEMA-STUDIO-BRIEF.md). Il nomme le confort qui manque encore, et la tranche livrée avec lui.

## But

**Décision :** le confort studio, c’est une seule chaîne pour un adhérent. Il retrouve ses personnages nommés, ses décors nommés, et il choisit le moteur sans quitter Personnage → Scène → Prise.

- **Distribution.** Un personnage a un nom. Quand il est formé, son fichier reste au coffre. Le choisir recharge cette identité.
- **Décors.** Un lieu a un nom. Il se rouvre : même plan, même caméra si elle a été enregistrée.
- **Moteurs.** Le choix du moteur est second. Il ne crée pas une nouvelle étape. Seuls les moteurs déjà branchés sont proposés. Un nom inconnu est refusé.

## Principes — les nôtres

- **Décision :** on reste dans l’app. Pas d’onglet moteur, pas de cadre étranger comme geste principal.
- **Décision :** rouvrir un décor, c’est rouvrir le lieu du coffre, avec la caméra enregistrée.
- **Décision :** choisir un personnage, c’est recharger son fichier. Le look, les photos et la phrase ne le remplacent pas.
- **Décision :** le moteur vient après Personnage → Scène → Prise. Il ne les précède pas.
- **Décision :** un seul geste or sur chaque écran.
- **Décision :** le téléphone reste une colonne (`min(560px, 100%)`), chaîne en bas. À partir de 1080 px, le rail de 232 px et les deux colonnes restent.

## Hors sujet

- **Décision :** pas de copie d’un produit commercial. Pas de reprise de son interface, de ses noms d’écran, ni de son parcours.
- **Décision :** pas d’inspection, pas de collecte, pas de clonage d’un site ou d’une API tiers.
- **Décision :** pas de fiche visiteur. Clerk reste hors de `/` et de `/studio`.
- **Décision :** pas d’achat automatique, pas de publication automatique, pas de débit sans le geste qui confirme.
- **Décision :** les clés (`u-ttu-fal`, `u-ttu-blender`, `u-ttu-rendu`) restent sur l’appareil. Jamais dans le coffre.
- **Décision :** un fichier Flux de lieu ne se branche pas sur le graphe H3 de la prise. Ce fichier fait des images. Il n’est pas un volume.

## Écart — mesuré sur ce dépôt

- **Fait (6 octobre, suite) :** la chaîne affichée est Personnage → Scène → Prise. Personnage est `#personnage`, `#lora`, `#rôle`. Les photos et les traits restent une feuille, `#photos` et les anciens `#look`, `#creer`. Ce n’est pas le premier pas.
- **Fait :** les personnages formés sont des fichiers du coffre (`kind` personnage, ou absent pour les fichiers d’avant). Sur Rôle, la liste « Au coffre » mélange personnages et lieux. Sur La prise, les noms n’apparaissent que si le moteur est déjà « Personnage ».
- **Fait :** les lieux persistent : nom, note, plan, trajet de caméra, vues, images. L’étagère est sur Scène. La prise montre le lieu ouvert, pas l’étagère. Changer de décor oblige à quitter la prise.
- **Fait :** deux moteurs de prise sont branchés. `comfy` : références H3, compte de rendu. `lora` : personnage H3 chez fal, fichier du coffre. Le contrôle s’appelle « Cohérence », pas « Moteur ».
- **Fait :** le LoRA de lieu passe par `fal-ai/flux-lora-fast-training`, puis `fal-ai/flux-lora` pour une image. `take-graph.ts` ne porte pas `flux-lora`. Ce n’est pas un troisième moteur de prise.
- **Écart :** il manque, sur La prise, le choix du qui et du où avant le geste or. Il manque un refus net d’un moteur qui n’est pas branché, au lieu d’un libellé qui cache les deux seuls chemins.

## Cette livraison

- **Décision :** La prise montre l’étagère des décors du coffre. En choisir un rouvre ce lieu, caméra comprise quand elle est enregistrée.
- **Décision :** La prise montre la distribution : les personnages nommés, pas les fichiers de lieu. En choisir un passe le moteur sur Personnage et recharge ce fichier.
- **Décision :** le contrôle s’appelle Moteur. Il ne propose que Références et Personnage. `pickEngine` renvoie `null` pour tout autre nom. Rien n’est inventé à la place.
- **Décision :** le geste or reste « Tourner ». Poser un décor ou former un personnage se fait toujours sur Scène et sur Personnage.

## Encore dehors

- **Écart :** la caméra se règle sur Scène. La prise la rouvre, elle ne la déplace pas.
- **Écart :** pas de portrait de distribution séparé des photos du rôle. Le nom recharge le fichier.
- **Écart :** pas de moteur Seedance, pas de Flux sur la prise, pas de volume 3D issu du LoRA de lieu.
- **Écart :** cette livraison ne forme rien et ne tourne rien. Aucun appel payant fal, Comfy ou Farpy.
