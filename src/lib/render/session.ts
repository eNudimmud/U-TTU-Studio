// The adherent's Comfy session, when they signed in inside the studio's
// connect sheet. Comfy's own web app keeps it in this origin's IndexedDB and
// refreshes it the same way. Nothing here leaves the browser except the
// token, sent to the renderer through the relay.

export interface FirebaseUser {
  apiKey: string;
  refreshToken: string;
  accessToken: string;
  expirationTime: number;
}

export interface TokenSource {
  token(): Promise<string | null>;
  connected(): Promise<boolean>;
  forget(): Promise<void>;
}

import { authDatabasePlan } from "../link-epoch.ts";
const MARGIN_MS = 60_000;
const SECURE_TOKEN = "https://securetoken.googleapis.com/v1/token";

/** A Firebase user record, as the web SDK stores it. Anything else is not a session. */
export function readFirebaseUser(value: unknown): FirebaseUser | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const manager = row.stsTokenManager as Record<string, unknown> | undefined;
  const apiKey = typeof row.apiKey === "string" ? row.apiKey : "";
  const refreshToken = typeof manager?.refreshToken === "string" ? manager.refreshToken : "";
  const accessToken = typeof manager?.accessToken === "string" ? manager.accessToken : "";
  const expirationTime = Number(manager?.expirationTime);
  if (!apiKey || !refreshToken || !/^[A-Za-z0-9_-]+$/.test(apiKey)) return null;
  return { apiKey, refreshToken, accessToken, expirationTime: Number.isFinite(expirationTime) ? expirationTime : 0 };
}

export async function refreshIdToken(user: FirebaseUser, fetchImpl: typeof fetch): Promise<FirebaseUser | null> {
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: user.refreshToken });
  try {
    const response = await fetchImpl(`${SECURE_TOKEN}?key=${encodeURIComponent(user.apiKey)}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!response.ok) return null;
    const data = await response.json() as { id_token?: unknown; refresh_token?: unknown; expires_in?: unknown };
    if (typeof data.id_token !== "string" || !data.id_token) return null;
    const seconds = Number(data.expires_in);
    return {
      ...user,
      accessToken: data.id_token,
      refreshToken: typeof data.refresh_token === "string" && data.refresh_token ? data.refresh_token : user.refreshToken,
      expirationTime: Date.now() + (Number.isFinite(seconds) ? seconds : 3600) * 1000,
    };
  } catch {
    return null;
  }
}

function readStoredUsers(): Promise<unknown[]> {
  return new Promise(resolve => {
    const finish = (rows: unknown[]) => resolve(rows);
    const openExisting = () => {
      try {
        const open = indexedDB.open("firebaseLocalStorageDb");
        let created = false;
        open.onupgradeneeded = () => {
          created = true;
          try { open.transaction?.abort(); } catch { /* an aborted upgrade must not leave an empty database */ }
        };
        open.onerror = () => finish([]);
        open.onsuccess = () => {
          const db = open.result;
          const hasStore = !created && db.objectStoreNames.contains("firebaseLocalStorage");
          if (authDatabasePlan(null, hasStore) !== "read") {
            db.close();
            finish([]);
            return;
          }
          const request = db.transaction("firebaseLocalStorage").objectStore("firebaseLocalStorage").getAll();
          request.onsuccess = () => {
            db.close();
            const rows = (request.result ?? []) as { fbase_key?: unknown; value?: unknown }[];
            finish(rows.filter(row => typeof row.fbase_key === "string" && row.fbase_key.startsWith("firebase:authUser:")).map(row => row.value));
          };
          request.onerror = () => {
            db.close();
            finish([]);
          };
        };
      } catch {
        finish([]);
      }
    };
    const list = indexedDB.databases?.bind(indexedDB);
    if (!list) {
      openExisting();
      return;
    }
    list().then(rows => {
      if (authDatabasePlan(rows, true) === "skip") finish([]);
      else openExisting();
    }).catch(() => openExisting());
  });
}

/** Signing out of the studio removes the session Comfy stored on this origin. */
function clearStoredUsers(): Promise<void> {
  return new Promise(resolve => {
    try {
      const request = indexedDB.deleteDatabase("firebaseLocalStorageDb");
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

export function sessionTokens(fetchImpl: typeof fetch = (input, init) => fetch(input, init)): TokenSource {
  let cached: FirebaseUser | null = null;
  let pending: Promise<string | null> | null = null;

  async function current(): Promise<string | null> {
    if (cached && cached.accessToken && cached.expirationTime - MARGIN_MS > Date.now()) return cached.accessToken;
    const stored = (await readStoredUsers()).map(readFirebaseUser).find(Boolean) ?? null;
    if (!stored) {
      cached = null;
      return null;
    }
    if (stored.accessToken && stored.expirationTime - MARGIN_MS > Date.now()) {
      cached = stored;
      return stored.accessToken;
    }
    cached = await refreshIdToken(stored, fetchImpl);
    return cached?.accessToken ?? null;
  }

  return {
    token() {
      pending ??= current().finally(() => { pending = null; });
      return pending;
    },
    async connected() {
      return Boolean(await this.token());
    },
    async forget() {
      cached = null;
      await clearStoredUsers();
    },
  };
}
