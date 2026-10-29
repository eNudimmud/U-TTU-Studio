import { expect, test, type Page } from "@playwright/test";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { simulateComfy } from "./helpers/simulate-comfy";
import { RELAY_LIMIT, heavyMp4, simulateRelay } from "./helpers/heavy-files";

// Direct send through a private Vercel Blob store, mocked end to end: the studio's three
// /envoi-direct routes and Vercel's Blob API. The token is a made-up one, never a real secret.
test.use({ hasTouch: true });
test.setTimeout(150_000);

const FAKE_TOKEN = "vercel_blob_rw_teststore123_" + "x".repeat(32);
const SCOPE = "e".repeat(24);
type Seen = { etat: number; jeton: number; put: { pathname: string; access: string }[]; comfy: { pathname: string; filename: string }[] };

async function simulateDirect(page: Page, direct: boolean) {
  const seen: Seen = { etat: 0, jeton: 0, put: [], comfy: [] };
  // Body sizes are read in the page: Playwright does not hand over large request bodies.
  await page.addInitScript(() => {
    const w = window as unknown as { __blobBytes: number[] };
    w.__blobBytes = [];
    const real = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.startsWith("https://vercel.com/api/blob") && init?.body instanceof Blob) w.__blobBytes.push(init.body.size);
      return real(input, init);
    };
  });
  await page.route(/\/envoi-direct\/etat$/, route => { seen.etat++; return route.fulfill({ json: direct ? { direct: true, scope: SCOPE } : { direct: false } }); });
  await page.route(/\/envoi-direct\/jeton$/, async route => {
    seen.jeton++;
    const body = route.request().postDataJSON() as { payload: { pathname: string } };
    expect(body.payload.pathname.startsWith(`envoi/${SCOPE}/`)).toBe(true);
    expect(route.request().headers()["x-api-key"]).toBeTruthy();
    const clientToken = await generateClientTokenFromReadWriteToken({ token: FAKE_TOKEN, pathname: body.payload.pathname, allowedContentTypes: ["image/*", "video/mp4", "video/quicktime", "video/webm"], maximumSizeInBytes: 200 * 1024 * 1024, validUntil: Date.now() + 600_000 });
    return route.fulfill({ json: { type: "blob.generate-client-token", clientToken } });
  });
  await page.route(/^https:\/\/vercel\.com\/api\/blob/, route => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "PUT, POST" } });
    const pathname = new URL(request.url()).searchParams.get("pathname") ?? "";
    seen.put.push({ pathname, access: request.headers()["x-vercel-blob-access"] ?? "" });
    const stored = pathname.replace(/(\.[a-z0-9]+)$/, "-Rnd42$1");
    return route.fulfill({ headers: { "access-control-allow-origin": "*" }, json: { url: `https://teststore123.private.blob.vercel-storage.com/${stored}`, downloadUrl: `https://teststore123.private.blob.vercel-storage.com/${stored}?download=1`, pathname: stored, contentType: "video/mp4", contentDisposition: "inline" } });
  });
  await page.route(/\/envoi-direct\/comfy$/, route => {
    const body = route.request().postDataJSON() as { pathname: string; filename: string };
    seen.comfy.push(body);
    return route.fulfill({ json: { name: body.filename, subfolder: "" } });
  });
  return seen;
}

async function openFinaliser(page: Page) {
  await page.goto("/studio#outils/vid-finaliser");
  const panel = page.locator('[data-tool-panel="vid-finaliser"]');
  await expect(panel).toBeVisible();
  return panel;
}

test("Finaliser · store connecté : une vidéo de 15 Mo part entière en Blob privé, puis Comfy, sans passer par le relais", async ({ page }, info) => {
  await simulateComfy(page);
  const relay = await simulateRelay(page);
  const seen = await simulateDirect(page, true);
  const prompts: unknown[] = [];
  await page.route(/\/api\/prompt$/, route => { prompts.push(route.request().postDataJSON()?.prompt); return route.fallback(); });
  const panel = await openFinaliser(page);
  await panel.locator("[data-outil-input=video] input[type=file]").setInputFiles(heavyMp4(info.outputPath("montage.mp4"), 15 * 1024 * 1024));
  await panel.locator("[data-tool-go]").tap();
  await panel.locator("[data-tool-confirm]").tap();
  await expect(panel.locator("[data-tool-done]")).toBeVisible({ timeout: 90_000 });
  expect(seen.jeton).toBe(1);
  expect(seen.put).toHaveLength(1);
  expect(await page.evaluate(() => (window as unknown as { __blobBytes: number[] }).__blobBytes)).toEqual([15 * 1024 * 1024]);
  expect(seen.put[0].access).toBe("private");
  const name = seen.put[0].pathname.split("/").pop()!;
  expect(seen.put[0].pathname).toMatch(new RegExp(`^envoi/${SCOPE}/[A-Za-z0-9._-]+\\.mp4$`));
  expect(seen.comfy).toEqual([{ pathname: `envoi/${SCOPE}/${name.replace(/\.mp4$/, "-Rnd42.mp4")}`, filename: name }]);
  expect(await relay.sent()).toHaveLength(0);
  expect(await relay.refused()).toBe(0);
  expect(JSON.stringify(prompts)).toContain(name);
});

test("Finaliser · sans token : repli silencieux, le refus clair d’aujourd’hui, rien envoyé à Blob", async ({ page }, info) => {
  await simulateComfy(page);
  const relay = await simulateRelay(page);
  const seen = await simulateDirect(page, false);
  const panel = await openFinaliser(page);
  await panel.locator("[data-outil-input=video] input[type=file]").setInputFiles(heavyMp4(info.outputPath("montage.mp4"), 15 * 1024 * 1024));
  await panel.locator("[data-tool-go]").tap();
  await panel.locator("[data-tool-confirm]").tap();
  await expect(panel.locator("[data-tool-fail]")).toContainText("Finaliser garde la qualité", { timeout: 30_000 });
  expect(seen.etat).toBe(1);
  expect(seen.jeton + seen.put.length + seen.comfy.length).toBe(0);
  expect(await relay.sent()).toHaveLength(0);
});

test("Outils · vidéo, store connecté : le clip réduit sous la limite reste sur le relais (Blob seulement au-delà)", async ({ page }, info) => {
  await simulateComfy(page);
  const relay = await simulateRelay(page);
  const seen = await simulateDirect(page, true);
  await page.goto("/studio#outils/vid-mouvement");
  const panel = page.locator('[data-tool-panel="vid-mouvement"]');
  await expect(panel).toBeVisible();
  await panel.locator("[data-outil-input=video] input[type=file]").setInputFiles(heavyMp4(info.outputPath("clip.mp4")));
  await panel.locator('[data-outil-sample="image"]').tap();
  await panel.locator("[data-tool-go]").tap();
  await panel.locator("[data-tool-confirm]").tap();
  await expect(panel.locator("[data-tool-done]")).toBeVisible({ timeout: 90_000 });
  for (const file of await relay.sent()) expect(file.bytes).toBeLessThan(RELAY_LIMIT);
  expect(seen.put).toHaveLength(0);
});
