import { authenticate, directConfigured } from "@/lib/envoi-direct/server";

export const dynamic = "force-dynamic";

// Is the direct send available for this visitor? Says yes or no and the blob scope; never a secret.
export async function GET(request: Request) {
  if (!directConfigured()) return Response.json({ direct: false }, { headers: { "cache-control": "no-store" } });
  const scope = await authenticate(request);
  return Response.json(scope ? { direct: true, scope } : { direct: false }, { headers: { "cache-control": "no-store" } });
}
