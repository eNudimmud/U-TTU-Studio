# Compte — Clerk sur Vercel

Le studio n’a pas besoin de compte. Le look, les lieux et les prises vivent dans le coffre de l’appareil ; le calcul tourne sur le compte de rendu de la personne. Le compte U*TTU est une page à part, `/compte`, facultative, atteinte depuis la feuille Coffre. Il ne bloque rien et ne garde rien du studio.

L’application Clerk existe déjà. JD est dessus, guide **Next.js → Agent setup**, instance **Development**.

| | |
| --- | --- |
| Id | `app_3JxoXh0l1EQ` |
| Dashboard | https://dashboard.clerk.com/apps/app_3JxoXh0l1EQ |
| Instance ouverte | **Development** (`pk_test_` / `sk_test_`) |
| Production | Pas encore. Autre instance du même app, plus tard (`pk_live_` / `sk_live_`) |

Le CLI de cette livraison n’était pas connecté (`clerk whoami` → `auth_required`). `npx clerk@latest init --framework next --app app_3JxoXh0l1EQ -y --no-skills` ouvre un navigateur et attend un login. Il n’a pas été mené à terme. Sans login, le CLI aurait créé une application keyless, pas celle-ci. Le scaffold Next officiel est déjà dans le dépôt, posé à la main : `src/proxy.ts` (`clerkMiddleware`, fichier proxy de Next 16), `ClerkProvider`, `/sign-in`, `/sign-up`. Le mode keyless reste éteint. Aucune clé n’est dans git.

Cible d’hébergement : **Vercel**. GitHub Pages ne peut plus publier ce dépôt : le proxy Clerk (`src/proxy.ts`) exige un runtime serveur, et l’export statique le refuse. Le workflow `.github/workflows/pages.yml` lance les tests et le build. Il ne déploie plus. L’URL `https://enudimmud.github.io/U-TTU-Studio/` reste la dernière livraison Pages (catalogue processus), figée.

Sans les deux clés, `npm test`, `npm run typecheck` et `npm run build` passent. Compte affiche un placeholder. Aucun cookie de session. Le mode keyless de Clerk est éteint dans `next.config.mjs`, pour ne pas créer une application temporaire tout seul.

## Ce que le code fait déjà

- `src/proxy.ts` — d’abord le relais Comfy, puis `clerkMiddleware` seulement si les deux clés sont présentes, et seulement sur `/compte`, `/sign-in` et `/sign-up` (`clerkPath`). Sur une instance Development, ce middleware redirige toute page où il tourne vers la poignée de main Clerk (`dev-browser-missing`) : il ne tourne donc ni sur `/` ni sur `/studio`. Aucune route n’est protégée.
- `src/components/account/clerk-scope.tsx` — `ClerkProvider` seulement si la clé publique est posée, et seulement sur `/compte`, `/sign-in` et `/sign-up`. Localisation `frFR`. Apparence sombre. Télémétrie Clerk coupée (`telemetry={false}`). Le layout racine ne monte pas Clerk : l’accueil et le studio ne chargent ni le script Clerk, ni ses cookies (`__client_uat`, `__clerk_db_jwt`), ni `clerk-telemetry.com`. Relevé live du 3 octobre 2026, avant le #32 : 11 requêtes vers l’instance Development, 3 vers `clerk-telemetry.com`, 4 cookies Clerk sur le domaine du studio, dès l’ouverture de `/studio`, sans clic.
- `/sign-in` et `/sign-up` — flux OAuth Clerk standard. Google et GitHub apparaissent quand ils sont activés dans le dashboard Clerk. Le code ne parle pas à Google ni à GitHub directement.
- `/compte` — « Le studio n’en a pas besoin. » Sans clés : « Comptes U*TTU fermés pour l’instant. » Anonyme : « Se connecter », « Créer un compte ». Connecté : profil et `UserButton`. Le compte ne lit pas le coffre et n’y écrit pas. L’ancien journal de budget local est retiré : le coût réel de chaque prise est dans le coffre (`jobs.md`).
- Après connexion ou inscription, retour vers `/compte`. Un ancien lien `/studio#compte` ou `/#compte` est reconduit vers `/compte`.

Pas de Stripe. Pas de jobs cloud. Pas de sync du coffre.

## Development et Production

Le sélecteur en haut à droite du dashboard doit rester sur **Development** pour le travail local et les previews. C’est l’instance du 28 septembre 2026.

