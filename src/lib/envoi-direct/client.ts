// Browser side of the direct send (see server.ts). When the store is connected, every file
// goes this way as the original (only Wan Animate's pose video is re-timed, see
// prepare-upload.ts). If it is not connected, or the send fails, the studio keeps the
// browser reduction + relay path, silently.

export const DIRECT_FAILED = "L’envoi direct du fichier lourd n’a pas abouti. Réessaie, ou prends un fichier plus léger.";
const DIRECT_TYPE = /^(image\/[a-z0-9.+-]+|audio\/[a-z0-9.+-]+|video\/(mp4|quicktime|webm))$/i;
const BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", avif: "image/avif", heic: "image/heic", heif: "image/heif", tif: "image/tiff", tiff: "image/tiff",
  mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm",
  mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", wav: "audio/wav", flac: "audio/flac", ogg: "audio/ogg", opus: "audio/ogg",
};

/** The type the Blob token accepts for this file, read from the extension when the browser gives none (HEIC on some phones). Null: not for Blob. */
export function directContentType(file: Blob, filename: string): string | null {
  if (file.type && DIRECT_TYPE.test(file.type)) return file.type.toLowerCase();
  if (file.type && file.type !== "application/octet-stream") return null;
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  return BY_EXTENSION[ext] ?? null;
}
const MULTIPART_FROM = 20 * 1024 * 1024;

export interface DirectState { direct: boolean; scope?: string }
export type BlobUpload = (pathname: string, file: File, options: { handleUploadUrl: string; headers: Record<string, string>; multipart: boolean; contentType: string }) => Promise<{ pathname: string }>;

export function directType(type: string): boolean {
  return DIRECT_TYPE.test(type);
}

/** A Blob- and Comfy-safe file name, extension kept. */
export function directName(filename: string): string {
  const dot = filename.lastIndexOf(".");
  const ext = dot > 0 ? filename.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) : "";
  const base = (dot > 0 ? filename.slice(0, dot) : filename).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "fichier";
  return ext ? `${base}.${ext}` : base;
}

export async function readDirectState(relay: string, headers: Record<string, string>, doFetch: typeof fetch): Promise<DirectState> {
  try {
    const response = await doFetch(`${relay}/envoi-direct/etat`, { headers, cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return { direct: false };
    const body = await response.json() as { direct?: unknown; scope?: unknown };
    return body.direct === true && typeof body.scope === "string" && /^[a-f0-9]{24}$/.test(body.scope) ? { direct: true, scope: body.scope } : { direct: false };
  } catch {
    return { direct: false };
  }
}

const defaultBlobUpload: BlobUpload = async (pathname, file, options) => {
  const { upload } = await import("@vercel/blob/client");
  return upload(pathname, file, { access: "private", ...options });
};

/** Browser → private Blob, then server → Comfy (blob deleted). Returns the Comfy input name. */
export async function sendDirect(file: File, scope: string, relay: string, headers: Record<string, string>, doFetch: typeof fetch, blobUpload: BlobUpload = defaultBlobUpload): Promise<string> {
  const filename = directName(file.name);
  const contentType = directContentType(file, file.name);
  if (!contentType) throw new Error(DIRECT_FAILED);
  let pathname: string;
  try {
    const blob = await blobUpload(`envoi/${scope}/${filename}`, file, { handleUploadUrl: `${relay}/envoi-direct/jeton`, headers, multipart: file.size > MULTIPART_FROM, contentType });
    pathname = blob.pathname;
  } catch {
    throw new Error(DIRECT_FAILED);
  }
  let response: Response;
  try {
    response = await doFetch(`${relay}/envoi-direct/comfy`, { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ pathname, filename }), cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(300_000) });
  } catch {
    throw new Error(DIRECT_FAILED);
  }
  if (!response.ok) throw new Error(DIRECT_FAILED);
  const body = await response.json().catch(() => ({})) as { name?: unknown; subfolder?: unknown };
  if (typeof body.name !== "string" || !body.name || /[\\\u0000]/.test(body.name)) throw new Error(DIRECT_FAILED);
  return typeof body.subfolder === "string" && body.subfolder ? `${body.subfolder}/${body.name}` : body.name;
}

export interface EssaiResult { direct: boolean; received?: boolean; bytes?: number; deleted?: boolean | null }

/** The free test: browser → private Blob → server reads it and deletes it. Comfy's upload is never called. */
export async function essaiDirect(file: File, relay: string, headers: Record<string, string>, doFetch: typeof fetch = (input, init) => fetch(input, init), blobUpload: BlobUpload = defaultBlobUpload): Promise<EssaiResult> {
  const state = await readDirectState(relay, headers, doFetch);
  if (!state.direct || !state.scope) return { direct: false };
  const filename = directName(file.name);
  const contentType = directContentType(file, file.name);
  if (!contentType) throw new Error(DIRECT_FAILED);
  const blob = await blobUpload(`envoi/${state.scope}/${filename}`, file, { handleUploadUrl: `${relay}/envoi-direct/jeton`, headers, multipart: file.size > MULTIPART_FROM, contentType });
  const response = await doFetch(`${relay}/envoi-direct/comfy`, { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ pathname: blob.pathname, filename, essai: true }), cache: "no-store", credentials: "same-origin" });
  if (!response.ok) throw new Error(DIRECT_FAILED);
  const body = await response.json() as { received?: boolean; bytes?: number; deleted?: boolean | null };
  return { direct: true, received: body.received === true, bytes: body.bytes, deleted: body.deleted ?? null };
}
