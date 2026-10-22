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

## Rôles retenus (décision de JD, 22 octobre 2026)

- **Comfy Cloud = stockage** des créations du compte (images, vidéos, sons), retrouvées par l’inventaire `/api/assets`.
- **U\*TTU Studio = organisation** : projets, classement, relations, plans de l’agent, dans `.uttu/media-index.json`.
- **IndexedDB = cache** local et état de session ; téléchargement à la demande.
- **Obsidian = export optionnel** : archive documentaire portable du coffre.

Pas de base serveur de projets ni de compte supplémentaire. Pour changer d’appareil : resynchroniser la médiathèque depuis le même compte Comfy (les créations reviennent), puis importer le manifeste JSON exporté (le classement revient) ; un ZIP reste nécessaire pour les médias uniquement locaux.

### Portée du compte

`/api/user` ne garantit dans sa spécification v1 qu’un champ de statut. Si un identifiant utilisateur est réellement retourné, le catalogue utilise son empreinte. Avec une clé API et sans cet identifiant, il utilise une empreinte de la clé : même clé, même portée ; une rotation de clé ne fusionne pas silencieusement les comptes. La clé elle-même n’est jamais persistée dans le catalogue. Une session sans identité stable est refusée pour la synchronisation plutôt que partagée entre utilisateurs sur la base d’un simple statut identique. Cette limite doit être vérifiée avec le compte réel avant activation.
