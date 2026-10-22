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

const SEGMENT = /^[._]?[A-Za-z0-9][A-Za-z0-9._ -]{0,80}$/;

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
    open.onblocked = () => reject(new Error("Ferme les autres onglets du studio puis réessaie la sauvegarde."));
    open.onsuccess = () => {
      const db = open.result;
      try {
        const tx = db.transaction("files", mode);
        let value: T;
        const fail = () => {
          db.close();
          reject(tx.error ?? new Error("Sauvegarde interrompue. Vérifie l’espace disponible puis réessaie."));
        };
        // A request can succeed and its transaction still abort (quota, shutdown).
        // Only a committed transaction is a successful save.
        tx.onabort = fail;
        tx.onerror = fail;
        tx.oncomplete = () => {
          db.close();
          resolve(value);
        };
        const req = run(tx.objectStore("files"));
        req.onsuccess = () => { value = req.result; };
        req.onerror = () => {
          db.close();
          reject(req.error ?? new Error("Mon studio est illisible."));
        };
      } catch (error) {
        db.close();
        reject(error);
      }
    };
  });
}

/** A stored row: a Blob when the browser accepts one, otherwise its bytes. */
export interface VaultRow {
  path: string;
  text?: string;
  blob?: Blob;
  bytes?: ArrayBuffer;
  type?: string;
  updatedAt: number;
}

/**
 * WebKit refuses Blob/File values in IndexedDB in private browsing, in some
 * in-app browsers and in ephemeral sessions ("Error preparing Blob/File data
 * to be stored in object store"). The same file then goes in as plain bytes.
 */
export async function bytesRow(entry: VaultEntry & { path: string }): Promise<VaultRow> {
  if (!entry.blob) return entry;
  const { blob, ...rest } = entry;
  return { ...rest, bytes: await blob.arrayBuffer(), type: blob.type };
}

/** Reads either row shape back as a vault entry with a Blob. */
export function entryFromRow(row: VaultRow): VaultEntry {
  if (row.blob || !row.bytes) {
    const { bytes: _bytes, type: _type, ...entry } = row;
    return entry;
  }
  const { bytes, type, ...entry } = row;
  return { ...entry, blob: new Blob([bytes], { type: type ?? "" }) };
}

export function idbVault(name = "uttu-coffre"): VaultStore {
  // Once WebKit has refused one Blob, every later file goes straight in as bytes.
  let blobsRefused = false;
  return {
    async list() {
      const rows = await request(store => store.getAll() as IDBRequest<VaultRow[]>, "readonly", name);
      return rows.map(entryFromRow).sort((a, b) => a.path.localeCompare(b.path));
    },
    async get(path) {
      const row = await request(store => store.get(path) as IDBRequest<VaultRow | undefined>, "readonly", name);
      return row ? entryFromRow(row) : null;
    },
    async put(entry) {
      const path = cleanPath(entry.path);
      if (!path) throw new Error(`Chemin refusé : ${entry.path}`);
      const row = { ...entry, path };
      if (!row.blob || !blobsRefused) {
        try {
          await request(store => store.put(row), "readwrite", name);
          return;
        } catch (error) {
          if (!row.blob) throw error;
        }
      }
      const fallback = await bytesRow(row);
      await request(store => store.put(fallback), "readwrite", name);
      blobsRefused = true;
    },
    async remove(path) {
      await request(store => store.delete(path), "readwrite", name);
    },
  };
}

/** Remove media only after every remaining note/cut has stopped referencing it. */
export async function removeUnreferenced(store: VaultStore, paths: readonly string[]): Promise<void> {
  const notes = (await store.list()).filter(entry => entry.text !== undefined);
  for (const path of new Set(paths)) {
    if (!notes.some(entry => entry.text?.includes(path))) await store.remove(path);
  }
}
