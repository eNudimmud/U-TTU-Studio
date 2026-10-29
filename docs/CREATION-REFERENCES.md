# P0-0 — Bulle de création et références nommées

Le plan actualisé place cette bulle avant P0-1, P0-2 et P0-3. Les PR #155, #156 et #157 restent séparées. Aucune fusion n’est réalisée ici.

## Cause et correction

La barre limitait les images à deux références et « Nouvelle référence » renvoyait dans CAST ou DÉCOR. Elle demandait une deuxième validation de la sélection. La vidéo changeait de parcours selon l’origine des images.

L’accès « Référence » était aussi désactivé lorsque sept pièces jointes étaient choisies : la limite d’une génération bloquait à tort la création et la gestion des fiches. Cet accès reste maintenant disponible.

Une seule bulle contient maintenant Image/Vidéo, le prompt, Photos/Audio/Référence et les options. Une référence possède un nom obligatoire, une description facultative, une catégorie et une à trois photos. Le formulaire s’ouvre vierge : les noms et les images sont ceux que l’utilisateur choisit. Aucune référence de démonstration n’est enregistrée dans sa bibliothèque.

Le nombre de fiches enregistrées n’a pas de quota applicatif. Le bouton « Nouvelle référence » reste visible et la bibliothèque reste accessible même lorsque sept références sont déjà jointes à une création. Un toucher sur une carte la joint ; celles déjà jointes sont signalées. **Sept est la limite des pièces jointes d’une génération, pas celle de la bibliothèque.** Les trois photos d’un même sujet sont réunies localement en une planche. Les puces s’enlèvent individuellement. Les demandes et les résultats apparaissent une seule fois dans le fil ; aucun aperçu vide ni barre de saisie ne recouvre la confirmation.

`readNamedReferences` lit directement les fiches CAST et DÉCOR existantes. Les nouveaux personnages utilisent `Cast/`, les décors `Decors/`, objets et styles `Refs/`. Modifier une référence modifie la même fiche, avec conservation des métadonnées de production. La suppression est confirmée et conserve les fichiers encore utilisés ailleurs.

Les photos et planches sont dans le coffre local IndexedDB, son export ZIP et son dossier lié lorsqu’il est connecté. La bibliothèque est aussi accessible dans Mes créations. Le brouillon et le fil sont séparés par projet ; leurs fichiers utilisent des chemins persistants, jamais une URL blob après rechargement.

## Workflows vérifiés

| Geste | Template officiel |
| --- | --- |
| `creation-image-texte` | `image_flux3_klein_t2i` |
| `creation-image` | `image_flux3_klein_image_edit` |
| `creation-video-texte` | `video_ltx2_5_t2v` |
| `creation-video-refs` | `video_minimax_h3_r2v` |

Les templates UI et les graphes API exacts sont dans `workflows/outils/` et l’index. Les tests les comparent à `graphForGeste`. Aucun fournisseur supplémentaire.

Sources ComfyUI relues le 28 octobre : [ReferenceMultiLatent](https://github.com/Comfy-Org/ComfyUI/blob/35060f0156181ae78a86b10f098f67ce8e83697f/comfy_extras/nodes_edit_model.py) accepte un autogrow de 100 images ; la bulle en utilise sept au plus, les autres pipelines gardent leur limite de quatre. [MiniMaxH3ReferenceToVideo](https://github.com/Comfy-Org/ComfyUI/blob/master/comfy_extras/nodes_minimax_h3.py) accepte neuf images et trois audios autonomes ; la bulle reste à sept images et un audio. Les noms correspondent aux index `<ref_image_n>` ou `<Picture n>` du prompt.

Le cadre de sortie Klein utilise un `EmptyFlux2LatentImage` distinct : il ne suit pas le ratio de la première photo. H3 reçoit la durée et la résolution ; couper le son retire l’audio de `CreateVideo`. Les classes 480p/720p sont alignées au multiple du moteur : la classe 720p peut avoir un côté court de 736 pixels. Une planche représente plusieurs vues d’un seul sujet. L’identité à sept sujets n’est pas une qualité mesurée.

## Rendu et résultat

Le devis est recalculé et confirmé avant tout upload ou POST payant. Le rendu ouvre une vue plein écran avec progression estimée en pourcentage. « Retour » la ferme et laisse le job continuer ; aucun appel d’annulation Comfy. Le résultat suit le chemin existant : reçu durable, récupération, coffre et catalogue.

Garder valide le média ; Favori reste enregistré. Refaire crée une nouvelle demande avec devis et confirmation et conserve le résultat précédent. Partager ouvre la feuille système, ou télécharge le fichier si cette feuille est indisponible. Le résultat image peut devenir une référence ; pour la vidéo, le bouton précise qu’il utilise sa dernière image. Le montage conserve la durée choisie, dont dix secondes.

Les sources originales restent liées à la note de production : retirer une fiche de la bibliothèque ne casse pas Refaire. Après rechargement, aucun POST n’est rejoué. Un résultat récupéré par le fournisseur rejoint sa bulle via son job id. Un reçu ambigu passe par la récupération existante.

## Vérification

Unitaires : catalogue partagé, séparation des projets, métadonnées, sept liens dans Klein, canevas, options H3/audio, prompt seul, devis et parité FR/EN/DE/ES. E2E tactiles : formulaire vierge, création de quatorze fiches dans les quatre catégories, deux fiches homonymes sans écrasement, recherche, filtres, rechargement, réemploi en un toucher et création d’une nouvelle fiche avec sept références déjà jointes. Les autres parcours couvrent deux références puis prompt seul, garder/favoris, édition, suppression confirmée, vidéo et montage. Les médias des tests sont des exemples du dépôt et Comfy est simulé. Les deux captures montrent la bibliothèque vide et le formulaire vierge du build local, sans références personnelles imitées ni résultat de génération.

Build de production Node 22 et contrôles de débordement aux tailles 390×844, 844×390, 1024×600 et 1280×800. Preuves dans `docs/preuves/creation/`.

**0 crédit réel dépensé**, aucun job id, aucun job annulé. La validation réelle P0-0 reste à effectuer, au plus 15 crédits sur les 60 du plan. Les devis restent des hypothèses liées aux dimensions, à la durée et aux références. La réserve de solde ne garantit pas un plafond de facturation.
