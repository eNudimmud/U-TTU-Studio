# Coffre — la mémoire du studio

Mis à jour le 3 octobre 2026 (studio direct). Chaque personne a un studio, et ce studio a une mémoire : son coffre. L’app l’écrit à chaque geste. Obsidian le lit tel quel. Le studio, côté serveur, ne le voit jamais.

## Schéma

```text
U-TTU-Studio/
  CANON.md               le look : nom, traits, photos (frontmatter + texte)
  refs/look-*.jpg        les photos du look, réduites à 1 536 px
  scenes/<lieu>.md       un lieu : nom, note, images
  scenes/<lieu>-*.jpg    ses images
  clips/clip-*.mp4       les courtes vidéos dont un double apprend
  loras/<id>.md          un double formé : déclencheur, pas, demande, coût
  loras/<id>.safetensors le fichier que La prise recharge
  prises/<id>.md         une prise : date, lieu, plan, réglage, moteur, job, calcul, coût, soldes, texte envoyé
  prises/<id>.mp4        la vidéo rapatriée
  prises/<id>.jpg        une image décodée de la vidéo (vignette)
  jobs.md                le journal : une ligne par prise et par formation
  README.md              le mode d’emploi du dossier
  .uttu/etat.json        le lieu courant
  .uttu/clips.json       durée et taille de chaque clip
```

Les fiches sont du Markdown avec frontmatter. Une prise porte en plus `moteur` (`comfy` ou `lora`), `lora`, `resolution`, `cout_usd`, `cout_source`. Une fiche de double porte `declencheur`, `fichier`, `sha256`, `pas`, `rang`, `entraineur`, `requete`. Les images et la vidéo sont liées en `![[…]]`. Aucun plugin Obsidian n’est requis. Le code : [`src/lib/coffre/`](../src/lib/coffre/).

## Où il vit

- **Sur l’appareil, dans le navigateur.** IndexedDB, base `uttu-coffre`, un enregistrement par fichier (`path`, texte ou blob). Le studio demande le stockage persistant (`navigator.storage.persist()`). La feuille Coffre dit ce qui est occupé, et si le navigateur peut le vider.
- **Exporter le coffre.** Un geste : `U-TTU-Studio.zip`, le dossier ci-dessus, à décompresser et ouvrir comme coffre Obsidian.
- **Relier mon dossier Obsidian.** Sur ordinateur, Chrome ou Edge (File System Access) : l’app copie le coffre dans le dossier choisi, puis y écrit chaque changement tant que la page reste ouverte. Le lien ne survit pas à la fermeture : on le refait d’un geste.

La clé et la session de rendu, la clé fal, et la clé Blender (`u-ttu-blender`) ne sont pas des fichiers du coffre. Elles restent dans le stockage du navigateur et n’entrent jamais dans l’export.

## Pourquoi ce coffre

L’ancien pilier était un ZIP de départ, téléchargé une fois, que la personne remplissait à la main. Le site n’écrivait rien dedans : la prise, son coût, ses images restaient à recopier. Il fallait quitter l’app pour tenir sa mémoire.

| Chemin | Retenu ? | Raison |
| --- | --- | --- |
| ZIP de départ à remplir à la main | Non | Le studio ne pouvait rien y écrire. Chaque prise devait être rangée hors de l’app. |
| Dossier Obsidian relié seulement (File System Access) | En plus | Absent de Safari et des téléphones. Seul, il exclurait le cas principal. |
| OPFS seul | Non | Safari n’écrit pas de fichier OPFS depuis la page principale (`createWritable`). IndexedDB tient partout. |
| Base du studio, ou sync liée à un compte | Non | Ce serait une base de visiteurs. Le brief l’exclut. |
| **IndexedDB rangé comme un coffre Obsidian, export ZIP, dossier relié en option** | **Oui** | Marche sur téléphone, sans compte. L’app écrit le vrai coffre à chaque geste. Le format reste celui d’Obsidian, donc la personne peut partir avec. |

## Limites

- **Le navigateur peut vider ce stockage** si l’espace manque et que la persistance n’est pas accordée. La feuille Coffre le dit. Exporter, ou relier un dossier, garde une copie.
- **Un coffre par navigateur.** Deux appareils ne partagent pas le même coffre. L’export, puis l’ouverture dans Obsidian, est le pont.
- **Le dossier relié est à sens unique.** L’app écrit dans le dossier. Elle ne relit pas un changement fait dans Obsidian.
