# Registre des anomalies

P0 : perte de données, dépense involontaire ou parcours principal bloqué. P1 : fiabilité, accès ou résultat trompeur important. P2 : confort, documentation ou couverture complémentaire. « Corrigé PR » ne signifie pas déployé ; les preuves exécutées sont dans [validation.md](validation.md).

| ID | Niveau | Défaut confirmé / conséquence | Traitement et état |
| --- | --- | --- | --- |
| A01 | P0 | Recherche rapide par nom déclenche deux fois le limiteur ; photos absentes malgré couverture | Corrigé #104 ; reproduit publiquement au premier contrôle, non systématique au second |
| A02 | P0 | Overpass lent empêche l’apparition des photos | Chargements indépendants, délais et régression #104 |
| A03 | P1 | Rayon fixe, instances filtrées et séquences voisines cachées | Fédération contrôlée, 300/1000/3000 m et chaînes conservées #104 |
| A04 | P1 | Licence supposée ou tronquée ; Mapillary perd géométrie/projection | Droits explicites, attribution et liens ; bbox et position réelle #104 |
| A05 | P1 | Panorama indisponible sans WebGL alors qu’une photo existe | Observé en production ; repli photo entière #104 |
| A06 | P0 | Deux confirmations rapprochées peuvent soumettre deux jobs | Verrou immédiat + inter-onglets ; test double clic #107 |
| A07 | P0 | Réponse de soumission perdue permettrait une seconde dépense | Reçu avant POST et blocage si état ambigu #107 ; réconciliation encore manuelle |
| A08 | P0 | CAST/DÉCOR/son/finalisation n’ont pas de reprise durable équivalente à PRISE | Journal commun, sauvegarde avant effacement du reçu #107 ; test réel fournisseur manquant |
| A09 | P0 | Résultat asynchrone écrit dans le projet sélectionné après son lancement | Projet figé ; master de finalisation et sources figés avant encodage #107 |
| A10 | P0 | Une prise s’attache à des plans non concernés, paramètres affichés différents du plan envoyé | Requête figée depuis le plan, références exactes, association ciblée #107 |
| A11 | P0 | Import répété d’un nom remplace un média ; suppression d’une fiche enlève un média partagé | Identifiants uniques et recherche des références restantes #107 |
| A12 | P0 | Une requête IDB réussie peut précéder un abandon de transaction | Résolution sur `oncomplete`, erreurs visibles #107 |
| A13 | P0 | Liaison d’un dossier peut écraser une version externe divergente | Comparaison avant activation, conflit conservé, liaison suspendue #107 |
| A14 | P0 | Montage charge un exemple et écrit une fausse prise à partir d’une image | Montage initial vide ; exemple explicite ; storyboard sans fausse prise #107 |
| A15 | P0 | Chargement tardif du montage remplace un clip qui vient d’être ajouté | Ajout après chargement du projet, sauvegardes ordonnées #107 |
| A16 | P0 | Export peut dessiner avant seek/décodage ou masquer une source absente | Attente décodage, erreurs de sources, codecs MP4 explicites #107 |
| A17 | P1 | Action/perspective/maquette ne survivent pas correctement au changement de vue | Sauvegarde par plan, état courant fusionné avant écriture #107 |
| A18 | P1 | Promesse « au maximum » sans plafond cloud réel | Réserve et estimation dans les confirmations #107 ; plafond fournisseur non disponible |
| A19 | P1 | Mutations du relais acceptent une origine navigateur étrangère | Refus 403 avant appel fournisseur ; test zéro appel #107 |
| A20 | P1 | Clé en clair dans le champ de saisie | Champ password #107 ; stockage localStorage demeure une frontière de confiance |
| A21 | P1 | Fichiers CAST modernes/audio incomplets à l’import ZIP | Parseurs et extensions conservés ; aller-retour octets testé #107 |
| A22 | P1 | Échec navigateur R8 sur Chromium sans lecture du MP4 de test | CI avec Chrome et artefacts, résultat explicitement retracé ; ne pas supprimer l’assertion de lecture |
| A23 | P1 | Le README confond anciennes fonctions et navigation actuelle | En-tête d’état courant, inventaire distinct des fonctions dormantes #107 |
| A24 | P1 | Aucune preuve de génération réelle sur les nouvelles corrections | Ouvert : nécessite autorisation explicite et budget de validation |
| A25 | P1 | Récupération sans job_id ne dispose pas d’écran de réconciliation | Interface ajoutée dans l’intégration concours : vérification manuelle, même compte, GET seul ; sans numéro retrouvé, blocage conservé |
| A26 | P1 | Persistance navigateur non demandée dans le contrôleur actuel ; risque d’éviction | Statut réel, demande explicite et quota ajoutés ; refus explicite, ZIP indépendant toujours nécessaire |
| A27 | P1 | Revue manuelle de l’aperçu Vercel bloquée par authentification | Ouvert : aucune protection désactivée ; tests CI exécutés sur le build |
| A28 | P1 | Limites 60 s, 12 fps et dépendance encodeurs du navigateur | Limite produit documentée ; non assimilée à un export professionnel universel |
| A30 | P1 | Clés locales accessibles au JavaScript même origine ; ancien relais Comfy présent | Risque résiduel à auditer avant réactivation de la connexion intégrée |
| A31 | P2 | Certaines nouvelles erreurs françaises dans les autres langues | Ouvert : compléter traduction et tests linguistiques après stabilisation |
| A32 | P2 | Aucun test sur téléphone physique ni Safari/Firefox | Ouvert : les deux tailles Chrome ne remplacent pas ces appareils |
| A33 | P2 | URLs Blob anciennes conservées jusqu’au démontage pour protéger les opérations en cours | Limite mémoire connue ; nettoyage fin par consommateurs à envisager après mesure |
| A34 | P2 | Liens de certaines prises/séquences dans Mon studio ouvrent PRISE sans sélection précise | Projet et identifiants exacts ajoutés ; transfert Mon studio vers montage corrigé, scénario navigateur ajouté |

