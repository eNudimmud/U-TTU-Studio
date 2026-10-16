# Audit — intégration de la version concours, 16 octobre 2026

Cette livraison poursuit la mission complète. Elle rapproche les correctifs des PR #104/#107 et la version concours de JD, sans fusionner ni remplacer sa branche. Le résultat n'est pas encore une certification de production.

## Versions et limites de preuve

- Main relu : `3079a0bc62597f5b4ab43900ce53f19ed1989176`.
- Version concours intégrée : PR #110, `3dabc5f853aa8f11335572034973d45db182be18`, incluant les devis LTX estimés, les gestes vidéo, la prévis et les migrations de graphes du 16 octobre.
- Corrections précédentes : #104 `73ec49ffa2bc0ee6af31c09ac426b57c051b892c` et #107 `332b05ce47035297b325f0056267b8871b2e87ad`.
- Branche de revue : `audit/hackathon-integration-20261016`, base `concours/ltx-flux3-open-source`.
- Zéro nouveau rendu payant, zéro entraînement, aucun secret copié dans les rapports, aucune fusion sur main, aucune publication sociale ni inscription au concours.

Les documents [rapport](rapport.md), [matrice](matrice.md), [anomalies](anomalies.md), [cartographie](cartographie.md) et [validation](validation.md) conservent l'inventaire et les preuves antérieures. Cette note décrit les changements de périmètre et les nouveaux résultats. Les mesures H3/Klein historiques ne prouvent pas la validation des graphes migrés.

## Périmètre préservé

Les quatre espaces, l'identité visuelle, les exemples R10b et les workflows dédiés sont conservés. LTX reste le moteur par défaut, H3 sélectionnable ; les gestes raccord, caméra, prévis, élargir et effacer restent présents. Les estimations LTX ajoutées par JD sont conservées comme estimations, sans les transformer en mesures.

La suppression du code dormant fal/LoRA/Farpy provient de la PR #110. L'intégration conserve cette décision ; elle ne réintroduit pas les anciens contrôleurs. Leur audit historique reste lisible, mais ils ne constituent plus des fonctions livrées par cette version. La préparation locale de jeux de données restante ne prouve pas un entraînement opérationnel.

## Corrections supplémentaires

1. **Gestes vidéo sécurisés.** Le même verrou synchrone et inter-onglets protège tous les envois. Un reçu est écrit avant le POST payant. Projet, identifiant, devis et fichiers sources sont conservés ; vidéo et fiche sont enregistrées avant d'effacer le reçu. Une reprise suit le numéro existant et ne soumet jamais un nouveau graphe. Les nouveaux gestes ne peuvent plus contourner ce dispositif.
2. **Réconciliation d'un envoi ambigu.** Crédits montre le reçu, sa date et son projet, permet son téléchargement sans l'empreinte du compte, puis l'association manuelle à un identifiant retrouvé dans l'historique Comfy. Confirmation explicite et même compte requis ; contrôle GET du job. Une modification concurrente du reçu annule l'association. La récupération manuelle ne prétend pas mesurer le coût par une ancienne différence de solde.
3. **Protection du coffre.** Mon studio affiche le statut fourni par le navigateur et propose une demande explicite de persistance. Refus, API absente et quota inconnu restent distincts d'un stockage protégé. Une copie ZIP indépendante reste nécessaire ; effacer les données du navigateur supprime toujours les projets locaux.
4. **Réutilisation exacte.** Liens avec projet et identifiant de prise, plan ou séquence ; une séquence demandée mais absente n'ouvre pas silencieusement une autre séquence. Ajouter un média depuis Mon studio ouvre le vrai montage et consomme la demande une seule fois, pour éviter un doublon au rechargement. Les gestes vidéo ont une fiche réutilisable et un accès au montage.
5. **Moteur, références et préférences.** Le moteur réellement envoyé suit celui du plan confirmé. Une sélection trop grande est refusée avant upload (LTX : 4 références ; H3 : 9), au lieu d'omettre silencieusement un décor. Les restrictions de modèle sont revérifiées dans les gestionnaires d'envoi. `cancel_requested` reste un travail en cours, pas un résultat terminal libérant le reçu.
6. **Confirmation et accessibilité.** Dialogues natifs avec confinement du clavier, Échap et restitution du focus. Toute modification des fichiers, du texte ou du format d'un geste vidéo annule son ancienne confirmation. La prévis libère ses pistes et signale une erreur d'enregistrement ; ses URL temporaires sont libérées. Les actions de renommage/suppression sans gestionnaire effectif ne sont plus proposées sur les cartes vidéo/audio.
7. **Coût honnête et export.** Réserve conseillée et prix final non garanti sont explicités. Finaliser utilise RTX Super Resolution ; les templates SeedVR2 ne sont pas présentés comme le bouton actif. RTX reste fermé dans le mode « Open weights seulement » tant que la qualification de ses poids n'est pas vérifiée. Export local H.264/AAC maintenu, avec encodeur AAC de secours local.
8. **Exécution ComfyUI locale.** Le lanceur refuse un modèle partenaire sans option explicite, vérifie les réponses HTTP, borne l'attente, utilise un nom unique sans écrasement et réinjecte le nom/sous-dossier réellement renvoyé par l'upload. Une erreur ne déclenche aucune nouvelle soumission automatique. Aucun ComfyUI réel n'a été lancé pour ces tests.

