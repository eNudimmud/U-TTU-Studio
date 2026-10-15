import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

// R7.2 : Overpass en panne (406 sans CORS) ne doit pas empêcher les photos de rue de s'afficher.
const ID = "0f1e2d3c-4b5a-4968-8776-655443322110";
const NEXT = "1f1e2d3c-4b5a-4968-8776-655443322111";
const IMG = "https://panoramax.openstreetmap.fr/images/test/sd.jpg";
const IMG2 = "https://panoramax.openstreetmap.fr/images/test2/sd.jpg";

function feature(id: string, href: string, lon: number, links: { rel: string; href: string }[]) {
  return {
    type: "Feature",
    id,
    geometry: { type: "Point", coordinates: [lon, 48.88805] },
    links,
    properties: { license: "CC-BY-SA-4.0", "geovisio:producer": "Ada Rue", "view:azimuth": 90, "pers:interior_orientation": { field_of_view: 70 } },
    assets: { sd: { href }, thumb: { href } },
  };
}

for (const flat of [false, true]) test(`la recherche par nom atteint les photos même si Overpass refuse${flat ? ' et sans WebGL' : ''}`, async ({ page }) => {
  if (flat) await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...args: any[]) {
      if (kind.includes('webgl')) return null;
      return (original as any).call(this, kind, ...args);
    } as typeof original;
  });
  const jpg = readFileSync("public/og.jpg");
  let searches = 0;
  await page.route("**/photon.komoot.io/api/**", route => route.fulfill({ json: { features: [{ geometry: { coordinates: [2.34063, 48.88805] }, properties: { name: "Rue test" } }] } }));
  await page.route("**/api.panoramax.xyz/api/instances", route => route.fulfill({ json: { instances: [] } }));
  await page.route("**/overpass-api.de/**", route => route.abort("failed"));
  await page.route("**/api.panoramax.xyz/api/search**", route => { searches++; return route.fulfill({
    status: 200,
    headers: { "access-control-allow-origin": "*" },
    contentType: "application/json",
    body: JSON.stringify({ type: "FeatureCollection", features: [
      feature(ID, IMG, 2.34063, [{ rel: "next", href: `https://api.panoramax.xyz/api/collections/c/items/${NEXT}` }]),
      feature(NEXT, IMG2, 2.34070, [{ rel: "prev", href: `https://api.panoramax.xyz/api/collections/c/items/${ID}` }]),
    ] }),
  }); });
  await page.route("**/panoramax.openstreetmap.fr/**", route => route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*" }, contentType: "image/jpeg", body: jpg }));

  await page.goto("/studio");
  await page.getByRole("navigation").getByRole("button", { name: "DÉCOR" }).click();
  const lieu = page.getByRole("textbox", { name: /où/i }).first();
  await lieu.fill("Rue test Paris");
  await lieu.press("Enter");
  await expect(page.locator("[data-rue-vue]")).toBeVisible();
  await expect(page.getByText("Les photos n'ont pas pu être chargées")).toHaveCount(0);
  await expect(page.locator("[data-rue-credit]")).toContainText("Ada Rue");
  expect(searches).toBe(1);
  await expect(page.getByText("Une recherche à la fois.", { exact: true })).toHaveCount(0);
  // Attributions : rien ne recouvre la photo, tout reste lisible sous elle.
  await expect(page.locator(".u-repere-map.is-mini .maplibregl-ctrl-attrib")).toBeHidden();
  const carte = page.locator("[data-carte-credit]");
  await expect(carte).toBeVisible();
  await expect(carte).toContainText("© contributeurs OpenStreetMap, ODbL");
  await expect(carte).toContainText("OpenFreeMap");
  await expect(page.locator("[data-rue-credit]")).toContainText("CC-BY-SA-4.0");
  if (flat) {
    const picture = page.locator('[data-rue-flat] img');
    await expect(picture).toBeVisible();
    await expect.poll(() => picture.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  }
  for (const sel of ["[data-rue-prev]", "[data-rue-next]", "[data-prendre-vue]"]) {
    const box = await page.locator(sel).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
});