| A35 | P0 | Chrome Linux lit le MP4 mais ne propose pas d’encodeur AAC ; export et master R8 bloqués | Reproduit dans la CI #107 ; encodeur AAC-LC WebAssembly local de secours, version et licence conservées |
| A36 | P0 | Le personnage importé apparaît dans la fiche mais la maquette vide refuse de l’initialiser | `seedLead` accepte désormais une scène neuve vide et respecte les suppressions volontaires ; régression comportementale |
| A37 | P1 | Décor d’exemple R10 affiché mais absent des références réellement envoyées | Génération bloquée avec explication tant que ce décor n’est pas enregistré ; contrôle répété avant soumission |
| A38 | P2 | Test mobile clique Galerie avant qu’elle soit visible ; glissement panorama cible une zone masquée après changement de mise en page | Tests attendent un contrôle interactif et un point stable ; assertions conservées |

| A39 | P1 | Les captures de la CI montrent « Vide » malgré les imports et une alerte de récupération après succès | Indicateurs fondés sur les médias/plans réellement présents ; confirmation de sauvegarde remplace l’alerte ; assertions navigateur ajoutées |

Les codes P0 corrigés restent des corrections à valider, et non une preuve qu’aucun autre défaut P0 ne peut exister. Aucun service payant ne doit être lancé pour vérifier ces lignes sans accord préalable.

## Nouveaux défauts de l’intégration concours

