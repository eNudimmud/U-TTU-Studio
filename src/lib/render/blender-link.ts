// The adherent's Farpy job key, kept in this browser only. It is never part
// of the vault or its export, and it is only ever sent to Farpy.

export const BLENDER_KEY_STORAGE = "u-ttu-blender";

const BLENDER_KEY = /^farpy_agent_[A-Za-z0-9._-]{8,200}$/;

export function cleanBlenderKey(raw: string): string | null {
  const key = raw.trim();
  return BLENDER_KEY.test(key) ? key : null;
}

export function readBlenderKey(storage: Pick<Storage, "getItem"> | null): string | null {
  try {
    const value = storage?.getItem(BLENDER_KEY_STORAGE);
    return value ? cleanBlenderKey(value) : null;
  } catch {
    return null;
  }
}

export function saveBlenderKey(storage: Pick<Storage, "setItem" | "removeItem"> | null, key: string | null): void {
  try {
    if (!storage) return;
    if (key) storage.setItem(BLENDER_KEY_STORAGE, key);
    else storage.removeItem(BLENDER_KEY_STORAGE);
  } catch {}
}
