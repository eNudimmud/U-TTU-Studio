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
| A25 | P1 | Récupération sans job_id ne dispose pas d’écran de réconciliation | Ouvert : conserver le reçu, contrôler l’historique, ne pas conseiller une suppression de stockage |
| A26 | P1 | Persistance navigateur non demandée dans le contrôleur actuel ; risque d’éviction | Ouvert ; promesse documentaire retirée, ZIP/dossier à utiliser pour copie indépendante |
| A27 | P1 | Revue manuelle de l’aperçu Vercel bloquée par authentification | Ouvert : aucune protection désactivée ; tests CI exécutés sur le build |
| A28 | P1 | Limites 60 s, 12 fps et dépendance encodeurs du navigateur | Limite produit documentée ; non assimilée à un export professionnel universel |
| A29 | P1 | LoRA/fal/Farpy hors du parcours actif | Partiel/dormant documenté ; ne pas afficher comme opérationnel ni réactiver sans validation |
| A30 | P1 | Clés locales accessibles au JavaScript même origine ; ancien relais Comfy présent | Risque résiduel à auditer avant réactivation de la connexion intégrée |
| A31 | P2 | Certaines nouvelles erreurs françaises dans les autres langues | Ouvert : compléter traduction et tests linguistiques après stabilisation |
| A32 | P2 | Aucun test sur téléphone physique ni Safari/Firefox | Ouvert : les deux tailles Chrome ne remplacent pas ces appareils |
| A33 | P2 | URLs Blob anciennes conservées jusqu’au démontage pour protéger les opérations en cours | Limite mémoire connue ; nettoyage fin par consommateurs à envisager après mesure |
| A34 | P2 | Liens de certaines prises/séquences dans Mon studio ouvrent PRISE sans sélection précise | À compléter ; galerie et montage conservent les fichiers, pas de suppression |

Les codes P0 corrigés restent des corrections à valider, et non une preuve qu’aucun autre défaut P0 ne peut exister. Aucun service payant ne doit être lancé pour vérifier ces lignes sans accord préalable.
