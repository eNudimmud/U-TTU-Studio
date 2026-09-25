# Gate dataset — critères FAIL

Le gate décide si un dataset a le droit de partir à l’entraînement. Il tourne dans le navigateur du client : les images ne quittent pas l’appareil tant que le client ne les dépose pas lui-même dans l’app Comfy.

Le code fait foi : [`src/lib/gate/rules.ts`](../src/lib/gate/rules.ts) (règles et seuils), [`captions.ts`](../src/lib/gate/captions.ts) (légendes), [`pixels.ts`](../src/lib/gate/pixels.ts) (mesures d’image). Les tests de [`tests/gate.test.ts`](../tests/gate.test.ts) font échouer chaque règle au moins une fois.

## Statuts

| Statut | Sens | Effet |
| --- | --- | --- |
| **PASS** | Règle satisfaite. | — |
| **FAIL** | Violation : quelque chose est faux dans le dataset. | Bloque l’étape 2. |
| **À FAIRE** | Information manquante : tri, étiquettes, confirmations. | Bloque l’étape 2. |
| **À NOTER** | Risque accepté, sans blocage. | Rien. |

Verdict **PASS** si et seulement si aucun contrôle n’est en FAIL ni en À FAIRE. Tant que ce n’est pas le cas, l’étape 2 est verrouillée : pas de ZIP, pas de lien Comfy, pas de légendes à copier. L’export revérifie le verdict avant d’écrire le moindre fichier. Un contrôle À NOTER (G06, G19, G20) ne ferme rien.

## Format imposé

**Trigger.** 4 à 24 caractères, `a–z`, `0–9`, `_`. Il commence par une lettre et contient au moins un chiffre ou un `_` (ex. `mira_v1`). Une fois les chiffres et `_` retirés, il ne doit pas redonner un mot courant (`woman_1` → refusé).

**Légende.** `trigger, angle, cadrage, variables`. L’angle et le cadrage viennent des étiquettes, en anglais contrôlé : `front view` / `three-quarter view` / `side profile view` / `back view` ; `close-up portrait` / `upper body shot` / `full body shot`. Les variables décrivent ce qui change d’une image à l’autre : tenue, pose, décor, lumière, expression. Elles s’écrivent en anglais, recommandé pour l’encodeur T5 de Flux.

**Invariants.** Au moins deux traits qui ne changent jamais (ex. `green eyes, freckles, scar on left cheek`). C’est le trigger qui doit les porter. Ils sont donc interdits dans les légendes.

## Les 20 contrôles

G01 à G19 sont les règles d’origine, inchangées. G20 est un repère : il ne passe jamais en FAIL.

