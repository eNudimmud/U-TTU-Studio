"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { LanguageSwitcher, useI18n } from "@/components/i18n/provider";
import { ACCOUNT_SIGN_IN_PATH, ACCOUNT_SIGN_UP_PATH, STUDIO_PATH } from "@/lib/account";
import { clerkClientEnabled } from "@/lib/clerk-config";
import { assetPath } from "@/lib/site";

export function AccountPage() {
  if (!clerkClientEnabled()) return <AccountBody phase="unconfigured" />;
  return <AccountSession />;
}

function AccountSession() {
  const { t } = useI18n();
  const { isLoaded, isSignedIn, user } = useUser();
  if (!isLoaded) return <p className="loading-panel" role="status">{t("account.opening")}</p>;
  if (!isSignedIn || !user) return <AccountBody phase="signed-out" />;
  return <AccountBody phase="signed-in" name={user.fullName || user.username || t("account.open")} email={user.primaryEmailAddress?.emailAddress ?? null} />;
}

function AccountBody({ phase, name, email }: { phase: "unconfigured" | "signed-out" | "signed-in"; name?: string; email?: string | null }) {
  const { t } = useI18n();
  return <main id="contenu" className="auth-page account-page">
    <a href={assetPath(STUDIO_PATH)} className="wordmark" aria-label="U*TTU Studio">U<span className="wordmark-star">*</span>TTU<span className="wordmark-studio">STUDIO</span></a>
    <LanguageSwitcher />
    <header className="auth-copy">
      <p className="eyebrow">{t("account.kicker")}</p>
      <h1>{t("account.title")}</h1>
      <p>{t("account.body")}</p>
    </header>
    {phase === "unconfigured" && <p className="auth-hold">{t("account.closed")}</p>}
    {phase === "signed-out" && <div className="account-actions">
      <a className="button button-primary" href={assetPath(ACCOUNT_SIGN_IN_PATH)}>{t("account.signIn")}</a>
      <a className="button button-outline" href={assetPath(ACCOUNT_SIGN_UP_PATH)}>{t("account.signUp")}</a>
    </div>}
    {phase === "signed-in" && <div className="account-user">
      <div>
        <p className="eyebrow">{t("account.profile")}</p>
        <h2>{name}</h2>
        {email ? <p>{email}</p> : <p>{t("account.noEmail")}</p>}
      </div>
      <UserButton />
    </div>}
    <a className="text-button" href={assetPath(STUDIO_PATH)}>{t("account.back")}</a>
  </main>;
}
