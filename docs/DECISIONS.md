# Registre de livraison — 24 septembre 2026

## FAIT — Sources lues

| Source | Blob GitHub consulté |
| --- | --- |
| U-TTU / SOUL.md | `a349b410fa544260aaa52cb407faeb9bb1236bfc` |
| U-TTU / knowledge/13-CANON-VISUEL.md | `8452ba9b47f1969cd30729f6e50f40437639663d` |
| U-TTU / knowledge/14-SANCTUAIRE.md | `45a408b91ab8e8beb69f5f0f9587bff649be1eed` |
| U-TTU / knowledge/02-PHILOSOPHIE.md | `57a901f999c33db54d898c349d6cca7d1b9b590c` |
| U-TTU-Vault / 00_IDENTITY/IDENTITE.md | `74d091703c32cbbc36b8d737072b94e91143e241` |

## FAIT — Mise en œuvre

Composition éditoriale : texte décisif à gauche, portrait à droite, puis comparaison, dossier, protocole, prix et contact. Le bronze structure les interactions. Le rouge ne sert qu’au refus. `iii` apparaît dans la signature, le dossier, le manifeste et le favicon.

Le prix et les quatre livrables viennent du brief. Aucun délai, nombre de révisions, témoignage, économie de crédits ou résultat client chiffré n’a été inventé. Les modalités de direction mensuelle sont décrites comme un périmètre à convenir.

Le formulaire compose un e-mail ; il ne contacte aucun serveur d’envoi et ne stocke aucune donnée. Le bouton de copie offre une alternative au client mail. Sans JavaScript, l’action de formulaire est également un `mailto:` et un lien direct est présent.

Le développement reste en Next.js authentique pour Vercel, conformément au choix de stack. Aucun hébergement Sites ou Higgsfield n’a été créé.

## FAIT — Correction de l’identité visuelle

JD a rejeté l’identité représentée dans la première livraison. La palette correspondait au brief, mais le visage, la peau, la tenue et les membres s’écartaient de ses références. Le statut de prototype ne suffisait pas à corriger cette dérive. Le précédent contrôle visuel ne constituait pas une validation canonique.

Le hero utilise désormais le portrait fourni `1000034598.png`. La comparaison emploie ce portrait et le détail `1000033588.png`. Le Sanctuaire utilise `1000033487.png`. Seuls l’encodage WebP et le cadrage CSS varient : aucune nouvelle génération, retouche du visage ou modification de la couleur des références. Les fichiers et invariants sont documentés dans [VISUAL-CANON.md](VISUAL-CANON.md).

La comparaison oppose une instruction insuffisamment définie à des références explicites, puis révèle des critères PASS / FAIL. Elle ne présente pas un faux historique de résultats client ni deux personnages inventés. Les anciennes images ne sont plus livrées dans `public/`.

La carte OG typographique ne représente pas le personnage ; elle est conservée. Son prompt reste dans [asset-prompts.txt](asset-prompts.txt).

## PROPOSITION — Suite

Un vrai cas client, autorisé à être montré, renforcerait la preuve davantage qu’une animation supplémentaire. Avant d’ajouter Stripe, fixer les délais, la politique de révision et les modalités contractuelles avec le créateur. Aucun de ces éléments n’est annoncé comme acquis.
