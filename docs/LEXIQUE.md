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
- **Lire la séquence** enchaîne, dans le navigateur, les vidéos des prises déjà posées sur les plans, dans l’ordre des plans. Un plan sans prise est un carton : **Plan sans prise**. EN Play the sequence / Shot without a take. DE Sequenz abspielen / Shot ohne Take. ES Reproducir la secuencia / Viñeta sin toma. La liste de montage est `Sequences/<id>-montage.md` (ordre, plan, prise, durée, source). Ce n’est pas un film assemblé.
- **Poser ce lieu, puis la prise** nomme le lieu et ouvre la prise, un seul geste. Le nom déjà écrit est **Lieu 1**. Une fois le lieu posé, le même bouton or redevient **Aller à la prise**. EN Set this place, then the take / Place 1 / Go to the take. DE Diesen Ort setzen, dann der Take / Ort 1 / Zum Take. ES Poner este lugar y abrir la toma / Lugar 1 / Ir a la toma.
- **Poser le plan** range la prise dans un plan, dans une séquence. Les noms sûrs sont déjà écrits : **Séquence 1**, **Plan 1**. EN Set the shot / Sequence 1 / Shot 1. DE Den Shot setzen / Sequenz 1 / Shot 1. ES Poner la viñeta / Secuencia 1 / Viñeta 1.
- Sans projet, le nom déjà écrit est **Atelier**. Un geste crée le projet. Entrée valide le champ sur ordinateur. EN The name is already written. DE Der Name steht schon da. ES El nombre ya está escrito.
- Le personnage sans nom écrit reçoit **Personnage 1**, déjà dans le champ. Deux traits restent visibles et ne bloquent pas le geste : rien n’est inventé à leur place. EN Character 1. DE Figur 1. ES Personaje 1.
- La phrase de la prise, quand aucune n’est écrite, est **Le personnage est dans le lieu.** Elle se lit dans le champ et dans le texte qui part, avant Tourner. EN The character is in the place. DE Die Figur ist an diesem Ort. ES El personaje está en el lugar.
- Le geste **Raccorder deux images** produit un court film, rangé avec les prises. Ce n’est pas la note de raccord d’une séquence, ni une case **Plan**. EN Bridge two images. DE Zwei Bilder verbinden. ES Empalmar dos imágenes.
- **Espace** (Pièce, Quai, Rue) est le lieu type. Ce n’est pas le **Plan** du storyboard. EN Layout. DE Raumplan. ES Plano de espacio.
- **Trajet** est le chemin de la caméra dans cet espace. EN Path. DE Weg. ES Recorrido. Ce n’est ni l’espace, ni le plan.
- Sur la prise, « Remettre cette prise à zéro » remet la phrase et le réglage. Ce n’est pas un plan.
- **Ajouter cette prise** pose une prise dans une séquence ou un plan. EN Add this take. DE Diesen Take hinzufügen. ES Añadir esta toma. Relier reste le verbe du compte.
- **Bouger la caméra** est le geste cinéma. EN Move the camera. DE Die Kamera bewegen. ES Mover la cámara.
- **Déplacer la caméra** et **Déplacer le point visé** règlent l’espace, avant le trajet. EN Shift the camera / Shift the aim point. DE Die Kamera verschieben / Den Zielpunkt verschieben. ES Desplazar la cámara / Desplazar el punto visado.
- **Poser un effet** : EN Apply an effect. DE Einen Effekt setzen. ES Poner un efecto.
- Gabarits : `modele-raccord.md`, `modele-mouvement.md`, `modele-effet.md`. Moteurs : `moteur-raccord.md`, `moteur-mouvement.md`, `moteur-effet.md`. Jamais le nom nu de la section.
- Mémoire du projet, sur Personnage, Scène et Prise : **Bible**, **Style**, **Lexique**, **Prompts**. EN Bible / Style / Lexicon / Prompts. DE Bibel / Stil / Lexikon / Prompts. ES Biblia / Estilo / Léxico / Prompts. Un champ vide dit qu’il n’y a rien d’écrit. Le fichier du squelette n’est pas présenté comme le texte du projet. Ces quatre notes ne sont pas le texte qui part avec Former, Former ce lieu, Filmer ce trajet, ni Tourner. Former envoie le mot du nom. Former ce lieu envoie le mot du lieu, aussi comme légende de chaque vue.
- Sur la Prise, la carte **Avant le geste** tient la phrase, le texte qui part, le devis et le bouton or. **Le texte en entier** ouvre le prompt long sous ce bouton. EN Before the gesture / The full text. DE Vor der Geste / Der ganze Text. ES Antes del gesto / El texto entero.
- Les catalogues EN, DE et ES portent `_human: native_open` : la relecture du lexique n’est pas une signature de locuteur natif.

Le switcher est dans la barre du téléphone et dans le rail du bureau. Les noms des langues ne se traduisent pas : Français, English, Deutsch, Español.
