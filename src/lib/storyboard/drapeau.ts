// Storyboard (/storyboard and the bubble's « Make a storyboard ») is open to everyone since SB11 (JD's yes).
// `?storyboard=0` stays one version as an escape hatch: it switches it off for this browser (cookie, so the
// server answers a clean 404), and `?storyboard=1` switches it back on.

export const STORYBOARD_COOKIE = "u-ttu-storyboard";
const UN_AN = 60 * 60 * 24 * 365;

/** Same answer on the server (search + cookie header value) and on the client. */
export function storyboardActif(search: string, cookie: string | null | undefined): boolean {
  const asked = new URLSearchParams(search).get("storyboard");
  if (asked === "1") return true;
  if (asked === "0") return false;
  return cookie !== "0";
}

/** The value of our cookie in a `document.cookie` string, or null. */
export function lireCookie(cookies: string): string | null {
  for (const part of cookies.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === STORYBOARD_COOKIE) return rest.join("=");
  }
  return null;
}

/** The cookie line to write after an explicit `?storyboard=` in the address, or null when nothing was asked. */
export function cookieDemande(search: string): string | null {
  const asked = new URLSearchParams(search).get("storyboard");
  if (asked === "0") return `${STORYBOARD_COOKIE}=0; Path=/; Max-Age=${UN_AN}; SameSite=Lax`;
  if (asked === "1") return `${STORYBOARD_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  return null;
}

/** Client only: reads the address and the cookie, and keeps an explicit choice. */
export function storyboardDansCePoste(): boolean {
  if (typeof document === "undefined") return false;
  const search = window.location.search;
  const line = cookieDemande(search);
  try { if (line) document.cookie = line; } catch { /* cookies off */ }
  let cookie: string | null = null;
  try { cookie = lireCookie(document.cookie); } catch { cookie = null; }
  return storyboardActif(search, cookie);
}
