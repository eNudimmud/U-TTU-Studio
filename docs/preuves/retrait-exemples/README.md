# Retrait de « Pars d’un exemple » (29.10.2026)

Demande de JD (29.10, 20:48 Zurich) : la section « Pars d’un exemple / Start from an example » sous les outils
du studio fait doublon avec les cartes d’outils et ne dit pas si l’on crée une image ou une vidéo. Retirée.

- `avant-prod-*.png` : prod avant (https://u-ttu-studio.vercel.app/studio), la grille d’exemples sous « Son ».
- `studio-<L>x<H>.png` : /studio après, haut de page (390×844, 844×390, 1024×600, 1280×800).
- `studio-<L>x<H>-bas.png` : bas de page après — la page finit sur la famille « Son », sans trou.
- `studio-<L>x<H>-page.png` : capture pleine page.

Contrôles (Playwright, serveur local) : aucun `[data-ex-galerie]`, `[data-ex-strip]`, `[data-barre-all-link]`,
aucun texte « Pars d’un exemple / Start from an example », pas de débordement horizontal, aux quatre tailles.
Aucune dépense Comfy.
