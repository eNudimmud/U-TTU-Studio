import { authenticate, directConfigured } from "@/lib/envoi-direct/server";

export const dynamic = "force-dynamic";

// Is the direct send available for this visitor? `store` says whether the server has a Blob
// token (its presence only, never its value); `direct` and the scope need a Comfy account.
export async function GET(request: Request) {
  const store = directConfigured();
  if (!store) return Response.json({ direct: false, store }, { headers: { "cache-control": "no-store" } });
  const scope = await authenticate(request);
  return Response.json(scope ? { direct: true, store, scope } : { direct: false, store }, { headers: { "cache-control": "no-store" } });
}
