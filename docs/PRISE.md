# PRISE — intention
Une séquence de plans ; chaque plan = cast + décor + cadrage/caméra + action → une prise.
On tourne un essai bon marché (devis « ≈ X crédits estimés » avant), on garde la bonne version (plusieurs rendus par plan restent des versions), puis Finaliser l'améliore sans la régénérer.
Liste des plans : ajouter, dupliquer, monter/descendre (tactile) ou glisser, supprimer avec « Annuler » ; chaque modification est écrite dans `Shots/<id>.md` (ordre compris). États visibles : vide, en place, en attente, généré, gardé, erreur.
Cause corrigée (28.10) : la liste n'avait ni suppression, ni duplication, ni réordonnancement au toucher ; la logique est dans `src/lib/prise/plans.ts`, testée par `tests/prise-plans.test.ts`.

## P0-1 — édition et persistance (28.10.2026)

### Causes

L’édition du plan ne proposait ni titre, ni angle/position caméra, ni référence de cadrage. Le cadrage et le mouvement étaient recalculés depuis la maquette à chaque affichage : une valeur enregistrée pouvait donc être écrasée silencieusement. L’annulation ne conservait qu’une suppression en mémoire. La suppression du fichier `Shots/` ne partageait pas la file des sauvegardes ; une écriture tardive pouvait le recréer. Enfin, après actualisation, l’état global d’un rendu ne portait plus l’identifiant du plan suivi.

### Correction

- Un seul éditeur du plan sélectionné : titre, action existante, cadrage (dont rapproché), angle, position, mouvement (dont dolly), durée 5 ou 10 s et référence visuelle choisie parmi les images du projet. Les personnages et le décor se modifient dans les rangées existantes. Les anciens plans de 8 s restent lisibles et utilisables.
- Les réglages explicites de cadrage et de mouvement priment sur la maquette. Angle et position figurent dans le texte réellement envoyé ; la référence de cadrage rejoint les images envoyées. C’est une référence visuelle : le contrôle structurel issu de la maquette reste le travail P0-2.
- Réducteur pur `src/lib/prise/history.ts` : 30 étapes d’annulation pour les modifications, ajouts, suppressions, duplications et déplacements. Une saisie continue dans le même champ se regroupe. Le toast dispose de 8 secondes de lecture et se met en pause au survol, au focus et au toucher ; le bouton Annuler reste accessible après sa disparition.
- Journal du projet `.uttu/prise-history.json` (liste, sélection, historique, états), puis notes `Shots/<id>.md` (ordre et composeur). Les sauvegardes successives sont regroupées par projet pour éviter une file d’écritures par caractère sur mobile. La file de sauvegarde conserve les liens vers les prises arrivées entre-temps. Suppression et écriture utilisent la même file. L’interface indique la sauvegarde en cours, réussie ou en erreur.
- Les identifiants des versions sont aussi conservés dans le journal : supprimer un plan puis l’annuler après actualisation retrouve ses versions. Garder une version n’efface aucune autre version. L’envoi immédiat au montage utilise bien la version que tu viens de garder.
- Chaque carte affiche brouillon/en place, en attente, en cours, généré/gardé ou en erreur. La progression affiche l’étape et le temps écoulé, sans inventer de pourcentage. Le contexte du suivi contient projet et plan, y compris pendant une récupération après actualisation.
- Une erreur terminale confirmée par Comfy libère le reçu et autorise une relance avec devis et confirmation. Une erreur réseau, un délai ou un téléchargement interrompu conserve le reçu : on propose la récupération du même job. Annuler une modification ne soumet et n’annule aucun job.

### Vérification

Tests unitaires de la liste et du réducteur : ajout, édition, suppression/annulation, duplication, déplacement, vingt annulations après rechargement, regroupement des saisies, données corrompues et sérialisation des nouveaux réglages jusqu’au prompt. E2E `e2e/prise-edition.spec.ts`, Chromium avec toucher : trois plans, édition du deuxième, suppression/annulation du troisième, déplacement, actualisation, versions gardées, récupération sans second POST, échec et relance confirmée, durée/pause du toast. Contrôle du débordement et des commandes de 44 px aux tailles 390×844, 844×390, 1024×600 et 1280×800, sur build de production Node 22.

Un conflit de sélecteur `.u-uttu` imposait aussi `white-space: nowrap` à la carte d’explication de PRISE et provoquait un débordement de 8 px sur mobile. Son style est maintenant limité au contexte de PRISE. Le titre de la liste utilise une clé traduisible propre, au lieu de traduire l’objet contenant ses actions.

Preuves : `docs/preuves/prise-p0-1/prise-p0-1-edition-390x844.png` et `prise-p0-1-persistance-390x844.png`.

### Régression du transfert depuis la barre, détectée en CI

Le parcours `e2e/barre.spec.ts` détectait un écrasement de la demande lors de « Ouvrir dans l’outil » : le transfert était appliqué dès le démarrage de PRISE, avant la lecture asynchrone du journal. Le journal remplaçait ensuite le plan, puis l’initialisation de la maquette écrivait « Uttu, regard caméra ». Le transfert et l’initialisation attendent maintenant que les plans du projet soient chargés. Le parcours vérifie aussi la conservation de la demande et du réglage Aperçu après actualisation, sans second envoi Comfy.

P0-2 puis P0-3 restent à traiter dans leurs branches et PR respectives. Aucun pipeline de contrôle de profondeur ni transfert d’apparence n’est annoncé comme livré par cette correction.

La remise à jour sur la bulle de création conserve ses parcours Image/Vidéo natifs. Le transfert historique vers PRISE reste lisible, attend la lecture du journal et se sauvegarde sans démarrer de rendu ; un parcours dédié vérifie ce comportement après rechargement.
