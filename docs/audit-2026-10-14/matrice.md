# Matrice de fonctionnement

État du code proposé dans #104/#107, pas une déclaration de mise en production. « Local » signifie résultat sans service payant ; « contrat » signifie fournisseur simulé. Les résultats exécutés et les SHA correspondants sont dans [validation.md](validation.md).

| Module / fonction | Chemin principal | État constaté et correction | Validation distante restante |
| --- | --- | --- | --- |
| Navigation quatre espaces | `studio-app.tsx`, `stage-screens.tsx` | Active sur le site public ; identité et composants conservés | Contrôle après déploiement des PR |
| CAST import de photos | `creation/import-media.ts` | Fiche et octets persistés ; collisions de noms évitées | Refaire sur vrais téléphones |
| CAST texte / photo / planche | `creation/still.ts`, `studio-session.tsx` | Graphes réels, confirmation, stockage et journal de reprise ; contrats testés | Génération réelle, qualité d’identité et facture |
| CAST édition, copie, suppression | `creation/fiche.ts`, session | Réutilisation active ; médias partagés conservés | Scénarios simultanés dans plusieurs onglets |
| CAST LoRA H3 | `lora/train.ts`, `lora/take.ts`, ancien `studio-context.tsx` | Bibliothèque et tests présents ; absente du parcours actif | Entraînement, récupération, qualité, reprise et prix actuels |
| Gate dataset historique | `gate/`, `fal-bootstrap.ts` | Règles locales et ZIP testés ; ancien parcours | Ne pas présenter comme étape obligatoire actuelle |
| DÉCOR import | `creation/import-media.ts`, `coffre/model.ts` | Décor conservé et réutilisable, fichiers originaux conservés | Téléphones physiques |
| DÉCOR génération / transformation | `creation/still.ts`, registre des gestes | Branché pour gestes avec graphe et devis ; opérations inactives restent fermées | Images, facture et règles du modèle réel |
| Exemples R9 | `exemple-depart.tsx`, `creation/depart.ts` | Remplissent formulaires ; pas de dépense implicite | Régression après déploiement |
| Recherche par nom / coordonnées / liens | `repere/photon.ts`, `saisie.ts`, `lien.ts` | Recherche réelle contrôlée ; double limiteur corrigé | Autres régions, quotas et indisponibilités réelles |
| Bâtiments, relief, carte | `repere/quartier.ts`, `direct.ts`, `/api/repere` | Indépendants des photos ; géométrie de repérage approximative | Précision locale et performances WebGL |
| Photos Panoramax | `repere/panoramax.ts`, `repere-carte.tsx` | GET public réel avec photos ; fédération, rayon, chaînes et attribution corrigés | Plusieurs villes/pays ; aucune couverture garantie |
| Photos Mapillary | `repere/mapillary.ts` | Adaptateur, bbox et géométrie testés ; jeton facultatif absent du contrôle réel | Appel authentifié, CORS, contenu et quota |
| Vue panoramique / copie | `rue-viewer.tsx` | Repli sur vraie photo si panorama indisponible ; droits contrôlés avant copie | Rotation, capture et CORS sur appareils variés |
| Blender / Farpy | `render/place-blend.ts`, `farpy.ts` | Bibliothèque inspectée, inspect/start distincts ; dormant dans le parcours actif | Job réel, coûts, acceptation des conditions et fichiers |
| LoRA de lieu Flux | `lora/place.ts` | Ancienne voie images, distincte du volume 3D et de H3 ; dormante | API réelle, licence/qualité, récupération |
| Maquette et plans | `maquette/`, `prise/vault.ts` | Texte, sélection, positions et plan sauvegardés ; une image reste un storyboard | Fidélité du conditionnement spatial non attestée |
| Image intermédiaire PRISE | `prise-stage.tsx` | Bouton sans exécution réelle désactivé avec raison | Raccordement futur nécessaire avant activation |
| Vidéo PRISE H3 | `render/take-graph.ts`, `run.ts` | Vrai graphe limité au profil mesuré ; références exactes du plan | Vidéo/audiovisuel réel, identité, mouvement, coût actuel |
| Plusieurs prises | `render/settle-take.ts` | Fichiers distincts ; association au bon plan ; relance avec nouvelle confirmation | Plusieurs rendus réels consécutifs |
| Confirmation et compte Comfy | `studio-frames.tsx`, `render/client.ts` | Confirmation visible, clé masquée, solde relu, délais bornés | Compte et abonnement réels, expiration et erreurs fournisseur |
| Double clic / plusieurs onglets | session, `render/recovery.ts` | Verrou synchrone et Web Locks ; reçu avant POST | Validation multiappareils hors portée du verrou local |
| Reprise job avec numéro | `render/recovery.ts`, session | Suit le même job et sauvegarde dans son projet ; aucun nouveau POST | Interruption réseau et reprise avec vrai compte |
| Envoi ambigu sans numéro | même chemin | Bloque un second envoi et conserve le reçu | Réconciliation manuelle ; interface dédiée manquante |
| Coûts et devis | `credits.ts`, `billed-quote.ts`, `creation/quotes.ts` | Estimations/réserves affichées ; source des mesures distincte | Pas de plafond fournisseur garanti ; activité concurrente du compte |
| Montage, rognage, scission, ordre | `montage/edit.ts`, `montage-stage.tsx` | Calculs testés, liste persistée ; ajout initial sécurisé | Montage prolongé, gestes tactiles sur vrais appareils |
| Import audio / mixage | `montage/encode.ts`, `creation/stem.ts` | Audio réel conservé, gain/fondu ; absence de piste distinguée d’une panne | Formats variés, synchronisation longue, écoute humaine |
| Voix / musique / effets IA | `creation/stem.ts`, session | Graphes, devis, confirmation et récupération ; contrats locaux | Génération et licence réelles de chaque modèle |
| Export MP4 local | `montage/encode.ts` | Fichiers réels téléchargés et inspectés par les tests navigateur ; limites 60 s / 12 fps | Chrome/Edge réels, Safari/Firefox, mémoire mobile |
| Finaliser R8 1080p/4K | `montage/finaliser.ts`, session | Master 720p/24 fps, confirmation, reçu et résultat conservé | Passe réelle ; 4K/nettoyage et fidélité sonore non validés |
| IndexedDB / réouverture | `coffre/store.ts` | Fin de transaction attendue, erreurs remontées ; fermeture de page testée | Arrêt processus/appareil, quota, éviction |
| Export/import ZIP Obsidian | `coffre/import.ts`, `export.ts` | Aller-retour octets/notes testé ; import sans écrasement | ZIP volumineux et formats d’archives externes variés |
| Dossier Obsidian relié | `coffre/link.ts`, `permit.ts` | Permission navigateur ; divergence bloque la liaison sans écrasement | Résolution manuelle, vraie permission et changements externes |
| Galerie / Mon studio | `project-gallery.tsx`, `atelier-page.tsx` | Médias conservés, filtres, réutilisation et montage | Revue complète des liens historiques de prises/séquences |
| Publication / partage | `publish.tsx`, `share.ts` | Préparation du fichier/texte ; aucune publication automatique | Web Share et téléchargement sur appareils cibles |
| Compte U*TTU Clerk | `clerk-config.ts`, `/compte`, proxy | Facultatif, build sans clés ; séparé du compte de rendu | Auth réelle et configuration du déploiement |
| Langues / accessibilité / mobile | `messages/`, CSS, composants | Quatre langues existantes, aides et raisons désactivées ; tests 1280×800 et 390×844 | Certaines erreurs nouvelles restent françaises ; lecteur d’écran et appareils physiques |
| PWA / installation | manifeste, routes | Manifeste conservé ; pas de promesse d’exécution cloud hors ligne | Installation, reprise OS et mode hors réseau |

Les fonctions dormantes restent dans le dépôt. Leur réactivation n’est pas requise pour l’itinéraire gratuit import → montage → export et ne doit pas précéder sa fiabilisation.
