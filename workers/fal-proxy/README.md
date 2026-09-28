# Proxy fal — Cloudflare Worker (non déployé)

Le studio live est sur Vercel (`https://u-ttu-studio.vercel.app`) : la clé fal ne peut pas y vivre. Ce Worker la garde côté serveur. Le navigateur n’appelle que lui, jamais fal avec la clé. Le catalogue GitHub Pages (`https://enudimmud.github.io/U-TTU-Studio/`) est figé. Contexte, coûts et vie privée : [docs/FAL-SPIKE.md](../../docs/FAL-SPIKE.md).

**Statut : code du spike présent, Worker non déployé dans cette reprise, vente HOLD.** Les tests (`tests/fal-proxy.test.ts`) le font tourner contre un faux fal, dans Node. Astra n’a effectué aucun appel fal réel (0 $). Le smoke live rapporté sur la machine U*TTU est documenté séparément ; il n’a pas été rejoué.

## Routes

Toutes exigent `Authorization: Bearer <ACCESS_TOKEN>`.

| Route | Entrée | Ce que fait le proxy | Réponse |
| --- | --- | --- | --- |
| `POST /train?trigger=…&steps=…` | Corps : le ZIP fal (`application/zip`) | Revérifie la forme du gate : exactement 15 JPEG et 15 légendes qui commencent par le trigger, rien d’autre. Dépose le ZIP sur fal.storage (expiration demandée : 24 h), puis met `fal-ai/flux-lora-fast-training` en file (`create_masks: true`, `is_style: false`). | `202 { id }`, ou `422 { error, problems }` |
| `GET /status?job=train\|gen&id=…` | — | Lit la file fal. Une fois terminé, renvoie le résultat utile. | `{ status: "IN_QUEUE", position }`, `{ status: "IN_PROGRESS", log }`, `{ status: "COMPLETED", result }` ou `{ status: "FAILED", error }` |
| `POST /gen` | JSON `{ lora, prompt, scale, seed }` | 1 image `fal-ai/flux-lora`, 1024 × 1024, 28 pas, filtre de sécurité fal actif. `lora` doit être un fichier hébergé par fal, `scale` entre 0,5 et 1,3. | `202 { id }` |
| `POST /bootstrap?trigger=…` | `multipart/form-data`, champ `refs` répété : 2 ou 3 images (JPEG, PNG ou WebP, 8 Mo chacune) | Vérifie le trigger. Dépose les photos (expiration demandée : 24 h). Met en file 15 jobs `fal-ai/flux-pro/kontext/multi`, prompts et seeds fixés dans `src/lib/fal-bootstrap.ts` (`enhance_prompt: false`, une image, carré). Le navigateur ne choisit ni le prompt ni le nombre. | `202 { refs, slots }` — chaque slot : `index`, `id`, `angle`, `framing`, `variables`, `caption`, `seed` |
| `GET /file?url=…` | URL https hébergée par fal | Relaye les octets sans la clé, sans suivre une redirection. Refuse toute autre origine de fichier. | image JPEG, PNG ou WebP, `Cache-Control: private, no-store` |

Résultat d’un entraînement : `{ lora, config }`, les URL de `diffusers_lora_file` et `config_file`. Résultat d’une image : `{ image, width, height, seed, nsfw }`.

## Garde-fous

- **Code d’accès.** `ACCESS_TOKEN`, 24 caractères au moins, est exigé sur chaque route. Il n’est pas dans le site : le studio le tape dans le panneau « Rail fal », il reste en mémoire le temps de la page.
- **CORS.** Pour les navigateurs, seules les origines de `ALLOWED_ORIGINS` sont acceptées, séparées par des virgules. Liste : `https://u-ttu-studio.vercel.app` (studio live) et `https://enudimmud.github.io` (catalogue Pages figé, sans le chemin `/U-TTU-Studio`). Une autre origine, y compris une preview `*.vercel.app`, reçoit un 403. Une requête sans `Origin` reste possible, mais exige toujours le code d’accès : CORS n’est pas une authentification.
- **Pas de relais ouvert.** Trois endpoints fal, et des entrées fixées côté serveur. `/train` : 20 à 2 000 étapes (environ 4 $ au maximum). `/gen` : une image (environ 0,035 $). `/bootstrap` : toujours 15 variations, prompts imposés (environ 0,60 $ si le tarif Kontext Pro de 0,04 $ s’applique au multi — hypothèse, voir [DECISIONS](../../docs/DECISIONS.md)). `/file` ne télécharge que depuis fal.
- **Vie privée.** Le code du Worker ne persiste pas les images et n’écrit pas de journaux applicatifs. Les réglages de journalisation Cloudflare du compte restent à vérifier. Il envoie `X-Fal-Store-IO: 0` et demande une expiration de 7 jours sur la LoRA et les images (`X-Fal-Object-Lifecycle-Preference`) ; l’effacement effectif n’a pas été mesuré.
- **Limite connue.** Aucune limite de débit : qui a le code peut dépenser. Avant toute ouverture publique, il faut ajouter Turnstile ou Cloudflare Access, et une limite de débit.