| | Development | Production |
| --- | --- | --- |
| Quand | Maintenant. Local, et Preview Vercel. | Plus tard, quand le domaine public est décidé. |
| Clés | `pk_test_…` / `sk_test_…` | `pk_live_…` / `sk_live_…` |
| Tirage | `npx clerk@latest env pull --app app_3JxoXh0l1EQ` | `npx clerk@latest env pull --app app_3JxoXh0l1EQ --instance prod` |
| Où les poser | `.env.local`, et Vercel **Preview** (et Development) | Vercel **Production** seulement |
| Google et GitHub | À activer sur cette instance | À réactiver sur l’instance Production. Les clients OAuth ne se copient pas tout seuls. |

Ne pas coller les clés Development dans l’environnement Production de Vercel. Ne pas committer ni l’un ni l’autre.

## Lier l’app et tirer les clés

Sur la machine de JD, déjà connectée au dashboard. Pas dans CI.

```bash
npx clerk@latest auth login
npx clerk@latest link --app app_3JxoXh0l1EQ
npx clerk@latest env pull --app app_3JxoXh0l1EQ
```

`env pull` écrit `.env.local` (clés Development). Le fichier est ignoré par git. Vérifier qu’il n’entre pas dans un commit.

Équivalent, une fois le login fait : `npx clerk@latest init --framework next --app app_3JxoXh0l1EQ --pm npm -y --no-skills`. Le dépôt a déjà le provider, le proxy et les pages. Ne pas laisser cette commande écraser le mode Compte ni remettre un export statique.

Sans ces clés, `npm run dev` reste le placeholder.

## Google et GitHub

Dans l’app `app_3JxoXh0l1EQ`, instance **Development** :

1. Ouvrir https://dashboard.clerk.com/apps/app_3JxoXh0l1EQ
2. Laisser le sélecteur sur **Development**.
3. **Configure → SSO connections** (l’écran peut encore dire Social connections).
4. Activer **Google**. Suivre l’assistant Clerk. S’il demande un client OAuth Google, le créer là. Ne pas coller ce secret dans le dépôt.
5. Activer **GitHub**. Même geste.
6. Ne pas activer TikTok, Instagram, ni X.
7. **Paths**, si l’écran les montre : sign-in `/sign-in`, sign-up `/sign-up`. Le code et `.env.example` les posent déjà.
8. **Domains** de cette instance : `http://localhost:3000`, puis le domaine de preview Vercel quand il existe.

Le composant `SignIn` affiche les providers allumés dans le dashboard. Le code ne parle pas à Google ni à GitHub.

Quand l’instance **Production** sera créée, refaire les étapes 4, 5 et 8 sur cette instance, avec le domaine public.

## Checklist Vercel

1. [Importer le dépôt](https://vercel.com/new) `eNudimmud/U-TTU-Studio`. Framework : Next.js. Racine : `/`.
2. Installation : `npm ci`. Build : `npm run build`. Node 22 ou plus.
3. Ne pas définir `GITHUB_PAGES`. Ne pas définir `NEXT_PUBLIC_BASE_PATH`.
4. Variables. Preview (et Development) : clés **Development**. Production Vercel : clés **Production**, seulement une fois l’instance créée. Sinon, laisser Production vide plutôt que d’y mettre `pk_test_`.

| Variable | Valeur |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_…` en Preview. `pk_live_…` en Production. |
| `CLERK_SECRET_KEY` | `sk_test_…` en Preview. `sk_live_…` en Production. |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/compte` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/compte` |
| `NEXT_PUBLIC_SITE_URL` | URL HTTPS publique, une fois le domaine connu |

5. Déployer une preview. Ouvrir `/` : l’accueil (Look, Scène, Prise), sans jargon de moteur. `/studio` : le look, sans mur. `/compte` : boutons. `/sign-in` : Google et GitHub, si l’étape SSO est faite et si le domaine de preview est autorisé sur l’instance Development. Si Vercel a encore `NEXT_PUBLIC_CLERK_*_FALLBACK_REDIRECT_URL=/studio#compte` ou `/#compte`, le remplacer par `/compte` ; les anciens hash sont aussi reconduits.
6. Dans Clerk, ajouter ce domaine (`*.vercel.app`, puis le domaine custom) aux domaines de la bonne instance. Sans ça, l’OAuth revient en erreur.

Les noms vides sont dans [`.env.example`](../.env.example). Les valeurs ne vont pas dans git.

## Vérifier

- Anonyme : `/studio` s’ouvre sur le look, sans session ; le coffre s’exporte depuis la feuille Coffre.
- `/compte` : sans session, les deux boutons ; connecté, le nom et le bouton de compte.
- Avec une clé factice : 0 requête Clerk sur `/` et `/studio`.
- `npm test` et `npm run typecheck` sans aucune clé.

Les captures du 28 septembre 2026 (`screenshots/compte-*.png`) montrent l’ancien mode Compte, avec son journal de budget. Elles restent pour l’historique.
