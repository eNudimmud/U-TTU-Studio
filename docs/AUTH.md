# Compte — Clerk sur Vercel

Le studio s’ouvre sur Créer. Le compte est un mode, en fin de nav. Il ne bloque pas le dépôt, ni le coffre.

Cible d’hébergement : **Vercel**. GitHub Pages ne peut plus publier ce dépôt : le proxy Clerk (`src/proxy.ts`) exige un runtime serveur, et l’export statique le refuse. Le workflow `.github/workflows/pages.yml` lance les tests et le build. Il ne déploie plus. L’URL `https://enudimmud.github.io/U-TTU-Studio/` reste la dernière livraison Pages (catalogue processus), figée.

Sans les deux clés, `npm test`, `npm run typecheck` et `npm run build` passent. Compte affiche un placeholder. Aucun cookie de session. Le mode keyless de Clerk est éteint dans `next.config.mjs`, pour ne pas créer une application temporaire tout seul.

## Ce que le code fait déjà

- `src/proxy.ts` — `clerkMiddleware` seulement si les deux clés sont présentes. Aucune route n’est protégée. Créer reste anonyme.
- `src/app/layout.tsx` — `ClerkProvider` seulement si la clé publique est posée. Localisation `frFR`. Apparence sombre.
- `/sign-in` et `/sign-up` — flux OAuth Clerk standard. Google et GitHub apparaissent quand ils sont activés dans le dashboard Clerk. Le code ne parle pas à Google ni à GitHub directement.
- `#compte` — anonyme : « Se connecter », « Créer un compte », rappel que Créer et le ZIP marchent sans compte. Connecté : profil, `UserButton`, « Tes runs » vide, « Ton studio cloud » vide, liens vers `refs/`, `dataset/`, `loras/`, `scenes/`, `processes/`, `jobs.md`, `CANON.md`, et le ZIP `public/vault/U-TTU-Studio.zip`.
- Après connexion, retour vers `/#compte`. Après déconnexion, retour vers `/#creer`.

Pas de Stripe. Pas de jobs cloud. Pas de sync du coffre.

## Checklist JD

### 1. Application Clerk

1. [Créer une application](https://dashboard.clerk.com) nommée U*TTU Studio.
2. **User & Authentication → Social connections** (ou SSO) : activer **Google** et **GitHub**.
3. Pour chacun, Clerk indique s’il faut un client OAuth chez Google Cloud et GitHub (client id + secret). Suivre l’écran Clerk. Ne pas coller ces secrets dans le dépôt.
4. Laisser email / mot de passe selon le défaut Clerk, ou les couper si tu ne veux que Google et GitHub. Le composant `SignIn` affiche ce que le dashboard autorise.
5. **Paths** : sign-in `/sign-in`, sign-up `/sign-up`. Le code et `.env.example` les posent déjà.
6. **Domains** : ajouter `http://localhost:3000` pour le développement, et le domaine de production Vercel (le domaine du projet, puis le domaine custom quand il existe).
7. Copier la **Publishable key** et la **Secret key**. Instance Development d’abord. Production plus tard, avec ses propres clés.

### 2. Projet Vercel

1. [Importer le dépôt](https://vercel.com/new) `eNudimmud/U-TTU-Studio`. Framework : Next.js. Racine : `/`.
2. Commande d’installation : `npm ci`. Build : `npm run build`. Node 22 ou plus (le dépôt demande `>=22`).
3. Ne pas définir `GITHUB_PAGES`. Ne pas définir `NEXT_PUBLIC_BASE_PATH` (site à la racine du domaine).
4. Variables d’environnement, pour **Production**, **Preview** et **Development** :

| Variable | Valeur |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | clé publique Clerk (`pk_test_…` puis `pk_live_…`) |
| `CLERK_SECRET_KEY` | secret Clerk (`sk_test_…` puis `sk_live_…`) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/#compte` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/#compte` |
| `NEXT_PUBLIC_SITE_URL` | URL HTTPS publique, une fois le domaine connu |

5. Déployer. Ouvrir `/` : Créer, sans mur. Ouvrir `/#compte` : boutons de connexion. Ouvrir `/sign-in` : Google et GitHub.
6. Dans Clerk, le domaine Vercel (`*.vercel.app`, puis le domaine custom) doit figurer dans les domaines autorisés, sinon l’OAuth revient en erreur.

### 3. Local

```bash
cp .env.example .env.local
# coller les deux clés Clerk dans .env.local — ne pas committer
npm run dev          # http://localhost:3000
```

`.env.local` est ignoré par git. Sans clés, le même `npm run dev` montre le placeholder.

## Vérifier

- Anonyme : `#creer` s’ouvre, le dépôt n’exige pas de session, le ZIP du coffre se télécharge depuis Studio et depuis Compte.
- Connecté : `#compte` montre le nom, le bouton de compte, deux listes vides, les sept liens du schéma.
- Déconnexion : retour à Créer.
- `npm test` et `npm run typecheck` sans aucune clé.

## Captures sans clés

Le 28 septembre 2026, aucune clé Clerk n’est dans ce dépôt. La session connectée (profil, `UserButton`, listes vides) est dans le code. Elle ne s’affiche qu’avec une session. Ici : l’anonyme sur Compte, et la page `/sign-in` en placeholder.

![Compte, anonyme, clés absentes](screenshots/compte-anonyme-desktop.png)

![Se connecter, placeholder](screenshots/compte-signin-placeholder-desktop.png)

Créer reste la première vue. Compte est en fin de nav.

![Créer, sans mur de connexion](screenshots/compte-creer-desktop.png)

Sur un écran étroit, les six modes passent à la ligne. Compte reste le dernier. Créer reste la première vue.

<img src="screenshots/compte-anonyme-mobile.png" width="390" alt="Compte, anonyme, écran étroit" />
