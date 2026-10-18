"use client";

import { LanguageSwitcher, useI18n } from "@/components/i18n/provider";
import { clerkClientEnabled } from "@/lib/clerk-config";
import { STUDIO_PATH } from "@/lib/account";
import { assetPath } from "@/lib/site";
import { Brand } from "@/components/brand";

export function AuthScreen({ screen, children }: {
  screen: "signIn" | "signUp";
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const enabled = clerkClientEnabled();
  return <main id="contenu" className="auth-page">
    <Brand href={assetPath(STUDIO_PATH)} />
    <LanguageSwitcher />
    <header className="auth-copy">
      <p className="eyebrow">{t(`auth.${screen}.kicker`)}</p>
      <h1>{t(`auth.${screen}.title`)}</h1>
      <p>{enabled ? t(`auth.${screen}.note`) : t("auth.closed")}</p>
    </header>
    {enabled ? children : <p className="auth-hold">{t("auth.offline")}</p>}
    <a className="text-button" href={assetPath(STUDIO_PATH)}>{t("account.back")}</a>
  </main>;
}
