import { neon } from "@neondatabase/serverless";
import { verifyToken } from "@clerk/nextjs/server";
import { syncServerConfig } from "./config.ts";
import { neonProjectStore, type SqlClient } from "./neon-store.ts";
import type { SyncDeps } from "./server.ts";

/** Real dependencies. Disabled (404 on every route) unless DATABASE_URL and both Clerk keys are set. */
export function syncDeps(): SyncDeps {
  const config = syncServerConfig();
  return {
    enabled: config !== null,
    async verify(token, origin) {
      if (!config) return null;
      const claims = await verifyToken(token, {
        secretKey: config.clerkSecretKey,
        ...(process.env.CLERK_JWT_KEY?.trim() ? { jwtKey: process.env.CLERK_JWT_KEY.trim() } : {}),
        authorizedParties: [origin],
      });
      return typeof claims.sub === "string" && /^user_[A-Za-z0-9]{1,64}$/.test(claims.sub) ? claims.sub : null;
    },
    store() {
      if (!config) throw new Error("disabled");
      return neonProjectStore(neon(config.databaseUrl) as unknown as SqlClient);
    },
  };
}
