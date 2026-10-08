// Bring-your-own vault on desktop: the studio copies every file into a folder
// the adherent picks (their Obsidian vault), then keeps it in step for the
// session. Browsers without the folder picker keep the export ZIP.

import type { VaultEntry, VaultStore } from "./store.ts";

type DirectoryHandle = {
  name: string;
  queryPermission?(options: { mode: "readwrite" }): Promise<"granted" | "denied" | "prompt">;
  requestPermission?(options: { mode: "readwrite" }): Promise<"granted" | "denied" | "prompt">;
  entries?(): AsyncIterable<[string, DirectoryHandle & { kind?: "file" | "directory"; getFile?: () => Promise<File> }]>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<{ createWritable(): Promise<{ write(data: Blob | string): Promise<void>; close(): Promise<void> }> }>;
  removeEntry(name: string): Promise<void>;
};

type PickerWindow = Window & { showDirectoryPicker?: (options?: { mode?: "readwrite"; id?: string }) => Promise<DirectoryHandle> };

export function folderLinkSupported(): boolean {
  return typeof window !== "undefined" && typeof (window as PickerWindow).showDirectoryPicker === "function";
}

export async function pickFolder(): Promise<DirectoryHandle | null> {
  const picker = (window as PickerWindow).showDirectoryPicker;
  if (!picker) return null;
  try {
    return await picker({ mode: "readwrite", id: "uttu-coffre" });
  } catch {
    return null;
  }
}

async function parentOf(root: DirectoryHandle, path: string, create: boolean): Promise<{ dir: DirectoryHandle; name: string }> {
  const parts = path.split("/");
  const name = parts.pop() ?? path;
  let dir = root;
  for (const part of parts) dir = await dir.getDirectoryHandle(part, { create });
  return { dir, name };
}

export async function mirrorEntry(root: DirectoryHandle, entry: VaultEntry): Promise<void> {
  const { dir, name } = await parentOf(root, entry.path, true);
  const file = await dir.getFileHandle(name, { create: true });
  const writable = await file.createWritable();
  await writable.write(entry.blob ?? entry.text ?? "");
  await writable.close();
}

export async function mirrorRemove(root: DirectoryHandle, path: string): Promise<void> {
  try {
    const { dir, name } = await parentOf(root, path, false);
    await dir.removeEntry(name);
  } catch {}
}

export async function mirrorAll(store: VaultStore, root: DirectoryHandle): Promise<number> {
  const files = await store.list();
  for (const file of files) await mirrorEntry(root, file);
  return files.length;
}

/** A store that writes through to the linked folder while it is linked. */
export function linkedStore(store: VaultStore, folder: () => DirectoryHandle | null): VaultStore {
  return {
    list: () => store.list(),
    get: path => store.get(path),
    async put(entry) {
      await store.put(entry);
      const root = folder();
      if (root) await mirrorEntry(root, entry).catch(() => {});
    },
    async remove(path) {
      await store.remove(path);
      const root = folder();
      if (root) await mirrorRemove(root, path);
    },
  };
}

export type { DirectoryHandle };
