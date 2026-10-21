# Médiathèque hybride — audit et contrat

Audit du 21 octobre 2026, branche `feat/studio-agent-capability-export`.

## État vérifié avant adaptation

Le coffre `uttu-coffre` conserve des fichiers et blobs dans IndexedDB. Les générations passent par `createRenderClient`, sont téléchargées, puis écrites dans les notes CAST/DÉCOR/Assets/Prises. Les prises conservent le job ; les autres notes ne conservent pas toutes l’identité distante. Le reçu `u-ttu-operation` permet de récupérer un job après interruption sans le soumettre à nouveau. Le relais Comfy sait déjà transmettre l’authentification et télécharger les redirections de stockage sans leur transmettre ces identifiants.

Aucune base serveur de projets des visiteurs n’est présente. L’authentification existante ne constitue pas une sauvegarde des projets. Les dossiers liés et les ZIP sont les seuls mécanismes de transfert actuels. Les blobs locaux, les URL temporaires, l’historique des jobs et la conservation distante sont quatre choses différentes.

## API officielle consultée

- [Inventaire v1](https://docs.comfy.org/api-reference/cloud/asset/list-user-assets) : GET `/api/assets`, `limit` (1–500), `offset`, `sort`, `order`, `has_more`. Identifiants UUID, hash, nom, MIME, taille, dates, `prompt_id`, `preview_id`, métadonnées. La v1 est signalée dépréciée ; l’inventaire v2 n’est pas supposé disponible.
- [Détail v1](https://docs.comfy.org/api-reference/cloud/asset/get-asset-details) : GET `/api/assets/{id}`, 404 distinct d’une panne réseau.
- [Métadonnées v2](https://docs.comfy.org/api-reference/v2/assets/asset-metadata) : GET `/api/v2/assets/{id}`, URL renouvelée, `expires_at` séparé de `url_expires_at`, `job_id`.
- [Octets v2](https://docs.comfy.org/api-reference/v2/assets/asset-bytes) : GET `/api/v2/assets/{id}/content`, redirection vers une URL signée sur Cloud. Aucun lien signé n’est un identifiant pérenne.
- [Conservation](https://docs.comfy.org/support/data-retention) : aucune durée garantie générale pour les créations ; les médias intermédiaires des Partner Nodes ont une politique distincte de 24 h. Ne pas appliquer cette durée à tous les assets Cloud.

Ces contrats sont documentés et testables avec mocks. Ils ne prouvent ni la permission effective d’un compte particulier ni la présence de chaque version sur son déploiement. Aucune génération payante n’a été demandée pour l’audit.

## Autorités et migration

Comfy fait autorité sur ses identifiants et la disponibilité distante. Studio fait autorité sur le classement, les relations et le projet. Le nouvel index est un fichier additionnel `.uttu/media-index.json` par projet : aucune modification de schéma IndexedDB, aucune suppression d’anciens médias ou de notes. Une migration relançable référence les fichiers existants. Une liste partielle ne prouve jamais une suppression. Une panne ou un refus d’accès ne devient jamais un état « supprimé ».

Le cache est alimenté à la demande pour les imports distants. Les fichiers déjà téléchargés et les résultats générés restent conservés comme avant. La synchronisation ne lance aucun job et n’efface aucun asset distant. Les secrets ne font pas partie des modèles de données, des exports ou du contexte agent.

## Continuité entre appareils — proposition préalable

La découverte du même compte retrouve ses assets, mais ne reconstruit pas automatiquement le classement Studio. Un manifeste JSON exportable indépendamment des blobs permet de transporter ce classement ; un ZIP reste nécessaire pour les médias locaux. Obsidian reste une archive documentaire optionnelle.

Proposition minimale pour une synchronisation automatique future : stockage de manifestes versionnés derrière l’identité utilisateur déjà authentifiée, avec contrôle d’accès par propriétaire, révision conditionnelle (ETag/CAS), historique de versions et quotas. Une petite base SQL/KV persistante suffit ; les vidéos restent chez Comfy. Il faut choisir l’hébergement, vérifier son budget et valider ce service avant activation. Ne pas détourner `user_metadata` Comfy en base de projets sans garantie documentée de concurrence et de sauvegarde. Aucun backend persistant nouveau n’est activé dans cette livraison.

### Portée du compte

`/api/user` ne garantit dans sa spécification v1 qu’un champ de statut. Si un identifiant utilisateur est réellement retourné, le catalogue utilise son empreinte. Avec une clé API et sans cet identifiant, il utilise une empreinte de la clé : même clé, même portée ; une rotation de clé ne fusionne pas silencieusement les comptes. La clé elle-même n’est jamais persistée dans le catalogue. Une session sans identité stable est refusée pour la synchronisation plutôt que partagée entre utilisateurs sur la base d’un simple statut identique. Cette limite doit être vérifiée avec le compte réel avant activation.

## Proposition concrète à valider : métadonnées partagées

Option minimale : **Postgres Neon Free**, appelé uniquement par les routes serveur Vercel existantes, sous l'identité du compte Studio Clerk. L'identité Comfy ne devient pas une autorisation d'accès aux projets Studio. Il faudra vérifier/configurer les clés et sessions Clerk réelles : leur présence dans le code ne prouve pas qu'elles fonctionnent sur l'instance de production.

Au 21 octobre 2026, [les conditions officielles Neon](https://neon.com/docs/introduction/plans) indiquent 0 USD/mois, 1 Go de stockage par projet Neon, 100 CU-heures/mois et 5 Go de transfert public par projet. [La page tarifaire](https://neon.com/pricing) indique qu'aucune carte n'est requise. Au dépassement des quotas gratuits, les opérations sont suspendues/refusées ; aucun passage payant automatique ne doit être activé. Ces limites sont à revérifier lors de l'activation. Le plan Vercel et Clerk déjà choisi conserve ses propres limites.

Contrat proposé, non activé :

- Table `studio_projects(owner_id, project_id, revision, manifest, updated_at)` et historique borné. Le serveur dérive `owner_id` d'une session Clerk validée ; il ne fait jamais confiance au propriétaire déclaré par le client. Toutes les requêtes imposent ce propriétaire, avec défense supplémentaire par politiques Postgres.
- `GET /studio-projects/{id}` et `PUT` conditionnel avec révision/ETag. Un conflit rend `409` et garde les deux versions pour résolution ; aucune écriture silencieuse par le dernier appareil. L'import local reste possible si le serveur est indisponible.
- Uniquement manifestes et notes de projet autorisés (organisation, plans, conversation). Pas de médias binaires, clés, cookies ou URL signées. Taille initiale plafonnée à 1 Mio par manifeste et quotas par propriétaire ; pagination ou découpage à prévoir pour de très gros projets.
- Migrations versionnées, export JSON indépendant, journal de synchronisation local et reprise idempotente. Les modifications locales restent en attente tant que le serveur n'a pas confirmé la révision.
- Tests à exiger avant activation : deux appareils, deux propriétaires, accès croisé refusé, collision de révision, déconnexion, quota, restauration d'une version et absence de secrets dans les manifestes.

Aucun compte Neon, aucune base, aucune variable d'environnement ni abonnement n'a été créé. Cette proposition attend la validation de l'hébergement et de l'usage de l'identité Studio avant implémentation.
