// The optional U*TTU account. It sits outside the studio: the studio, its
// vault and its renders never need it.

export const ACCOUNT_SIGN_IN_PATH = "/sign-in";
export const ACCOUNT_SIGN_UP_PATH = "/sign-up";
export const ACCOUNT_PATH = "/compte";
export const STUDIO_PATH = "/studio#personnage";

/** Providers JD enables in the Clerk dashboard. SignIn shows whatever is on. */
export const CLERK_OAUTH_PROVIDERS = ["google", "github"] as const;