Le dépôt officiel des nœuds NVIDIA indique une licence Apache-2.0 pour l'extension et une dépendance aux bindings NVIDIA VFX. Cela ne constitue pas une attestation que tous les poids utilisés satisfont la catégorie du concours : <https://github.com/Comfy-Org/ComfyUI_Nvidia_VFX_Nodes>. Aucune désactivation de RTX en mode ordinaire.

## Matrice actualisée

| Module | Vérifiable sans paiement | État et preuve encore nécessaire |
| --- | --- | --- |
| CAST import / fiches / copie / ZIP | Transactions, noms distincts, réutilisation, fichiers partagés | Fonctionnement local ; téléphone physique et gros volumes à compléter |
| CAST/DÉCOR Klein, planche FLUX 3, Nano Banana optionnel | Graphes dédiés, sélection, confirmation, reprise | Partiel : vrais nouveaux résultats et facture des graphes migrés non vérifiés |
| DÉCOR cartes et photos | Correctifs #104 conservés, attribution et refus si droits incomplets | Panoramax public observé auparavant ; Mapillary authentifié et couverture géographique restent à vérifier |
| Maquette / préparation / plans | Sauvegarde du texte, du cadre, des personnages et du décor | Local ; fidélité spatiale du rendu non démontrée |
| PRISE LTX/H3 | Moteur exact, références, estimation ou mesure historique, verrou et journal | Contrats simulés ; aucune nouvelle génération réellement facturée |
| Gestes vidéo / prévis | Enregistrement navigateur, graphe, consentement renouvelé, reçu et montage | Rendu MoGe/IC-LoRA, raccord, VFX et qualité non validés auprès du fournisseur |
| MONTAGE et plusieurs clips | Import de vraies vidéos, ordre, coupe, son et sauvegarde | Export réel Chrome déjà démontré sur #107 ; nouvelle intégration à vérifier en CI |
| EXPORT local | H.264/AAC, 60 s max, 960×540 ou 540×960, 12 images/s | Ne vaut pas export professionnel universel ; autres codecs/appareils non attestés |
| Finaliser RTX | Préparation master, consentement, reçu et récupération | Vrai 1080p/4K, son et tarifs actuels non validés ; restriction du mode Open Weights |
| Voix / musique / effets | Confirmation et conservation ; restriction partenaires | Génération et droits du fournisseur non vérifiés en réel |
| Reprise / coûts | Ambiguïté conservée ; lecture d'un job existant, coût inconnu explicite | Sans identifiant retrouvé, l'envoi reste bloqué ; vérification manuelle du compte nécessaire |
| IndexedDB / Obsidian / sauvegardes | Fin de transaction, protection demandée, ZIP, conflit de dossier refusé | Permission réelle de dossier, éviction OS, plantage appareil et gros ZIP à compléter |
| Mobile / accessibilité / langues | Tailles 1280×800 et 390×844 ; clavier ; nouveaux textes FR/EN/DE/ES | Des erreurs historiques restent françaises ; pas de téléphone physique ni audit lecteur d'écran |
| LoRA / fal / Farpy historiques | Inventaire antérieur disponible | Retirés par la branche concours ; non livrés, non certifiés |

