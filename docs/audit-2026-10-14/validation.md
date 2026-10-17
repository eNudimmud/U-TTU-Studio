# Validation — preuves et limites

> Version historique #104/#107. Pour la branche concours #110 et les nouveaux correctifs, lire [l’intégration concours](integration-concours.md). Les fonctions LoRA/fal/Farpy et les règles LTX décrites ci-dessous ont changé dans cette branche.

État relevé le 16 octobre 2026. Aucun appel payant réel effectué par cet audit. Les appels cloud des suites automatisées utilisent des réponses simulées et des clés factices. Le fichier MP4 de fixture est un vrai média local de trois secondes (H.264 1920×1080, AAC), pas le produit d’une génération exécutée pendant cette mission.

## Automatisation exécutée

| Version / exécution | Tests Node | Types / build | Navigateur |
| --- | --- | --- | --- |
| Base initiale `338d0150` | 319 réussis, 1 ignoré | Réussis localement | Anciennes preuves du dépôt distinctes de cet audit |
| #104 `18bfd5e`, [CI 38544492900](https://github.com/eNudimmud/U-TTU-Studio/actions/runs/38544492900) | 324 réussis, 1 ignoré | Réussis | 4 réussis, Chromium, deux tailles |
| #104 après R8/R9 `efd4686`, [CI 38660191878](https://github.com/eNudimmud/U-TTU-Studio/actions/runs/38660191878) | 332 réussis, 1 ignoré | Réussis | 6 réussis, 2 échecs : lecture MP4 R8 attendue trop longtemps |
| #104 `92678aa`, [CI 38728457036](https://github.com/eNudimmud/U-TTU-Studio/actions/runs/38728457036) | 332 réussis, 1 ignoré | Réussis | **10 réussis**, Chrome, ordinateur/mobile, 47,1 s |
| #107 `712271e`, [CI 38727049394](https://github.com/eNudimmud/U-TTU-Studio/actions/runs/38727049394) | 343 réussis, 1 ignoré | Réussis | **5 réussis, 9 échecs** : personnage absent de la maquette, AAC non encodable, sélection galerie mobile et glissement panorama |
| #104 après R10 `75e9ed2`, [CI 38818150540](https://github.com/eNudimmud/U-TTU-Studio/actions/runs/38818150540) | 332 réussis, 1 ignoré | Réussis | **10 réussis**, Chrome ordinateur/mobile, 39,7 s |
| #107 après R10 `e3ceee8`, [CI 38818233890](https://github.com/eNudimmud/U-TTU-Studio/actions/runs/38818233890) | **344 réussis, 1 ignoré**, 0 échec (345 tests, 87 suites) | **Réussis** | **16 réussis**, Chrome ordinateur/mobile, 1,3 min |
| #104 R10b `e82a4e5`, [CI 38883330542](https://github.com/eNudimmud/U-TTU-Studio/actions/runs/38883330542) | 331 réussis, 1 échec, 1 ignoré | Non exécutés après l’échec | Une assertion propre à #107 avait été incluse par erreur dans #104 ; rétablie dans son périmètre, contrôle de confirmation conservé |
| #107 `d48c7d3`, [CI 38818748589](https://github.com/eNudimmud/U-TTU-Studio/actions/runs/38818748589) | 344 réussis, 1 ignoré | Réussis | **16 réussis**, 1,4 min ; décor d’exemple non transmis bloqué avant confirmation |
| #107 R10b `3a92f01`, [CI 38883387105](https://github.com/eNudimmud/U-TTU-Studio/actions/runs/38883387105) | **344 réussis, 1 ignoré** | **Réussis** | **16 réussis**, 1,3 min ; indicateurs CAST/DÉCOR/PRISE et disparition de l’alerte de récupération contrôlés |
| #104 R10b `73ec49f`, [CI 38883673887](https://github.com/eNudimmud/U-TTU-Studio/actions/runs/38883673887) | **332 réussis, 1 ignoré** | **Réussis** | **10 réussis**, Chrome ordinateur/mobile |

Le test ignoré est le rendu Blender : le binaire attendu n’est pas disponible. Il ne constitue pas un succès Farpy. La suite contient de nombreux contrôles de chaînes de code en plus des tests comportementaux. Leur nombre brut n’est pas un indicateur suffisant de fonctionnement réel.

