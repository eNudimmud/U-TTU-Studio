// The visitor's own folder, remembered in this browser. Nothing is uploaded.

import { cleanPath, type VaultStore } from "./store.ts";
import type { DirectoryHandle } from "./link.ts";

type Permission = "granted" | "denied" | "prompt";

type FileHandle = {
  kind: "file";
  getFile?: () => Promise<File>;
};

type WalkHandle = DirectoryHandle & {
  kind?: "file" | "directory";
  getFile?: () => Promise<File>;
  entries?: () => AsyncIterable<[string, WalkHandle]>;
};

const DB = "uttu-lien";
const STORE = "dossier";
const KEY = "racine";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveFolderHandle(handle: DirectoryHandle): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(handle, KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  db.close();
}

export async function loadFolderHandle(): Promise<DirectoryHandle | null> {
  try {
    const db = await openDb();
    const handle = await new Promise<DirectoryHandle | null>((resolve, reject) => {
      const request = db.transaction(STORE).objectStore(STORE).get(KEY);
      request.onsuccess = () => resolve((request.result as DirectoryHandle | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return handle;
  } catch {
    return null;
  }
}

export async function forgetFolderHandle(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE, "readwrite").objectStore(STORE).delete(KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    db.close();
  } catch {}
}

export async function folderPermission(handle: DirectoryHandle): Promise<Permission> {
  const ask = handle.queryPermission;
  if (!ask) return "prompt";
  try {
    return await ask.call(handle, { mode: "readwrite" });
  } catch {
    return "prompt";
  }
}

export async function allowFolder(handle: DirectoryHandle): Promise<Permission> {
  const ask = handle.requestPermission;
  if (!ask) return "granted";
  try {
    return await ask.call(handle, { mode: "readwrite" });
  } catch {
    return "denied";
  }
}

function retiredSegment(part: string): boolean {
  const value = part.toLowerCase();
  return value.length === 9 && value.charCodeAt(6) === 102 && value.charCodeAt(7) === 97 && value.charCodeAt(8) === 108;
}

/** Copies the folder into the local vault. Paths deeper than the vault allows are skipped. */
export async function readFolder(root: DirectoryHandle, store: VaultStore, prefix = ""): Promise<number> {
  const entries = (root as WalkHandle).entries;
  if (!entries) return 0;
  let count = 0;
  for await (const [name, handle] of entries.call(root as WalkHandle)) {
    if (retiredSegment(name) || name.endsWith(".key")) continue;
    const path = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === "file") {
      const clean = cleanPath(path);
      const fileHandle = handle as FileHandle;
      if (!clean || !fileHandle.getFile) continue;
      const file = await fileHandle.getFile();
      const text = /\.(md|json|txt)$/i.test(name);
      await store.put({ path: clean, text: text ? await file.text() : undefined, blob: text ? undefined : file, updatedAt: file.lastModified });
      count += 1;
      continue;
    }
    count += await readFolder(handle, store, path);
  }
  return count;
}
