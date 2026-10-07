// The whole vault as one ZIP, laid out as an Obsidian vault folder.

import { createZip, type ZipEntry } from "../zip.ts";
import { COFFRE_ROOT, README, writeMap } from "./model.ts";
import type { VaultStore } from "./store.ts";

export async function coffreEntries(store: VaultStore): Promise<ZipEntry[]> {
  await writeMap(store);
  const encoder = new TextEncoder();
  const entries: ZipEntry[] = [];
  const files = await store.list();
  if (!files.some(file => file.path === "README.md")) entries.push({ name: `${COFFRE_ROOT}/README.md`, data: encoder.encode(README) });
  for (const file of files) {
    const data = file.blob ? new Uint8Array(await file.blob.arrayBuffer()) : encoder.encode(file.text ?? "");
    entries.push({ name: `${COFFRE_ROOT}/${file.path}`, data });
  }
  return entries;
}

export async function coffreZip(store: VaultStore, date = new Date()): Promise<Uint8Array> {
  return createZip(await coffreEntries(store), date);
}
