import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { simulateComfy } from "./helpers/simulate-comfy";
import { heavyJpeg, heavyMp4, heavyWav, simulateRelay } from "./helpers/heavy-files";

// Direct send through a private Vercel Blob store, mocked end to end: the studio's three
// /envoi-direct routes and Vercel's Blob API. The token is a made-up one, never a real secret.
test.use({ hasTouch: true });
test.setTimeout(150_000);

const FAKE_TOKEN = "vercel_blob_rw_teststore123_" + "x".repeat(32);
const SCOPE = "e".repeat(24);
type Seen = { etat: number; jeton: number; put: { pathname: string; access: string }[]; comfy: { pathname: string; filename: string; essai?: boolean }[] };

async function simulateDirect(page: Page, direct: boolean) {
  const seen: Seen = { etat: 0, jeton: 0, put: [], comfy: [] };
  // Body sizes are read in the page: Playwright does not hand over large request bodies.
  await page.addInitScript(() => {
    const w = window as unknown as { __blobBytes: number[]; __blobSha: Promise<string>[] };
    w.__blobBytes = []; w.__blobSha = [];
    const real = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.startsWith("https://vercel.com/api/blob") && init?.body instanceof Blob) {
        w.__blobBytes.push(init.body.size);
        w.__blobSha.push(init.body.arrayBuffer().then(buffer => crypto.subtle.digest("SHA-256", buffer)).then(digest => [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("")));
      }
      return real(input, init);
    };
  });
  await page.route(/\/envoi-direct\/etat$/, route => { seen.etat++; return route.fulfill({ json: direct ? { direct: true, store: true, scope: SCOPE } : { direct: false, store: false } }); });
  await page.route(/\/envoi-direct\/jeton$/, async route => {
    seen.jeton++;
    const body = route.request().postDataJSON() as { payload: { pathname: string } };
    expect(body.payload.pathname.startsWith(`envoi/${SCOPE}/`)).toBe(true);
    expect(route.request().headers()["x-api-key"]).toBeTruthy();
    const clientToken = await generateClientTokenFromReadWriteToken({ token: FAKE_TOKEN, pathname: body.payload.pathname, allowedContentTypes: ["image/*", "video/mp4", "video/quicktime", "video/webm", "audio/*"], maximumSizeInBytes: 200 * 1024 * 1024, validUntil: Date.now() + 600_000 });
    return route.fulfill({ json: { type: "blob.generate-client-token", clientToken } });
  });
  await page.route(/^https:\/\/vercel\.com\/api\/blob/, route => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "PUT, POST" } });
    const pathname = new URL(request.url()).searchParams.get("pathname") ?? "";
    seen.put.push({ pathname, access: request.headers()["x-vercel-blob-access"] ?? "" });
    const stored = pathname.replace(/(\.[a-z0-9]+)$/, "-Rnd42$1");
    return route.fulfill({ headers: { "access-control-allow-origin": "*" }, json: { url: `https://teststore123.private.blob.vercel-storage.com/${stored}`, downloadUrl: `https://teststore123.private.blob.vercel-storage.com/${stored}?download=1`, pathname: stored, contentType: request.headers()["x-content-type"] ?? "application/octet-stream", contentDisposition: "inline" } });
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
  expect(await received(page)).toEqual([sha(info.outputPath("montage.mp4"))]);
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

const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const received = (page: Page) => page.evaluate(() => Promise.all((window as unknown as { __blobSha: Promise<string>[] }).__blobSha));

// One heavy original per family (under 20 Mo, so the Blob client sends one PUT, which the mock answers).
const families: { tool: string; slot: string; file: (dir: (name: string) => string) => string; extra?: (panel: ReturnType<Page["locator"]>) => Promise<void>; type: string }[] = [
  { tool: "ret-detourer", slot: "image", file: dir => heavyJpeg(dir("photo.jpg")), type: "image/jpeg" },
  { tool: "ret-detourer", slot: "image", file: dir => heavyJpeg(dir("IMG_0042.heic"), 6_000_000), type: "image/heic" },
  { tool: "vid-fluidifier", slot: "video", file: dir => heavyMp4(dir("clip.mp4"), 15 * 1024 * 1024), type: "video/mp4" },
  { tool: "son-voix-ouverte", slot: "audio", file: dir => heavyWav(dir("voix.wav"), 100), type: "audio/wav", extra: async panel => { await panel.locator("textarea").first().fill("Bonjour, ceci est un essai de voix."); await panel.locator("[data-tool-consent]").tap(); } },
];