## Déployer via GitHub Actions

Chemin recommandé sans ordinateur, et sur Termux : Android ne lance pas `workerd`, donc Wrangler en local n’est pas un chemin utilisable. Le workflow [`.github/workflows/deploy-fal-proxy.yml`](../../.github/workflows/deploy-fal-proxy.yml) déploie `uttu-fal-proxy` depuis GitHub. **Le Worker n’est pas en ligne** tant que ce workflow n’a pas réussi. Aucune valeur secrète ne va dans le fichier de workflow, ni dans le journal.

Dans **eNudimmud/U-TTU-Studio** : **Settings → Secrets and variables → Actions → New repository secret**. Créer `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID` avant la fusion : sans eux, le premier passage sur `main` échoue à l’authentification Cloudflare. `FAL_KEY` et `ACCESS_TOKEN` peuvent suivre.

| Secret | Valeur |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare : **My Profile → API Tokens → Create Token**, modèle **Edit Cloudflare Workers**. |
| `CLOUDFLARE_ACCOUNT_ID` | Tableau de bord Cloudflare, identifiant du compte (page Workers). |
| `FAL_KEY` | Clé du compte fal qui paie les appels. |
| `ACCESS_TOKEN` | `openssl rand -hex 24`. Conserver ce code dans un gestionnaire de mots de passe. 24 caractères au moins : la commande en produit 48. |

Puis :

