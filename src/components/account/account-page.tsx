"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { ACCOUNT_SIGN_IN_PATH, ACCOUNT_SIGN_UP_PATH, STUDIO_PATH } from "@/lib/account";
import { clerkClientEnabled } from "@/lib/clerk-config";
import { assetPath } from "@/lib/site";

export function AccountPage() {
  if (!clerkClientEnabled()) return <AccountBody phase="unconfigured" />;
  return <AccountSession />;
}

function AccountSession() {
  const { isLoaded, isSignedIn, user } = useUser();
  if (!isLoaded) return <p className="loading-panel" role="status">Ouverture du compte…</p>;
  if (!isSignedIn || !user) return <AccountBody phase="signed-out" />;
  return <AccountBody phase="signed-in" name={user.fullName || user.username || "Compte ouvert"} email={user.primaryEmailAddress?.emailAddress ?? null} />;
}

function AccountBody({ phase, name, email }: { phase: "unconfigured" | "signed-out" | "signed-in"; name?: string; email?: string | null }) {
  return <main id="contenu" className="auth-page account-page">
    <a href={assetPath(STUDIO_PATH)} className="wordmark" aria-label="U*TTU Studio">U<span className="wordmark-star">*</span>TTU<span className="wordmark-studio">STUDIO</span></a>
    <header className="auth-copy">
      <p className="eyebrow">Compte · facultatif</p>
      <h1>Le studio n’en a pas besoin.</h1>
      <p>Ton look, tes lieux et tes prises vivent dans mon studio, sur ton appareil. Le calcul tourne sur ton compte de rendu. Ce compte U*TTU ne garde rien de tout ça.</p>
    </header>
    {phase === "unconfigured" && <p className="auth-hold">Comptes U*TTU fermés pour l’instant.</p>}
    {phase === "signed-out" && <div className="account-actions">
      <a className="button button-primary" href={assetPath(ACCOUNT_SIGN_IN_PATH)}>Se connecter</a>
      <a className="button button-outline" href={assetPath(ACCOUNT_SIGN_UP_PATH)}>Créer un compte</a>
    </div>}
    {phase === "signed-in" && <div className="account-user">
      <div>
        <p className="eyebrow">Profil</p>
        <h2>{name}</h2>
        {email ? <p>{email}</p> : <p>Aucune adresse visible.</p>}
      </div>
      <UserButton />
    </div>}
    <a className="text-button" href={assetPath(STUDIO_PATH)}>Retour au studio</a>
  </main>;
}
