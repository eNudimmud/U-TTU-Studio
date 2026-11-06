# Promptothèque CINEMA / ANIME

58 directions originales : 25 CINEMA et 33 ANIME. Chacune produit quatre textes distincts : personnage, décor, plan et mouvement, soit 232 variantes de départ. Le sujet reste modifiable. Recherche par référence, titre, matière et famille ; copie, ajout à la bible du projet et application directe dans Cast / Set / Shoot.

Les noms sont des repères de découverte. Les prompts décrivent des caractéristiques visuelles et ne transmettent pas de nom d’artiste au modèle. Ce sont des interprétations éditoriales, pas des recettes officielles ou une reproduction exhaustive de l’œuvre. Stephen King et Yūji Horii sont notamment des repères narratifs ; Adult Swim et Label 619 couvrent plusieurs auteurs. Les fiches correspondantes annoncent donc une proposition ciblée, pas une signature visuelle uniforme.

## Couverture des références demandées

La liste exhaustive et les alias recherchables sont dans `src/lib/sections/styles.ts`. Le test `sections-styles.test.ts` vérifie chacun des noms demandés, ainsi que les matières punk, analogique, caricature, VHS, Y2K et argentique. Les variantes de noms mal orthographiés restent recherchables, tandis que les fiches affichent les noms usuels.

## Recherche et sources consultées

- [Sony Pictures Imageworks — Into the Spider-Verse](https://www.imageworks.com/our-craft/feature-animation/movies/spider-man-spider-verse) : combinaison de volume, traits de visage et effets dessinés.
- [Sony — The Creators Behind the Spider-Verse](https://www.sony.com/en/brand/beyondthescreen/acrossthespiderverse/) : fabrication des différents langages graphiques.
- [Fortiche — Arcane](https://forticheprod.com/blog/arcane-by-fortiche/) : direction picturale, mélange 2D / 3D et mise en scène.
- [Studio Ghibli — catalogue officiel](https://www.ghibli.jp/works/) : repères d’œuvres et de création.
- [Loving Vincent — technique](https://www.lovingvincent.com/technology%2C48%2Cpl.html) : peinture animée à partir de références tournées.
- [NBCUniversal — The Wild Robot](https://www.nbcuniversal.com/article/wild-robot-jeff-hermann-storytelling-animation-innovation) : entretien de production.
- [STUDIO4℃ — œuvres](https://www.studio4c.co.jp/works/en/index.html) et [entretien avec Shōjirō Nishimi, Agence japonaise des affaires culturelles](https://www.bunka.go.jp/j-mediaarts/en/animation/SpecialInterviews/NISHIMI-Shojiro.html) : création, action et collaboration autour de Mutafukaz.
- [Label 619](https://label619.com/) et [Festival Chambéry BD — Run / 777Run](https://chamberybd.fr/label-619/) : distinguer le collectif éditorial et Guillaume Renard, alias Run / 777Run.
- [ASC — Realism for Citizen Kane, Gregg Toland](https://theasc.com/article/realism-for-citizen-kane/) : profondeur de champ et rôle dramatique du décor.

Les textes créatifs ne sont pas des extraits de ces pages. Aucune vignette générée n’est présentée comme preuve d’un prompt non testé. Les illustrations de navigation sont des signes dessinés, pas des résultats du modèle.

## Validation

Tests hors ligne : couverture intégrale des références demandées, identifiants uniques, variantes par usage, recherche avec accents, pas de nom d’artiste injecté par la construction du prompt. Aucun rendu payant. La fidélité artistique de chaque modèle à chaque fiche doit être évaluée sur des rendus autorisés avant toute promesse de résultat reproductible.

La bibliothèque n’offre pas de prompt de style dans Finish : cette étape améliore une prise existante.
