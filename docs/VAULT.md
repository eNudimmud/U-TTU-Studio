# Coffre — studio personnel

Chaque personne tient son studio dans un dossier Obsidian. Le site est la surface : Créer, Sphère, Identité, Bibliothèque. Le coffre est le système de fichiers. Aujourd’hui il vit sur la machine, hors ligne. Un compte pourra le synchroniser plus tard. Cette page ne le fait pas.

La vente reste HOLD. Pas d’auth, pas de Stripe, pas de Worker fal, pas de plugin Obsidian à installer.

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

La bibliothèque du site montre encore la session de la page. Fermer l’onglet l’efface. Le coffre, lui, reste.

## Ouvrir

1. Dans Studio, télécharger le coffre.
2. Décompresser. Le dossier s’appelle `U-TTU-Studio`.
3. Obsidian → ouvrir un dossier comme coffre → ce dossier.
4. Aucun plugin.

Le fichier servi est `public/vault/U-TTU-Studio.zip`, produit par `src/lib/vault.ts`. `npm run vault:build` l’écrit. `npm run build` le régénère avant l’export Pages.

## Plus tard

Sync optionnelle vers un stockage du compte (R2 ou Git privé), une fois l’auth en place. Le même schéma. L’app compagnon, plus tard, lira le même dossier. Rien de cela n’est branché.
