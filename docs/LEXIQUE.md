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
- **Séquence** relie des prises dans l’ordre. Le **raccord** dit ce qui doit coller : lumière, regard, mouvement, objet. EN Sequence / Continuity. DE Sequenz / Anschluss. ES Secuencia / Raccord.
- Le geste **Raccorder deux images** produit un court film, rangé avec les prises. Ce n’est pas la note de raccord d’une séquence, ni une case **Plan**. EN Bridge two images. DE Zwei Bilder verbinden. ES Empalmar dos imágenes.
- **Espace** (Pièce, Quai, Rue) est le lieu type. Ce n’est pas le **Plan** du storyboard. EN Layout. DE Raumplan. ES Plano de espacio.
- Sur la prise, « Remettre cette prise à zéro » remet la phrase et le réglage. Ce n’est pas un plan.
- **Bouger la caméra** : EN Move the camera. DE Die Kamera bewegen. ES Mover la cámara.
- **Poser un effet** : EN Apply an effect. DE Einen Effekt setzen. ES Poner un efecto.
- Gabarits : `modele-raccord.md`, `modele-mouvement.md`, `modele-effet.md`. Moteurs : `moteur-raccord.md`, `moteur-mouvement.md`, `moteur-effet.md`. Jamais le nom nu de la section.
- Mémoire du projet, sur la Prise : **Bible**, **Style**, **Lexique**, **Prompts**. EN Bible / Style / Lexicon / Prompts. DE Bibel / Stil / Lexikon / Prompts. ES Biblia / Estilo / Léxico / Prompts. Un champ vide dit qu’il n’y a rien d’écrit. Le fichier du squelette n’est pas présenté comme le texte du projet.

Le switcher est dans la barre du téléphone et dans le rail du bureau. Les noms des langues ne se traduisent pas : Français, English, Deutsch, Español.
