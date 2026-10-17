# Audit — intégration de la version concours, 17 octobre 2026

Cette livraison poursuit la mission complète. Elle rapproche les correctifs des PR #104/#107 et la version concours de JD, en conservant sa version désormais fusionnée dans main par JD. Le résultat n'est pas encore une certification de production.

## Versions et limites de preuve

- Main relu : `5f87e6784bd75478e750c3070a2da0a747dd6c8b`.
- Version concours intégrée : PR #110 fusionnée par JD, tête `57142cbd5e40ce34f5616beba985799fa45e97e5`, incluant les devis LTX estimés, gestes vidéo, prévis mobile, objets, import GLB, trajet caméra, génération Hunyuan3D/TRELLIS.2 et suppression du workflow de déploiement fal.
- Corrections précédentes : #104 `73ec49ffa2bc0ee6af31c09ac426b57c051b892c` et #107 `332b05ce47035297b325f0056267b8871b2e87ad`.
- Branche de revue : `audit/hackathon-integration-20261016`, PR #111, base `main` après intégration du squash #110.
- Zéro nouveau rendu payant, zéro entraînement, aucun secret copié dans les rapports, aucune fusion effectuée par cet audit sur main, aucune publication sociale ni inscription au concours.

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
8. **Prévis et modèles 3D.** Les fichiers GLB/glTF autonomes sont conservés avec leur fiche, inclus dans les sauvegardes et réutilisables depuis une liste. Les scènes gardent le chemin du fichier, pas une URL Blob expirante ; caméra et objets sont validés à la lecture. Les modèles nécessitant des fichiers externes sont refusés avec explication. Une erreur de lecture ne devient plus une caisse fictive. La génération 3D emploie le reçu/verrou commun, garde ses sources et son projet, et se récupère sans resoumission. Changer la photo annule le consentement. Le prix reste une estimation.
9. **Exécution ComfyUI locale.** Le lanceur refuse un modèle partenaire sans option explicite, vérifie les réponses HTTP, borne l'attente, utilise un nom unique sans écrasement et réinjecte le nom/sous-dossier réellement renvoyé par l'upload. Une erreur ne déclenche aucune nouvelle soumission automatique. Aucun ComfyUI réel n'a été lancé pour ces tests.

Le dépôt officiel des nœuds NVIDIA indique une licence Apache-2.0 pour l'extension et une dépendance aux bindings NVIDIA VFX. Cela ne constitue pas une attestation que tous les poids utilisés satisfont la catégorie du concours : <https://github.com/Comfy-Org/ComfyUI_Nvidia_VFX_Nodes>. Aucune désactivation de RTX en mode ordinaire.

## Matrice actualisée

| Module | Vérifiable sans paiement | État et preuve encore nécessaire |
| --- | --- | --- |
| CAST import / fiches / copie / ZIP | Transactions, noms distincts, réutilisation, fichiers partagés | Fonctionnement local ; téléphone physique et gros volumes à compléter |
| CAST/DÉCOR Klein, planche FLUX 3, Nano Banana optionnel | Graphes dédiés, sélection, confirmation, reprise | Partiel : vrais nouveaux résultats et facture des graphes migrés non vérifiés |
| DÉCOR cartes et photos | Correctifs #104 conservés, attribution et refus si droits incomplets | Panoramax public observé auparavant ; Mapillary authentifié et couverture géographique restent à vérifier |
| Maquette / préparation / plans | Sauvegarde du texte, du cadre, des personnages et du décor | Local ; fidélité spatiale du rendu non démontrée |
| PRISE LTX/H3 | Moteur exact, références, estimation ou mesure historique, verrou et journal | Contrats simulés ; aucune nouvelle génération réellement facturée |
| Modèles 3D / prévis mobile | Import, sauvegarde, ZIP, liste de réutilisation, caméra ; contrat de reprise | Générations Hunyuan3D/TRELLIS.2 réelles et performances téléphone non validées |
| Gestes vidéo / prévis | Enregistrement navigateur, graphe, consentement renouvelé, reçu et montage | Rendu MoGe/IC-LoRA, raccord, VFX et qualité non validés auprès du fournisseur |
| MONTAGE et plusieurs clips | Import de vraies vidéos, ordre, coupe, son et sauvegarde | Exports réels Chrome réussis dans la première CI #111 ; nouvelle base main à vérifier |
| EXPORT local | H.264/AAC, 60 s max, 960×540 ou 540×960, 12 images/s | Ne vaut pas export professionnel universel ; autres codecs/appareils non attestés |
| Finaliser RTX | Préparation master, consentement, reçu et récupération | Vrai 1080p/4K, son et tarifs actuels non validés ; restriction du mode Open Weights |
| Voix / musique / effets | Confirmation et conservation ; restriction partenaires | Génération et droits du fournisseur non vérifiés en réel |
| Reprise / coûts | Ambiguïté conservée ; lecture d'un job existant, coût inconnu explicite | Sans identifiant retrouvé, l'envoi reste bloqué ; vérification manuelle du compte nécessaire |
| IndexedDB / Obsidian / sauvegardes | Fin de transaction, protection demandée, ZIP, conflit de dossier refusé | Permission réelle de dossier, éviction OS, plantage appareil et gros ZIP à compléter |
| Mobile / accessibilité / langues | Tailles 1280×800 et 390×844 ; clavier ; nouveaux textes FR/EN/DE/ES | Des erreurs historiques restent françaises ; pas de téléphone physique ni audit lecteur d'écran |
| LoRA / fal / Farpy historiques | Inventaire antérieur disponible | Retirés par la branche concours ; non livrés, non certifiés |

