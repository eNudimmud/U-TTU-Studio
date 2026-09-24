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

Verdict **PASS** si et seulement si aucun contrôle n’est en FAIL ni en À FAIRE. Tant que ce n’est pas le cas, l’étape 2 est verrouillée : pas de ZIP, pas de lien Comfy, pas de légendes à copier. L’export revérifie le verdict avant d’écrire le moindre fichier.

## Format imposé

**Trigger.** 4 à 24 caractères, `a–z`, `0–9`, `_`. Il commence par une lettre et contient au moins un chiffre ou un `_` (ex. `mira_v1`). Une fois les chiffres et `_` retirés, il ne doit pas redonner un mot courant (`woman_1` → refusé).

**Légende.** `trigger, angle, cadrage, variables`. L’angle et le cadrage viennent des étiquettes, en anglais contrôlé : `front view` / `three-quarter view` / `side profile view` / `back view` ; `close-up portrait` / `upper body shot` / `full body shot`. Les variables décrivent ce qui change d’une image à l’autre : tenue, décor, lumière, expression. Elles s’écrivent en anglais, recommandé pour l’encodeur T5 de Flux.

**Invariants.** Au moins deux traits qui ne changent jamais (ex. `green eyes, freckles, scar on left cheek`). C’est le trigger qui doit les porter. Ils sont donc interdits dans les légendes.

## Les 19 contrôles

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
| `RAPPORT_GATE.txt` | Verdict, 19 contrôles, légendes, images écartées. |
| `gate.json` | Même contenu, lisible par machine. |
| `LISEZMOI.txt` | Étapes suivantes, lien App Mode, estimations de coût. |
