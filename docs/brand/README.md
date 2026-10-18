# Logo U*TTU Studio

- `uttu-logo-jd-source.png` : le logo dessiné par JD (1254 px, fond graphite), source unique.
- `scripts/brand/make_assets.py` régénère tout depuis ce fichier : `python3 scripts/brand/make_assets.py [chemin.png]`.
- Règles (retour de JD sur #115) : la toile **complète**, jamais recadrée ; le **trait d'origine**, jamais épaissi.
  Seules opérations : transparence tirée de la luminance sur le fond graphite (l'antialiasing est conservé),
  recadrage avec marge, réduction Lanczos (fichiers 1x/2x/3x pour les écrans retina).
  Pour rester lisible, le logo s'affiche **plus grand** (48 px de haut sur mobile, 56–64 px sur ordinateur).
- Fichiers :
  - `public/brand/uttu-logo.png` : logo complet (toile + U*TTU + STUDIO), taille native, fond transparent.
  - `public/brand/uttu-logo-h180*.png` : le même à 180 px de haut (accueil, ordinateur).
  - `public/brand/uttu-mark.png` : la toile seule, taille native ; `uttu-mark-h48/h56/h64*.png` : en-têtes.
  - `src/app/favicon.ico` (16/32/48), `src/app/icon.png`, `src/app/apple-icon.png`, `public/brand/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` : la toile telle quelle sur graphite #0F0F11.
  - `assets-proof.json` : contrôle automatique (rien d'encre hors du cadre, marge vide, écart à l'original).
- Seul nettoyage : les poussières quasi invisibles du fichier source (taches isolées sous 7 % d'opacité) sont retirées ; aucun trait n'est touché.
- L'or du logo, mesuré sur l'astérisque et « STUDIO », vaut `#C9A75B`. C'est l'accent unique de l'interface (`--accent`).
- La toile n'apparaît que dans le logo, jamais en décor de l'interface.
