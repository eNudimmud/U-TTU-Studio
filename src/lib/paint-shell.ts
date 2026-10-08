// The first paint of an empty studio is the screen itself, so the largest text
// does not wait for IndexedDB. A vault that already has a project waits:
// painting the empty shell and then the filled one would jump.

export const VAULT_FILLED_COOKIE = "u-ttu-plein";

export function paintShell(ready: boolean, assumeFilled: boolean): boolean {
  return ready || !assumeFilled;
}

/** Cookie written once IndexedDB has been read. The next document can match it. */
export function vaultFilledCookie(filled: boolean): string {
  if (!filled) return `${VAULT_FILLED_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  return `${VAULT_FILLED_COOKIE}=1; Path=/; Max-Age=31536000; SameSite=Lax`;
}
