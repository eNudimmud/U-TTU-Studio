# U*TTU — direction artistique du studio

Mis à jour le 3 octobre 2026 (studio direct). Le visage et le monde d’U*TTU ne sont pas libres : l’app suit les six planches de référence de JD (la tisseuse encapuchonnée, le filigrane or sur noir, les membres d’araignée, The Bloc, Soft Error en CRT, la fiche personnage avec palette, marque `iii` et schéma de toile).

## Sources

- Les six planches de référence transmises par JD le 3 octobre 2026. Elles ne sont pas publiées dans `public/` : elles guident, elles ne servent pas de héros.
- [U-TTU / SOUL.md](https://github.com/eNudimmud/U-TTU/blob/main/SOUL.md) : posture calme et précise, registre de vérité, symbole `iii`.
- [U-TTU / knowledge/13-CANON-VISUEL.md](https://github.com/eNudimmud/U-TTU/blob/main/knowledge/13-CANON-VISUEL.md) : noir, anthracite, gris métallique ; bronze, or ancien, brun chaud ; rouge très rare.

## Palette — fiche personnage

| Rôle | Couleur |
| --- | --- |
| Fond | encre `#0B0A09`, charbon `#121110`, graphite `#1C1B19` |
| Or (fil, interaction, accent) | ocre `#B98A43`, or `#C9A46A`, or pâle `#E8D3AD` |
| Terre (avertissement doux) | olive `#33301F`, sable `#B9A58C` |
| Refus | sang-de-bœuf `#5C241A`, texte `#E2A08F`. Jamais en accent. |
| Erreur de rendu | Soft Error : vert de phosphore sur noir, trames CRT. Seulement quand une prise échoue. |
| Interdit | Bleu néon ou froid, dégradés « IA » cyan et magenta, ville néon. |

Typographie : Syne (titres) et Manrope (texte), auto-hébergées, SIL OFL. Les étiquettes sont en capitales mono espacées, comme les cartouches des planches.

## Motifs dans l’app

- **La toile.** Un filigrane de cercles et de rayons, or à 7 %, dans le coin haut droit du fond. C’est le schéma de toile de la fiche, pas une texture décorative.
- **Le fil.** Les trois gestes sont des nœuds sur un fil d’or, en bas de l’écran. Un nœud tenu se remplit d’or. Pendant un calcul, un point d’or court sur le fil.
- **La marque `iii`.** Le mot-symbole de l’app : `iii` en or, puis U*TTU.
- **Soft Error.** L’échec d’un geste s’affiche en écran CRT (« Ça n’a pas abouti. »), puis la raison donnée par le compte.

## U*TTU, la guide

- Son visage, dans la bulle du guide, est le portrait canon (`public/images/uttu-canon-portrait.webp`), recadré en CSS sur le visage : même capuche, mêmes lignes dorées. Aucun autre visage n’est dessiné ni généré.
- Elle parle une phrase, au moment où l’on en a besoin, à l’endroit du geste. Pas de tutoriel en écrans, pas de manuel. « Compris » range la phrase ; « Ne plus guider » coupe la guide. Les phrases : [`src/lib/guide.ts`](../src/lib/guide.ts).
- Personnage, Scène et Prise gardent en plus une ligne courte, toujours visible. Elle ne se ferme pas. Elle ne nomme pas de nœud.
- L’accueil garde le portrait, légendé « U*TTU · elle te guide dans le studio ». C’est la seule grande image du site.

## Portrait

Le portrait canonique fourni par JD (`1000034598.png` → `public/images/uttu-canon-portrait.webp`, SHA-256 `574c8a45b35caf876ad25b881e357137e613e5b87b11660e644b891882a0c8df`) est converti en WebP sans retouche, cadré en CSS. Ce n’est pas un résultat de rendu.

La carte OG (`public/og.jpg`, 1200 × 630) est typographique : aucun personnage, aucune génération. Source : [og-card.html](og-card.html), rendue par Chrome headless.

Le mouvement reste discret et se coupe avec `prefers-reduced-motion`.
