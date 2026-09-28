"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { ACCOUNT_SIGN_IN_PATH, ACCOUNT_SIGN_UP_PATH, ACCOUNT_VAULT_LINKS } from "@/lib/account";
import { BUDGET_ANON } from "@/lib/budget";
import { clerkClientEnabled } from "@/lib/clerk-config";
import { assetPath } from "@/lib/site";
import { STARTER_VAULT_FILE, STARTER_VAULT_HREF } from "@/lib/vault";
import { Arrow } from "../glyph";
import { BudgetJournal } from "./budget-journal";
import { useGoToMode } from "./mode-context";

export function AccountPanel() {
  if (!clerkClientEnabled()) return <AccountBody phase="unconfigured" />;
  return <AccountSession />;
}

function AccountSession() {
  const { isLoaded, isSignedIn, user } = useUser();
  if (!isLoaded) return <p className="loading-panel" role="status">Ouverture du compte…</p>;
  if (!isSignedIn || !user) return <AccountBody phase="signed-out" />;
  return <AccountBody
    phase="signed-in"
    userId={user.id}
    name={user.fullName || user.username || "Compte ouvert"}
    email={user.primaryEmailAddress?.emailAddress ?? null}
  />;
}

function AccountBody({ phase, name, email, userId }: { phase: "unconfigured" | "signed-out" | "signed-in"; name?: string; email?: string | null; userId?: string }) {
  const go = useGoToMode();
  const signedIn = phase === "signed-in";

  return <section className="mode-panel" aria-labelledby="mode-title">
    <header className="mode-hero">
      <p className="eyebrow">Compte</p>
      <h1 id="mode-title" tabIndex={-1}>Le studio, <em>à ton nom.</em></h1>
      <p className="mode-lead">Créer et le coffre marchent sans compte. Rien n’est exigé pour déposer des photos, ni pour télécharger le ZIP. Le compte garde le tableau. Il ne ferme pas la porte.</p>
      <div className="mode-links">
        <button type="button" className="text-button" onClick={() => go("creer")}>Retour à Créer</button>
        <button type="button" className="text-button" onClick={() => go("studio")}>Ouvrir le coffre</button>
      </div>
    </header>

    {phase === "unconfigured" && <aside className="offline-fal" role="status">
      <p><strong>Hors ligne.</strong> Clés Clerk absentes. Google et GitHub s’ouvriront quand elles seront posées. Aucune session, aucun cookie de compte.</p>
    </aside>}

    {signedIn ? <div className="account-user">
      <div>
        <p className="eyebrow">Profil</p>
        <h2>{name}</h2>
        {email ? <p>{email}</p> : <p>Aucune adresse visible.</p>}
      </div>
      <UserButton />
    </div> : <div className="account-actions">
      <a className="button button-primary" href={assetPath(ACCOUNT_SIGN_IN_PATH)}>Se connecter <Arrow /></a>
      <a className="button button-outline" href={assetPath(ACCOUNT_SIGN_UP_PATH)}>Créer un compte</a>
    </div>}

    {signedIn && <div className="account-grid">
      <article className="account-card" aria-labelledby="account-runs">
        <p className="eyebrow">Journal</p>
        <h2 id="account-runs">Tes runs</h2>
        <p>Aucun run cloud. Rien n’est inventé. Ce que tu notes est plus bas, sur cet appareil.</p>
      </article>
      <article className="account-card" aria-labelledby="account-cloud">
        <p className="eyebrow">Nuage</p>
        <h2 id="account-cloud">Ton studio cloud</h2>
        <p>Vide. Aucun fichier n’est déposé sur un serveur. Le dossier reste sur ta machine.</p>
      </article>
    </div>}

    {signedIn && userId ? <BudgetJournal userId={userId} /> : <article className="account-card account-budget" aria-labelledby="account-budget">
      <p className="eyebrow">Budget</p>
      <h2 id="account-budget">Le journal, une fois connecté.</h2>
      <p>{BUDGET_ANON}</p>
    </article>}

    <article className="vault-schema account-schema" aria-labelledby="account-vault">
      <p className="eyebrow">Coffre</p>
      <h2 id="account-vault">Le schéma, chez toi.</h2>
      <p>Ces liens ouvrent Studio. Le compte ne lit pas le dossier, et n’écrit pas dedans.</p>
      <ol className="vault-tree">
        {ACCOUNT_VAULT_LINKS.map(link => <li key={link.id}>
          <a href={link.href}><code>{link.label}</code></a>
          <span>{link.hint}</span>
        </li>)}
      </ol>
      <a className="button button-outline" href={assetPath(STARTER_VAULT_HREF)} download={STARTER_VAULT_FILE}>Télécharger le coffre <Arrow /></a>
    </article>
  </section>;
}
