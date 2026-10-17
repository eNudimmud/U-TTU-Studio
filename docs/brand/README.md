# Logo U*TTU Studio

- `uttu-logo-jd-source.png` : le logo dessiné par JD (1254 px, fond graphite), source unique.
- `scripts/brand/make_assets.py` régénère tout depuis ce fichier : `python3 scripts/brand/make_assets.py [chemin.png]`.
  - `public/brand/uttu-logo.png` : logo complet, fond transparent (détouré par dé-composition du fond #0F0F0F).
  - `public/brand/uttu-mark.png` : la toile seule, fond transparent, trait d'origine (grandes tailles).
  - `public/brand/uttu-mark-small.png` : la toile pour l'en-tête (38×28 px). Même dessin, trait épaissi : au trait d'origine, la toile disparaît sous 64 px.
  - `src/app/icon.png`, `src/app/apple-icon.png`, `public/brand/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` : icônes sur graphite #0F0F11.
- L'or du logo, mesuré sur l'astérisque et « STUDIO », vaut `#C9A75B`. C'est l'accent unique de l'interface (`--accent`).
- La toile n'apparaît que dans le logo, jamais en décor de l'interface.
