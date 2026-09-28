# Coffre — studio personnel

Chaque personne tient son studio dans un dossier Obsidian. Le site est la surface : Créer, Sphère, Identité, Bibliothèque, et Compte. Le coffre est le système de fichiers. Il vit sur la machine, hors ligne. Le mode Compte ne le lit pas. Une sync pourra le rejoindre plus tard. Cette page ne le fait pas.

La vente reste HOLD. Clerk tient la session, quand les clés sont posées. Pas de Stripe, pas de Worker fal, pas de plugin Obsidian à installer. Pas de sync.

## Schéma

```
U-TTU-Studio/
  refs/           photos sources, deux ou trois
  dataset/        lot de quinze, légendes .txt
  loras/          .safetensors et notes
  scenes/         avant, après, entre, clips plus tard
  processes/      recettes, liens d’apps, prompts
  jobs.md         journal des runs
  CANON.md        identité, trigger, invariants
```

Le ZIP de départ ajoute `README.md`, le mode d’emploi du coffre. Ce n’est pas une pièce de travail.

## Modes

| Mode | Endroit | Ce qu’on y range |
| --- | --- | --- |
| Créer | `refs/`, `dataset/` | Les photos, puis le lot |
| Sphère | `scenes/` | Avant, après, entre |
| Identité | `CANON.md`, `loras/` | Ce qui ne doit pas bouger, et le fichier |
| Bibliothèque | `refs/`, `dataset/`, `loras/`, `scenes/` | Ce qui est déjà rangé |
| Studio | `jobs.md`, `processes/` | Le journal, et les recettes |
| Compte | — | La session. Aucun dossier. |

Les fiches Sphère se notent dans la page, sur l’appareil. Chacune s’exporte en `.md` : `scenes/avant.md`, `scenes/apres.md`, `scenes/entre.md`. Le lieu, le rappel des quatre angles, et la note gauche / droite y tiennent. On pose le fichier dans `scenes/` à la main. Un collage, ou un fichier choisi dans le navigateur, remplit la fiche. Le site n’ouvre pas le coffre. Le ZIP laisse `scenes/` vide. Aucune sync.

La bibliothèque du site montre encore la session de la page. Fermer l’onglet l’efface. Le coffre, lui, reste. Les fiches, elles, restent dans le navigateur jusqu’à ce qu’on les efface.

Le panneau Studio liste les processus du catalogue : titre, état, une ligne. C’est un texte. On les range dans `processes/`, et chaque run se note dans `jobs.md`. Le site ne les écrit pas. Le ZIP ne change pas.

## Ouvrir

1. Dans Studio, télécharger le coffre.
2. Décompresser. Le dossier s’appelle `U-TTU-Studio`.
3. Obsidian → ouvrir un dossier comme coffre → ce dossier.
4. Aucun plugin.

Le fichier servi est `public/vault/U-TTU-Studio.zip`, produit par `src/lib/vault.ts`. `npm run vault:build` l’écrit. `npm run build` le régénère avant le build Next.

## Plus tard

Sync optionnelle vers un stockage du compte (R2 ou Git privé). Le compte Clerk est en place comme squelette. Il ne synchronise pas. Le même schéma. L’app compagnon, plus tard, lira le même dossier. Rien de cela n’est branché.