| ID | Règle | FAIL / À FAIRE quand | Pourquoi |
| --- | --- | --- | --- |
| G01 | Trigger unique | Format invalide, pas de chiffre ni de `_`, mot courant. À FAIRE si vide. | Un mot connu de Flux mélange ton identité avec ce qu’il sait déjà. |
| G02 | Identité déclarée | Moins de 2 invariants (À FAIRE). | Sans invariants, le linter ne peut pas repérer une identité redite. |
| G03 | 15 images retenues | Plus de 15 : FAIL. Moins de 15 une fois tout trié : FAIL. Tri en cours : À FAIRE. | L’app Comfy a 15 emplacements. En dessous, la LoRA confond identité et décor. |
| G04 | Chaque image triée | Une image encore « à trier » (À FAIRE). | Chaque image gardée est une affirmation humaine : « conforme aux invariants ». C’est ici que la dérive est rejetée. |
| G05 | Confirmations humaines | Une case non cochée (À FAIRE) : une seule personne au premier plan, aucun texte ou filigrane, visages nets vérifiés à 100 %, visage non masqué, droits et consentement. | Ce que la machine ne voit pas de façon fiable. |
| G06 | Fichiers lisibles, petit côté ≥ 768 px | Image retenue illisible ou < 768 px (refusée d’office à l’import). À NOTER entre 768 et 1 023 px. | Pas assez de pixels pour un visage. |
| G07 | Aucun doublon | Deux images retenues à ≤ 5 bits de distance (dHash 64 bits). | Une pose dupliquée pèse double. |
| G08 | Netteté vérifiée | Image marquée « Flou ? » gardée sans « Vérifié ». | Une LoRA apprend aussi le flou. |
| G09 | Signalements vérifiés | Image gardée sans « Vérifié » alors que marquée « Hors norme », « Miroir ? » ou « Très proche ». | Dérive de style, asymétrie inversée, rafale ou recadrage. |
| G10 | Angle et cadrage renseignés | Image retenue sans étiquette (À FAIRE). | La couverture et les légendes en dépendent. |
| G11 | ≥ 3 angles de visage | Face, 3/4 et profil ne sont pas tous présents. | La LoRA ne sait refaire que ce qu’elle a vu. |
| G12 | Aucun angle > 60 % | Plus de 9 images sur 15 sous le même angle. | L’angle dominant finit figé. |
| G13 | Cadrages mélangés | Moins de 3 gros plans ou moins de 3 plans buste / plein pied. | L’identité doit tenir du visage à la silhouette. |
| G14 | Trigger en tête | Une légende ne commence pas par le trigger. | Garde-fou structurel. |
| G15 | Aucun invariant dans les légendes | Un invariant, ou son pluriel, apparaît dans une légende. | Un trait écrit n’est plus porté par le trigger : la LoRA ne marchera que si on le réécrit. |
| G16 | Aucun trait recopié | Une variable identique dans ≥ 60 % des légendes, ou un mot significatif dans ≥ 80 % (mots génériques ignorés). | Soit un trait d’identité non déclaré, soit un lot sans variété. |
| G17 | ≤ 40 mots par légende | Légende-roman. | Décrire la personne au lieu de ce qui change. |
| G18 | Légendes toutes différentes | Deux légendes identiques. | Les variables doivent dire ce qui diffère. |
| G19 | Variables décrites | Plus de la moitié des légendes sans variable libre (À NOTER). | Un décor non décrit risque d’être appris comme identité. |
| G20 | Répartition des cadrages (repère) | Jamais bloquant. À NOTER si les gros plans sortent de 3–5, les plans buste de 6–8 ou le plein pied de 3–5 ; À FAIRE tant qu’une image gardée n’est pas étiquetée. | Trop de gros plans : portrait serré, silhouette fragile. Trop de plein pied : visage minuscule à 0,25 MP. Le buste relie les deux. |

## Repère de cadrage (G20)

G13 garde le minimum bloquant : au moins 3 gros plans et 3 plans buste ou plein pied. G20 ajoute la répartition visée pour les 15 images gardées.

| Cadrage | Légende | Part visée | Sur 15 images |
| --- | --- | --- | --- |
| Gros plan | `close-up portrait` | 20–30 % | 3 à 5 |
| Buste | `upper body shot` | 40–50 % | 6 à 8 |
| Plein pied | `full body shot` | 20–30 % | 3 à 5 |

Les fourchettes sont arrondies vers l’extérieur, à l’image près : 30 % de 15 font 4,5, donc 5 (`framingTarget`, `rules.ts`).

| Statut | Quand |
| --- | --- |
| À FAIRE | Une image gardée n’a pas encore d’angle ou de cadrage, comme pour G11 à G13. |
| À NOTER | Un cadrage sort de sa fourchette. Le verdict peut rester PASS : l’étape 2 s’ouvre. |
| PASS | Les trois cadrages sont dans leur fourchette. |

Dans le panneau du gate, G20 est le compteur affiché en tête de la section « Couverture » : une case par image, la fourchette soulignée en bronze, l’excédent hachuré. Les comptes suivent chaque changement de cadrage. Un excédent est signalé tout de suite, avec « Voir les N … » pour surligner les images concernées. Un manque ne l’est qu’une fois toutes les images gardées étiquetées : avant, il peut encore se combler.

| Écart | Message affiché |
| --- | --- |
| Trop de gros plans | La LoRA tire vers le portrait serré et tient mal la silhouette. |
| Trop peu de gros plans | Le détail du visage manque (G13 bloque sous 3). |
| Trop de plans buste | Il reste peu de place pour les gros plans et le plein pied. |
| Trop peu de plans buste | Ce sont eux qui relient le visage à la silhouette. |
| Trop d’images en plein pied | Entraîné à 0,25 MP, un visage en plein pied ne fait que quelques dizaines de pixels. |
| Trop peu d’images en plein pied | Proportions et silhouette resteront approximatives. |

Le rapport (`RAPPORT_GATE.txt`, `gate.json`) reprend G20 avec les comptes et le repère.

