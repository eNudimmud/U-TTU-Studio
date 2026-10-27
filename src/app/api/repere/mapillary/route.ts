// Mapillary images for Repérage. The token stays on the server (MAPILLARY_TOKEN, or
// NEXT_PUBLIC_MAPILLARY_TOKEN as fallback). It is never written into the response.

import { mapillaryBboxUrl, mapillaryServerToken } from "@/lib/repere/mapillary";

export const dynamic = "force-dynamic";

const BBOX = /^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/;

export async function GET(request: Request) {
  const token = mapillaryServerToken();
  if (!token) return Response.json({ state: "off", data: null });

  const url = new URL(request.url);
  const bboxRaw = (url.searchParams.get("bbox") ?? "").trim();
  if (!BBOX.test(bboxRaw)) return Response.json({ error: "bbox" }, { status: 400 });
  const parts = bboxRaw.split(",").map(Number) as [number, number, number, number];
  if (parts.some(n => !Number.isFinite(n))) return Response.json({ error: "bbox" }, { status: 400 });
  const limit = Math.min(100, Math.max(1, Math.round(Number(url.searchParams.get("limit") ?? "100") || 100)));

  try {
    const upstream = await fetch(mapillaryBboxUrl(parts, limit), {
      headers: { Accept: "application/json", Authorization: `OAuth ${token}` },
      signal: AbortSignal.timeout(4_000),
      cache: "no-store",
    });
    if (!upstream.ok) return Response.json({ state: "fail", data: null }, { status: 502 });
    const data: unknown = await upstream.json();
    return Response.json({ state: "ok", data });
  } catch {
    return Response.json({ state: "fail", data: null }, { status: 502 });
  }
}
