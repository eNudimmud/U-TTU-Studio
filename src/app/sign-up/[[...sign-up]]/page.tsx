import { SignUp } from "@clerk/nextjs";
import { AuthScreen } from "@/components/account/auth-screen";
import { ClerkScope } from "@/components/account/clerk-scope";
import { ACCOUNT_PATH, ACCOUNT_SIGN_IN_PATH, ACCOUNT_SIGN_UP_PATH } from "@/lib/account";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { assetPath } from "@/lib/site";
import { routeMetadata } from "@/lib/route-meta";

export const metadata = routeMetadata("inscription");

export default function SignUpPage() {
  return <ClerkScope>
    <AuthScreen screen="signUp">
      <SignUp
        appearance={clerkAppearance}
        routing="path"
        path={assetPath(ACCOUNT_SIGN_UP_PATH)}
        signInUrl={assetPath(ACCOUNT_SIGN_IN_PATH)}
        fallbackRedirectUrl={assetPath(ACCOUNT_PATH)}
      />
    </AuthScreen>
  </ClerkScope>;
}
