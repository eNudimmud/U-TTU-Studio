# U*TTU — DA du site C micro

## Sources

- [U-TTU / SOUL.md](https://github.com/eNudimmud/U-TTU/blob/main/SOUL.md) : posture calme et précise, registre de vérité (fait, hypothèse, proposition, décision), symbole `iii`.
- [U-TTU / knowledge/13-CANON-VISUEL.md](https://github.com/eNudimmud/U-TTU/blob/main/knowledge/13-CANON-VISUEL.md) : palette de base noir, anthracite, gris métallique ; accents bronze, or ancien, brun chaud ; rouge très rare.

Seules la DA et le ton sont repris, pas l’ancien produit Look-Lock.

## Application

| Élément | Règle |
| --- | --- |
| Fond, panneaux | `#0A0A0B`, `#111112`, `#141414`, `#1A1B1E` |
| Interaction, PASS, accents | Bronze `#A67C52`, or ancien `#C4A574` |
| Rouge | Uniquement FAIL et refus (`#8B1E1E`, texte `#DF9390`). Jamais en accent principal. |
| Interdit | Bleu néon ou froid, dégradés « IA » cyan et magenta. |
| Typographie | Syne (titres) et Manrope (texte), auto-hébergées, SIL OFL. |
| Mouvement | Discret : entrée du hero, apparition des contrôles, pulsation dorée sur l’image ciblée. Tout est coupé avec `prefers-reduced-motion`. |
| Ton | Vivant et clair, pas temple : tutoiement, phrases courtes, chiffres visibles. |

## Image

Le hero garde le portrait canonique fourni par JD (`1000034598.png` → `public/images/uttu-canon-portrait.webp`, SHA-256 `574c8a45b35caf876ad25b881e357137e613e5b87b11660e644b891882a0c8df`). Il est converti en WebP sans retouche, cadré en CSS. Il est légendé « Référence du studio, pas une sortie du parcours » pour ne pas le faire passer pour un résultat de LoRA.

Le détail de peau et la scène du Sanctuaire servaient l’offre A. Ils ont été retirés de `public/` et restent dans l’historique git.

La carte OG (`public/og.jpg`, 1200 × 630) est typographique : aucun personnage, aucune génération. Source : [og-card.html](og-card.html), rendue par Chrome headless.
