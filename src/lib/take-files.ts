// Look photos and the posed still live for the page, not in localStorage.
// La prise writes them into IndexedDB only when the visitor loads the frame.
// The frame reads that record. This module never calls the network.

import { buildTakePrompt, type PictureRole } from "./take-brief.ts";

export const TAKE_DB = "uttu-take";
export const TAKE_STORE = "brief";
export const TAKE_KEY = "current";
export const TAKE_FILE_MAX = 8 * 1024 * 1024;

export type TakeFileRecord = {
  node: "137" | "139";
  name: string;
  type: string;
  bytes: ArrayBuffer;
};

export type TakeBriefRecord = {
  prompt: string;
  files: TakeFileRecord[];
};

type Held = { type: string; name: string; size: number };

const lookFiles: File[] = [];
const plateauFiles = new Map<string, File>();

function isImage(file: Held): boolean {
  if (file.size <= 0 || file.size > TAKE_FILE_MAX) return false;
  return file.type.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(file.name);
}

export function rememberLook(list: readonly File[]) {
  lookFiles.splice(0, lookFiles.length, ...list.filter(isImage).slice(0, 2));
}

export function heldLookFiles(): File[] {
  return lookFiles.slice();
}

export function rememberPlateauFile(id: string, file: File) {
  if (!id || !isImage(file)) return;
  plateauFiles.set(id, file);
}

export function forgetPlateauFile(id: string) {
  plateauFiles.delete(id);
}

export function placeFileFor(scene: { stills: { id: string }[]; sequences: { id: string }[] } | null): File | null {
  if (!scene) return null;
  for (const still of scene.stills) {
    const file = plateauFiles.get(still.id);
    if (file) return file;
  }
  for (const sequence of scene.sequences) {
    const file = plateauFiles.get(sequence.id);
    if (file) return file;
  }
  return null;
}

export function chooseTakeSlots(look: readonly Held[], place: Held | null): {
  identity: boolean;
  second: boolean;
  picture2: PictureRole;
} {
  const photos = look.filter(isImage);
  if (place && isImage(place)) return { identity: photos.length > 0, second: true, picture2: "place" };
  if (photos.length > 1) return { identity: true, second: true, picture2: "second-look" };
  return { identity: photos.length > 0, second: false, picture2: "none" };
}

function fileName(file: File): string {
  const base = file.name.split(/[/\\]/).pop() ?? "image.png";
  const clean = base.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 80);
  return clean || "image.png";
}

async function toRecord(node: "137" | "139", file: File): Promise<TakeFileRecord | null> {
  if (!isImage(file)) return null;
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength <= 0 || bytes.byteLength > TAKE_FILE_MAX) return null;
  return { node, name: fileName(file), type: file.type || "image/png", bytes };
}

export function writeTakeBrief(record: TakeBriefRecord): Promise<boolean> {
  return new Promise(resolve => {
    try {
      const open = indexedDB.open(TAKE_DB, 1);
      open.onupgradeneeded = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains(TAKE_STORE)) db.createObjectStore(TAKE_STORE);
      };
      open.onerror = () => resolve(false);
      open.onsuccess = () => {
        const db = open.result;
        try {
          const tx = db.transaction(TAKE_STORE, "readwrite");
          tx.objectStore(TAKE_STORE).put(record, TAKE_KEY);
          tx.oncomplete = () => {
            db.close();
            resolve(true);
          };
          tx.onerror = () => {
            db.close();
            resolve(false);
          };
        } catch {
          db.close();
          resolve(false);
        }
      };
    } catch {
      resolve(false);
    }
  });
}

export async function storeTakeHandoff(input: {
  trigger: string;
  invariants: string;
  placeName: string;
  placeNote: string;
  takeLine: string;
  look: readonly File[];
  place: File | null;
}): Promise<"images" | "text" | "miss"> {
  const photos = input.look.filter(isImage);
  const place = input.place && isImage(input.place) ? input.place : null;
  const choice = chooseTakeSlots(photos, place);
  const prompt = buildTakePrompt({
    trigger: input.trigger,
    invariants: input.invariants,
    placeName: input.placeName,
    placeNote: input.placeNote,
    takeLine: input.takeLine,
    picture2: choice.picture2,
  });
  const files: TakeFileRecord[] = [];
  if (choice.identity && photos[0]) {
    const slot = await toRecord("137", photos[0]);
    if (slot) files.push(slot);
  }
  const second = place ?? (choice.picture2 === "second-look" ? photos[1] : undefined);
  if (choice.second && second) {
    const slot = await toRecord("139", second);
    if (slot) files.push(slot);
  }
  const ok = await writeTakeBrief({ prompt, files });
  if (!ok) return "miss";
  return files.length > 0 ? "images" : "text";
}
