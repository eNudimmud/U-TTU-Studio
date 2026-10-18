import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

// Repérage 3D : tout le réseau est simulé (tuiles synthétiques, relief plat, géocodeur), rien ne sort du poste.
test.use({ launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] } });

const TILE = readFileSync("e2e/fixtures/reperage-tile.pbf");
const TERRAIN = readFileSync("e2e/fixtures/reperage-terrain.png");
const JPG = readFileSync("public/og.jpg");
// One real swissBUILDINGS3D tile of Lausanne (swisstopo, OGD, « © swisstopo »), 12 KB, Draco.
const SWISS = readFileSync("e2e/fixtures/swissbuildings-lausanne.b3dm");
const SWISS_ROOT = "https://3d.geo.admin.ch/ch.swisstopo.swissbuildings3d.3d/v1/";
const ALL_CH = [0.10, 0.79, 0.19, 0.84, 0, 5000];
const TILE_REGION = [0.115794, 0.811893, 0.115833, 0.811911, 473, 504];

async function offline(page: Page) {
  const outside: string[] = [];
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, route => { outside.push(route.request().url()); return route.abort("blockedbyclient"); });
  await page.route("https://tiles.openfreemap.org/planet", route => route.fulfill({ json: { tiles: ["https://tiles.openfreemap.org/planet/fixture/{z}/{x}/{y}.pbf"], maxzoom: 14 }, headers: { "access-control-allow-origin": "*" } }));
  await page.route("https://tiles.openfreemap.org/planet/fixture/**", route => route.fulfill({ body: TILE, contentType: "application/x-protobuf", headers: { "access-control-allow-origin": "*" } }));
  await page.route("https://s3.amazonaws.com/elevation-tiles-prod/terrarium/**", route => route.fulfill({ body: TERRAIN, contentType: "image/png", headers: { "access-control-allow-origin": "*" } }));
  await page.route("https://wmts.geo.admin.ch/**", route => route.fulfill({ body: JPG, contentType: "image/jpeg", headers: { "access-control-allow-origin": "*" } }));
  await page.route("**/photon.komoot.io/api/**", route => route.fulfill({ json: { features: [{ geometry: { coordinates: [6.6326, 46.5206] }, properties: { name: "Place d'essai", city: "Lausanne", country: "Suisse" } }] }, headers: { "access-control-allow-origin": "*" } }));
  await page.route("**/api.panoramax.xyz/api/**", route => route.fulfill({ json: { type: "FeatureCollection", features: [], instances: [] }, headers: { "access-control-allow-origin": "*" } }));
  const cors = { "access-control-allow-origin": "*" };
  await page.route(`${SWISS_ROOT}tileset.json`, route => route.fulfill({ json: { asset: { version: "1.0" }, root: { boundingVolume: { region: ALL_CH }, children: [{ boundingVolume: { region: ALL_CH }, content: { uri: "fixture/tileset.json" } }] } }, headers: cors }));
  await page.route(`${SWISS_ROOT}fixture/tileset.json`, route => route.fulfill({ json: { asset: { version: "1.0" }, root: { boundingVolume: { region: ALL_CH }, children: [{ boundingVolume: { region: TILE_REGION }, geometricError: 0, content: { uri: "11/305/723.b3dm" } }] } }, headers: cors }));
  await page.route(`${SWISS_ROOT}fixture/11/305/723.b3dm`, route => route.fulfill({ body: SWISS, contentType: "application/octet-stream", headers: cors }));
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
  // Lausanne is in Switzerland: real swissBUILDINGS3D roofs replace the OSM volumes nearby.
  await expect(sheet).toHaveAttribute("data-rep3d-roofs", "ready", { timeout: 20_000 });
  await expect(page.locator("[data-rep3d-roofs=ready]").last()).toContainText("swissBUILDINGS3D");
  await expect(credit).toContainText("swissBUILDINGS3D © swisstopo");

  // Camera buttons sit under the view, never over the 16:9 frame; 44 px each.
  const frameBox = await page.locator(".u-rep3d-frame").boundingBox();
  const stageBox = await page.locator("[data-rep3d-stage]").boundingBox();
  expect(frameBox && stageBox).toBeTruthy();
  for (const button of await page.locator("[data-rep3d-pad] button").all()) {
    const box = await button.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.y, "pad under the stage").toBeGreaterThanOrEqual(stageBox!.y + stageBox!.height);
  }

  // Two fingers: a twist only turns, a vertical drag only tilts.
  const view = page.locator("[data-rep3d-view]");
  const read = async () => {
    const text = await view.textContent() ?? "";
    const [, cap, tilt] = text.match(/Cap (-?\d+)° · inclinaison (-?\d+)°/) ?? [];
    return { cap: Number(cap), tilt: Number(tilt) };
  };
  const fingers = async (from: [number, number][], to: [number, number][]) => {
    await page.locator(".u-rep3d-canvas").evaluate((canvas, { from, to }) => {
      const box = canvas.getBoundingClientRect();
      const fire = (type: string, id: number, x: number, y: number) => canvas.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: "touch", isPrimary: id === 11, clientX: box.left + x, clientY: box.top + y, bubbles: true, cancelable: true }));
      // OrbitControls asks for pointer capture on these synthetic ids; that refusal is expected here.
      const original = canvas.setPointerCapture.bind(canvas);
      canvas.setPointerCapture = (id: number) => { try { original(id); } catch { /* synthetic pointer */ } };
      const release = canvas.releasePointerCapture.bind(canvas);
      canvas.releasePointerCapture = (id: number) => { try { release(id); } catch { /* synthetic pointer */ } };
      from.forEach(([x, y], i) => fire("pointerdown", 11 + i, x, y));
      for (let step = 1; step <= 10; step += 1) {
        to.forEach(([x, y], i) => fire("pointermove", 11 + i, from[i][0] + (x - from[i][0]) * step / 10, from[i][1] + (y - from[i][1]) * step / 10));
      }
      to.forEach(([x, y], i) => fire("pointerup", 11 + i, x, y));
    }, { from, to });
  };
  const box = await page.locator(".u-rep3d-canvas").boundingBox();
  const cx = box!.width / 2, cy = box!.height / 2;
  const before = await read();
  // Twist 30° around the middle.
  const r = 60, a = 30 * Math.PI / 180;
  await fingers([[cx - r, cy], [cx + r, cy]], [[cx - r * Math.cos(a), cy + r * Math.sin(a)], [cx + r * Math.cos(a), cy - r * Math.sin(a)]]);
  await expect.poll(async () => (await read()).cap).not.toBe(before.cap);
  const turned = await read();
  expect(Math.abs(turned.tilt - before.tilt)).toBeLessThanOrEqual(1);
  // Both fingers up: tilt only.
  await fingers([[cx - 50, cy + 40], [cx + 50, cy + 40]], [[cx - 50, cy - 30], [cx + 50, cy - 30]]);
  await expect.poll(async () => (await read()).tilt).not.toBe(turned.tilt);
  const tilted = await read();
  expect(Math.abs(((tilted.cap - turned.cap + 540) % 360) - 180)).toBeLessThanOrEqual(1);

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

  // One location tool in DÉCOR: no 2D map below, no ≈ 13-credit guide quote.
  await page.getByRole("navigation").getByRole("button", { name: "DÉCOR" }).click();
  await expect(page.locator("[data-repere-2d], .maplibregl-canvas, [data-creer-decor]")).toHaveCount(0);
  await expect(page.locator("[data-rep3d-entry]")).toHaveCount(1);
  expect(outside).toEqual([]);
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
