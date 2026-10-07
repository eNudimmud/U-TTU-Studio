"use client";

import type { ReactNode } from "react";
import { deDE, enUS, esES, frFR } from "@clerk/localizations";
import { ClerkProvider } from "@clerk/nextjs";
import { useLocaleSwitch } from "@/components/i18n/provider";
import { ACCOUNT_PATH, STUDIO_PATH } from "@/lib/account";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { clerkClientEnabled } from "@/lib/clerk-config";
import { assetPath } from "@/lib/site";

const packs = { fr: frFR, en: enUS, de: deDE, es: esES } as const;

// Clerk loads only where an account is asked for: /compte, sign-in, sign-up.
// The studio and the landing never fetch Clerk, set its cookies, or send its telemetry.
// The pack is Clerk’s own copy for that locale, not the studio lexicon.
export function ClerkScope({ children }: { children: ReactNode }) {
  const { locale } = useLocaleSwitch();
  if (!clerkClientEnabled()) return children;
  return <ClerkProvider
    appearance={clerkAppearance}
    localization={packs[locale]}
    telemetry={false}
    afterSignOutUrl={assetPath(STUDIO_PATH)}
    signInFallbackRedirectUrl={assetPath(ACCOUNT_PATH)}
    signUpFallbackRedirectUrl={assetPath(ACCOUNT_PATH)}
  >
    {children}
  </ClerkProvider>;
}
