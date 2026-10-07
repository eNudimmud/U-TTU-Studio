// The vault's files, on this device. IndexedDB holds them because it keeps
// blobs on every phone browser. Paths follow the Obsidian layout so an export
// or a linked folder opens as a vault as-is.

export interface VaultEntry {
  path: string;
  text?: string;
  blob?: Blob;
  updatedAt: number;
}

export interface VaultStore {
  list(): Promise<VaultEntry[]>;
  get(path: string): Promise<VaultEntry | null>;
  put(entry: VaultEntry): Promise<void>;
  remove(path: string): Promise<void>;
}

const SEGMENT = /^\.?[A-Za-z0-9][A-Za-z0-9._ -]{0,80}$/;

/** A vault-relative path, or null. No climbing out, no absolute path. */
export function cleanPath(path: string): string | null {
  const parts = path.split("/");
  if (parts.length === 0 || parts.length > 4) return null;
  if (!parts.every(part => SEGMENT.test(part) && part !== "." && part !== "..")) return null;
  return parts.join("/");
}

export function memoryVault(): VaultStore {
  const files = new Map<string, VaultEntry>();
  return {
    async list() {
      return [...files.values()].sort((a, b) => a.path.localeCompare(b.path));
    },
    async get(path) {
      return files.get(path) ?? null;
    },
    async put(entry) {
      const path = cleanPath(entry.path);
      if (!path) throw new Error(`Chemin refusé : ${entry.path}`);
      files.set(path, { ...entry, path });
    },
    async remove(path) {
      files.delete(path);
    },
  };
}

function request<T>(run: (store: IDBObjectStore) => IDBRequest<T>, mode: IDBTransactionMode, name: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(name, 1);
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains("files")) open.result.createObjectStore("files", { keyPath: "path" });
    };
    open.onerror = () => reject(open.error ?? new Error("Mon studio est fermé."));
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction("files", mode);
      const req = run(tx.objectStore("files"));
      req.onsuccess = () => {
        const value = req.result;
        tx.oncomplete = () => {
          db.close();
          resolve(value);
        };
      };
      req.onerror = () => {
        db.close();
        reject(req.error ?? new Error("Mon studio est illisible."));
      };
    };
  });
}

export function idbVault(name = "uttu-coffre"): VaultStore {
  return {
    async list() {
      const rows = await request(store => store.getAll() as IDBRequest<VaultEntry[]>, "readonly", name);
      return rows.sort((a, b) => a.path.localeCompare(b.path));
    },
    async get(path) {
      return (await request(store => store.get(path) as IDBRequest<VaultEntry | undefined>, "readonly", name)) ?? null;
    },
    async put(entry) {
      const path = cleanPath(entry.path);
      if (!path) throw new Error(`Chemin refusé : ${entry.path}`);
      await request(store => store.put({ ...entry, path }), "readwrite", name);
    },
    async remove(path) {
      await request(store => store.delete(path), "readwrite", name);
    },
  };
}