La restriction de lancement locale est `socket() failed: Operation not permitted`. Aucun contournement n’a été tenté ; l’exécution dans les runners GitHub reste une preuve distincte. Chrome est utilisé en CI pour vérifier les codecs MP4, avec traces/captures d’échec et fichiers exportés conservés sept jours comme artefacts.

## Fichiers effectivement produits et inspectés

Les quatre MP4 de la CI `38818233890` ont été téléchargés puis analysés indépendamment avec `ffprobe`. Le ZIP correspond à l’empreinte SHA-256 publiée par GitHub (`b4cafcdee609ac421011d159851557c4eba7a1695d64fb8aa7b5b8171aa80ee1`). Le détail reproductible est dans [exports-ci-38818233890.json](exports-ci-38818233890.json).

| Parcours | Sortie ordinateur et mobile | Observation |
| --- | --- | --- |
| Image importée → storyboard | H.264, 540×960, 12 images/s, 5,000 s vidéo ; AAC stéréo 48 kHz | 121 594 / 122 021 octets ; piste audio de 5,035 s (padding codec) |
| Deux vidéos importées | H.264, 960×540, 12 images/s, 6,000 s vidéo ; AAC stéréo 48 kHz | 147 502 / 147 787 octets ; piste audio de 6,037 s |

Les images de la CI ont également été ouvertes pour inspection visuelle. Elles montrent le montage, les deux clips et l’interface d’export dans les deux formats d’écran. Elles ont révélé deux incohérences textuelles supplémentaires : états CAST/DÉCOR « Vide » après import et notification de récupération restée affichée après sauvegarde. Les corrections et leurs assertions sont dans la révision suivante, qui intègre aussi R10b. La CI R10b `38883387105` a ensuite passé les mêmes contrôles, y compris les nouveaux indicateurs. Son archive a été vérifiée par SHA-256 puis ses quatre MP4 analysés : [relevé ffprobe](exports-ci-38883387105.json).

Deux résultats et deux captures de cette révision sont conservés dans le dépôt : [storyboard vertical MP4](preuves/storyboard-vertical.mp4), [montage de deux clips MP4](preuves/montage-deux-clips.mp4), [capture mobile](preuves/export-mobile.png), [capture ordinateur](preuves/montage-desktop.png). Ce sont des médias de test issus des ressources existantes du dépôt. Ils prouvent l’export local ; ils ne prouvent aucune génération payante réelle.

## Scénarios ajoutés

| Scénario | Nature de la preuve |
| --- | --- |
| Import de fichiers homonymes | Les contenus distincts et fiches sont conservés dans le coffre de test |
| Export/import ZIP | Comparaison des octets CAST, DÉCOR, vidéo et audio après aller-retour |
| Stockage refusé avant soumission | Zéro appel `submit` au faux client |
| Soumission à réponse ambiguë | Reçu conservé ; une seconde tentative ne produit aucun second POST |
| Refus explicite d’authentification | Reçu libéré, aucun faux résultat sauvegardé |
| Projet changé pendant le travail | Le résultat écrit dans le coffre épinglé reste dans le projet initial |
| Association d’une prise | Un seul plan ciblé ; nouvelle intégration du même résultat sans doublon |
| Média partagé | La suppression d’une fiche ne supprime pas le média référencé par une autre |
| Conflit avec dossier externe | Les deux versions restent intactes ; la liaison échoue explicitement |
| Proxy cross-origin | Refus avant appel amont, vérifié avec transport instrumenté |
| Géocodage rapide / Overpass en panne | Services cartographiques simulés ; photo et attribution visibles sur deux tailles |
| Sans WebGL | Capacité WebGL désactivée dans le test ; vraie image JPEG chargée en repli |
| Import gratuit → storyboard → MP4 → réouverture | Téléchargement du MP4 réellement encodé ; analyse codec/durée/dimensions ; nouvelle page du même contexte retrouve les données |
| Confirmation PRISE → double clic → interruption | Contrat cloud simulé, contrôle du prompt envoyé, un seul POST, reprise et conservation des octets du MP4 de fixture |
| Deux vidéos importées → montage de 6 s | Export réel, codec H.264/AAC et durée contrôlés ; décodage de deux images non noires dans le navigateur |
| Finaliser R8 | Contrat Comfy simulé ; confirmation, graphe, récupération et lecture du MP4 de fixture |

Les résultats de chaque scénario navigateur doivent être lus dans le résultat final de sa CI. Une assertion ajoutée au fichier de test n’est pas une assertion exécutée avec succès.

## Vérifications manuelles du site public