| ID | Niveau | Défaut confirmé | Correction / limite |
| --- | --- | --- | --- |
| A40 | P0 | Nouveaux gestes vidéo : POST direct sans journal ni verrou, projet choisi après le rendu | Journal et verrou communs, projet figé, sources et fiche persistées, reprise sans nouveau POST |
| A41 | P0 | Montage depuis la galerie Mon studio change seulement le hash de la mauvaise page | Navigation vers le studio avec identifiant de média, requête consommée une fois |
| A42 | P1 | Moteur affiché LTX mais moteur omis de la requête figée lors de l’intégration | Moteur explicite, test de graphe H3 adapté à sa migration |
| A43 | P1 | Références au-delà de la limite tronquées, décor potentiellement perdu | Refus avant upload (LTX 4, H3 9) |
| A44 | P1 | cancel_requested traité comme annulation finale | Reçu conservé jusqu’à état terminal fournisseur |
| A45 | P1 | Confirmation vidéo reste cochée après changement du contenu ; maximum présenté comme garanti | Confirmation invalidée, réserve et incertitude explicites en quatre langues |
| A46 | P1 | Lanceur local écrase des noms et ignore le nom effectivement attribué par ComfyUI | UUID, overwrite=false, nom retourné réinjecté ; erreurs et attente bornées |
| A47 | P1 | Dialogue ne confine pas le clavier ; erreur MediaRecorder peut laisser la prévis bloquée | Dialogue natif, restauration du focus ; nettoyage des pistes/URL et erreur visible |
| A48 | P2 | Renommer/supprimer proposés sur des médias sans gestionnaire effectif | Actions limitées aux types réellement pris en charge |

Les validations de cette passe sont consignées dans [integration-concours.md](integration-concours.md). Aucun rendu réel supplémentaire ni déploiement de production n’est attesté.

## Intégration de main après fusion de #110 — 17 octobre

| ID | Niveau | Défaut confirmé | Correction / limite |
| --- | --- | --- | --- |
| A49 | P0 | Nouveau rendu 3D soumis directement, sans reçu ni verrou et projet choisi au retour | Reçu avant POST, verrou commun, UUID, sources et projet figés, reprise du GLB existant |
| A50 | P0 | Import 3D stocké seulement sous URL Blob ; modèle disparu après fermeture | Fichier et fiche dans le coffre, référence durable, ZIP, liste des modèles réutilisables |
| A51 | P1 | Confirmation 3D conservée après remplacement de la photo | Confirmation annulée à chaque changement |
| A52 | P1 | Une erreur de modèle produit une caisse factice | Erreur explicite ; fichier téléchargeable ; aucune substitution silencieuse |
| A53 | P1 | Première CI #111 : dialogue natif laisse Tab sortir ; Firefox/WebKit héritent du canal Chrome | Bouclage clavier explicite, canal propre à Chromium ; assertions maintenues |

| A54 | P0 | Prévis filmée uniquement dans la mémoire de la page, perdue si fermeture avant envoi | Fichier et fiche persistés avant utilisation cloud ; téléchargement et réutilisation locale ; test réel MediaRecorder préparé |
| A55 | P1 | Permission de persistance Firefox sans réponse laisse « Demande en cours » indéfiniment | Attente bornée, état pending distinct du refus, demandes dédupliquées ; tests unitaires attente/accord tardif |
| A56 | P1 | Libellés vidéo/3D changent selon le contenu du contrôle | Noms accessibles explicites et stables ; assertions exactes maintenues |
| A57 | P1 | Import initial WebKit non pris en compte dans les huit parcours CI | Import désactivé jusqu’au coffre prêt ; attente explicite dans les tests ; cause/validation navigateur à confirmer |
| A58 | P1 | Hunyuan3D présenté comme poids ouverts sans préciser les restrictions de sa licence | Restrictions et lien officiel affichés avant confirmation ; qualification fournisseur/concours encore ouverte |

La CI de référence reste rouge (16/40). Les correctifs ci-dessus nécessitent une nouvelle preuve navigateur. Les limites de ressources/éviction sur appareil physique restent à vérifier.

| A49 | P0 | WebKit (Safari privé, navigateurs intégrés aux apps, sessions éphémères) refuse un Blob/File dans IndexedDB : « Error preparing Blob/File data to be stored in object store ». Aucun import ni rendu n’était enregistré ; CAST restait « Vide » | Le coffre réessaie la même écriture en octets (ArrayBuffer + type) et relit les deux formes en Blob ; test unitaire, quatre parcours WebKit de la CI |
