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

test("les photos de rue s'affichent même si Overpass refuse", async ({ page }) => {
  const jpg = readFileSync("public/og.jpg");
  await page.route("**/overpass-api.de/**", route => route.abort("failed"));
  await page.route("**/api.panoramax.xyz/api/search**", route => route.fulfill({
    status: 200,
    headers: { "access-control-allow-origin": "*" },
    contentType: "application/json",
    body: JSON.stringify({ type: "FeatureCollection", features: [
      feature(ID, IMG, 2.34063, [{ rel: "next", href: `https://api.panoramax.xyz/api/collections/c/items/${NEXT}` }]),
      feature(NEXT, IMG2, 2.34070, [{ rel: "prev", href: `https://api.panoramax.xyz/api/collections/c/items/${ID}` }]),
    ] }),
  }));
  await page.route("**/panoramax.openstreetmap.fr/**", route => route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*" }, contentType: "image/jpeg", body: jpg }));

  await page.goto("/studio");
  await page.getByRole("navigation").getByRole("button", { name: "DÉCOR" }).click();
  const lieu = page.getByRole("textbox", { name: /où/i }).first();
  await lieu.fill("48.88805, 2.34063");
  await lieu.press("Enter");
  await expect(page.locator("[data-rue-vue]")).toBeVisible();
  await expect(page.getByText("Les photos n'ont pas pu être chargées")).toHaveCount(0);
  await expect(page.locator("[data-rue-credit]")).toContainText("Ada Rue");
});
