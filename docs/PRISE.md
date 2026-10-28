# PRISE — intention
Une séquence de plans ; chaque plan = cast + décor + cadrage/caméra + action → une prise.
On tourne un essai bon marché (devis « ≈ X crédits estimés » avant), on garde la bonne version (plusieurs rendus par plan restent des versions), puis Finaliser l'améliore sans la régénérer.
Liste des plans : ajouter, dupliquer, monter/descendre (tactile) ou glisser, supprimer avec « Annuler » ; chaque modification est écrite dans `Shots/<id>.md` (ordre compris). États visibles : vide, en place, en attente, généré, gardé, erreur.
Cause corrigée (28.10) : la liste n'avait ni suppression, ni duplication, ni réordonnancement au toucher ; la logique est dans `src/lib/prise/plans.ts`, testée par `tests/prise-plans.test.ts`.
