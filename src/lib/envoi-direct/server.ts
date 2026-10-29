// Direct send for heavy files (Vercel Blob, private store). The browser uploads the file
// straight to Blob with a short client token, then asks this server to hand it to Comfy:
// the server reads the private blob with BLOB_READ_WRITE_TOKEN, re-sends it to Comfy's
// /api/upload/image with the visitor's own Comfy credential (forwarded, never stored),
// and deletes the blob. Without BLOB_READ_WRITE_TOKEN everything answers « not available »
// and the studio keeps the browser reduction + relay path.

import { createHash } from "node:crypto";

export const COMFY = "https://cloud.comfy.org";
export const DIRECT_MAX_BYTES = 200 * 1024 * 1024;
export const DIRECT_TYPES = ["image/*", "video/mp4", "video/quicktime", "video/webm"];
export const DIRECT_PREFIX = "envoi";

export interface BlobOps {
  get(pathname: string): Promise<{ blob: Blob; contentType: string } | null>;
  del(pathname: string): Promise<void>;
}

/** True only when the store is connected. Never reads or returns the value. */
export function directConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.BLOB_READ_WRITE_TOKEN);
}

/** The Comfy credential headers the visitor sent (key or session), nothing else. */
export function comfyCredential(request: Request): Headers | null {
  const headers = new Headers();
  const key = request.headers.get("x-api-key");
  const bearer = request.headers.get("authorization");
  if (key) headers.set("x-api-key", key);
  else if (bearer && /^Bearer \S{16,}$/.test(bearer)) headers.set("authorization", bearer);
  else return null;
  return headers;
}

/** Same-origin browser calls only (the relay applies the same rule). */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  return !origin || origin === new URL(request.url).origin;
}

/**
 * The studio's session is the visitor's Comfy account: a credential Comfy accepts.
 * Returns an opaque scope (hash of the account id) that prefixes every blob path.
 */
export async function authenticate(request: Request, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  if (!sameOrigin(request)) return null;
  const credential = comfyCredential(request);
  if (!credential) return null;
  credential.set("accept", "application/json");
  let response: Response;
  try {
    response = await fetchImpl(new URL("/api/user", COMFY), { headers: credential, cache: "no-store", signal: AbortSignal.timeout(15_000) });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  const body = await response.json().catch(() => null) as { id?: unknown } | null;
  const id = body && (typeof body.id === "string" || typeof body.id === "number") ? String(body.id) : "";
  if (!id) return null;
  return createHash("sha256").update(`u-ttu-envoi:${id}`).digest("hex").slice(0, 24);
}

const SAFE_NAME = /^[A-Za-z0-9._-]{1,120}$/;

/** A blob path is `envoi/<scope>/<file>`; anything else is refused. */
export function pathAllowed(pathname: string, scope: string): boolean {
  const parts = pathname.split("/");
  return parts.length === 3 && parts[0] === DIRECT_PREFIX && parts[1] === scope && SAFE_NAME.test(parts[2]) && !parts[2].startsWith(".");
}

export function tokenRules(scope: string, pathname: string, now = Date.now()) {
  if (!pathAllowed(pathname, scope)) throw new Error("Chemin refusé.");
  return {
    allowedContentTypes: DIRECT_TYPES,
    maximumSizeInBytes: DIRECT_MAX_BYTES,
    addRandomSuffix: true,
    validUntil: now + 10 * 60 * 1000,
    tokenPayload: JSON.stringify({ scope }),
  };
}

/** Reads the private blob, sends it to Comfy with the visitor's credential, then deletes it. */
export async function handToComfy(request: Request, input: { pathname: string; filename: string }, scope: string, blobs: BlobOps, fetchImpl: typeof fetch = fetch): Promise<Response> {
  if (!pathAllowed(input.pathname, scope) || !SAFE_NAME.test(input.filename)) return Response.json({ error: "Chemin refusé." }, { status: 400 });
  const credential = comfyCredential(request)!;
  try {
    const found = await blobs.get(input.pathname);
    if (!found) return Response.json({ error: "Fichier introuvable." }, { status: 404 });
    if (found.blob.size > DIRECT_MAX_BYTES) return Response.json({ error: "Fichier trop lourd." }, { status: 413 });
    const form = new FormData();
    form.append("image", new File([found.blob], input.filename, { type: found.contentType }));
    form.append("type", "input");
    const upstream = await fetchImpl(new URL("/api/upload/image", COMFY), { method: "POST", headers: credential, body: form, cache: "no-store" });
    if (!upstream.ok) return Response.json({ error: `Comfy ${upstream.status}` }, { status: upstream.status === 401 || upstream.status === 403 ? upstream.status : 502 });
    const body = await upstream.json().catch(() => ({})) as { name?: unknown; subfolder?: unknown };
    if (typeof body.name !== "string" || !body.name) return Response.json({ error: "Comfy sans nom." }, { status: 502 });
    return Response.json({ name: body.name, subfolder: typeof body.subfolder === "string" ? body.subfolder : "" });
  } finally {
    // Never keep the file: the store stays within the Hobby quota.
    await blobs.del(input.pathname).catch(() => {});
  }
}
