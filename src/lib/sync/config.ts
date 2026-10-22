// Project metadata sync (Neon Postgres + Clerk). Off unless every variable is set.
// Without them the studio stays exactly local: no route answers, no Clerk script on /studio.

export interface SyncServerConfig { databaseUrl: string; clerkSecretKey: string; clerkPublishableKey: string }

type Env = Record<string, string | undefined>;

/** Server side: all three secrets/keys, else null (sync disabled). */
export function syncServerConfig(env: Env = process.env): SyncServerConfig | null {
  const databaseUrl = env.DATABASE_URL?.trim();
  const clerkSecretKey = env.CLERK_SECRET_KEY?.trim();
  const clerkPublishableKey = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  if (!databaseUrl || !clerkSecretKey || !clerkPublishableKey) return null;
  if (!/^postgres(ql)?:\/\//.test(databaseUrl)) return null;
  return { databaseUrl, clerkSecretKey, clerkPublishableKey };
}

/** Browser side: the public Clerk key and an explicit opt-in flag, both inlined at build. */
export function syncClientEnabled(env: Env = { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, NEXT_PUBLIC_STUDIO_SYNC: process.env.NEXT_PUBLIC_STUDIO_SYNC }): boolean {
  return Boolean(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim()) && env.NEXT_PUBLIC_STUDIO_SYNC?.trim() === "on";
}
