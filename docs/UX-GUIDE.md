# Refonte du guide LoRA — 27 septembre 2026

Le 28 septembre 2026, la Phase 0 remplace l’ouverture en quatre écrans par un shell Créer. Le même jour, le shell gagne cinq modes (Créer, Sphère, Identité, Bibliothèque, Studio) et la zone de dépôt devient le geste principal. Le tutoriel reste dans le tiroir « Comment ça marche ». Plus tard le même jour, **Compte** s’ajoute en fin de nav, sans mur devant Créer ([AUTH.md](AUTH.md)). Le détail est dans le README et dans [DECISIONS.md](DECISIONS.md).

## But

Le site présentait une longue introduction, le formulaire, tous les contrôles et les outils avancés sur la même page. La refonte du 27 septembre ouvrait sur une explication de la LoRA, puis présentait une seule étape à la fois : Comprendre, Préparer, Entraîner, Créer.

- Introduction courte, vocabulaire expliqué et exemple de prompt annoté.
- Tri image par image, vignettes de navigation et filtres par décision.
- Résumé du lot avec prochaine action ; rapport, coaching et diagnostics repliables.
- Réglages avancés, tests comparatifs et fal accessibles à la demande.
- Composants, traitements d’images et styles de préparation différés jusqu’à leur utilisation.
- Session conservée lors des changements d’étape. Un ZIP devenu périmé ne permet plus de confirmer le test ; une modification du lot invalide la confirmation de son test. Les confirmations de lancement/réception sont remises à zéro si les réglages changent.

Le gate, les workflows, la confidentialité, les coûts estimés et le statut HOLD restent applicables. Aucun entraînement ni appel fal réel n’a été exécuté.

## Vérifications réalisées

| Contrôle | Résultat |
| --- | --- |
| `npm test` | 77 tests, 17 suites, 0 échec |
| `npm run typecheck` | Réussi |
| Build export GitHub Pages | Réussi avec `/U-TTU-Studio` et proxy fal vide |
| Rendu React côté serveur avec les fixtures du gate | 15 vignettes, une fiche éditable, confirmations finales présentes |
| Rendu React du ZIP périmé | Confirmation du test désactivée et décochée ; activée avec un ZIP à jour |
| Rendu React du résumé | État prêt et rapport détaillé replié |
| `git diff --check` | Réussi |

Les contrôles de rendu React vérifient le HTML produit, pas les clics ou les pixels dans un navigateur.

## Poids du chargement initial

Comparaison de deux exports de production avec les mêmes dépendances et variables Pages. Référence : `f6688a9`. Somme des fichiers explicitement référencés par les balises script et stylesheet du HTML initial ; hors polices, image, en-têtes réseau et chunks différés. Compression gzip locale identique (`mtime=0`), pas une mesure de latence.

| Ressource | Avant, octets | Après, octets | Avant gzip | Après gzip |
| --- | ---: | ---: | ---: | ---: |
| HTML | 56,195 | 19,939 | 12,043 | 5,630 |
| JavaScript initial | 661,957 | 623,494 | 205,579 | 193,495 |
| CSS initial | 47,435 | 22,659 | 10,800 | 5,887 |

Le reste des styles de travail se charge au premier accès à la préparation. Aucune promesse de score Lighthouse ou de temps de chargement n’est faite.

## Revue visuelle restante — PR en brouillon

L’environnement de navigation n’a pas permis d’ouvrir un onglet de contrôle. Aucune nouvelle capture, validation responsive ou vérification interactive n’est donc revendiquée. Les anciennes captures du README sont datées et identifiées comme telles.

Avant fusion :

1. À 320, 390, 768 et 1440 px : titres lisibles, boutons accessibles et absence de débordement horizontal dans chaque écran.
2. Naviguer au clavier, revenir au tutoriel puis à la préparation : focus sur le titre et champs conservés.
3. Importer un lot synthétique : filtrer, sélectionner, garder/rejeter, changer les légendes ; vérifier qu’une seule fiche est éditable.
4. Amener le gate au PASS, exporter, naviguer, puis modifier une légende : le ZIP devient périmé et la confirmation du test redevient à faire.
5. Vérifier le résumé des coûts, la limite du plan et l’accès aux outils avancés ; fal reste désactivé sans proxy.
6. Vérifier l’absence de requêtes vers Comfy/fal avant le clic explicite correspondant. Ne lancer aucun run payant pour cette revue.

## Référence pédagogique

[Documentation LoRA de Hugging Face Diffusers](https://huggingface.co/docs/diffusers/training/lora) : petit ensemble de paramètres appris, utilisé avec le modèle de base. Le portrait canonique est une référence du studio, jamais une sortie présentée comme mesurée.
