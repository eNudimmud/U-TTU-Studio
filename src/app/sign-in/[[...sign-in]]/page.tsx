import { SignIn } from "@clerk/nextjs";
import { AuthScreen } from "@/components/account/auth-screen";
import { ClerkScope } from "@/components/account/clerk-scope";
import { ACCOUNT_PATH, ACCOUNT_SIGN_IN_PATH, ACCOUNT_SIGN_UP_PATH } from "@/lib/account";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { assetPath } from "@/lib/site";

export const metadata = { title: "Se connecter — U*TTU Studio" };

export default function SignInPage() {
  return <ClerkScope>
    <AuthScreen kicker="Compte" title="Se connecter." note="Google ou GitHub. Mon studio, lui, reste sur ta machine.">
      <SignIn
        appearance={clerkAppearance}
        routing="path"
        path={assetPath(ACCOUNT_SIGN_IN_PATH)}
        signUpUrl={assetPath(ACCOUNT_SIGN_UP_PATH)}
        fallbackRedirectUrl={assetPath(ACCOUNT_PATH)}
      />
    </AuthScreen>
  </ClerkScope>;
}
