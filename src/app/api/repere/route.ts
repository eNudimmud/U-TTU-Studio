// The map, the name search and the street photos are asked by the browser.
// This route does not call Overpass, Photon, Panoramax, Mapillary or any paid service.

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ error: "direct" }, { status: 410 });
}
