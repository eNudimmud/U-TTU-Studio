// The adherent's Comfy session, when they signed in through Comfy's login page
// served on this origin (src/proxy.ts). Comfy's web app initialises Firebase with
// persistence [browserLocal, indexedDB, browserSession]: the user lands in this
// origin's localStorage under `firebase:authUser:<apiKey>:[DEFAULT]`, and Firebase
// moves any IndexedDB copy there too (then deletes it from IndexedDB). Older
// Comfy builds used IndexedDB first, so both places are read, localStorage first.
// Nothing here leaves the browser except the token, sent to Comfy as Bearer.

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
/** Key prefix Firebase uses for a signed-in user, in localStorage and in IndexedDB. */
export const FIREBASE_USER_PREFIX = "firebase:authUser:";

type KeyedStorage = Pick<Storage, "length" | "key" | "getItem">;

/** Firebase users kept in a Web Storage area (localStorage), parsed. Broken rows are skipped. */
export function storedUsersIn(storage: KeyedStorage | null | undefined): unknown[] {
  const rows: unknown[] = [];
  if (!storage) return rows;
  try {
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (!key || !key.startsWith(FIREBASE_USER_PREFIX)) continue;
      try { rows.push(JSON.parse(storage.getItem(key) ?? "null")); } catch { /* not a user record */ }
    }
  } catch { /* storage blocked */ }
  return rows;
}

/** True when a storage event is Comfy writing or removing its signed-in user. */
export function isSessionStorageKey(key: string | null): boolean {
  return key === null || key.startsWith(FIREBASE_USER_PREFIX);
}

function localArea(): Storage | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
}
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

async function readStoredUsers(): Promise<unknown[]> {
  return [...storedUsersIn(localArea()), ...await readIndexedDbUsers()];
}

function readIndexedDbUsers(): Promise<unknown[]> {
  return new Promise(resolve => {
    if (typeof indexedDB === "undefined") { resolve([]); return; }
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
  const area = localArea();
  if (area) {
    try {
      const keys: string[] = [];
      for (let index = 0; index < area.length; index++) { const key = area.key(index); if (key?.startsWith(FIREBASE_USER_PREFIX)) keys.push(key); }
      for (const key of keys) area.removeItem(key);
    } catch { /* storage blocked */ }
  }
  return new Promise(resolve => {
    if (typeof indexedDB === "undefined") { resolve(); return; }
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
