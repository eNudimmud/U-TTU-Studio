# Genjutsu dans les outils du Studio — 28.10.2026

## Workflow et intégration

Le workflow demandé est **Higgsfield Genjutsu : transfert de mouvement**, `api_higgsfield_genjutsu_motion_transfer`, visible dans le catalogue de Comfy Cloud. Il est exécuté dans le Studio par `HiggsfieldMotionTransferNode` (`genjutsu-v1.0`), puis `SaveVideo`, via le même client Comfy que les autres outils. Aucun déploiement Comfy supplémentaire ni nouvelle clé de fournisseur ne sont créés.

Le template a été chargé dans Comfy Cloud et son graphe API exporté le 28.10.2026, sans lancer de rendu. La source de cet export est conservée dans `workflows/outils/sources/api_higgsfield_genjutsu_motion_transfer.api.json` ; le champ d’aperçu réservé à l’éditeur a été retiré. La base envoyée omet également le champ `codec` de compatibilité, doublon de `format.codec`. Un test compare la base à cet export. Le template UI officiel et l’exemple exact envoyé par le Studio sont dans `workflows/outils/outil-vid-genjutsu.json` et `.api.json`.

La bibliothèque commune n’avait pas cette entrée exécutable. La carte `vid-genjutsu` de la famille Vidéo ouvre maintenant le formulaire natif : vidéo source, image du personnage, seconde image facultative pour le décor/style, consigne et résolution. Elle est aussi accessible depuis la recherche et les outils de PRISE. Le formulaire, le devis, la confirmation, la progression et la vidéo de résultat restent dans U*TTU Studio ; la vidéo est sauvegardée dans Mes créations et peut être ajoutée au montage.

Les textes sont traduits en FR/EN/DE/ES. Le personnage d’exemple et la vignette utilisent le portrait canonique d’Uttu déjà présent dans le dépôt. Cette illustration n’est pas présentée comme un résultat Genjutsu. Les références, la consigne et la résolution sont conservées par le mécanisme de brouillon partagé.

## Contraintes du nœud

- Vidéo d’au moins 4 secondes ; sous cette durée, aucun devis ni envoi n’est autorisé.
- Au-delà de 30 secondes, le nœud retient les 30 premières secondes. Le formulaire l’annonce et calcule son devis sur cette durée.
- Résolutions 480p, 720p et 1080p ; le choix initial du Studio est 480p.
- Le modèle accepte jusqu’à 8 images. Le formulaire expose les deux références de l’exemple officiel : personnage et décor/style facultatif. Sans seconde image, sa branche est retirée ; le personnage n’est pas dupliqué.
- La seed contrôle le recalcul du nœud et ne rend pas ses résultats déterministes.
- C’est un nœud partenaire payant, masqué par « modèles du studio seulement ». Le même filtre s’applique avant tout envoi depuis un accès direct.

## Devis et budget

Barème publié par le nœud officiel, vérifié le 28.10.2026 : 0,45474 USD/s en 480p ; 0,97383 USD/s en 720p ; 2,33376 USD/s en 1080p. Comfy Cloud affiche aussi 205,5 crédits/seconde en 720p sur le nœud chargé. Calcul du Studio : tarif × durée retenue × 211 crédits/USD, arrondi au crédit supérieur. La réserve de solde vaut 1,5 fois ce devis, arrondie au-dessus ; elle ne garantit pas le montant final facturé.

Pour 5 s : **≈ 480 crédits estimés** en 480p, **≈ 1 028 crédits estimés** en 720p, **≈ 2 463 crédits estimés** en 1080p. Le registre porte le profil 5 s / 480p ; le bouton recalcule selon la durée réelle et la résolution choisie. Une durée inconnue ne produit pas de devis. Il n’y a pas de passe d’image de départ supplémentaire dans ce graphe.

**Dépense réelle : 0 crédit. Aucun job soumis ou annulé.** Le minimum de 4 s représente ≈ 384 crédits estimés en 480p, au-delà du budget de vérification autorisé de 60 crédits. Aucun rendu réel n’est effectué dans cette livraison. Le relevé historique `app-proxy/openjutsu` à 240 crédits concerne un autre parcours et ne calibre pas ce workflow.

## Vérification

Les tests unitaires vérifient l’export Comfy, les ports vidéo/images, la référence facultative, les trois tarifs, la borne de durée, la disponibilité du workflow et le filtre de modèles. Les parcours navigateur simulent Comfy : aucun upload avant confirmation, aucun appel d’annulation, graphe partenaire exact, qualité conservée après actualisation, retour vidéo, sauvegarde dans Mes créations et accès au montage. Le cas d’une vidéo trop courte et l’accès direct avec filtre actif sont également contrôlés.

Le résultat vidéo des tests est une fixture, et les soldes sont simulés. Ces vérifications ne prouvent pas la qualité du remplacement de personnage ni un coût réel. Les captures du formulaire et du résultat servent à revoir l’interface.

Sources : [template officiel](https://github.com/Comfy-Org/workflow_templates/blob/main/templates/api_higgsfield_genjutsu_motion_transfer.json), [nœud et prix officiels](https://github.com/Comfy-Org/ComfyUI/blob/master/comfy_api_nodes/nodes_higgsfield.py).


Résultats : **602 tests unitaires réussis, 1 ignoré** ; TypeScript et build production Node 22 réussis. **12 parcours navigateur distincts réussis** : 6 cas Genjutsu sur bureau/mobile, rejoués après les derniers textes de confirmation, et 6 non-régressions de la grille, du hub et des brouillons. Vérification des formats 390 × 844, 844 × 390, 1024 × 600, 1280 × 800 et des cibles de 44 px. La carte Genjutsu et l’export du graphe ont également été vérifiés dans Comfy Cloud en lecture seule.

Preuves : `docs/preuves/genjutsu/genjutsu-confirmation-390x844.png` et `genjutsu-resultat-1280x800.png`. Le résultat en mire colorée est la vidéo simulée du test d’interface ; il n’est pas un rendu Genjutsu.
