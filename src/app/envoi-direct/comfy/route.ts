import { BlobNotFoundError, del, get, head } from "@vercel/blob";
import { authenticate, directConfigured, handToComfy, type BlobOps } from "@/lib/envoi-direct/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const blobs: BlobOps = {
  async get(pathname) {
    const found = await get(pathname, { access: "private", useCache: false });
    if (!found || found.statusCode !== 200 || !found.stream) return null;
    const blob = await new Response(found.stream).blob();
    return { blob, contentType: found.blob.contentType || "application/octet-stream" };
  },
  async del(pathname) {
    await del(pathname);
  },
  async exists(pathname) {
    try {
      await head(pathname);
      return true;
    } catch (error) {
      if (error instanceof BlobNotFoundError) return false;
      throw error;
    }
  },
};

// Hands a private blob to Comfy with the visitor's credential, then deletes it.
export async function POST(request: Request) {
  if (!directConfigured()) return Response.json({ error: "Envoi direct indisponible." }, { status: 404 });
  const scope = await authenticate(request);
  if (!scope) return Response.json({ error: "Compte de rendu non connecté." }, { status: 401 });
  const input = (await request.json().catch(() => null)) as { pathname?: unknown; filename?: unknown; essai?: unknown } | null;
  if (!input || typeof input.pathname !== "string" || typeof input.filename !== "string") return Response.json({ error: "Requête refusée." }, { status: 400 });
  return handToComfy(request, { pathname: input.pathname, filename: input.filename, essai: input.essai === true }, scope, blobs);
}
