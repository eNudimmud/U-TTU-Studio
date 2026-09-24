# Gate de livraison — V1

Vérification du 24 septembre 2026. Sources canoniques lues avant le code. Les captures sont des rendus du site dans Chrome, pas des maquettes.

## Contrôles exécutés

| Contrôle | Résultat | Preuve / périmètre |
| --- | --- | --- |
| Build de production | PASS | `npm run build` → Next.js 16.3.6 / Webpack, compilation, TypeScript, génération statique et traces terminées sans erreur. |
| TypeScript strict | PASS | `npm run typecheck` et vérification intégrée au build. |
| Sources / cible | PASS | Les cinq fichiers imposés ont été lus ; seul U-TTU-Studio contient les ajouts. Références dans DECISIONS.md. |
| Hero / tarifs | PASS | Captures dans `docs/screenshots/`, affichées dans le README. |
| Responsive | PASS | Viewport desktop 1363 px et documents dans des cadres de largeur 320, 390, 600, 768, 1024 px. Aucun débordement horizontal après correction de la liste d’audiences à 320 px. |
| Formulaire vide | PASS | Les champs nom, budget et brief empêchent une demande vide via la validation native. |
| Formulaire rempli | PASS | Préparation du mailto vers HelveticVault@gmail.com. Accents, `&`, retours à la ligne et URL de référence encodés correctement. Aucun e-mail envoyé pendant la vérification. |
| Copie | PASS | Bouton testé, statut « Brief copié. Collez-le dans votre e-mail. ». Un texte sélectionnable reste disponible si l’API presse-papiers échoue. |
| Navigation clavier | PASS | Passage par Tab du nom au studio ; focus visible avec contour plein. Lien d’évitement, labels et contrôles natifs présents. |
| Démonstration PASS / FAIL | PASS | Ouverture / fermeture testées ; `aria-expanded` et visibilité de la grille conformes. La grille est explicitement illustrative, sans évaluation automatique. |
| Images | PASS | Assets locaux chargés dans le navigateur ; portrait, comparatif et Sanctuaire inspectés. Aucun stock générique. |
| Mouvement réduit | PASS — code inspecté | Animations / transitions / scroll fluide désactivés par `prefers-reduced-motion: reduce`. La transition native n’est pas appelée si cette préférence est active. |
| Confidentialité | PASS — code inspecté | Analytics inertes. Pas d’envoi serveur, cookies ou stockage de brief. Repli sans JS par mailto. |
| Promesses commerciales | PASS | Un pack + une direction mensuelle. Aucun résultat chiffré inventé, génération illimitée, produit crypto ou abonnement logiciel annoncé. |

## Contrastes

Ratios calculés selon la luminance relative sRGB. Les couples de texte ci-dessous dépassent le seuil AA 4,5:1 ; les limites des champs et boutons dépassent 3:1.

| Élément | Couleurs | Ratio |
| --- | --- | --- |
| Texte principal / fond | `#F1EDE6` / `#0A0A0B` | 16,96:1 |
| Texte secondaire / panneau | `#A8A6A2` / `#131313` | 7,65:1 |
| Or / noir | `#C4A574` / `#0A0A0B` | 8,46:1 |
| Texte du CTA / fond or | `#11100F` / `#C4A574` | 8,13:1 |
| Limite des champs / champ | `#776B5B` / `#141414` | 3,54:1 |
| Limite du CTA secondaire / panneau | `#8A7554` / `#151515` | 4,13:1 |

## Performance et limites

Le contenu principal est rendu côté serveur puis pré-rendu statiquement. Seuls le formulaire et la comparaison sont des îlots clients. Le hero est préchargé avec des dimensions réservées. Les images suivantes sont différées et les polices sont auto-hébergées. Aucun moteur 3D, vidéo automatique ou bibliothèque d’animation externe.

Les vérifications responsive utilisent Chrome et de vrais viewports de documents embarqués ; elles ne constituent pas une campagne sur appareils physiques ou Safari. Aucun score Lighthouse, temps LCP mesuré ou certification d’accessibilité n’est revendiqué. La vérification de la délivrabilité de la boîte e-mail ne fait pas partie du test d’interface.

Les captures desktop et mobile sont des preuves de rendu. Le protocole de test temporaire n’est pas livré dans `public/`.

## Publication

Le code et les preuves sont livrés sur `main` de [eNudimmud/U-TTU-Studio](https://github.com/eNudimmud/U-TTU-Studio). Le commit final est indiqué dans le compte rendu de livraison et vérifiable dans l’historique GitHub.

Le déploiement Vercel reste à déclencher. Les instructions et variables d’environnement sont dans le README.
