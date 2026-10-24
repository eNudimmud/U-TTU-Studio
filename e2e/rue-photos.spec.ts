import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

// Photos de rue dans l'outil unique « Repérer un lieu » : Overpass et tuiles en panne ne bloquent pas les photos.
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

for (const flat of [false, true]) test(`la recherche par nom atteint les photos de rue même si la carte refuse${flat ? ' et sans WebGL' : ''}`, async ({ page }) => {
  if (flat) await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...args: any[]) {
      if (kind.includes('webgl')) return null;
      return (original as any).call(this, kind, ...args);
    } as typeof original;
  });
  const jpg = readFileSync("public/og.jpg");
  let searches = 0;
  await page.route("**/photon.komoot.io/api/**", route => route.fulfill({ json: { features: [{ geometry: { coordinates: [2.34063, 48.88805] }, properties: { name: "Rue test" } }] }, headers: { "access-control-allow-origin": "*" } }));
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

  // Nothing else leaves the machine: map tiles, relief and Swiss roofs are refused, photos still come.
  await page.route(/tiles\.openfreemap\.org|elevation-tiles-prod|geo\.admin\.ch/, route => route.abort("blockedbyclient"));

  await page.goto("/studio#personnage");
  await page.getByRole("navigation").getByRole("button", { name: "DÉCOR" }).click();
  await page.locator("[data-rep3d-open]").click();
  const sheet = page.getByRole("dialog", { name: "Repérage 3D" });
  const lieu = sheet.getByRole("searchbox", { name: "Lieu, adresse ou coordonnées" });
  await lieu.fill("Rue test Paris");
  await lieu.press("Enter");
  // Street photos sit on the same view as the 3D city: one toggle.
  await expect(sheet).toHaveAttribute("data-rep3d-step", "2");
  const toggle = page.locator("[data-rep3d-src-pick=rue]");
  await expect(toggle).toContainText("· 2");
  await toggle.click();
  await expect(sheet).toHaveAttribute("data-rep3d-src", "rue");
  const card = page.locator("[data-rep3d-rue-count]");
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute("data-rep3d-rue-count", "2");
  await expect(page.getByText("Les photos de rue n’ont pas répondu.")).toHaveCount(0);
  const credit = page.locator("[data-rep3d-rue-credit]");
  await expect(credit).toContainText("Ada Rue");
  await expect(credit).toContainText("CC-BY-SA-4.0");
  expect(searches).toBe(1);
  // Browse the photos found around the place.
  await expect(page.locator("[data-rep3d-rue-prev]")).toBeDisabled();
  await page.locator("[data-rep3d-rue-next]").click();
  await expect(card).toHaveAttribute("data-rep3d-rue-index", "1");
  await expect(page.locator("[data-rep3d-rue-next]")).toBeDisabled();
  await expect(page.locator("[data-rep3d-rue-prev]")).toBeEnabled();
  if (flat) {
    await expect(sheet).toHaveAttribute("data-rep3d-state", "nogl");
    await page.locator("[data-rep3d-rue-around]").click();
    const picture = page.locator("[data-rue-flat] img");
    await expect(picture).toBeVisible();
    await expect.poll(() => picture.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  }
  for (const sel of ["[data-rep3d-rue-prev]", "[data-rep3d-rue-next]", "[data-rep3d-rue-add]", "[data-rep3d-rue-around]"]) {
    const box = await page.locator(sel).boundingBox();
    expect(box!.height, sel).toBeGreaterThanOrEqual(44);
  }
  await page.locator("[data-rep3d-rue-add]").click();
  await expect(page.locator("[data-rep3d-rue-note]")).toContainText("Photo ajoutée aux photos de référence (1/3)");
});