1. Fusionner sur `main`. Un push qui touche `workers/fal-proxy/**` lance le workflow. Sinon : **Actions → Déployer le proxy fal → Run workflow**, branche `main`.
2. Dans le journal de l’étape « URL pour Vercel », copier l’URL `https://….workers.dev`.
3. Projet Vercel : variable **`NEXT_PUBLIC_FAL_PROXY_URL`**, Production et Preview, cette URL sans `/train`, `/status`, `/gen` ou `/bootstrap`. Redéployer. Suite : [Brancher le studio Vercel](#brancher-le-studio-vercel-après-validation).

Si `FAL_KEY` ou `ACCESS_TOKEN` manque, le déploiement du code reste vert et le journal avertit que les routes protégées répondront **503** jusqu’à ce que les deux secrets soient posés. Les ajouter, puis relancer le workflow : il refait `wrangler secret put` sans invite, par l’entrée standard, sans afficher la valeur. Un code de moins de 24 caractères laisse aussi les routes en 503. Ce passage n’envoie aucun entraînement ni génération fal.

Les [8 commandes](#déployer-jd--8-commandes) restent l’autre chemin, sur une machine où Wrangler tourne.

## Déployer (JD) — 8 commandes

Autre chemin, avec Node et Wrangler sur la machine. Ce n’est pas le chemin Termux. Prérequis : Node 22 ou plus récent, npm, OpenSSL, un compte Cloudflare avec Workers activé et la clé fal. À lancer depuis la racine du dépôt, sur la branche qui contient `POST /bootstrap` (ou `main` après fusion). La tenue du plan gratuit avec un ZIP réel, et avec 15 mises en file d’un coup, reste à mesurer.

Avant de commencer, contrôler `wrangler.toml` : `name = "uttu-fal-proxy"`, `ALLOWED_ORIGINS` avec `https://u-ttu-studio.vercel.app` et `https://enudimmud.github.io`. Aucune valeur secrète ne va dans ce fichier. Laisser `NEXT_PUBLIC_FAL_PROXY_URL` vide sur Vercel pendant la vérification.

```bash
cd workers/fal-proxy
npx wrangler login
npx wrangler deploy                   # noter l’URL ; routes protégées en 503 tant que les secrets manquent
npx wrangler secret put FAL_KEY        # coller la clé au prompt masqué
openssl rand -hex 24                   # conserver ce code dans un gestionnaire de mots de passe
npx wrangler secret put ACCESS_TOKEN   # coller le code généré ; Wrangler déploie cette nouvelle version
curl -i -H 'Origin: https://u-ttu-studio.vercel.app' 'https://uttu-fal-proxy.VOTRE-COMPTE.workers.dev/status'
curl -i -H 'Origin: https://example.com' 'https://uttu-fal-proxy.VOTRE-COMPTE.workers.dev/status'
```

Remplacer `https://uttu-fal-proxy.VOTRE-COMPTE.workers.dev` par l’URL exacte rendue par Wrangler. Ces commandes ne soumettent aucun entraînement ni génération fal.

| Vérification | Résultat attendu |
| --- | --- |
| Premier `curl`, origine Vercel sans code | **401**, avec `Access-Control-Allow-Origin: https://u-ttu-studio.vercel.app`. Cela vérifie la présence des secrets et le refus sans code, pas la validité de la clé fal. |
| Second `curl`, autre origine | **403**, sans `Access-Control-Allow-Origin`. |
| Réponse 503 | Secret manquant ou code de moins de 24 caractères : corriger avant de brancher Vercel. |

La même requête avec `Origin: https://enudimmud.github.io` doit aussi renvoyer **401** et `Access-Control-Allow-Origin: https://enudimmud.github.io`. Cette origine ne reçoit plus de nouveau build.

Le premier déploiement refuse les routes protégées tant que les deux secrets ne sont pas configurés. `wrangler secret put` crée et déploie une nouvelle version ; un second `deploy` n’est donc pas nécessaire après ces deux ajouts. Référence : [secrets Cloudflare](https://developers.cloudflare.com/workers/configuration/secrets/).

## Brancher le studio Vercel après validation

Le chemin live n’est plus une variable Actions de GitHub Pages. Poser `NEXT_PUBLIC_FAL_PROXY_URL` dans les variables d’environnement Vercel, pour **Production** et **Preview**.

1. Projet Vercel du studio : **Settings → Environment Variables**.
2. Nom : **`NEXT_PUBLIC_FAL_PROXY_URL`**. Valeur : l’URL HTTPS exacte du Worker, sans `/train`, `/status` ou `/gen`. Cocher Production et Preview. Ne mettre ici ni `FAL_KEY` ni `ACCESS_TOKEN`.
3. Redéployer Production, et les previews ouvertes, pour que le build prenne la variable. Elle est publique et figée à la compilation.
4. Après PASS du gate, vérifier le panneau sur `https://u-ttu-studio.vercel.app` : « Prêt » et champ de code d’accès. Cela indique que l’URL est présente, pas que fal a été testé. Sans code, le bouton reste désactivé ; ne pas lancer de run payant pour cette vérification.

Le Worker peut rester non déployé et l’URL vide pour fusionner le spike désactivé. **PR DRAFT, vente HOLD et feu JD pour la fusion restent indépendants du déploiement.** Le catalogue Pages reste figé : ne pas y republier cette variable.

Pour désactiver le panneau, vider ou supprimer `NEXT_PUBLIC_FAL_PROXY_URL` sur Vercel (Production et Preview) et redéployer. Pour couper immédiatement l’accès aux dépenses, révoquer ou remplacer `ACCESS_TOKEN` côté Worker ; vider la variable seule ne désactive pas le Worker ni les pages déjà ouvertes.

## En local

Les tests Node utilisent un faux fal, sans compte Cloudflare ni clé réelle. Pour le développement manuel, `.dev.vars` et ses variantes sont ignorés ; les garder uniquement dans `workers/fal-proxy/`. `wrangler dev` peut appeler fal pour de vrai si une vraie clé lui est fournie : le mode local n’est pas un dry run. Le smoke sans `--live` reste le contrôle sans réseau.

## Limites du stub

- **CPU.** Le [plan gratuit](https://developers.cloudflare.com/workers/platform/limits/) accorde 10 ms de CPU par requête. `/train` lit le ZIP sans recalculer les CRC ; rester sous cette limite avec un vrai corpus n’est pas garanti. Si Cloudflare coupe, évaluer un plan adapté ou un dépôt signé direct ([FAL-SPIKE.md](../../docs/FAL-SPIKE.md#suites-possibles)).
- **Hôte de la LoRA.** `/gen` n’accepte que les URL `*.fal.media` et le bucket `storage.googleapis.com/fal…`. Si fal rend la LoRA ailleurs, il faut élargir `isFalFileUrl` dans `src/lib/fal-stack.ts`.
- **Code partagé.** Le Worker importe `src/lib/fal-stack.ts`, `fal-api.ts`, `fal-dataset.ts` et `zip.ts` : même contrat que le site et le script de smoke. Wrangler les inclut au build.
