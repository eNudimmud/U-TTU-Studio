# Lexique — nom de l’espace

Décision JD, 7 octobre 2026. L’interface française n’affiche plus « Coffre » ni « Vault ».

| Clé | FR | EN | DE | ES |
| --- | --- | --- | --- | --- |
| `my_studio` | Mon studio | My studio | Mein Studio | Mi estudio |

- Bouton du rail et de la barre : **Mon studio**.
- Export : **Exporter mon studio (.zip)**.
- Import : **Importer un studio (.zip)**.
- Les textes d’aide disent « mon studio ».
- Les chemins de code `src/lib/coffre/` et la base `uttu-coffre` restent internes.
- EN, DE et ES sont branchés (`next-intl`, catalogues `messages/`). Le français est la source. L’audit des termes de studio (chaîne, verbes, solde, devis, échec) est dans les catalogues DE et ES, statut `reviewed`. L’adresse ne porte pas la langue.

## Termes appliqués dans l’interface

- Feuille photos : **Références**. « Photos des références ». « Remettre ces références ». Le hash `#look` reste.
- Aria et libellés de lieu : **Lieux**.
- Étape : **Personnage**. Moteur du fichier : **Personnage (fichier)**. Chemin : **Fichier**.
- Sphère : sous-titre **Tes prises**.
- Verbes : Relier, Lancer, Tourner, Former, Filmer, Bâtir.
- Moteur. Distribution. Prise.
- La ligne « FR Coffre · EN Vault » du glossaire de travail est dépassée. L’écran dit **Mon studio**.
- Chaque univers de travail est un projet sous `Projets/`. L’écran dit « Mon studio » et « Projet en cours ».

Le switcher est dans la barre du téléphone et dans le rail du bureau. Les noms des langues ne se traduisent pas : Français, English, Deutsch, Español.
