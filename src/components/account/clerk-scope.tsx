import type { ReactNode } from "react";
import { frFR } from "@clerk/localizations";
import { ClerkProvider } from "@clerk/nextjs";
import { ACCOUNT_PATH, STUDIO_PATH } from "@/lib/account";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { clerkClientEnabled } from "@/lib/clerk-config";
import { assetPath } from "@/lib/site";

// Clerk loads only where an account is asked for: /compte, sign-in, sign-up.
// The studio and the landing never fetch Clerk, set its cookies, or send its telemetry.
export function ClerkScope({ children }: { children: ReactNode }) {
  if (!clerkClientEnabled()) return children;
  return <ClerkProvider
    appearance={clerkAppearance}
    localization={frFR}
    telemetry={false}
    afterSignOutUrl={assetPath(STUDIO_PATH)}
    signInFallbackRedirectUrl={assetPath(ACCOUNT_PATH)}
    signUpFallbackRedirectUrl={assetPath(ACCOUNT_PATH)}
  >
    {children}
  </ClerkProvider>;
}
