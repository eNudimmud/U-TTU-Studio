# Mon studio — la mémoire

Mis à jour le 7 octobre 2026. Le nom produit de ce dossier est **Mon studio**. L’app l’écrit à chaque geste. Obsidian le lit tel quel. Le serveur ne le voit jamais, et ne le synchronise pas.

## Schéma

```text
U-TTU-Studio/
  MOC.md                         la carte des projets
  README.md                      le mode d’emploi du dossier
  .uttu/projet.json              le projet en cours (pas une clé)
  Projets/<projet>/
    _MOC.md                      la carte de ce projet
    Bible.md  Style.md  Lexique.md
    Journal.md                   une ligne par prise et par formation
    Cast/canon.md                le personnage : nom, traits, photos
    Cast/<id>.md                 un fichier de personnage
    Refs/                        photos du personnage
    Lieux/<lieu>.md              un lieu, ses images à côté
    Lieux/<id>-fichier.md        un fichier d’images du lieu, pas le lieu
    Prises/<id>.md               une prise, sa vidéo et sa vignette
    Sequences/  Shots/  Prompts/
    Templates/modele-personnage.md  modele-scene.md  modele-prise.md  modele-sequence.md  modele-shot.md
    Moteurs/                     fiches Relier → Lancer, sans graphe
    Assets/                      poids .safetensors et clips
    .uttu/etat.json              le lieu courant
    .uttu/clips.json             durée et taille de chaque clip
    .uttu/role.json              le brouillon de personnage
```

Les fiches sont du Markdown avec frontmatter : `type`, `projet`, `statut`, `updated`, et `moteur` (`comfy`, `fal` ou `demo`) plus `gesture` quand le geste existe. Une prise garde aussi `lora`, `resolution`, `cout_usd`, `cout_source`. Le moteur `fal` d’une prise est le moteur interne `lora`. Une fiche de fichier porte `declencheur`, `fichier`, `sha256`, `pas`, `rang`, `entraineur`, `requete`. Les images et la vidéo sont liées en `![[…]]`. `MOC.md` liste les projets. `_MOC.md` relie le personnage, les lieux, les prises, la bible et le journal de ce projet. Aucun plugin Obsidian n’est requis. Le code : [`src/lib/coffre/`](../src/lib/coffre/).

Un ZIP ancien (`CANON.md`, `scenes/`, `prises/`, `loras/`) est rangé dans un projet à l’import. Un fichier déjà présent n’est pas écrasé.

## Où il vit

- **Sur l’appareil, dans le navigateur.** IndexedDB, base `uttu-coffre`, un enregistrement par fichier (`path`, texte ou blob). Le studio demande le stockage persistant (`navigator.storage.persist()`). La feuille Mon studio dit ce qui est occupé, et si le navigateur peut le vider.
- **Exporter mon studio.** Un geste : `U-TTU-Studio.zip`, le dossier ci-dessus, `MOC.md` comprise, à décompresser et ouvrir dans Obsidian.
- **Importer un studio.** Un ZIP du même schéma s’ajoute à mon studio sur cet appareil. Une prise ou un personnage déjà là reste. Une fiche illisible, ou qui pointe vers une vidéo ou un fichier absent, ne remplace pas la fiche valide. Le journal et la carte sont réécrits à partir de ce que mon studio peut ouvrir.
- **Relier mon dossier Obsidian.** Sur ordinateur, Chrome ou Edge (File System Access) : l’app copie mon studio dans le dossier choisi, puis y écrit chaque changement tant que la page reste ouverte. Le lien ne survit pas à la fermeture : on le refait d’un geste.

La clé et la session de rendu, la clé fal, et la clé Blender (`u-ttu-blender`) ne sont pas des fichiers de mon studio. Elles restent dans le stockage du navigateur et n’entrent jamais dans l’export.

## Pourquoi mon studio

L’ancien pilier était un ZIP de départ, téléchargé une fois, que la personne remplissait à la main. Le site n’écrivait rien dedans : la prise, son coût, ses images restaient à recopier. Il fallait quitter l’app pour tenir sa mémoire.

| Chemin | Retenu ? | Raison |
| --- | --- | --- |
| ZIP de départ à remplir à la main | Non | Le studio ne pouvait rien y écrire. Chaque prise devait être rangée hors de l’app. |
| Dossier Obsidian relié seulement (File System Access) | En plus | Absent de Safari et des téléphones. Seul, il exclurait le cas principal. |
| OPFS seul | Non | Safari n’écrit pas de fichier OPFS depuis la page principale (`createWritable`). IndexedDB tient partout. |
| Base du studio, ou sync liée à un compte | Non | Ce serait une base de visiteurs. Le brief l’exclut. |
| **IndexedDB rangé comme un dossier Obsidian, export ZIP, dossier relié en option** | **Oui** | Marche sur téléphone, sans compte. L’app écrit mon studio à chaque geste. Le format reste celui d’Obsidian, donc la personne peut partir avec. |

## Limites

- **Le navigateur peut vider ce stockage** si l’espace manque et que la persistance n’est pas accordée. La feuille Mon studio le dit. Exporter, ou relier un dossier, garde une copie.
- **Un studio par navigateur.** Deux appareils ne partagent pas le même dossier. Le pont : exporter le ZIP, ouvrir le dossier dans Obsidian, importer ce ZIP sur l’autre appareil. Il n’y a pas de copie sur le serveur.
- **Le dossier relié est à sens unique.** L’app écrit dans le dossier. Elle ne relit pas un changement fait dans Obsidian. L’import, lui, lit un ZIP.
