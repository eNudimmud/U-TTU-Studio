// The FILM redesign is the studio's film by default since navigation PRISE | MONTAGE shipped (PR 9).
// One escape hatch stays for a release: `?film2=0` brings the former film back on this device (kept as
// a preference), `?film2=1` returns to the new one. The former screens are removed in a later cleanup.

export const FILM2_KEY = "u-ttu-film2";

export function film2Actif(search: string, storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null): boolean {
  const asked = new URLSearchParams(search).get("film2");
  try {
    if (asked === "0") { storage?.setItem(FILM2_KEY, "0"); return false; }
    if (asked === "1") { storage?.removeItem(FILM2_KEY); return true; }
    return storage?.getItem(FILM2_KEY) !== "0";
  } catch {
    return asked !== "0";
  }
}

/** Client only: reads the address and the preference once. */
export function film2DansCePoste(): boolean {
  if (typeof window === "undefined") return false;
  let storage: Storage | null = null;
  try { storage = window.localStorage; } catch { storage = null; }
  return film2Actif(window.location.search, storage);
}
