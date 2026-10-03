# Registre — C micro

Registre de vérité U*TTU : chaque ligne est un **fait**, une **hypothèse**, une **proposition** ou une **décision**. Dernière mise à jour : 2026-10-03.

## Cinéma — l’app : une chaîne, des crédits lisibles, publier — 3 octobre 2026

- **Décision JD :** un adhérent, un studio. Ton style → Ta scène → La prise, en français, une action principale. Sphère est l’étagère. La création tourne dans le cloud. JD ne gère pas de données de visiteurs.
- **Décision :** une seule barre d’app ; la chaîne passe en onglets en bas sur mobile ; Sphère est un outil discret ; le reste est dans « Plus ». Ton style devient une carte de look avec « Poser le monde » comme seul bouton plein. Manifeste web : installable.
- **Décision :** crédits. Pas de processeur de paiement : il n’y en a pas. Le cadre lit le solde Comfy du visiteur et le montre dans « Crédits ». Chaque lancement Comfy passe par « Lancer ce rendu ? » avec estimation et solde ; « Lancer » s’éteint si le solde lu est sous l’estimation basse. Les lancements confirmés et les jobs payés par le studio vont dans un journal local (`u-ttu-usage`), sans identité. Le solde fal du studio n’est pas lu : il faut une clé d’administration fal dans le relais (à créer) ; le bouton reste éteint.
- **Décision :** publier. « Publier la prise » prépare le texte et passe la main à X : feuille de partage de l’appareil avec le fichier, ou brouillon `https://x.com/intent/post`. Rien n’est publié sans le clic dans X. Publier depuis le studio sans quitter la page demanderait une app X (`X_CLIENT_ID`, `X_CLIENT_SECRET`) et que le studio garde le jeton du visiteur : le bouton reste éteint. Aucun connecteur d’autre réseau n’existe ; aucun n’est ajouté.
- **Décision :** Clerk n’est plus monté à la racine. Il ne charge que sur Compte, `/sign-in` et `/sign-up`, télémétrie coupée. Avant : chaque visite de `/studio` chargeait Clerk, `clerk-telemetry.com` et 4 cookies Clerk.
- **Fait :** les tuiles Sphère, le rejeu `/api/view`, l’avertissement Image 01–15 et le brief de La prise (#31) ne changent pas. 0 $ : aucun rendu lancé, rien publié.

## Cinéma — le brief entre dans le cadre, l’écran s’allège — 3 octobre 2026

- **Décision :** Look tenu et monde posé, « Charger la prise ici » prépare le texte du plan et, si les fichiers sont encore là, la photo d’identité et l’image du lieu. L’adresse `?template=video_minimax_h3_r2v` n’accepte pas ces octets : le cadre réécrit le JSON `/templates/video_minimax_h3_r2v.json` après le clic. Le nœud 138 reçoit le texte. Les nœuds 137 et 139 ne changent que si `POST /api/assets` renvoie un nom sûr. Le plein onglet ne reçoit rien de ce brief.
- **Décision :** le run payant n’est pas branché. Pas de `POST /api/prompt`, pas de `run_template`. Le LoRA (nœud 145, interrupteur 146) et l’échange de personnage restent à la main. Seedance n’est pas ce bouton.
- **Décision :** sur `/studio`, le chemin visible est Ton style → Ta scène → La prise. Sphère reste un lien discret. Identité, Bibliothèque, Studio et Compte sont dans « Autres espaces ». Former mon look et Tester un prompt restent, repliés.
- **Fait :** les tuiles Sphère, le rejeu `/api/view`, et l’avertissement Image 01–15 ne changent pas. 0 $ : aucun prompt n’est lancé.

## Cinéma — La prise ouvre le template H3 — 2 octobre 2026, nuit

- **Décision :** Look tenu et monde posé, « Charger la prise ici » ouvre le template officiel `video_minimax_h3_r2v` dans `/comfy-embed`. Le plein onglet reste `https://cloud.comfy.org/?template=video_minimax_h3_r2v`. Un autre id, ou `source=custom`, est refusé.
- **Fait :** le LoRA turbo est le nœud 145, champ `lora_name` (`minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16`). L’interrupteur nœud 146 est éteint (4 pas au nœud 144, 20 pas au nœud 143). Le Character-Swap se substitue à ce fichier, à la main. Le look Flux n’y entre pas. Deux images seulement (nœuds 137 et 139).
- **Décision :** le run payant n’est pas branché. Pas de `run_template`, pas de remplissage du brief, pas de burn. Seedance reste un autre chemin. Détail : [CINEMA-STUDIO-BRIEF.md](CINEMA-STUDIO-BRIEF.md).

## Cinéma — Take après le look — 2 octobre 2026, soir

- **Décision JD :** le look tenu peut ensuite nourrir une prise MiniMax H3 en Reference-to-Video, ou un LoRA d’échange de personnage. R2V : modèle `ref2va`, références nommées par balise, LoRA turbo 4 pas. Essai public : [MiniMax-H3-Character-Swap-LoRA](https://x.com/toyxyz3/status/2103933651797045300). Doc : [H3 R2V](https://docs.comfy.org/tutorials/video/minimax/minimax-h3-native#minimax-h3-reference-to-video-r2v).
- **Décision :** ce n’est pas branché. Le bouton de La prise ne lance rien. Pas de route nouvelle, pas de burn. Seedance reste un autre chemin possible. Détail : [CINEMA-STUDIO-BRIEF.md](CINEMA-STUDIO-BRIEF.md).

## Cinéma — tourner dans un monde — shell — 2 octobre 2026

- **Décision JD :** le sommet est de tourner dans un monde virtuel créé. Le shell `/studio` porte Look, Plateau, Take. Plateau reçoit la préviz (images, suites, notes) venue du bureau Blender. Take est le tournage dans ce monde, plus tard via Seedance ou un chemin équivalent, à partir de cette préviz et du look tenu. Pas une boîte texte-vers-vidéo. Le bouton ne lance rien. Détail : [CINEMA-STUDIO-BRIEF.md](CINEMA-STUDIO-BRIEF.md).
- **Fait :** aucun appel Seedance, aucune route fal nouvelle, aucun fichier `.blend` ouvert. Le monde et le plan restent sur l’appareil.

## Cinéma — Look, Plateau, Take — accueil — 2 octobre 2026

- **Décision JD :** l’étoile du nord est Look, puis Plateau, puis Take. L’accueil `/` la montre en français clair. Le shell reste `/studio` et s’ouvre sur Ton style. Détail : [CINEMA-STUDIO-BRIEF.md](CINEMA-STUDIO-BRIEF.md), [LANDING-AND-UX.md](LANDING-AND-UX.md).
- **Décision :** pas de Blender dans le navigateur. La préviz reste un export du bureau. Pas de Night City. Take, plus tard, est Seedance dans le cloud — pas branché. Aucune route fal nouvelle. Aucun burn vidéo.
- **Décision inchangée :** la phase 0 ferme toujours la boucle photo dans Créer. Vente HOLD. Apps Comfy et coffre conservés. Compte sans mur. Les retours Clerk vont vers `/studio#compte` et `/studio#creer`. Un ancien `/#compte` est reconduit vers le shell.

## CORS Worker fal — hôte live — 28 septembre 2026

- **Fait :** l’hôte live du studio est `https://u-ttu-studio.vercel.app`. `ALLOWED_ORIGINS` du Worker accepte cette origine et conserve `https://enudimmud.github.io`.
- **Décision :** le catalogue Pages (`https://enudimmud.github.io/U-TTU-Studio/`) reste figé. `NEXT_PUBLIC_FAL_PROXY_URL` se pose sur Vercel, Production et Preview. Ce n’est plus une variable Actions de Pages. Le Worker n’est pas déployé par cette note. Vente HOLD.

## Pont fiches Sphère — scenes/ — 28 septembre 2026

- **Décision :** chaque fiche Sphère (Avant, Après, Entre) édite le lieu, un rappel pour chacun des quatre angles, et la note gauche / droite. Le texte tient dans `localStorage`, clé `u-ttu-scenes`, sur cet appareil. L’export est un `.md` (`scenes/avant.md`, `scenes/apres.md`, `scenes/entre.md`) que la personne pose dans le dossier. L’import lit un collage ou un fichier, dans le navigateur. Le coffre n’est pas ouvert. Aucune sync.
- **Décision :** le ZIP de départ ne change pas. `scenes/` reste un dossier vide. Le format du `.md` est celui que la personne y dépose.
- **Décision :** Entre ne reçoit pas de partage inventé. Le catalogue ne gagne pas d’adresse Comfy. Cette entrée est le pont que le journal de budget laissait de côté. Le journal ne bouge pas.
- **Décision inchangée :** vente HOLD. Pas de Stripe. Pas de Worker fal. Pas de domaine propre. Créer reste ouvert, sans mur.
- **Fait :** le 28 septembre 2026, dans le navigateur, une fiche Avant se remplit, s’exporte en `avant.md`, refuse le markdown d’une autre fiche, relit un collage et un fichier, et garde le texte après rechargement. Le pointeur est dans Studio. Aucun appel réseau.

![Fiche Avant remplie, écran large](screenshots/sphere-fiche-edit-desktop.png)

![Export .md, écran large](screenshots/sphere-fiche-export-desktop.png)

<img src="screenshots/sphere-fiche-edit-mobile.png" width="390" alt="Fiche Avant remplie, écran étroit" />

<img src="screenshots/sphere-fiche-export-mobile.png" width="390" alt="Export .md, écran étroit" />

![Pointeur scenes/ dans Studio](screenshots/sphere-vault-pointer-desktop.png)

## Journal de budget — compte ouvert — 28 septembre 2026

- **Décision :** une fois la session Clerk ouverte, Compte tient un journal local. Une ligne : libellé, estimation (coût ou crédits, texte libre), date. Vingt-quatre lignes au plus. Vide au départ. Pas un solde. Pas de chiffre venu du cloud.
- **Décision :** la persistance est `localStorage`, clé `u-ttu-budget:` plus l’identifiant Clerk. Sans session, le texte d’attente reste. Aucun seau anonyme n’enregistre de ligne. L’ancienne clé globale `u-ttu-budget` n’est pas relue : elle n’appartient pas à un compte.
- **Décision :** l’extrait markdown se copie ou se télécharge (`jobs-extrait.md`). Il reprend le tableau de `jobs.md` (Date, Geste, Dossier, Note). Le dossier reste vide. Le site n’écrit pas dans le coffre.
- **Décision inchangée :** vente HOLD. Pas de Stripe. Pas de sync fal. Entre et le lien Vault↔Sphère ne bougent pas. Créer reste ouvert sans compte.
- **Fait :** sans clés Clerk, la session réelle ne s’ouvre pas. `npm test` couvre l’ajout, la clé par compte, l’extrait et le vide. Les captures signées ci-dessous montent ce panneau avec un identifiant local, le temps d’une vérification. Ce branchement n’est pas dans le code livré. L’anonyme est la page réelle : le texte d’attente, pas de formulaire.

![Compte, anonyme, le budget attend](screenshots/compte-budget-anonyme-desktop.png)

![Journal vide, compte ouvert](screenshots/compte-budget-vide-desktop.png)

![Une ligne notée](screenshots/compte-budget-ligne-desktop.png)

<img src="screenshots/compte-budget-ligne-mobile.png" width="390" alt="Une ligne notée, écran étroit" />

## Entre deux images — partage manquant — 28 septembre 2026

- **Fait :** « Former mon look » reste `?share=798eb224b972` (record `e8d7c649-0cb5-466b-be1a-4d7caa9204c2`, graphe `c-micro-train-image`, 40 nœuds). « Tester un prompt » reste `?share=25954f3b0278` (record `d5746aa7-b780-4e09-b877-0cf39309e875`, graphe `c-micro-prompt-test`, 11 nœuds). Les deux partages se résolvent. Vérifié le 28 septembre 2026.
- **Fait :** aucun partage Entre. L’historique git, les docs et le workspace Comfy (ces deux workflows seulement) n’en portent pas. Aucune adresse n’est inventée. Cette entrée remplace le « Entre reste Bientôt » des livraisons catalogue et doctrine du même jour, pour le processus. Le burn vidéo des fiches ne bouge pas.
- **Décision :** « Entre deux images » quitte « Bientôt » pour « Partage manquant ». Même carte que Former et Tester, bouton éteint, pas de cadre. La fiche Entre dit la même chose et n’ouvre rien. Si `NEXT_PUBLIC_COMFY_ENTRE_APP_URL` est un `https://cloud.comfy.org/?share=` valide, et que ce n’est ni Former ni Tester, la carte passe live et la fiche lance ce cadre, après le second clic déjà en place. Avant et Après restent « Bientôt ».
- **Décision inchangée :** vente HOLD. Pas de Worker fal, pas de Stripe, pas de domaine. Pas de budget, pas de coffre. Créer reste ouvert sans compte.

## Doctrine du burn — fiches Sphère — budget Compte — 28 septembre 2026

- **Décision :** avant un burn cher (long entraînement, vidéo), le canon se montre. Angles du look, mot d’appel, traits constants (yeux, marques), pointeur vers `CANON.md`. Le gate est souple : avertissement, puis confirmation. Les images fixes et Créer anonyme ne sont pas bloqués. « Tester un prompt » est le geste cheap, à côté de Former. La musique n’entre pas dans la génération : elle se pose au montage. Note seulement.
- **Décision :** Sphère porte des fiches Avant, Après, Entre. Chaque fiche a un nom de lieu, le rappel des quatre angles, une note gauche / droite, et le lien `scenes/`. Prolonger tient mieux qu’une régénération isolée. Entre reste Bientôt. Aucune troisième app Comfy.
- **Décision :** Compte, une fois connecté, montre un Budget. Journal local, lignes saisies ici, vide au départ. Pas de solde cloud. Pas de runs inventés. Anonyme : le budget attend le compte, Créer reste ouvert. Sans clés Clerk, le placeholder reste.
- **Décision inchangée :** vente HOLD. Pas de Stripe. Pas de Worker fal. Pas de domaine propre. L’export Pages n’est pas réactivé. Compte reste en fin de nav.

## Fondation compte — Vercel et Clerk — 28 septembre 2026

- **Décision :** Vercel est la cible officielle. L’export statique GitHub Pages est retiré : `src/proxy.ts` (Clerk) ne peut pas vivre dans `output: "export"`. Le workflow [pages.yml](../.github/workflows/pages.yml) ne publie plus. Il vérifie `npm test`, `npm run typecheck` et `npm run build` sans clés. Le site déjà en ligne sur `https://enudimmud.github.io/U-TTU-Studio/` reste la dernière livraison Pages (catalogue processus). Il ne recevra plus cette branche. Détail : [AUTH.md](AUTH.md).
- **Décision :** le compte est un sixième mode, **Compte**, en fin de nav. Identité reste le canon du personnage (`CANON.md`, `loras/`). Compte n’est pas une pièce du coffre, et ne passe pas devant Créer. Anonyme : créer, sphère, ZIP. Connecté : profil, `UserButton`, listes vides « Tes runs » et « Ton studio cloud », liens vers le schéma.
- **Décision :** Clerk, Google et GitHub, flux OAuth standard (`SignIn` / `SignUp`). Les providers s’activent dans le dashboard Clerk, pas dans un second SDK. Pas de Stripe, pas de TikTok, Instagram ou X. Pas de Worker fal. Pas de sync R2 ou Git.
- **Fait :** sans `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` et `CLERK_SECRET_KEY`, le build et les tests passent. Le proxy n’appelle pas Clerk. L’UI montre un placeholder. Le mode keyless de Clerk est forcé éteint (`NEXT_PUBLIC_CLERK_KEYLESS_DISABLED`), pour ne pas créer une app temporaire tout seul.
- **Fait :** l’application Clerk existe déjà. Instance **Development**, id `app_3JxoXh0l1EQ` ([dashboard](https://dashboard.clerk.com/apps/app_3JxoXh0l1EQ)). Le CLI de cette livraison n’était pas connecté (`auth_required`). `clerk init --app app_3JxoXh0l1EQ` ouvre un navigateur et attend. Il n’a pas été mené à terme : sans login, le CLI crée une app keyless au lieu de celle-ci. Aucune clé n’a été écrite. Le lien et `clerk env pull` sont pour JD ([AUTH.md](AUTH.md)).
- **Décision :** cette entrée remplace le « pas d’auth » des livraisons shell, coffre et catalogue du même jour. La vente reste HOLD. Les jobs cloud ne sont pas inventés : les listes sont vides.
- **Fait :** le schéma du ZIP ne change pas. `refs/`, `dataset/`, `loras/`, `scenes/`, `processes/`, `jobs.md`, `CANON.md`.

## Catalogue des processus — 28 septembre 2026

- **Décision :** les apps Comfy Cloud sont un catalogue de processus de création, pas une page technique. La source est `src/lib/processes.ts`. Sphère en est la maison. Créer garde le parcours 2–3 photos → lot de 15, et pointe « Former mon look » une fois le lot en PASS.
- **Décision :** l’interim reste l’App Mode en embed, chargé au clic, avec le consentement déjà en place (traceurs de Comfy). « Lancer » ouvre ce cadre dans la page. Pas de nouvel onglet forcé. Une API Comfy dans le domaine du studio, plus tard.
- **Fait :** deux processus sont live. « Former mon look » reprend l’app `?share=798eb224b972` (`e8d7c649-0cb5-466b-be1a-4d7caa9204c2`). « Tester un prompt » reprend `?share=25954f3b0278` (`d5746aa7-b780-4e09-b877-0cf39309e875`). Aucune troisième app n’est créée.
- **Décision :** Avant, Après et Entre deux images restent « Bientôt ». Ces deux apps ne tiennent pas un passage entre deux images. On ne les présente pas comme une scène.
- **Fait :** le panneau Studio liste le catalogue en texte et renvoie au dossier `processes/` et au journal `jobs.md`. Le site n’écrit pas dans le coffre. Le ZIP de départ ne change pas.
- **Décision inchangée :** vente HOLD. Worker fal éteint. Pas d’auth, pas de Stripe.

## Studio maison — coffre Obsidian — 28 septembre 2026

- **Décision :** chaque personne gère son studio dans un vault Obsidian, sur sa machine. Le mode Studio n’est plus un tableau « bientôt ». Il est la maison : schéma, mode d’emploi, ZIP de départ. Le site ne lit pas le coffre et n’écrit pas dedans. Détail : [VAULT.md](VAULT.md).
- **Décision :** le schéma canon est `U-TTU-Studio/` avec `refs/`, `dataset/`, `loras/`, `scenes/`, `processes/`, `jobs.md`, `CANON.md`. Le ZIP ajoute un `README.md` de mode d’emploi, qui n’est pas une pièce de travail. Aucun plugin Obsidian n’est requis.
- **Décision :** correspondance des modes, dans l’ordre du shell. Créer → `refs/` et `dataset/`. Sphère → `scenes/`. Identité → `CANON.md` et `loras/`. Bibliothèque → les dossiers déjà remplis (`refs/`, `dataset/`, `loras/`, `scenes/`). Studio → `jobs.md` et `processes/`.
- **Fait :** le ZIP est produit par `src/lib/vault.ts` et déposé dans `public/vault/U-TTU-Studio.zip`. `npm run build` le régénère avant l’export. GitHub Pages le sert comme les autres fichiers de `public/`. Pas de Worker, pas de compte, pas de sync.
- **Proposition :** avec un compte, plus tard, une sync optionnelle vers R2 ou un Git privé. Le coffre reste utilisable hors ligne sans compte. Hors de cette livraison.
- **Décision inchangée :** vente HOLD. Sphère reste un aperçu sans rendu vidéo. Pas d’auth, pas de Stripe, pas de déploiement fal.

## Shell et DA — avant le Worker — 28 septembre 2026

- **Décision :** le shell Studio OS et la DA de Créer passent avant le déploiement du Worker fal. Cinq modes dans une seule page : Créer, Sphère, Identité, Bibliothèque, Studio. Hash client, export Pages inchangé. Pas de route serveur, pas d’auth, pas de Stripe.
- **Décision :** tant que `NEXT_PUBLIC_FAL_PROXY_URL` est vide, les boutons qui lanceraient fal restent éteints. Les états hors ligne le disent. Aucun appel réseau n’est simulé. Le Worker n’est pas déployé. 0 $.
- **Fait :** Créer garde le parcours 2–3 photos → plan de 15, l’import des 15 images, le gate et le repli Comfy replié. Le tiroir « Comment ça marche » reste secondaire. Sphère (Avant / Après / Entre), la bibliothèque et le tableau sont des panneaux réels : aperçus « bientôt », sans vidéo et sans compte. Identité reprend le gate, les légendes, le ZIP et le rail fal.
- **Décision inchangée :** vente HOLD. Échéance au 8 octobre 2026, visible sans devenir le héros. La Phase 0 ci-dessous avait exclu Sphère et dashboard : cette décision ajoute leurs panneaux, pas leur backend.
- **Fait :** « Préparer les 15 images » ne part que si le trigger est valide, qu’il y a 2 ou 3 photos, et au moins 2 invariants (G02). Le contrôle est dans le client, avant l’appel. Un lot incomplet ne lance rien. Sans proxy, « J’ai déjà 15 images » est le bouton principal. Pas de déploiement Worker, pas de plafond, pas d’appel fal payant.

## Phase 0 — Créer maintenant — 28 septembre 2026

- **Décision de cette livraison :** la page s’ouvre sur Créer. Le tutoriel est un tiroir. Le chemin principal est fal, dans la page. Comfy est un repli replié (« Expert »), chargé seulement après un second clic. La vente reste HOLD. Pas de Stripe, d’auth, de dashboard ni de Sphère vidéo.
- **Fait :** le gate reste 15 JPEG et 15 légendes. Le plan de `src/lib/fal-bootstrap.ts` vise le repère G20 (4 gros plans, 7 bustes, 4 plein pied) et les trois angles de visage. Un test construit un lot avec ce plan, deux invariants et les cinq confirmations : verdict PASS. La revue humaine (garder, confirmations) n’est pas sautée.
- **Fait, endpoint :** variations via `fal-ai/flux-pro/kontext/multi` (`image_urls`, `prompt`, `aspect_ratio` `1:1`, `output_format` `jpeg`, `num_images` 1, `enhance_prompt` false). Schéma lu le 28 septembre 2026 sur la page API fal. Le prompt est fixé côté Worker : le navigateur envoie les photos et le trigger, pas la consigne. Le trigger n’est pas dans le prompt de génération ; il n’entre que dans les légendes.
- **Hypothèse :** cet endpoint, marqué expérimental par fal, garde l’identité à partir de 2 ou 3 photos quand on ne change que le cadrage et la scène. Non mesuré : aucun appel fal dans cette livraison (0 $).
- **Hypothèse de prix :** 0,04 $ par image, tarif publié pour Flux Kontext Pro sur la page tarif fal le 28 septembre 2026 (15 images ≈ 0,60 $). Une ligne de prix distincte pour l’id `/multi` n’a pas été vue. Le taux 1 USD = 0,82 CHF reste non vérifié.
- **Proposition :** si le multi déçoit à la première facture ou au premier lot réel, remplacer l’id par `fal-ai/flux-pro/kontext` et n’envoyer qu’une `image_url` (l’index `refIndex` du plan). Le gate et l’UI ne bougent pas.
- **Fait d’hébergement :** l’export Pages statique reste le build. Le calcul nouveau est dans le Worker (`POST /bootstrap`, `GET /file`). `FAL_KEY` n’est pas dans `NEXT_PUBLIC_*`. Le Worker n’a pas été déployé ici.
- **Décision inchangée :** échéance au 8 octobre 2026 ou 1 CHF. Cette phase ne lève pas le HOLD.

## Reprise après PR #5 — 26 septembre 2026

- **Décision JD (passation)** : C micro uniquement, vente HOLD, Look-Lock KILL ; échéance au 8 octobre 2026 ou 1 CHF payant. Pas de fusion par Astra sans feu JD, PR #4 hors périmètre des modifications.
- **Fait GitHub vérifié le 26 septembre** : PR #5 fusionnée le 25 septembre (`41ef200`), ainsi que PR #4. Les corrections sont reportées sur ce `main`, doctrine UI conservée, pour une PR de suivi DRAFT.
- **Décision de périmètre** : rail fal expérimental en plus du repli Comfy, même gate de 15 JPEG et légendes. Cette décision remplace la restriction historique à Comfy seul ; elle ne change pas le produit.
- **Fait vérifié dans le code** : la clé fal reste côté Worker ou shell smoke. La variable publique `NEXT_PUBLIC_FAL_PROXY_URL` active le panneau après PASS ; vide, elle le garde en « Script seul ».
- **Fait de cette reprise** : aucun déploiement Worker ni appel fal réel (0 $). Les tests utilisent un faux fal ; la recette et les limites sont dans [FAL-SPIKE.md](FAL-SPIKE.md).
- **Preuve rapportée par la passation** : smoke API live PASS sur la machine U*TTU, 100 étapes puis une image à 0,75, dataset synthétique. Non rejoué ici, aucune preuve de qualité identité.
- **À vérifier** : fidélité sur corpus réel, facture fal, taux USD/CHF (actuellement fixe et non vérifié), expiration effective des fichiers, ressources Cloudflare et configuration distante. La commercialisation reste HOLD.

## Décisions

| Décision | Par | Date |
| --- | --- | --- |
| App : une barre, la chaîne en onglets mobiles, Sphère étagère, carte de look. Crédits : solde Comfy lu dans le cadre, « Lancer ce rendu ? » avant chaque `POST /api/prompt`, journal local. Publier : feuille de partage ou brouillon X, rien sans clic. Clerk seulement sur Compte et connexion, télémétrie coupée. Solde fal et publication directe : éteints, secrets nommés. | JD (intention) + livraison | 2026-10-03 |
| La prise écrit le texte du plan dans le nœud 138 du cadre H3. Les photos (137, 139) ne partent que si `/api/assets` renvoie un nom. L’URL du template ne porte pas les octets. Plein onglet sans brief. Run payant non branché. Écran : une chaîne, Sphère en retrait. | Livraison | 2026-10-03 |
| La prise, look tenu et monde posé, ouvre `video_minimax_h3_r2v` dans le cadre. LoRA turbo : nœud 145 `lora_name`, interrupteur 146 éteint. Character-Swap à la main dans ce champ. Run payant non branché. Pas de burn. | Livraison | 2026-10-02 |
| Take, après le look tenu : MiniMax H3 R2V (`ref2va`, balises, LoRA turbo 4 pas) ou LoRA d’échange de personnage. Non branché. Pas de burn. Seedance reste possible. | JD | 2026-10-02 |
| Étoile cinéma : Look → Plateau → Take. Accueil `/`, shell `/studio`. Pas de Blender navigateur, pas de Night City, pas de route Seedance ni fal vidéo. Phase 0 photo inchangée. Vente HOLD. | JD (verrou) + livraison (accueil) | 2026-10-02 |
| L’hôte live est Vercel (`https://u-ttu-studio.vercel.app`). Le Worker fal l’accepte en CORS, avec le catalogue Pages figé. `NEXT_PUBLIC_FAL_PROXY_URL` est une variable Vercel (Production et Preview). Vente HOLD. | Livraison (CORS Worker) | 2026-09-28 |
| Les fiches Sphère s’exportent en `.md` pour `scenes/`, se relisent par collage ou fichier, et restent dans `localStorage`. Le ZIP ne change pas. Aucune sync. Entre sans partage inventé. Vente HOLD. | Livraison (mission pont fiches) | 2026-09-28 |
| Compte signé tient un journal local, clé par identifiant Clerk : libellé, estimation, date. Extrait markdown, sans écriture dans le coffre. Pas de solde, pas de Stripe, pas de sync fal. Anonyme : l’attente. Vente HOLD. | Livraison (mission budget) | 2026-09-28 |
| Entre deux images est au catalogue comme Former et Tester. Sans partage Comfy distinct, l’état est « Partage manquant » : pas de cadre, pas d’adresse inventée. Un `?share=` réel, plus tard, ouvre la fiche. Avant et Après restent Bientôt. Vente HOLD. | Livraison (mission Entre) | 2026-09-28 |
| Le burn cher attend le canon, avec avertissement et confirmation. Les fixes restent ouvertes. Sphère tient les fiches de lieu. Compte note un budget local, vide, sans solde cloud. Entre reste Bientôt. Vente HOLD. | Livraison (mission doctrine) | 2026-09-28 |
| Vercel est la cible. Clerk (Google + GitHub) ouvre le mode Compte, sans mur devant Créer. Sans clés : placeholder, build vert. Pages n’est plus publié. Pas de Stripe, pas de sync, pas de jobs cloud. Vente HOLD. | Livraison (mission compte) | 2026-09-28 |
| Les apps Comfy sont un catalogue de processus. Interim : embed App Mode au clic, avec consentement. API dans le domaine, plus tard. Sphère tient les cartes. Entre deux images reste « Bientôt ». Vente HOLD. | Livraison (mission catalogue) | 2026-09-28 |
| Le mode Studio est la maison du coffre Obsidian : schéma canon, ZIP de départ, hors ligne. Pas de sync, pas de compte. Sphère reste sans vidéo. Vente HOLD. | Livraison (mission vault) | 2026-09-28 |
| Shell à cinq modes et DA Créer avant le Worker fal. Proxy vide : boutons fal éteints, pas de réseau simulé. Sphère, bibliothèque et tableau en panneaux « bientôt ». Vente HOLD. | Livraison (mission shell) | 2026-09-28 |
| Tuer A (Look-Lock, forfait DA et ZIP-juge) : retrait du site, de la nav, des métadonnées et de la carte OG, sans route d’archive. | JD (mission) | 2026-09-24 |
| C micro est l’unique offre : dataset propre → LoRA → 1 image. | JD (mission) | 2026-09-24 |
| Date de kill au 2026-10-08, ou 1 client payant avant. | JD (mission) | 2026-09-24 |
| Une seule stack : Flux.1 [dev] sur Comfy Cloud, pas de SDXL en parallèle. | Livraison ([COMFY-STACK.md](COMFY-STACK.md)) | 2026-09-24 |
| Entraînement et image dans le même run Comfy. | Livraison, imposé par l’absence de `SaveLoRA` sur Cloud | 2026-09-24 |
| Dataset fixé à 15 images exactement. | Livraison, imposé par les emplacements fixes de l’App Mode | 2026-09-24 |
| FAIL réservé aux violations ; information manquante en « À faire » ; PASS exige tout en PASS. | Livraison, après QA | 2026-09-24 |
| Aucun crédit Comfy dépensé pendant la livraison. Premier run = calibration par JD. | Livraison | 2026-09-24 |
| Après PASS, les deux apps Comfy s’affichent dans la page (iframe), avec « Ouvrir en plein onglet » au-dessus de chaque cadre. Pas de proxy, pas de crédits Studio, pas de préremplissage des 15 images. Ne débloque pas la vente. | Livraison | 2026-09-24 |
| Cadres Comfy chargés au clic seulement (« Charger l’app Comfy ici ») : Comfy charge ses propres traceurs, il faut le consentement des visiteurs CH/UE. « Ouvrir en plein onglet » reste disponible sans charger le cadre. | JD | 2026-09-24 |
| Doctrine LoRA 2026 intégrée au guide, sans changer la stack ni le statut de vente : repère de cadrage, coaching des légendes, grille de test. Pas de pile Pony, Kohya ou SDXL, pas d’auto-bootstrap (4 à 8 références → mini-LoRA → régénération). | JD (mission) | 2026-09-24 |
| Répartition visée des 15 images : 20–30 % gros plans, 40–50 % buste, 20–30 % plein pied, soit 3–5 / 6–8 / 3–5. Contrôle G20 en À NOTER, jamais bloquant ; G13 reste le minimum bloquant ([DATASET-GATE.md](DATASET-GATE.md#repère-de-cadrage-g20)). | JD (mission) | 2026-09-24 |
| Coaching des légendes : principe « ce qui change / ce que le trigger tient », exemples FAIL et PASS, aide sur chaque carte. Aucune règle nouvelle. | JD (mission) | 2026-09-24 |
| Grille de test à l’étape 3 : 3 prompts fixes × forces 0,60 / 0,75 / 0,90, seed de l’étape 3. Faute de `SaveLoRA`, ni checkpoint ni LoRA réutilisable : comparaison avec/sans LoRA et variation de force. Une case = un run complet, coût affiché ([COMFY-STACK.md](COMFY-STACK.md#grille-de-test-étape-3)). | JD (mission) | 2026-09-24 |
| Étapes d’entraînement par défaut inchangées (800). 1 200 à reconsidérer après calibration. | JD (mission) | 2026-09-24 |

## Faits

- Le catalogue Comfy Cloud contient `TrainLoraNode`, `MakeTrainingDataset`, `LoraModelLoader`, `LossGraphNode`, `CreateList`, `ImageScaleToTotalPixels` et `Basic data handling: StringSplitlinesDataList`. Il ne contient ni `SaveLoRA` ni les loaders de dataset par dossier (vérifié par MCP le 2026-09-24).
- Runs limités à 30 min en Standard et Creator, 60 min en Pro. GPU à ~0,39 crédit/s. 211 crédits ≈ 1 $. Import de LoRA réservé aux plans Creator et plus, depuis Hugging Face ou Civitai.
- `estimate_credits` renvoie 0 crédit pour les deux workflows : il ignore le temps GPU.
- Les deux workflows passent la validation `submit_workflow` en `dry_run`. Ils sont sauvegardés dans le workspace Comfy (records `e8d7c649…` et `d5746aa7…`, version 2 avec App Mode) et partagés en `?share=798eb224b972` et `?share=25954f3b0278`.
- Les graphes versionnés dans `public/comfy/` correspondent au générateur, lien par lien et valeur par valeur (`tests/comfy.test.ts`).
- QA E2E sur Chrome avec 20 images synthétiques : chaque piège est signalé, le PASS n’arrive qu’avec 15 images propres, le ZIP est valide ([QA.md](QA.md)).
- `cloud.comfy.org` envoie `frame-ancestors 'self' https:`, sans `X-Frame-Options` (2026-09-24). Après le clic, Chrome affiche la connexion Comfy dans les cadres du guide servi en HTTPS ; une page HTTP est refusée ([QA.md](QA.md#cadre-comfy-dans-le-guide)).
- La page de connexion Comfy appelle `www.googleadservices.com` et `px.ads.linkedin.com` (journal réseau Chrome, 2026-09-24). Avant le clic sur « Charger l’app Comfy ici », le guide ne contacte aucun domaine `comfy.org`.
- Frontend Comfy (`useSharedWorkflowUrlLoader.ts`, `workflowService.ts`) : un `?share=` passe par la connexion, puis la fenêtre « Open shared workflow », puis charge le graphe dans la vue donnée par `extra.linearMode`. Les snapshots `798eb224b972` et `25954f3b0278` ont `linearMode: true`.
- Le workflow d’entraînement a un seul prompt (`CLIPTextEncode`) et une seule force (`LoraModelLoader`) : un run rend une seule case de la grille de test, plus son témoin.

## Hypothèses — à mesurer

- Vitesse d’entraînement Flux dev à 0,25 MP sur les GPU Comfy : 0,7 à 1,4 s par étape. Frais fixes de 90 à 240 s. Image 1024² de 9 à 14 s.
- 800 étapes, lr 4e-4 et rank 16 sur 15 images suffisent pour une identité reconnaissable (réglages proches des entraîneurs Flux « rapides » courants). Non vérifié sur Comfy.
- Le `TrainLoraNode` du core entraîne correctement Flux.1 [dev] : implémentation générique, flow-matching géré par `model_sampling`. Node marqué expérimental.
- Les seuils de netteté (100 absolu, 35 % de la médiane) et de couleur (3,5 MAD) détectent assez de problèmes sans trop de faux positifs sur des photos réelles. Calibrés uniquement sur des images synthétiques.
- Un lien `?share=` ouvre l’App Mode une fois connecté. C’est ce que fait le code du frontend Comfy ; l’écran connecté n’a pas été vu.
- La connexion Comfy fonctionne dans le cadre. Sa session vit en localStorage et IndexedDB, partitionnés dans un cadre tiers : une connexion de plus est attendue. Non vérifié sans compte tiers ; repli : « Ouvrir en plein onglet ».
- La répartition 20–30 / 40–50 / 20–30 % et la bande d’usage 0,70–0,85 viennent des pratiques LoRA 2026 pour Flux. Elles ne sont pas calibrées sur ce stack (0,25 MP, 800 étapes, rank 16).
- Chaque run Comfy Cloud réentraîne la LoRA. En local, ComfyUI réutilise la sortie d’un node dont les entrées n’ont pas changé ; rien n’indique que Comfy Cloud le fasse d’un run à l’autre. À vérifier pendant la calibration ([COMFY-STACK.md](COMFY-STACK.md#coût--modèle-et-calibration), étape 5).
- Même dataset, mêmes étapes et seed d’entraînement fixe (42) : d’un run à l’autre, la LoRA ne varie que par les écarts de calcul du GPU. C’est ce qui rend les cases de la grille comparables. Non mesuré.

## Propositions — non vérifiées, décision JD

- **Prix** : CHF 49–149 pour un run guidé one-shot, ou crédits Comfy du client + frais de guidage. Affiché « prix pressenti, non confirmé ».
- **Licence Flux.1 [dev]** : faire valider l’usage commercial des sorties, le client exécutant le modèle sur son compte Comfy.
- **Calibration** avant toute vente : test à blanc et run réel sur un vrai dataset (≈ 300 à 650 crédits), puis `TIMING.measured = true`.
- **Phase test** : affichée jusqu’au 8 octobre 2026, date de kill.
- **Force par défaut de l’étape 3** : 1,00, valeur du workflow Comfy, au-dessus de la bande d’usage. Le guide l’explique sans la changer. Passer le guide à 0,75 tient en une ligne.
- **Grille en un seul run** : un workflow qui rendrait les 3 forces après un seul entraînement ferait passer une ligne de la grille de 3 runs complets à 1 run et 3 rendus de 9 à 14 s. Il faudrait régénérer, valider, sauvegarder et repartager les workflows Comfy : hors de cette livraison.

## Archive — offre A (tuée)

La première livraison vendait le « Look-Lock Pack » (CHF 800–2 500) et une direction légère mensuelle. JD l’a tuée le 2026-09-24. Tout son contenu a été retiré du site : comparaison, grille PASS / FAIL d’U*TTU, tarifs, Sanctuaire, formulaire de brief. Le code reste consultable dans l’historique git (`9fca7e5` et antérieurs). Le portrait canonique d’U*TTU fourni par JD reste utilisé dans le hero, légendé comme référence du studio ([VISUAL-CANON.md](VISUAL-CANON.md)).
