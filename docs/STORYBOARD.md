# Storyboard

Ouvert à tous depuis SB11 (31 octobre 2026, oui de JD). Depuis le 2 novembre 2026 (JD : « Oui remplace l'ancienne »), `/storyboard` est le storyboard simplifié U1.1, dans toutes les langues, sur ordinateur et sur mobile.

U1.1 : une histoire, un plan, un endroit pour demander un changement. La lecture passe par l'agent de texte natif (poids ouverts, compte Comfy). Le bouton affiche `≈ X crédits estimés`. Rien n'est filmé avant l'approbation. `?storyboard=u11` ouvre la même page.

## Entrées

- Accueil du studio (outils) : la carte **Storyboard** ouvre `/storyboard`.
- Bulle U*TTU, menu « + » : **Faire un storyboard** ouvre `/storyboard?idee=…` avec le texte de la bulle. Rien n'est filmé avant l'approbation.
- Pas d’onglet dans la barre film2, rien dans PRISE (décision D2 du design).

## Ancienne page

L'ancienne page « Papier » (liste, tableau, fiche, impression) reste dans le code, seulement derrière `?storyboard=legacy`. Le choix est gardé pour l'onglet. À retirer plus tard.

`/storyboard/<id>/print` reste la vue A4 (6 plans par page).

Sur cette page, Uttu écrit encore à partir d'une phrase, sans modèle : séquences, plans, cadrage, caméra, durée 5/8/10 s, refs CAST/DÉCOR. Chaque plan porte son devis (`≈ X crédits estimés`). « Film · ≈ X » ouvre une seule confirmation avant « Start ». Moteurs : Fidèle (H3) et Rapide, Comfy uniquement.

## Fichiers

- `Projets/<projet>/.uttu/sb-<id>.json` — la vérité structurée.
- `Projets/<projet>/Storyboard/<id>.md` — la vue Obsidian, réécrite après chaque changement.
- `_MOC.md` du projet : section **Storyboards** (archivés en dernier).

## Échappatoire

`?storyboard=0` désactive le storyboard dans ce navigateur pendant une version (cookie `u-ttu-storyboard=0` : la page répond 404, l’entrée de la bulle et la carte disparaissent). `?storyboard=1` le rallume sur U1.1. À retirer à la version suivante.

Code : [`src/lib/storyboard/`](../src/lib/storyboard/), [`src/components/storyboard/`](../src/components/storyboard/).
