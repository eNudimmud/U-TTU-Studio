// The adherent's fal key, kept in this browser only. It is never part of the
// vault or its export, and it is only ever sent to fal.

export const FAL_KEY_STORAGE = "u-ttu-fal";

const FAL_KEY = /^[A-Za-z0-9-]{8,80}:[A-Za-z0-9_-]{8,200}$/;

export function cleanFalKey(raw: string): string | null {
  const key = raw.trim().replace(/^Key\s+/i, "");
  return FAL_KEY.test(key) ? key : null;
}

export function readFalKey(storage: Pick<Storage, "getItem"> | null): string | null {
  try {
    const value = storage?.getItem(FAL_KEY_STORAGE);
    return value ? cleanFalKey(value) : null;
  } catch {
    return null;
  }
}

export function saveFalKey(storage: Pick<Storage, "setItem" | "removeItem"> | null, key: string | null): void {
  try {
    if (!storage) return;
    if (key) storage.setItem(FAL_KEY_STORAGE, key);
    else storage.removeItem(FAL_KEY_STORAGE);
  } catch {}
}
