// One place name, one answer. Nominatim asks for a real User-Agent, which the browser cannot set.
// No autocomplete: the visitor presses the button. Nothing here calls Comfy.

import { nominatimUrl, parseNominatim } from "@/lib/repere/lieu";

export const dynamic = "force-dynamic";

const last = { at: 0 };

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 120) return Response.json({ error: "lieu" }, { status: 400 });
  const now = Date.now();
  if (now - last.at < 1000) return Response.json({ error: "rate" }, { status: 429 });
  last.at = now;
  const upstream = await fetch(nominatimUrl(query), {
    headers: {
      Accept: "application/json",
      "Accept-Language": "fr",
      "User-Agent": "UTTU-Studio/1.0 (reperage; https://u-ttu-studio.vercel.app)",
    },
    cache: "no-store",
  });
  if (!upstream.ok) return Response.json({ error: "introuvable" }, { status: 502 });
  const found = parseNominatim(await upstream.json());
  if (!found) return Response.json({ error: "introuvable" }, { status: 404 });
  return Response.json(found);
}
