// A picture sent once to Comfy Cloud keeps its Comfy input name: the next take reuses it, no second
// upload (registre de production, PR 3). Comfy Cloud stays the main remote storage. The memo is per
// render account (opaque scope, never a credential) and per file need, kept on this device only.

export const ENVOIS_KEY = "u-ttu-envois";
const MAX = 400;
/** Older names are sent again, in case the cloud dropped the input. */
export const ENVOI_TTL_MS = 7 * 24 * 3600 * 1000;

export interface UploadMemo {
  get(key: string): string | null;
  set(key: string, name: string): void;
  forget(key: string): void;
}

interface Row { name: string; at: number }

export async function sha256Hex(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

/** The key of one upload: same bytes, same reduction, same account. */
export function envoiKey(scope: string, sha: string, need: unknown, filename: string): string {
  const ext = /\.([a-z0-9]{1,5})$/i.exec(filename)?.[1]?.toLowerCase() ?? "";
  return `${scope}|${sha}|${ext}|${JSON.stringify(need ?? null)}`;
}

export function memoEnvois(storage: Pick<Storage, "getItem" | "setItem"> | null, now: () => number = Date.now): UploadMemo {
  const read = (): Record<string, Row> => {
    try {
      const data = JSON.parse(storage?.getItem(ENVOIS_KEY) ?? "{}") as Record<string, Row>;
      return data && typeof data === "object" ? data : {};
    } catch { return {}; }
  };
  const write = (rows: Record<string, Row>) => {
    const kept = Object.entries(rows).sort((a, b) => b[1].at - a[1].at).slice(0, MAX);
    try { storage?.setItem(ENVOIS_KEY, JSON.stringify(Object.fromEntries(kept))); } catch { /* full storage: upload again next time */ }
  };
  return {
    get(key) {
      const row = read()[key];
      if (!row || typeof row.name !== "string" || now() - row.at > ENVOI_TTL_MS) return null;
      return row.name;
    },
    set(key, name) {
      const rows = read();
      rows[key] = { name, at: now() };
      write(rows);
    },
    forget(key) {
      const rows = read();
      delete rows[key];
      write(rows);
    },
  };
}

/** In-memory memo for tests and for tabs without storage. */
export function memoMemoire(): UploadMemo {
  const rows = new Map<string, string>();
  return { get: key => rows.get(key) ?? null, set: (key, name) => { rows.set(key, name); }, forget: key => { rows.delete(key); } };
}
