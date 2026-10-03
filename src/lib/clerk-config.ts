// Clerk is optional at build time. Without both keys the studio stays open
// and the account panel shows a placeholder. Keyless mode is disabled in
// next.config so a missing key never provisions a temporary Clerk app.
// The real app already exists. JD links it from a logged-in machine.
// See docs/AUTH.md. Do not commit the keys.

import { ACCOUNT_PATH, ACCOUNT_SIGN_IN_PATH, ACCOUNT_SIGN_UP_PATH } from "./account.ts";

export const CLERK_APP_ID = "app_3JxoXh0l1EQ";
export const CLERK_APP_DASHBOARD = `https://dashboard.clerk.com/apps/${CLERK_APP_ID}`;

export function hasClerkKeys(publishable?: string, secret?: string): boolean {
  return Boolean(publishable?.trim() && secret?.trim());
}

/** The only paths where the Clerk middleware runs. */
export function clerkPath(pathname: string): boolean {
  return [ACCOUNT_SIGN_IN_PATH, ACCOUNT_SIGN_UP_PATH, ACCOUNT_PATH].some(path => pathname === path || pathname.startsWith(`${path}/`));
}

/** Browser gate. The secret is not readable here, and must not be. */
export function clerkClientEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());
}
