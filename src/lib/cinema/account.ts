// CE5 · the account a cinema job belongs to (Astra decision 6, CE5_INTEGRATION §3).
// The scope is the fingerprint of the opaque, stable user id returned by Comfy `/api/user`. Never the
// key, never a hash of the key (a rotated key on the same account keeps the same scope; another
// account gets another one). No id = no new cinema submission; open receipts are kept as they are.
//
// Field: `id`, the one the media catalogue already reads first and the redacted fixture holds. Its
// presence on the real account is still to be confirmed by a redacted read on JD's side; until then
// `user_id` / `uid` and the key-hash fallback of `media/catalog.ts` are deliberately NOT accepted here.
import { accountFingerprint } from "../render/recovery.ts";
import { CinemaError } from "./types.ts";

export const ACCOUNT_ID_FIELD = "id" as const;
const MAX_ID = 200;

/** The opaque id, or null when `/api/user` gave none (or something that is not a short string). */
export function opaqueUserId(user: unknown): string | null {
  if (!user || typeof user !== "object" || Array.isArray(user)) return null;
  const value = (user as Record<string, unknown>)[ACCOUNT_ID_FIELD];
  return typeof value === "string" && value.trim() !== "" && value.length <= MAX_ID ? value : null;
}

/** Same derivation as the media catalogue's id branch (`comfy-user:<id>`), so both partitions agree. */
export async function cinemaAccountScope(user: unknown): Promise<string> {
  const id = opaqueUserId(user);
  if (!id) throw new CinemaError("ACCOUNT_UNAVAILABLE", "Le compte Comfy ne donne pas d'identifiant stable : aucun envoi cinéma.");
  return accountFingerprint(`comfy-user:${id}`);
}

/**
 * Legacy receipts carry `accountFingerprint(key)` or `accountFingerprint(JSON.stringify(user))`. That is
 * a format to migrate, never a proof of identity: such a receipt is only resumed after the visitor
 * reconnects and the new scope is recorded by an explicit migration (not done implicitly here).
 */
export const isCinemaScope = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
