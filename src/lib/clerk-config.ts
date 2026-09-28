// Clerk is optional at build time. Without both keys the studio stays open
// and the account panel shows a placeholder. Keyless mode is disabled in
// next.config so a missing key never provisions a temporary Clerk app.

export function hasClerkKeys(publishable?: string, secret?: string): boolean {
  return Boolean(publishable?.trim() && secret?.trim());
}

/** Browser gate. The secret is not readable here, and must not be. */
export function clerkClientEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());
}