## Tests exécutés et tests préparés

État local avant publication de la PR d'intégration :

- `npm test` : **265 tests, 264 réussis, 1 ignoré, 0 échec**, 75 suites. Le total diffère de #107 car la branche concours supprime les tests de modules retirés ; aucun test actif n'a été supprimé pour obtenir ce résultat.
- `npm run typecheck` : succès.
- `npm run build` : succès, compilation serveur et 10 pages ; sans clés Clerk.
- Lanceur local : vrai script exécuté en sous-processus avec transport fetch simulé ; vérification du refus partenaire avant upload et de l'absence d'écrasement. Ce n'est pas une validation d'un serveur ComfyUI.
- Playwright préparé : parcours Chrome complets sur deux tailles ; reprise, stockage et clavier sur Firefox/WebKit, également sur deux tailles. Les doubles clics et retours cloud sont interceptés. Les téléchargements et décodages vidéo locaux utilisent de vrais octets de médias du dépôt. **Résultats de cette nouvelle CI encore à joindre ; ils ne sont pas déduits des tests unitaires.**

L'environnement local avait refusé le lancement du navigateur (`socket() failed: Operation not permitted`). Pas de contournement : les parcours sont exécutés dans GitHub Actions. Une émulation 390×844 n'est pas un test sur téléphone physique ; WebKit Playwright n'est pas une certification Safari/iOS.

## Opérations encore non validées en production

1. Relire le build d'intégration dans un aperçu Vercel accessible, puis autoriser sa fusion après revue. Les PR #104/#107 restent des brouillons ; éviter une double fusion aveugle de ces mêmes correctifs.
2. Refaire le parcours réel sur le déploiement résultant et relever son SHA. Le site public actuel ne prouve pas que ces correctifs y sont déployés.
3. Avec autorisation et budget explicitement définis : produire un CAST et un DÉCOR, au moins deux prises LTX/H3, les assembler, exporter et rouvrir le projet. Mesurer coûts, qualité, identité, synchronisation audio et reprise sur le même compte.
4. Valider séparément prévis/IC-LoRA, raccord, élargissement, effacement, partenaires audio et finalisation RTX. Un graphe exporté ou un dry-run rapporté ne prouve pas un résultat facturé exploitable.
5. Tester Mapillary avec un jeton autorisé, d'autres villes Panoramax, et vérifier les droits de chaque référence retenue. Aucune licence ne doit être déduite d'une simple disponibilité réseau.
6. Tester un téléphone Android et un iPhone physiques, fermeture complète du navigateur, manque d'espace, permissions de dossier et sauvegarde/restauration indépendante.
7. Qualifier les licences des modèles pour la catégorie choisie, produire une démo de deux minutes maximum et fournir les éléments de soumission. Aucune publication n'est faite par cet audit.

La [page officielle du concours](https://comfy.org/open-source-higgsfield/) demande notamment le code, les workflows, une licence libre, les instructions locales et une démo de deux minutes maximum ; elle affiche le 30 octobre à 9 h PT. Le dépôt couvre une partie de ces éléments. Cela ne certifie ni l'éligibilité finale ni la qualité d'un rendu encore non exécuté.
