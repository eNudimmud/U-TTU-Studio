// The FILM redesign stays behind one switch until navigation Plans | Montage ships (PR 9):
// `?film2=1` turns it on for this device (kept as a preference), `?film2=0` turns it off.

export const FILM2_KEY = "u-ttu-film2";

export function film2Actif(search: string, storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null): boolean {
  const asked = new URLSearchParams(search).get("film2");
  try {
    if (asked === "1") { storage?.setItem(FILM2_KEY, "1"); return true; }
    if (asked === "0") { storage?.removeItem(FILM2_KEY); return false; }
    return storage?.getItem(FILM2_KEY) === "1";
  } catch {
    return asked === "1";
  }
}

/** Client only: reads the address and the preference once. */
export function film2DansCePoste(): boolean {
  if (typeof window === "undefined") return false;
  let storage: Storage | null = null;
  try { storage = window.localStorage; } catch { storage = null; }
  return film2Actif(window.location.search, storage);
}
