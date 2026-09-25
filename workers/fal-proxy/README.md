# Proxy fal — Cloudflare Worker (non déployé)

Le site est un export statique sur GitHub Pages : la clé fal ne peut pas y vivre. Ce Worker la garde côté serveur. Le navigateur n’appelle que lui, jamais fal avec la clé. Contexte, coûts et vie privée : [docs/FAL-SPIKE.md](../../docs/FAL-SPIKE.md).

**Statut : stub, jamais déployé, 0 appel fal.** Les tests (`tests/fal-proxy.test.ts`) le font tourner contre un faux fal, dans Node.

## Routes

Toutes exigent `Authorization: Bearer <ACCESS_TOKEN>`.

| Route | Entrée | Ce que fait le proxy | Réponse |
| --- | --- | --- | --- |
| `POST /train?trigger=…&steps=…` | Corps : le ZIP fal (`application/zip`) | Revérifie la forme du gate : exactement 15 JPEG et 15 légendes qui commencent par le trigger, rien d’autre. Dépose le ZIP sur fal.storage (expiration demandée : 24 h), puis met `fal-ai/flux-lora-fast-training` en file (`create_masks: true`, `is_style: false`). | `202 { id }`, ou `422 { error, problems }` |
| `GET /status?job=train\|gen&id=…` | — | Lit la file fal. Une fois terminé, renvoie le résultat utile. | `{ status: "IN_QUEUE", position }`, `{ status: "IN_PROGRESS", log }`, `{ status: "COMPLETED", result }` ou `{ status: "FAILED", error }` |
| `POST /gen` | JSON `{ lora, prompt, scale, seed }` | 1 image `fal-ai/flux-lora`, 1024 × 1024, 28 pas, filtre de sécurité fal actif. `lora` doit être un fichier hébergé par fal, `scale` entre 0,5 et 1,3. | `202 { id }` |

Résultat d’un entraînement : `{ lora, config }`, les URL de `diffusers_lora_file` et `config_file`. Résultat d’une image : `{ image, width, height, seed, nsfw }`.

## Garde-fous

- **Code d’accès.** `ACCESS_TOKEN`, 24 caractères au moins, est exigé sur chaque route. Il n’est pas dans le site : le studio le tape dans le panneau « Rail fal », il reste en mémoire le temps de la page.
- **CORS.** Seules les origines de `ALLOWED_ORIGINS` sont servies (`https://enudimmud.github.io` par défaut). Une autre origine reçoit un 403.
- **Pas de relais ouvert.** Deux endpoints fal, et des entrées fixées côté serveur : taille d’image, nombre d’images, 20 à 2 000 étapes. Au pire, un appel coûte environ 4 $ (`/train` à 2 000 étapes) ou 0,035 $ (`/gen`).
- **Vie privée.** Le Worker ne stocke ni ne journalise rien. Il envoie `X-Fal-Store-IO: 0` et une expiration de 7 jours sur la LoRA et les images (`X-Fal-Object-Lifecycle-Preference`).
- **Limite connue.** Aucune limite de débit : qui a le code peut dépenser. Avant toute ouverture publique, il faut ajouter Turnstile ou Cloudflare Access, et une limite de débit.

## Déployer (JD)

Prérequis : un compte Cloudflare (le plan gratuit suffit pour le spike), Node 22 ou plus récent, une clé fal.ai.

```bash
cd workers/fal-proxy
npx wrangler login
npx wrangler secret put FAL_KEY        # coller la clé fal au prompt, jamais dans un fichier
openssl rand -hex 24                   # code d’accès : le garder dans un gestionnaire de mots de passe
npx wrangler secret put ACCESS_TOKEN   # coller ce code
npx wrangler deploy                    # → https://uttu-fal-proxy.<compte>.workers.dev
```

Vérifier sans rien dépenser :

```bash
curl -i https://uttu-fal-proxy.<compte>.workers.dev/status        # 401 : le proxy répond et refuse sans code
curl -i -H "Origin: https://example.com" https://uttu-fal-proxy.<compte>.workers.dev/status   # 403
```

Brancher le site : GitHub → Settings → Secrets and variables → Actions → **Variables**, créer `NEXT_PUBLIC_FAL_PROXY_URL` avec l’URL du Worker, puis relancer le workflow « Deploy U*TTU Studio to GitHub Pages ». Le bloc « Rail fal » passe de « Script seul » à « Prêt ». C’est une variable et pas un secret : l’URL finit de toute façon dans le JavaScript public. Le code d’accès, lui, n’y va pas.

## En local

```bash
cd workers/fal-proxy
printf 'FAL_KEY=…\nACCESS_TOKEN=…\nALLOWED_ORIGINS=http://localhost:3000\n' > .dev.vars   # ignoré par git
npx wrangler dev                       # http://localhost:8787, appelle fal pour de vrai
cd ../.. && NEXT_PUBLIC_FAL_PROXY_URL=http://localhost:8787 npm run dev
```

## Limites du stub

- **CPU.** Le plan gratuit accorde 10 ms de CPU par requête. `/train` lit le ZIP (environ 10 Mo) sans recalculer les CRC, pour rester dedans. Si Cloudflare coupe quand même, il reste deux options : le plan Workers payant, ou le dépôt direct du navigateur vers fal.storage par URL signée ([FAL-SPIKE.md](../../docs/FAL-SPIKE.md#suites-possibles)).
- **Hôte de la LoRA.** `/gen` n’accepte que les URL `*.fal.media` et le bucket `storage.googleapis.com/fal…`. Si fal rend la LoRA ailleurs, il faut élargir `isFalFileUrl` dans `src/lib/fal-stack.ts`.
- **Code partagé.** Le Worker importe `src/lib/fal-stack.ts`, `fal-api.ts`, `fal-dataset.ts` et `zip.ts` : même contrat que le site et le script de smoke. Wrangler les inclut au build.
