import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { authenticate, directConfigured, tokenRules } from "@/lib/envoi-direct/server";

export const dynamic = "force-dynamic";

// Client token for one private upload. The visitor must hold a Comfy credential Comfy accepts.
export async function POST(request: Request) {
  if (!directConfigured()) return Response.json({ error: "Envoi direct indisponible." }, { status: 404 });
  const body = (await request.json().catch(() => null)) as HandleUploadBody | null;
  if (!body || body.type !== "blob.generate-client-token") return Response.json({ error: "Requête refusée." }, { status: 400 });
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async pathname => {
        const scope = await authenticate(request);
        if (!scope) throw new Error("Compte de rendu non connecté.");
        return tokenRules(scope, pathname);
      },
    });
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 403 });
  }
}