## Légendes : ce qui change, pas ce qui tient

Au-dessus des cartes, le guide affiche le principe en une ligne : écrire ce qui doit pouvoir **changer**, jamais ce que le trigger doit **tenir** (forme du visage, yeux, coiffure signature, oreilles ou queue si elles font l’identité). Suivent deux légendes côte à côte, en anglais, telles que Flux les lit :

| | Légende | Ce qu’elle apprend à la LoRA |
| --- | --- | --- |
| FAIL | `mira_v1, front view, close-up portrait, young woman, oval face, green eyes, freckles, long wavy red hair, full lips` | Les traits s’attachent aux mots de la légende, plus au trigger : il faudra les réécrire dans chaque prompt. G15 bloque les invariants déclarés, G16 les traits recopiés. |
| PASS | `mira_v1, three-quarter view, upper body shot, laughing, leaning on a pillar, grey hoodie, subway platform, cold fluorescent light` | Expression, pose, tenue, décor, lumière : ce qui varie d’une image à l’autre. Le visage reste au trigger. |

Le trigger remplace `mira_v1` dès qu’il est valide. Le trigger, l’angle et le cadrage viennent des étiquettes : le client n’écrit que la fin, en anglais simple, sans tags du type « 1girl, masterpiece ». Les exemples sont construits avec `buildCaption` et vérifiés contre le gate par `tests/doctrine.test.ts`.

Sur chaque carte gardée :

- le champ s’appelle « Ce qui change, en anglais » ;
- vide, il rappelle « Pose, tenue, décor, lumière, expression. Pas le visage. », et l’aperçu de la légende montre la place `[ce qui change]` ;
- un invariant déclaré y est signalé sur la carte, avec la même correspondance que G15 (pluriel compris).

Aucune règle nouvelle : G14 à G19 restent les seules règles de légende.

## Signalements automatiques par image

Mesures faites sur une copie de 512 px de long côté.

| Badge | Poids | Déclencheur |
| --- | --- | --- |
| Illisible | refus d’office | Le navigateur ne décode pas le fichier (HEIC sur Chrome, par exemple). |
| `N px` | refus d’office | Petit côté < 768 px. |
| `N px` | information | Petit côté entre 768 et 1 023 px. |
| Flou ? | à vérifier | Variance du laplacien de la tuile la plus nette (grille 4×4) < 100, ou < 35 % de la médiane du lot (dès 5 images). |
| Hors norme | à vérifier | Luminance ou saturation moyenne à plus de 3,5 écarts absolus médians du lot (planchers 40/255 et 0,12, dès 6 images). |
| Miroir ? | à vérifier | Le hash d’une image correspond au hash retourné d’une autre (≤ 5 bits). |
| Très proche | à vérifier | 6 à 12 bits de distance : recadrage, rafale, même pose. |
| Doublon | paire bloquante | ≤ 5 bits de distance : garder l’une, rejeter l’autre. |

« À vérifier » veut dire que la machine signale et que l’humain tranche : il coche « Vérifié à 100 % : même identité, visage net, pose distincte », ou il rejette l’image.

## Ce que le gate ne fait pas

- Il ne reconnaît pas les visages. La dérive d’identité est jugée par le tri humain (G04) et les signalements (G08, G09), pas par un modèle de reconnaissance.
- Il ne prouve pas qu’une LoRA sera bonne. Il retire les causes connues d’échec avant de payer l’entraînement.
- Ses seuils de netteté et de couleur sont des heuristiques. Ils ont été testés sur des images synthétiques, pas encore calibrés sur des datasets clients réels.

## Export

Le ZIP n’existe qu’en PASS. Il contient :

| Fichier | Contenu |
| --- | --- |
| `01.jpg` … `15.jpg` | Images retenues dans l’ordre des emplacements Comfy, réencodées en JPEG q 0,92, 1 536 px max, sans EXIF ni GPS. |
| `01.txt` … `15.txt` | Légende de chaque image (format standard image + .txt). |
| `captions_comfy.txt` | Les 15 légendes, une par ligne, à coller dans l’app. |
| `RAPPORT_GATE.txt` | Verdict, 20 contrôles, légendes, images écartées. |
| `gate.json` | Même contenu, lisible par machine. |
| `LISEZMOI.txt` | Étapes suivantes, lien App Mode, estimations de coût. |
