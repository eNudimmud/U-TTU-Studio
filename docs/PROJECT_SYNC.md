# Synchronisation des projets — Neon + Clerk

Facultative et **éteinte par défaut**. Sans variables, le studio reste exactement local : les routes `/studio-sync/*` répondent `404 {"error":"disabled"}`, aucune section n’apparaît, aucun script Clerk n’est chargé sur `/studio` ni `/mon-studio` (test `e2e/project-sync-off.spec.ts`).

## Ce qui voyage

- Seulement les **notes texte** d’un projet (`.md`, `.json`, `.txt`, `.csv`, `.canvas`) : Bible, plans, séquences, conversation de l’agent, index `.uttu/media-index.json`.
- Jamais : images, vidéos, sons, blobs, clés (`sk_…`, `comfyui-…`, `Bearer …`), URL `blob:`/`data:`, liens signés (`X-Amz-Signature`, `token=`…), chaînes `postgres://`. Une note qui en contient reste sur l’appareil et est signalée. Le serveur refuse aussi (422).
- 1 Mio maximum par projet, 100 projets par compte, 10 dernières versions gardées en historique.

## Comment ça marche

- `PUT /studio-sync/projects/{projet}` avec `{ baseRevision, manifest }` : compare-and-set. La révision stockée doit être égale à `baseRevision` (0 = création), sinon **409** avec la version courante, et rien n’est écrit.
- Côté appareil (`src/lib/sync/client.ts`), « Synchroniser ce projet » envoie, récupère, ou annonce un **conflit** si le projet a changé ici *et* ailleurs depuis la dernière synchro. La personne choisit : « Prendre la version du compte » (copie de secours dans `.uttu/sync-backup.json`, aucune note supprimée) ou « Garder celle de cet appareil ».
- Le propriétaire vient d’un jeton de session Clerk vérifié côté serveur (`verifyToken`, `authorizedParties` = l’origine du studio). Jamais d’un champ envoyé par le navigateur. Chaque requête SQL pose `app.owner_id` dans la même transaction ; les politiques RLS (`FORCE`) bloquent tout accès croisé.
- Clerk n’est chargé qu’après « Activer sur cet appareil » dans Mon studio.

Fichiers : `db/migrations/0001_studio_projects.sql`, `src/lib/sync/{config,manifest,server,neon-store,deps,client}.ts`, `src/app/studio-sync/projects/…`, `src/components/app/project-sync*.tsx`, `tests/project-sync.test.ts`.

## Activer (JD)

1. **Neon Free** — https://neon.com, compte gratuit, sans carte. Créer un projet `u-ttu-studio`, région Europe (Frankfurt). Ne jamais activer de plan payant ; au-delà des quotas gratuits, Neon suspend au lieu de facturer.
2. **SQL Editor** de Neon → coller et exécuter `db/migrations/0001_studio_projects.sql` (idempotent).
3. **Connection string** → bouton *Connect*, cocher *Pooled connection*, copier `postgresql://…`.
4. **Clerk** — l’application existe déjà (`app_3JxoXh0l1EQ`, voir `docs/AUTH.md`). Instance Development pour Preview : `pk_test_…` / `sk_test_…`. Facultatif : *API keys → JWT public key* pour `CLERK_JWT_KEY`.
5. **Vercel → Settings → Environment Variables** (Preview d’abord) :

| Variable | Valeur | Visible navigateur |
| --- | --- | --- |
| `DATABASE_URL` | chaîne Neon *pooled* | non (marquer *Sensitive*) |
| `CLERK_SECRET_KEY` | `sk_test_…` | non |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_…` | oui |
| `NEXT_PUBLIC_STUDIO_SYNC` | `on` | oui |
| `CLERK_JWT_KEY` | facultatif, PEM | non |

6. **Redéployer** (les `NEXT_PUBLIC_*` sont figées au build). Mon studio → « Synchroniser mes projets » → « Activer sur cet appareil » → se connecter → « Synchroniser ce projet ».

Pour couper : retirer `NEXT_PUBLIC_STUDIO_SYNC` (ou `DATABASE_URL`) et redéployer. Les notes locales ne bougent pas.