for (const family of families) {
  test(`Store connecté · ${family.tool} (${family.type}) : l’original part en Blob, octets identiques, rien par le relais`, async ({ page }, info) => {
    await simulateComfy(page);
    const relay = await simulateRelay(page);
    const seen = await simulateDirect(page, true);
    const prompts: string[] = [];
    await page.route(/\/api\/prompt$/, route => { prompts.push(JSON.stringify(route.request().postDataJSON()?.prompt ?? {})); return route.fallback(); });
    await page.goto(`/studio#outils/${family.tool}`);
    const panel = page.locator(`[data-tool-panel="${family.tool}"]`);
    await expect(panel).toBeVisible();
    const path = family.file(name => info.outputPath(name));
    await panel.locator(`[data-outil-input=${family.slot}] input[type=file]`).setInputFiles(path);
    await family.extra?.(panel);
    await panel.locator("[data-tool-go]").tap();
    await panel.locator("[data-tool-confirm]").tap();
    await expect.poll(() => prompts.length, { timeout: 90_000 }).toBe(1);
    expect(await received(page)).toEqual([sha(path)]);
    expect(seen.put[0].access).toBe("private");
    expect(await relay.sent()).toHaveLength(0);
    expect(prompts[0]).toContain(seen.comfy[0].filename);
  });
}

test("Store connecté · CAST puis DÉCOR : les photos de 9 et 11 Mo partent en original par Blob", async ({ page }, info) => {
  await simulateComfy(page);
  const relay = await simulateRelay(page);
  const seen = await simulateDirect(page, true);
  const nav = (name: string) => page.getByRole("navigation").getByRole("button", { name, exact: false });
  const lea = heavyJpeg(info.outputPath("lea.jpg"));
  const labo = heavyJpeg(info.outputPath("labo.jpg"), 11_000_000);
  await page.goto("/studio#personnage");
  await page.getByLabel("Importer un personnage", { exact: true }).setInputFiles(lea);
  await expect(nav("CAST")).toContainText("Prêt");
  await nav("DÉCOR").tap();
  await page.getByLabel("Importer un décor", { exact: true }).setInputFiles(labo);
  await expect(nav("DÉCOR")).toContainText("Prêt");
  await nav("PRISE").tap();
  await expect(page.locator('[data-prise-ready="true"]')).toBeVisible();
  await page.getByRole("textbox", { name: "Ce qui se passe", exact: true }).fill("Léa ouvre la porte du laboratoire");
  await page.locator(".u-prise-actions .u-primary").tap();
  await page.locator("[data-confirm-gold]").tap();
  await expect.poll(() => seen.comfy.length, { timeout: 90_000 }).toBeGreaterThanOrEqual(2);
  const hashes = await received(page);
  expect(hashes).toContain(sha(lea));
  expect(hashes).toContain(sha(labo));
  expect(await relay.sent()).toHaveLength(0);
});

test("Store connecté · Copier un mouvement : le clip est remis à 16 i/s (81 images) puis part par Blob, la photo en original", async ({ page }, info) => {
  await simulateComfy(page);
  const relay = await simulateRelay(page);
  const seen = await simulateDirect(page, true);
  await page.goto("/studio#outils/vid-mouvement");
  const panel = page.locator('[data-tool-panel="vid-mouvement"]');
  await expect(panel).toBeVisible();
  const clip = heavyMp4(info.outputPath("clip.mp4"), 15 * 1024 * 1024);
  await panel.locator('[data-outil-input="video"] input[type=file]').setInputFiles(clip);
  await panel.locator('[data-outil-sample="image"]').tap();
  await panel.locator("[data-tool-go]").tap();
  await panel.locator("[data-tool-confirm]").tap();
  await expect(panel.locator("[data-tool-done]")).toBeVisible({ timeout: 90_000 });
  expect(seen.put).toHaveLength(2);
  const hashes = await received(page);
  expect(hashes).not.toContain(sha(clip)); // re-timed, not the raw 30 i/s clip
  expect(seen.put.some(item => item.pathname.endsWith(".mp4"))).toBe(true);
  expect(await relay.sent()).toHaveLength(0);
});

test("Page d’essai : un fichier de 6 Mo atteint Blob puis est effacé, sans rendu", async ({ page }, info) => {
  const seen = await simulateDirect(page, true);
  await page.route(/\/envoi-direct\/comfy$/, route => {
    const body = route.request().postDataJSON() as { pathname: string; filename: string; essai?: boolean };
    seen.comfy.push(body);
    return route.fulfill({ json: { essai: true, received: true, bytes: 6 * 1024 * 1024, deleted: true } });
  });
  const prompts: string[] = [];
  await page.route(/cloud\.comfy\.org|\/api\/(prompt|upload)/, route => { prompts.push(route.request().url()); return route.abort(); });
  await page.addInitScript(() => localStorage.setItem("u-ttu-rendu", JSON.stringify({ mode: "key", key: "k".repeat(24) })));
  await page.goto("/envoi-direct/essai");
  await page.locator("[data-essai-file]").setInputFiles(heavyMp4(info.outputPath("essai.mp4"), 6 * 1024 * 1024));
  await expect(page.locator("[data-essai-line]")).toContainText("6.3 Mo", { timeout: 60_000 });
  await expect(page.locator("[data-essai-line]")).toContainText("Effacé du stockage : oui");
  expect(seen.put).toHaveLength(1);
  expect(seen.comfy[0].essai).toBe(true);
  expect(prompts).toHaveLength(0);
});
