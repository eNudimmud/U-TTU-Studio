import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

// Repérage 3D : tout le réseau est simulé (tuiles synthétiques, relief plat, géocodeur), rien ne sort du poste.
test.use({ launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] } });

const TILE = readFileSync("e2e/fixtures/reperage-tile.pbf");
const TERRAIN = readFileSync("e2e/fixtures/reperage-terrain.png");
const JPG = readFileSync("public/og.jpg");

async function offline(page: Page) {
  const outside: string[] = [];
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, route => { outside.push(route.request().url()); return route.abort("blockedbyclient"); });
  await page.route("https://tiles.openfreemap.org/planet", route => route.fulfill({ json: { tiles: ["https://tiles.openfreemap.org/planet/fixture/{z}/{x}/{y}.pbf"], maxzoom: 14 }, headers: { "access-control-allow-origin": "*" } }));
  await page.route("https://tiles.openfreemap.org/planet/fixture/**", route => route.fulfill({ body: TILE, contentType: "application/x-protobuf", headers: { "access-control-allow-origin": "*" } }));
  await page.route("https://s3.amazonaws.com/elevation-tiles-prod/terrarium/**", route => route.fulfill({ body: TERRAIN, contentType: "image/png", headers: { "access-control-allow-origin": "*" } }));
  await page.route("https://wmts.geo.admin.ch/**", route => route.fulfill({ body: JPG, contentType: "image/jpeg", headers: { "access-control-allow-origin": "*" } }));
  await page.route("**/photon.komoot.io/api/**", route => route.fulfill({ json: { features: [{ geometry: { coordinates: [6.6326, 46.5206] }, properties: { name: "Place d'essai", city: "Lausanne", country: "Suisse" } }] }, headers: { "access-control-allow-origin": "*" } }));
  await page.route("**/api.panoramax.xyz/api/**", route => route.fulfill({ json: { type: "FeatureCollection", features: [], instances: [] }, headers: { "access-control-allow-origin": "*" } }));
  return outside;
}

async function openSheet(page: Page) {
  await page.goto("/studio");
  await page.getByRole("navigation").getByRole("button", { name: "DÉCOR" }).click();
  await page.locator("[data-rep3d-open]").click();
  const sheet = page.getByRole("dialog", { name: "Repérage 3D" });
  await expect(sheet).toBeVisible();
  return sheet;
}

test("repérage 3D : chercher, styler, capturer, retrouver le lieu en DÉCOR et en PRISE", async ({ page }) => {
  const outside = await offline(page);
  const sheet = await openSheet(page);
  await expect(sheet).toHaveAttribute("data-rep3d-state", "search");
  // Disabled settings say why.
  await expect(page.locator("#u-rep3d-why-set")).toBeVisible();
  const search = sheet.getByRole("searchbox", { name: "Lieu, adresse ou coordonnées" });
  await search.fill("Place d'essai");
  await search.press("Enter");
  await expect(sheet).toHaveAttribute("data-rep3d-state", "ready", { timeout: 20_000 });
  await expect(page.locator("[data-rep3d-place]")).toContainText("Place d'essai");
  await expect(page.locator("[data-rep3d-place]")).toContainText(/\d+ bâtiments/);
  const credit = page.locator("[data-rep3d-credit]");
  await expect(credit).toContainText("© contributeurs OpenStreetMap");
  await expect(credit).toContainText("OpenFreeMap");
  await expect(credit).toContainText("Terrain Tiles");
  await expect(credit).not.toContainText(/google/i);

  for (const look of ["carte", "volumes", "ombres", "trait"]) {
    await page.locator(`[data-look-pick=${look}]`).click();
    await expect(sheet).toHaveAttribute("data-look", look);
  }
  await page.locator("[data-look-pick=carte]").click();
  await expect(credit).toContainText("© swisstopo");
  await page.locator("[data-look-pick=trait]").click();
  await page.locator("[data-framing=contre]").click();
  await expect(sheet).toHaveAttribute("data-street", "1");
  await page.locator("[data-framing=moyen]").click();
  await expect(sheet).toHaveAttribute("data-street", "0");
  await page.locator("[data-sun=soir]").click();
  await expect(page.locator("[data-sun=soir]")).toHaveAttribute("aria-pressed", "true");

  await page.locator("[data-reglages] > summary").click();
  const fov = page.locator("#u-rep3d-fov");
  await expect(fov).toBeEnabled();
  await fov.fill("60");
  await expect(page.locator("[data-rep3d-view]")).toContainText("21 mm");
  await expect(page.locator("#u-rep3d-tone")).toBeDisabled();
  await expect(page.locator("#u-rep3d-tone-why")).toContainText("Trait + ombres");

  for (const sel of ["[data-look-pick=trait]", "[data-framing=large]", "[data-street-toggle]", "[data-sun=midi]", "[data-rep3d-capture]"]) {
    const box = await page.locator(sel).boundingBox();
    expect(box!.height, sel).toBeGreaterThanOrEqual(44);
  }

  await page.locator("[data-rep3d-capture]").click();
  const done = page.locator("[data-capture-done]");
  await expect(done).toBeVisible({ timeout: 20_000 });
  await expect(done.locator("img")).toHaveCount(3);
  await expect(page.locator("[data-rep3d-quote]")).toContainText("4");
  await page.locator("[data-rep3d-use]").click();
  await expect(sheet).toBeHidden();

  // The colour capture now sits in the décor photo slot; nothing ran.
  await expect(page.locator("[data-slot] img").first()).toBeVisible();
  const name = "Place d'essai · Trait";
  await page.getByRole("navigation").getByRole("button", { name: "PRISE" }).click();
  const where = page.locator("[data-ou-source=mes-decors]");
  await expect(where).toBeVisible();
  await expect(where.getByRole("button", { name })).toBeVisible();
  await expect(where.getByRole("button", { name }).locator("img")).toBeVisible();

  // Only the 2D map's style (outside this tool, blocked here) may try the network.
  expect(outside.filter(url => !url.startsWith("https://tiles.openfreemap.org/styles/"))).toEqual([]);
});

test("repérage 3D sans WebGL : un message clair, pas d'écran noir", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...args: unknown[]) {
      if (kind.includes("webgl")) return null;
      return (original as (...a: unknown[]) => unknown).call(this, kind, ...args);
    } as typeof original;
  });
  await offline(page);
  const sheet = await openSheet(page);
  await sheet.getByRole("button", { name: /Lausanne/ }).first().click();
  await expect(sheet).toHaveAttribute("data-rep3d-state", "nogl");
  await expect(page.locator("[data-rep3d-capture]")).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
});

test("repérage 3D : géocodeur limité, réponse calme et nouvel essai", async ({ page }) => {
  await offline(page);
  await page.route("**/photon.komoot.io/api/**", route => route.fulfill({ status: 429, body: "", headers: { "access-control-allow-origin": "*" } }));
  const sheet = await openSheet(page);
  const search = sheet.getByRole("searchbox", { name: "Lieu, adresse ou coordonnées" });
  await search.fill("Tokyo");
  await search.press("Enter");
  await expect(page.locator("[data-rep3d-search-note]")).toBeVisible();
  // Coordinates never reach the geocoder.
  await search.fill("40.758, -73.9855");
  await search.press("Enter");
  await expect(sheet).toHaveAttribute("data-rep3d-state", "ready", { timeout: 20_000 });
});
