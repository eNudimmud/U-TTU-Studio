import type { ReactNode } from "react";
import { frFR } from "@clerk/localizations";
import { ClerkProvider } from "@clerk/nextjs";
import { ACCOUNT_CREER_HASH, ACCOUNT_HOME_HASH } from "@/lib/account";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { clerkClientEnabled } from "@/lib/clerk-config";
import { assetPath } from "@/lib/site";

// Clerk loads only where an account is asked for: Compte, sign-in, sign-up.
// The chain and the landing never fetch Clerk, set its cookies, or send its telemetry.
export function ClerkScope({ children }: { children: ReactNode }) {
  if (!clerkClientEnabled()) return children;
  return <ClerkProvider
    appearance={clerkAppearance}
    localization={frFR}
    telemetry={false}
    afterSignOutUrl={assetPath(ACCOUNT_CREER_HASH)}
    signInFallbackRedirectUrl={assetPath(ACCOUNT_HOME_HASH)}
    signUpFallbackRedirectUrl={assetPath(ACCOUNT_HOME_HASH)}
  >
    {children}
  </ClerkProvider>;
}
