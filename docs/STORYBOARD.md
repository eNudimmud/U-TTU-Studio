# Storyboard

Ouvert à tous depuis SB11 (31 octobre 2026, oui de JD). Page à part, thème clair « Papier » : `/storyboard` (les storyboards du projet), `/storyboard/<id>` (le tableau), `/storyboard/<id>/print` (A4, 6 plans par page).

## Entrées

- Accueil du studio (outils) : la carte **Storyboard**.
- Bulle U*TTU, menu « + » : **Make a storyboard** ouvre `/storyboard?idee=…` avec le texte de la bulle. Rien n’est écrit ni rendu avant « Write ».
- Pas d’onglet dans la barre film2, rien dans PRISE (décision D2 du design).

## Ce qui se passe

- Uttu écrit le storyboard à partir d’une phrase, sans modèle ni crédit : séquences → plans, cadrage, caméra, durée 5/8/10 s (8 et 10 s seulement quand un devis existe), refs CAST/DÉCOR, réplique citée et modifiable. Une seule question au plus.
- Le lieu vient, dans l’ordre : d’un `@` sur une carte DÉCOR ou une référence de lieu, d’une carte DÉCOR nommée, d’un lieu après une préposition, d’un nom de lieu courant (« la ville », « the city », « die Stadt », « la ciudad »). Sans lieu, les plans s’écrivent sans.
- Chaque plan porte son devis (`≈ X credits estimated`). « Film · ≈ X » ouvre la confirmation PRISE : une seule confirmation liste chaque étape avant « Start ». Moteurs : Fidèle (H3) et Rapide, Comfy uniquement.
- La suggestion de répliques reste cachée tant que son prix n’est pas mesuré.

## Fichiers

- `Projets/<projet>/.uttu/sb-<id>.json` — la vérité structurée.
- `Projets/<projet>/Storyboard/<id>.md` — la vue Obsidian, réécrite après chaque changement.
- `_MOC.md` du projet : section **Storyboards** (archivés en dernier).

## Échappatoire

`?storyboard=0` désactive le storyboard dans ce navigateur pendant une version (cookie `u-ttu-storyboard=0` : la page répond 404, l’entrée de la bulle et la carte disparaissent). `?storyboard=1` le rallume. À retirer à la version suivante.

Code : [`src/lib/storyboard/`](../src/lib/storyboard/), [`src/components/storyboard/`](../src/components/storyboard/).