## Tests exécutés et tests préparés

- Intégration initiale `d20b847` : **264 réussis, 1 ignoré**, types/build réussis. [CI 38970043433](https://github.com/eNudimmud/U-TTU-Studio/actions/runs/38970043433) : **14 tests navigateur réussis, 20 échoués**. Douze échecs venaient du canal Chrome transmis à Firefox/WebKit ; six de sélecteurs devenus ambigus ; deux révélaient une vraie sortie du focus hors du dialogue. Aucune assertion supprimée : configuration et sélecteurs précisés, bouclage Tab/Shift+Tab ajouté.
- Les exports réels de cette CI sont présents dans l’artefact `12075619483`, SHA-256 de l’archive `8b727ea9074e710ba3444e4539783ec607851c93780b87d06c21f3f9905e9fa3` : storyboard et montage de deux clips, ordinateur/mobile. Ils utilisent des médias locaux de fixture ; aucun rendu génératif n’a été effectué.
- Nouvelle base main du 17 octobre : **274 tests Node, 273 réussis, 1 ignoré, 0 échec**, 77 suites. `npm run typecheck` et `npm run build` réussissent localement. Une première passe avait détecté un terme allemand non canonique ; texte corrigé et suite complète relancée.
- Playwright : **40 scénarios préparés**, Chrome ordinateur/mobile et quatre scénarios de fiabilité sur Firefox/WebKit aux deux tailles. Le nouveau cas 3D vérifie l’import, la persistance de scène, l’invalidation de consentement, le double clic, le reçu, sa récupération simulée, la réutilisation et le téléchargement exact après fermeture. [CI 39011309429](https://github.com/eNudimmud/U-TTU-Studio/actions/runs/39011309429) : **16 réussis, 24 échoués**. Archive de traces `12093836444`, SHA-256 `2afcc8bbfe70527a5790a8ac2c74d1e0b3853f53724b0a21da2a9dac59b91da2`. Les 16 parcours Chrome précédents passent, dont les véritables exports. La lecture des traces confirme : libellés textarea/select incluant leur contenu ; sélecteur comptant deux présentations du même personnage ; intitulé du ZIP différent ; demande de permission Firefox sans réponse ; import initial WebKit non pris en compte. Les imports sont désormais indisponibles jusqu’à l’initialisation du coffre ; le test attend cet état explicite. Cette dernière correction doit encore être confirmée par une nouvelle exécution.
- Les transports cloud sont interceptés et utilisent des clés factices. Exports, IndexedDB, demandes de persistance et téléchargements sont réels. Les tests du lanceur exécutent le vrai script avec fetch simulé, sans serveur ComfyUI réel.

### Correctifs après lecture des traces, 17 octobre

- Libellés accessibles stables pour le texte vidéo, la phrase de composition et la liste 3D. Les assertions exactes restent actives. Le test de récupération vise la galerie des assets, au lieu de compter aussi sa présentation historique.
- Export ZIP nommé « Exporter mon studio » dans Mon studio, cohérent avec l’aide et indépendant d’une installation Obsidian.
- Demande de persistance bornée à cinq secondes ; une permission native encore ouverte est signalée comme en attente, jamais comme refusée ou accordée. Nouvelle demande dédupliquée tant que la précédente attend. Inspection bornée également. Deux tests unitaires supplémentaires vérifient l’attente indéfinie et l’accord tardif.
- Une prévisualisation réellement filmée est enregistrée avec son fichier, sa fiche et son projet **avant** d’être proposée au geste cloud. Elle est retrouvable, téléchargeable et utilisable au montage depuis Mon studio, à coût local nul. Un nouveau scénario Chrome ordinateur/mobile filme réellement le canvas pendant cinq secondes, ferme la page, retrouve le clip, le télécharge et analyse sa durée ; il n’intercepte pas MediaRecorder.
- Nouvelle passe locale : **276 tests, 275 réussis, 1 ignoré, 0 échec** ; typecheck et build réussis. **42 scénarios navigateur préparés**, pas encore validés. Deux workers CI et actions bornées à vingt secondes réduisent les attentes inutiles sans retirer les reprises ni les assertions.

### Contrôle public et licences, 17 octobre

Le site public affiche la nouvelle prévis 3D de JD. Une composition gratuite « Deux personnages autour d’une table, la caméra tourne autour » crée les figures, la table et trois points caméra ; un rechargement perd cette scène dans le déploiement observé. Le correctif de sauvegarde de la PR doit donc encore être livré. Aucun SHA fiable n’était exposé par la page ; il n’est pas déduit de son apparence.

L’aperçu de la PR redirige vers une connexion Vercel : sa validation manuelle est bloquée par cet accès. Les scénarios GitHub Actions restent distincts d’une validation de cet aperçu authentifié.

La [licence Hunyuan3D 2.1](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1/blob/main/LICENSE) contient des restrictions territoriales, notamment UE, Royaume-Uni et Corée du Sud. « Poids ouverts » ne signifie pas licence libre sans restriction. Le panneau fournit désormais un avertissement court et le lien officiel avant confirmation ; les conditions exactes d’usage via le fournisseur et l’éligibilité au concours restent à qualifier. [TRELLIS.2](https://github.com/microsoft/TRELLIS.2) annonce code et modèles MIT, avec des dépendances possédant leurs propres licences. Ces vérifications documentaires ne constituent pas un avis juridique ni une validation de rendu.

L'environnement local avait refusé le lancement du navigateur (`socket() failed: Operation not permitted`). Pas de contournement : les parcours sont exécutés dans GitHub Actions. Une émulation 390×844 n'est pas un test sur téléphone physique ; WebKit Playwright n'est pas une certification Safari/iOS.

## Opérations encore non validées en production

1. Relire le build d'intégration dans un aperçu Vercel accessible, puis autoriser sa fusion après revue. Les PR #104/#107 restent des brouillons ; éviter une double fusion aveugle de ces mêmes correctifs.
2. Refaire le parcours réel sur le déploiement résultant et relever son SHA. Le site public actuel ne prouve pas que ces correctifs y sont déployés.
3. Avec autorisation et budget explicitement définis : produire un CAST et un DÉCOR, au moins deux prises LTX/H3, les assembler, exporter et rouvrir le projet. Mesurer coûts, qualité, identité, synchronisation audio et reprise sur le même compte.
4. Valider séparément prévis/IC-LoRA, raccord, élargissement, effacement, partenaires audio, génération 3D Hunyuan3D/TRELLIS.2 et finalisation RTX. Un graphe exporté ou un dry-run rapporté ne prouve pas un résultat facturé exploitable.
5. Tester Mapillary avec un jeton autorisé, d'autres villes Panoramax, et vérifier les droits de chaque référence retenue. Aucune licence ne doit être déduite d'une simple disponibilité réseau.
6. Tester un téléphone Android et un iPhone physiques, fermeture complète du navigateur, manque d'espace, permissions de dossier et sauvegarde/restauration indépendante.
7. Qualifier les licences des modèles pour la catégorie choisie, produire une démo de deux minutes maximum et fournir les éléments de soumission. Aucune publication n'est faite par cet audit.

La [page officielle du concours](https://comfy.org/open-source-higgsfield/) demande notamment le code, les workflows, une licence libre, les instructions locales et une démo de deux minutes maximum ; elle affiche le 30 octobre à 9 h PT. Le dépôt couvre une partie de ces éléments. Cela ne certifie ni l'éligibilité finale ni la qualité d'un rendu encore non exécuté.
