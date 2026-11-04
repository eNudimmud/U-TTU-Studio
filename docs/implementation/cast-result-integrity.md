# CAST : intégrité du résultat — 4 novembre 2026

Base : `dbbaf6619fa603c5ac2f606f9e3d8b90e5cd38b0`.

## Diagnostic vérifiable

- CAST « Depuis un texte » utilisait Klein, pas Qwen. Son couple modèle/VAE et son sampler correspondent au template officiel lu ; rien ne permet d’affirmer un mauvais VAE sans le job défectueux.
- `stillOutput` parcourait tous les nœuds, avec une préférence par nom de fichier : une référence ou un aperçu pouvait être pris pour le résultat.
- `pixelsVides` rejetait le noir et les couleurs uniformes ; une bande bruitée sur blanc passait. `imageVide` acceptait aussi les erreurs de décodage.
- `runStill` lisait le coût avant la validation de l’image.

## Correction

CAST texte passe à Qwen Image 2.1 t2i, avec son VAE 2.1 et une sortie 1920×1088. Le moteur Qwen edit est également préparé pour les références, avec le commutateur de taille activé. Les nœuds actifs proviennent des templates Comfy-Org fournis ; aucune amélioration automatique du prompt.

La récupération lit exclusivement le nœud final désigné par le graphe. Ce nœud est conservé dans le reçu avant l’envoi, y compris pour une reprise après rechargement. Une sortie temporaire, absente, plate, blanche avec une bande étroite ou indécodable est refusée avant la lecture du coût. Les écritures CAST/DÉCOR conservent leur ordre : média validé, fiche, état, puis confirmation au visiteur. Un échec d’écriture conserve le reçu.

Le devis de quatre crédits reste une estimation. Le studio ne peut pas annuler la consommation GPU facturée directement par Comfy lorsque Comfy produit une mauvaise image ; aucune promesse de remboursement automatique. Aucun coût n’est ajouté à une fiche projet pour une image rejetée.

## Limites et validation

La cause GPU précise du résultat signalé reste non confirmée : son image et son identifiant de job ne figurent pas dans l’archive. Les deux planches de tests annoncées sont absentes ; l’archive contient quatre captures de maquette. Aucun rendu payant effectué.

Tests hors ligne : sélection du vrai nœud, absence de repli sur aperçu, bande blanche, conservation des dessins et scènes sombres, erreur de décodage, refus avant lecture du coût, reçu de reprise et couple modèle/VAE Qwen. TypeScript et suite complète exécutés.
