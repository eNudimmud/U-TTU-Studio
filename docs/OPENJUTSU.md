# OpenJutsu dans les outils — 28.10.2026

## Inventaire avant intégration

Source officielle : [Comfy-Org/comfy-openjutsu](https://github.com/Comfy-Org/comfy-openjutsu), arbre `70ec62df0eda7c58697ea3ac2050588513651583`, lu le 28.10.2026. L’app hébergée est [Openjutsu sur Comfy](https://comfy.org/hub/apps/openjutsu/), ouverte et vérifiée sans importer de média ni lancer de rendu.

L’app remplace la personne principale d’une portion de vidéo de 5 à 15 secondes par un personnage fourni en image ; elle conserve scène, performance et son. Le clone officiel utilise MiniMax H3, SAM 3.1, un pack `h3_character_swap` patché et des LoRAs dédiées. Son README demande un déploiement Comfy Developer Platform préparé et une clé côté serveur. Le clonage ne crée pas ce déploiement.

Le parcours officiel peut également générer une première image par Comfy Router (GPT Image 2.5 dans le code source), facturée séparément de la vidéo. La page hébergée affiche cette charge séparée. Le code public permet de désactiver l’ancrage ; U*TTU ne pilote pas les réglages de la page hébergée.

## Coût et choix de livraison

Le relevé antérieur `app-proxy/openjutsu` de 240 crédits dans `docs/mesures/test-visiteur-2026-10-27.md` ne précise pas les paramètres ni la durée ; il ne devient pas un devis du Studio. Aucune estimation chiffrée n’est inventée. Le panneau demande de vérifier le devis dans Comfy et signale la charge de l’image de départ. Son lien ouvre l’app ; ce n’est pas un bouton de génération.

**0 crédit dépensé**, aucun job soumis ou annulé pour cette intégration. Aucun déploiement, abonnement ou stockage Comfy supplémentaire créé. Les frais de l’app restent à confirmer dans Comfy avant un lancement et ne sont pas engagés dans le budget de vérification de 60 crédits.

## Intégration

La cause de l’absence était l’absence d’entrée dans le catalogue commun, pas un workflow du Studio en panne. Une entrée `vid-openjutsu` de la famille Vidéo alimente maintenant la grille, la recherche, les menus et les outils de PRISE. Elle ouvre un panneau traduit FR/EN/DE/ES avec un lien explicite vers l’app officielle et sa source. La vignette est le portrait canonique d’Uttu déjà présent dans le dépôt ; elle n’est pas présentée comme un rendu OpenJutsu.

Le type d’état `app` distingue cet accès des graphes exécutables par le Studio. Ni faux graphe API, ni faux coût mesuré, ni capacité d’exécution accordée à l’agent. L’option « modèles du studio seulement » masque aussi l’accès direct, car U*TTU ne peut pas garantir l’absence du modèle Router de l’app hébergée. Les médias et résultats se choisissent et se récupèrent dans Comfy ; aucun fichier n’est transmis à l’ouverture du panneau.

Le workflow source reste dans le dépôt officiel. L’index des workflows exécutés par U*TTU et le registre des coûts ne changent pas, puisque cette version n’exécute pas le graphe OpenJutsu.

## Vérification

Tests de catalogue, rôle d’app externe, absence de devis et d’exécution native, et respect des préférences. Parcours navigateur bureau/mobile : recherche, classement Vidéo, vignette, panneau, quatre formats, cibles 44 px, ouverture explicite d’un nouvel onglet et zéro POST de génération ou d’import. L’ouverture distante est simulée dans les tests ; aucune qualité de rendu n’est revendiquée.


Résultats locaux : **599 tests unitaires réussis, 1 ignoré** ; TypeScript et build de production Node 22 réussis. **10 parcours navigateur réussis** : les 4 nouveaux cas OpenJutsu (bureau/mobile, ouverture et préférences) et 6 cas de non-régression (grille/vignettes, recherche et navigation du hub, sauvegarde des brouillons). Les nouveaux cas ont été rejoués après correction de l’encodage UTF-8 de la page Comfy simulée, sans changement du produit.

Preuves : `docs/preuves/openjutsu/openjutsu-outils-1280x800.png` et `openjutsu-mobile-390x844.png`. Aucun rendu OpenJutsu produit ou présenté comme validé.
