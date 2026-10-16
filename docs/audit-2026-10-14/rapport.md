# Audit technique U*TTU Studio — 16 octobre 2026

Le parcours local possède des éléments réels réutilisables, mais le critère de réussite complet ne peut pas encore être certifié en production. Les corrections sont proposées en brouillon ; aucune fusion, aucun déploiement manuel de production, aucun rendu payant pendant cet audit.

## Périmètre et versions

- Point de départ : main `338d0150ddc700831e22ec90d8638309032a63de`.
- Mise à jour de l’utilisateur intégrée : R8 « Finaliser » (`105043a6`, PR #105) et R9 « Partir de cet exemple » (`2e4f4d38`, PR #106). R10 « Galerie sans cartes vides » (PR #108) intégré ensuite. R10b (PR #109) intégré le 16 octobre : quatre décors et planche d’Uttu conservés sans retouche. Main relu : `3079a0bc62597f5b4ab43900ce53f19ed1989176`.
- [PR #104](https://github.com/eNudimmud/U-TTU-Studio/pull/104) : cartographie, dépendances réseau, licences, repli photo.
- [PR #107](https://github.com/eNudimmud/U-TTU-Studio/pull/107) : imports, données, soumissions, reprise, prise réelle et montage. PR empilée sur #104 pour isoler la revue.
- Application publique contrôlée : `https://u-ttu-studio.vercel.app/studio`. Les ajouts R9 sont visibles ; le SHA du déploiement n’est pas exposé dans la page et n’est donc pas attesté par son apparence.

L’inspection porte sur les chemins actifs, leurs dépendances, les anciens contrôleurs et les rapports pertinents. Elle ne certifie ni tous les services externes, ni toutes les combinaisons de modèles. Voir [matrice](matrice.md), [registre](anomalies.md), [validation](validation.md) et [cartographie](cartographie.md).

## Architecture réellement appelée

Next.js 16.3.6 sert `/studio`, `/mon-studio` et les relais nécessaires. `studio-app.tsx` monte `StudioProvider` de `studio-session.tsx`. Les vues actives sont `stage-screens.tsx` pour CAST/DÉCOR, `prise-stage.tsx` et `montage-stage.tsx`. Les données suivent `coffre/`, les images `creation/`, les vidéos `render/`, les exports `montage/`.

Un second contrôleur volumineux, `studio-context.tsx`, conserve l’ancien parcours LoRA, fal et Farpy. Son existence et ses tests ne prouvent pas son accessibilité depuis le studio actuel. Aucun de ces modules n’a été supprimé pour simplifier artificiellement l’audit.

### CAST

Les gestes actifs produisent une image/planche par Comfy. Les graphes locaux contiennent les références, les prompts et les nœuds d’enregistrement. Les exemples R9 remplissent le formulaire ; ils ne lancent pas de rendu. Les imports ajoutés au parcours gratuit produisent une fiche de personnage et conservent les octets du média. Les identifiants uniques empêchent l’écrasement lorsque deux fichiers portent le même nom. Les copies et suppressions conservent les médias encore référencés ailleurs.

L’entraînement H3 historique prépare un ZIP de clips et références, appelle `minimax/h3/ref2va/trainer`, suit la file fal, contrôle le fichier safetensors et conserve les coûts disponibles. La réutilisation LoRA a son propre code. Ce chemin reste **dormant dans la navigation actuelle**, sans validation distante ni nouvelle preuve d’identité. Le réactiver constituerait un lot séparé après stabilisation du parcours actuel.

### DÉCOR et repérage

Les décors peuvent provenir d’un import, d’une génération ou du repérage. Photon géocode ; Overpass fournit les bâtiments ; Panoramax fournit les photographies et Mapillary reste facultatif avec jeton. La couverture physique des fournisseurs est distincte des pertes introduites par l’application.

Les causes confirmées dans le code sont un limiteur déclenché deux fois pour une recherche rapide, l’attente commune des bâtiments et photos, le filtrage d’instances fédérées, le rayon fixe et l’élimination des séquences voisines. Les corrections séparent ces flux, bornent les délais, autorisent les hôtes exacts du catalogue officiel, conservent les séquences et proposent 300 m, 1 km, puis 3 km. Les réponses anciennes n’écrasent plus une recherche récente. Le repli sans panorama conserve une vraie photographie.

La copie exige auteur et licence ouverte identifiée. La version de licence, sa source et le lien d’origine sont conservés ; une licence absente ne devient jamais arbitrairement CC BY-SA. Les liens cartographiques Google servent à extraire un lieu ; aucune photographie Google n’est copiée par ce correctif. La couverture mondiale n’est pas garantie et aucun abonnement payant n’est ajouté.

### PRISE

La maquette place des figures, définit le cadrage et le texte. Elle ne constitue pas à elle seule un rendu conditionné par un modèle 3D. Le bouton d’image intermédiaire sans raccordement réel est désactivé avec explication. La génération vidéo transmet les références et le texte du plan effectivement choisi, selon le profil H3 mesuré du dépôt : 4 pas, 5 s, 9:16. Un réglage sans mesure reste fermé.

La sélection de personnages/décor, le texte et la maquette sont enregistrés par projet et plan. Une vidéo terminée revient au bon plan ; elle n’est plus ajoutée à tous les plans. L’envoi au montage conserve le vrai MP4 lorsqu’il existe. Un storyboard reste une image et n’est plus présenté comme une prise vidéo artificiellement réussie.

### MONTAGE et export

La timeline permet assemblage, ordre, rognage, scission, pistes sonores, fondus et sauvegarde de la liste de montage. Elle est vide pour un nouveau projet ; l’exemple R9 demande un geste explicite. L’ajout de plusieurs fichiers attend le chargement initial pour éviter qu’un état tardif remplace les clips ajoutés.

L’export utilise Canvas, Web Audio, WebCodecs et Mediabunny. Il attend les images vidéo décodées avant de les dessiner, vérifie les sources et échoue explicitement si un média requis est inaccessible. Un fichier vidéo sans piste sonore est accepté ; une piste sonore existante mais illisible ne devient pas silencieuse à l’insu de l’utilisateur. La sortie demandée est MP4 H.264/AAC. Un encodeur AAC WebAssembly local prend le relais lorsque l’encodage natif manque (cas confirmé sous Chrome Linux). Sans encodeur H.264 compatible, une erreur explicite reste affichée.

Limites actuelles : export local court, 60 s maximum, 960×540 ou 540×960 à 12 images/s. Le master préparé pour R8 est 720p à 24 images/s ; la passe Comfy 1080p/4K reste une opération distincte et payante. Ces limites empêchent de qualifier l’outil d’éditeur professionnel complet. R8 est préservé et reçoit le même journal de reprise que les autres opérations. Le projet et les sources sont figés avant la préparation du master.

### Coffre, Obsidian, imports et fichiers

IndexedDB `uttu-coffre` contient des entrées texte ou Blob indexées par chemin, sous `Projets/<slug>/`. Les notes Markdown conservent les liens Obsidian. CAST, DÉCOR, prises, sons, montage et maquette sont des données réelles ; la sauvegarde ne dépend pas d’un compte U*TTU.

La promesse d’écriture se résout désormais après la validation de la transaction, et non après la seule requête. Les erreurs de quota/transaction sont remontées. Les opérations longues utilisent le projet d’origine. Les écritures de plans et montages sont séquencées pour limiter les écrasements dans un même onglet.

ZIP et dossier importés sont filtrés par chemins autorisés ; un fichier existant n’est pas remplacé silencieusement. Le format CAST actuel et les médias audio sont repris. Un conflit entre dossier externe et coffre local suspend la liaison : les deux contenus restent conservés, mais la résolution du conflit est encore manuelle. Une copie locale et un dossier lié ne constituent pas une synchronisation bidirectionnelle temps réel.

Le contrôle réel ajouté ferme une page puis en ouvre une autre dans le même profil. Il ne simule pas un effacement des données système ni un arrêt brutal de tout l’appareil. La persistance permanente et la résistance à l’éviction restent distinctes. Le chemin actuel ne confirme pas l’appel à `navigator.storage.persist()` pourtant annoncé par l’ancien document VAULT ; cette promesse est corrigée dans la documentation.

### Paiements, reprise et erreurs réseau

Chaque action payante garde sa confirmation explicite et relit le solde. Le verrou immédiat empêche deux clics rapprochés ; Web Locks empêche deux onglets de soumettre simultanément. Un navigateur sans cette protection refuse le lancement avec explication.

Avant le POST payant, un reçu durable est écrit. L’impossibilité de l’écrire empêche la dépense. Après réponse, le numéro du job est enregistré. Recharger suit ce même job ; la récupération ne soumet pas de nouvelle génération. Le reçu est supprimé seulement après sauvegarde du résultat, ou après constat distant d’un état terminal sans résultat, archivé localement.

Un POST accepté mais dont la réponse est perdue reste ambigu : le navigateur conserve le reçu et bloque les nouveaux envois. Sans clé d’idempotence fournie par le service, une relance automatique serait dangereuse. La réconciliation de ce cas exige encore la consultation de l’historique Comfy ; aucune interface de réconciliation complète n’est livrée ici.

Les montants sont des estimations et réserves de solde. Aucun plafond dur de facture fournisseur n’est prouvé. Une différence de soldes peut aussi inclure une activité extérieure à cet onglet. Les anciens « au maximum » ont été remplacés dans les confirmations actives ; la reprise d’un résultat sans coût fiable conserve un coût inconnu.

### Sécurité et confidentialité

Les clés restent hors du coffre et de ses ZIP ; le champ de saisie Comfy est masqué. Les tests utilisent seulement des valeurs factices. Le relais Comfy vérifie les mutations provenant d’une autre origine navigateur et les refuse avant appel distant. Les chemins de fichiers sont validés ; les domaines d’images fédérées proviennent du catalogue officiel, pas d’une URL collée arbitrairement.

Limites : les clés persistées dans localStorage sont lisibles par le JavaScript de la même origine. L’ancien relais de pages Comfy constitue donc une frontière de confiance à réexaminer avant d’exposer à nouveau la connexion intégrée. Le contrôle ajouté ne remplace pas un audit indépendant de sécurité, de la configuration Vercel, des permissions des comptes ni des dépendances distantes. Aucun secret de déploiement n’a été demandé ou lu.

## Comparaison des rapports avec les faits

| Rapport ou affirmation | Constat de l’audit |
| --- | --- |
| README : trois gestes, LoRA directement accessible | Navigation actuelle à quatre espaces ; ancien contrôleur distinct. Description historique signalée. |
| README : aucune vraie prise jamais exécutée | Contredit par la mesure H3 du 7 octobre dans `docs/mesures/` ; aucune nouvelle prise payante pendant cet audit. |
| R7 : envoi d’une image comme prise, voix/musique d’exemple par défaut | Comportement confirmé dans le code, corrigé pour ne pas confondre storyboard, exemples et production. |
| QA : PASS LoRA/fal/Farpy | Rapports historiques majoritairement simulés ou explicitement « non exécuté ». Pas une validation de l’interface actuelle ni de l’API actuelle. |
| VAULT : stockage persistant demandé, lecture du dossier puis réécriture | Appel non confirmé dans le contrôleur actuel ; risque de divergence de dossier corrigé sans écrasement. |
| R8 : 4,1/4,5 crédits pour 5/30 s en 1080p | Mesures déclarées dans le code de la mise à jour, non répétées ici. 4K/nettoyage restent estimés. |
| CI verte | Valide les assertions exécutées. Les assertions lexicales et mocks ne prouvent pas un rendu payant réel. |

## Décision de livraison

Conserver les PR en brouillon jusqu’à revue des résultats. Fusionner et déployer seulement après validation. Le parcours gratuit et l’export doivent être évalués sur les MP4 réellement produits ; les générations payantes nécessitent ensuite un essai explicitement autorisé, avec budget et contrôles qualité. Les fonctions dormantes, les cas ambigus et les limites matérielles restent nommés dans la matrice et le registre.
