# U1 — storyboard conversationnel

**Design U1 validé par JD le 1er novembre 2026 ; implémentation CE4 autorisée.** [Accord consigné dans GitHub](https://github.com/eNudimmud/U-TTU-Studio/pull/222#issuecomment-6557202544) : « Oui je valide », en réponse à la maquette et au périmètre U1. Aucun changement produit n'est livré par ce dossier. Les compositions artistiques, crédits et merges conservent leurs validations distinctes.

[Maquette interactive validée](prototypes/uttu-cinema-u1.html) : fragment de référence conservé tel que présenté, hors code applicatif. Sélection de plan et ouverture du contexte seulement ; aucun appel réseau ni média privé. Cursor peut s'en servir directement sans demander à JD de retransmettre la maquette.

## Périmètre validé

Faire évoluer le storyboard existant : plans visuels au centre, conversation Uttu contextuelle, références et historique à la demande. Garder le papier/or, les routes et les quatre domaines CAST · DÉCOR · PRISE · MONTAGE. Aucun nouveau menu « moteur AAA » ou panneau permanent par compétence.

| Zone | Visible | Interaction |
| --- | --- | --- |
| En-tête | Projet et séquence, sauvegarde réelle | Navigation Studio conservée |
| Plans | Numéro, vignette réelle si disponible, durée et état | Sélection ; duplication, réordre, archivage avec annulation |
| Création | Plan sélectionné dominant, action/caméra en une ligne | Comparer variantes ; garder une prise explicitement |
| Conversation | Un seul Uttu, portée `Shot 2` près du champ | Demande naturelle, références `@Nom`, proposition vérifiable |
| Contexte replié | Réfs par rôle, verrous, variantes, workflow/coût sur demande | Inspecter/corriger puis refermer |

La maquette de validation utilise des emplacements explicitement vides : aucune identité ou image d'Uttu, Enki, Fizz ou Blanche n'est inventée. Sélection de plan et ouverture du contexte sont les seules interactions simulées ; génération et export n'y fonctionnent pas et ne sont pas présentés comme disponibles.

## Parcours et états

Demande → proposition de trois plans → édition d'un plan → préparation image clé → devis → accord/lancement utilisateur → résultat dans le plan → validation de l'image → préparation animation → accord → montage/export. Aucun appel image implicite quand l'agent écrit un storyboard. Les commandes directes utilisent les mêmes services.

- Sélection claire : « conserve Fizz, rapproche la caméra » touche le plan choisi et préserve ses bindings.
- Référence manquante : correction locale proposée, pas de personnage inventé.
- Prix : `≈ X estimated credits` en EN ; `≈ X crédits estimés` en FR. Sans devis : `Estimate unavailable`, jamais zéro.
- Suivi : état réel du job, pas de pourcentage fictif. Soumission incertaine : contrôle du job existant avant toute nouvelle tentative.
- Résultat tardif : `Result from an earlier version`, visible comme variante sans remplacer la prise gardée.
- Finaliser : source visible, opération de finition, nouvelle version ; original intact.
- Export : `Preview MP4 · 540p · 12 fps`, originaux accessibles. Pas de promesse 1080p factice.

Les outils réellement cassés restent masqués ; un blocage temporaire utile est expliqué. EN par défaut, FR/DE/ES complètes, langue déjà choisie préservée. Pas de seconde bulle active faisant doublon avec la conversation principale.

## Responsive et accessibilité

| Dimensions | Disposition attendue |
| --- | --- |
| 1280×800 | Visuel environ 2/3, conversation 1/3, contexte local repliable |
| 1024×600 | Même hiérarchie compacte, page défilable, saisie accessible |
| 390×844 | Plans et preview puis conversation dans le flux ; contexte en disclosure |
| 844×390 | Disposition compacte, défilement naturel ; aucun overlay fixe masquant une action |

Cibles >=44 px, focus visible, sélection clavier, alternatives au glisser-déposer, annonces d'état mesurées, aucun débordement horizontal. La couleur n'est jamais le seul signal. Préserver le SSR et les gains LCP #221 ; pas de nouvelle dépendance visuelle lourde.

## Impact et validation

Périmètre : workspace storyboard et conversation. Risque principal : deux champs concurrents ou sélection mal propagée. Test d'acceptation : choisir Fizz, modifier caméra, vérifier qu'Enki et son plan restent identiques. Les contrôles de budget/reprise restent hors React.

L'accord est acquis pour ce périmètre : ne pas redemander la même validation à JD. Cursor ouvre la PR CE4 sur `feat/cinema-workspace-u1`, publie la preview et les preuves des quatre dimensions, puis Astra vérifie la conformité. Le raccord aux opérations réelles dépend de CE0–CE3. Les détails d'implémentation compatibles sont tranchés par Astra/Cursor ; toute extension UX importante repasse par JD.