| Contrôle | Observation réelle |
| --- | --- |
| Ouverture `/studio`, sans compte | Les quatre espaces s’ouvrent ; CAST et DÉCOR sont vides ; aucune génération lancée |
| Mise à jour R9 | Boutons « Partir de cet exemple » visibles, y compris Uttu canon |
| Recherche « Lausanne Place Saint-François », contrôle initial | Coordonnées 46.5196, 6.6330 puis « Une recherche à la fois » ; défaut reproduit |
| Même recherche, 15 octobre | Photo Panoramax de jo2sm trouvée ; erreur WebGL dans le lecteur ; jeton Mapillary absent indiqué |
| Panoramax API publique | 20 résultats obtenus dans les 300 m au premier contrôle ; une licence CC-BY-SA-4.0 explicitement fournie |
| PRISE après R10, contrôle du 16 octobre (Zurich) | Trois décors étiquetés « EXEMPLE », aucun sélectionné ; invitation à créer son lieu. Uttu et « Composer l’image » encore présents dans le projet public vide ; protections proposées dans #107 |
| MONTAGE, 15 octobre | « Prêt » dès le projet vide ; montage d’exemple de 7 s avec voix/musique ; cela ne représente pas des prises de l’utilisateur |
| Coûts CAST/DÉCOR publics | « Au maximum 18 crédits (estimation) » encore affiché ; correction proposée, non déployée |
| Aperçu Vercel #104 | Page de connexion Vercel ; pas de revue manuelle du correctif derrière cette protection |

Ces contrôles manuels ont été faits dans un navigateur distant de bureau. Les dimensions mobile de la CI ne constituent pas un téléphone physique. Le SHA du site public n’est pas déduit de sa seule interface.

## Opérations non validées en production

1. Fusion, déploiement et contrôle manuel des deux PR : aucune fusion effectuée.
2. CAST réel pour chaque geste actif, DÉCOR réel pour chaque transformation, plusieurs prises H3 successives : contenu, identité, audio et facture réelle.
3. Reprise d’un vrai job après perte réseau, quota disque ou fermeture du navigateur ; récupération de chaque type de média, y compris finalisation.
4. Cas ambigu où le fournisseur accepte un POST sans que le studio reçoive le numéro ; réconciliation manuelle nécessaire.
5. Finalisation R8 1080p puis 4K/nettoyage : qualité, durée, synchronisation sonore, coût à froid et taille du fichier.
6. Entraînement LoRA H3 et Flux, réutilisation fal, rendu Blender/Farpy : anciennes bibliothèques dormantes, non réactivées ni testées à distance.
7. Mapillary authentifié et couverture réelle sur plusieurs régions ; Panoramax sur plusieurs instances, capture et attribution exportées.
8. Authentification Comfy par session, expiration des jetons, compatibilité des relais après changement fournisseur ; limites de confiance du code tiers même origine.
9. Safari/iOS, Firefox, Chrome Android réel, accessibilité avec lecteur d’écran, export proche de 60 s sous pression mémoire et mode PWA.
10. Réouverture après arrêt complet du processus/appareil, éviction de stockage, permission du dossier Obsidian réel, résolution des conflits externes et gros ZIP.
11. Publication Web Share sur téléphone, partage effectif vers une autre application et restauration entre deux appareils par ZIP.

## Critère utilisateur

| Étape | Verdict à ce stade |
| --- | --- |
| Créer/importer un personnage | Import local corrigé et testé ; création cloud à valider réellement |
| Choisir/créer un décor | Import et repérage partiellement vérifiés ; génération cloud non répétée |
| Composer/générer une vraie prise | Composition persistée ; orchestration testée avec contrat simulé ; nouvelle vraie génération bloquée par absence d’autorisation de dépense |
| Enregistrer plusieurs prises | Code ciblé et tests de persistance ; plusieurs générations réelles à effectuer |
| Assembler au montage | Deux vidéos assemblées, exportées et décodées dans les deux tailles Chrome ; CI réussie |
| Exporter une vidéo exploitable | Quatre MP4 téléchargés et analysés : H.264/AAC, 5/6 s ; limites 12 fps et 60 s conservées |
| Retrouver le projet après fermeture | Fermeture/réouverture de page couverte ; arrêt système/éviction non validés |

Le critère global ne sera déclaré satisfait qu’après validation du parcours complet sur le déploiement cible et une génération réelle explicitement autorisée. Les tests non payants apportent des preuves utiles, sans se substituer à cette étape.
