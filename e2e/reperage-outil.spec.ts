import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

// « Repérer un lieu » is a tool of its own: it opens from the rail (or the 3D row on a phone)
// and the map builds. Everything stays local: tiles, relief and geocoder are simulated.
test.use({ launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] } });

const TILE = readFileSync("e2e/fixtures/reperage-tile.pbf");
const TERRAIN = readFileSync("e2e/fixtures/reperage-terrain.png");

async function offlineMap(page: Page) {
const cors = { "access-control-allow-origin": "*" };
await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, route => route.abort("blockedbyclient"));
await page.route("https://tiles.openfreemap.org/planet", route => route.fulfill({ json: { tiles: ["https://tiles.openfreemap.org/planet/fixture/{z}/{x}/{y}.pbf"], maxzoom: 14 }, headers: cors }));
await page.route("https://tiles.openfreemap.org/planet/fixture/**", route => route.fulfill({ body: TILE, contentType: "application/x-protobuf", headers: cors }));
await page.route("https://s3.amazonaws.com/elevation-tiles-prod/terrarium/**", route => route.fulfill({ body: TERRAIN, contentType: "image/png", headers: cors }));
await page.route("**/photon.komoot.io/api/**", route => route.fulfill({ json: { features: [{ geometry: { coordinates: [6.6326, 46.5206] }, properties: { name: "Place d'essai", city: "Lausanne", country: "Suisse" } }] }, headers: cors }));
await page.route("**/api.panoramax.xyz/api/**", route => route.fulfill({ json: { type: "FeatureCollection", features: [], instances: [] }, headers: cors }));
}

test("s'ouvre depuis le rail (ou la rangée 3D sur téléphone) et la carte se construit", async ({ page }) => {
  await offlineMap(page);
  await page.goto("/mon-studio");
  const rail = page.locator("[data-rail]");
  if (await rail.isVisible()) await rail.locator("[data-rail-reperage]").click();
  else {
    await page.goto("/studio#outils/tous");
    await page.locator("[data-outil-reperage]").click();
  }
  await expect(page).toHaveURL(/#outils\/reperage$/);
  const tool = page.locator("[data-reperage-tool]");
  await expect(tool.locator("h1")).toHaveText("Repérer un lieu");
  await expect(tool.locator("[data-reperage-decor]")).toContainText("≈ 4 crédits estimés");
  await expect(tool.locator("[data-rep3d-example-note]")).toContainText("faite hors Comfy");
  await expect(tool.locator("[data-reperage-kept]")).toHaveAttribute("data-reperage-kept", "0");
  await tool.locator("[data-rep3d-open]").click();
  const sheet = page.getByRole("dialog", { name: "Un vrai lieu en décor" });
  await expect(sheet).toBeVisible();
  const search = sheet.getByRole("searchbox", { name: "Une adresse, une place, une ville" });
  await search.fill("Place d'essai");
  await search.press("Enter");
  await expect(sheet).toHaveAttribute("data-rep3d-state", "ready", { timeout: 30_000 });
  await expect(page.locator("[data-rep3d-place]")).toContainText("Place d'essai");
  const canvas = page.locator("[data-rep3d-stage] canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box!.width).toBeGreaterThan(200);
  await expect(sheet).toHaveAttribute("data-rep3d-step", "2");
  // Keeping the view is free: it lands in Mes créations › Lieux and opens « Crée ton décor ».
  await page.locator("[data-rep3d-capture]").click();
  await expect(sheet).toHaveAttribute("data-rep3d-step", "3", { timeout: 20_000 });
  await expect(page.locator("[data-capture-done] img")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(tool.locator("[data-reperage-kept]")).toHaveAttribute("data-reperage-kept", "1");
});
