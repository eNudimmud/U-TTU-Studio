import { expect, test, type Page } from "@playwright/test";
import { simulateComfy } from "./helpers/simulate-comfy";
import { RELAY_LIMIT, heavyJpeg, heavyMp4, heavyWav, simulateRelay } from "./helpers/heavy-files";

// 29.10: every user file goes to Comfy through the studio relay, and Vercel refuses a body
// above ~4 MB with 413. One test per family, each with a phone-weight file: it must arrive
// under the limit (prepared in the browser) or be refused with a clear line. Nothing is spent.
test.use({ hasTouch: true });
test.setTimeout(150_000);

type Graph = Record<string, { class_type: string; inputs: Record<string, unknown> }>;
async function graphs(page: Page) {
  const seen: Graph[] = [];
  await page.route(/\/api\/prompt$/, route => { seen.push(route.request().postDataJSON()?.prompt ?? {}); return route.fallback(); });
  return seen;
}
async function openTool(page: Page, id: string) {
  await page.goto(`/studio#outils/${id}`);
  const panel = page.locator(`[data-tool-panel="${id}"]`);
  await expect(panel).toBeVisible();
  return panel;
}

test("Outils · image : une photo de 9 Mo part en jpg sous la limite et l’outil aboutit", async ({ page }, info) => {
  await simulateComfy(page);
  const relay = await simulateRelay(page);
  const seen = await graphs(page);
  const panel = await openTool(page, "ret-detourer");
  await panel.locator("[data-outil-input=image] input[type=file]").setInputFiles(heavyJpeg(info.outputPath("photo.jpg")));
  await panel.locator("[data-tool-go]").tap();
  await panel.locator("[data-tool-confirm]").tap();
  await expect(panel.locator("[data-tool-done]")).toBeVisible({ timeout: 60_000 });
  const sent = await relay.sent();
  expect(sent).toHaveLength(1);
  expect(sent[0].type).toBe("image/jpeg");
  expect(sent[0].bytes).toBeLessThan(RELAY_LIMIT);
  expect(await relay.refused()).toBe(0);
  expect(seen).toHaveLength(1);
});

test("Outils · vidéo (Copier un mouvement) : un clip de téléphone de 25 Mo part sous la limite", async ({ page }, info) => {
  await simulateComfy(page);
  const relay = await simulateRelay(page);
  const seen = await graphs(page);
  const panel = await openTool(page, "vid-mouvement");
  await panel.locator('[data-outil-input="video"] input[type=file]').setInputFiles(heavyMp4(info.outputPath("clip.mp4")));
  await panel.locator('[data-outil-sample="image"]').tap();
  await panel.locator("[data-tool-go]").tap();
  await panel.locator("[data-tool-confirm]").tap();
  await expect(panel.locator("[data-tool-done]")).toBeVisible({ timeout: 90_000 });
  const video = (await relay.sent()).find(item => item.type.startsWith("video/"));
  expect(video?.type).toBe("video/mp4");
  expect(video!.bytes).toBeLessThan(RELAY_LIMIT);
  expect(await relay.refused()).toBe(0);
  expect(seen).toHaveLength(1);
});

test("Outils · audio : un mémo vocal wav de 40 Mo part compressé sous la limite", async ({ page }, info) => {
  await simulateComfy(page);
  const relay = await simulateRelay(page);
  const seen = await graphs(page);
  const panel = await openTool(page, "son-voix-ouverte");
  await panel.locator("[data-outil-input=audio] input[type=file]").setInputFiles(heavyWav(info.outputPath("voix.wav")));
  await panel.locator("textarea").first().fill("Bonjour, ceci est un essai de voix.");
  await panel.locator("[data-tool-consent]").tap();
  await panel.locator("[data-tool-go]").tap();
  await panel.locator("[data-tool-confirm]").tap();
  await expect.poll(() => seen.length, { timeout: 90_000 }).toBe(1);
  const audio = (await relay.sent()).find(item => item.type.startsWith("audio/"));
  expect(audio?.type).toBe("audio/mp4");
  expect(audio!.bytes).toBeLessThan(RELAY_LIMIT);
  expect(await relay.refused()).toBe(0);
});

test("Suite · Fluidifier : un clip de 25 Mo part sous la limite, à sa cadence d’origine", async ({ page }, info) => {
  await simulateComfy(page);
  const relay = await simulateRelay(page);
  const seen = await graphs(page);
  const panel = await openTool(page, "vid-fluidifier");
  await panel.locator("[data-outil-input=video] input[type=file]").setInputFiles(heavyMp4(info.outputPath("clip.mp4")));
  await panel.locator("[data-tool-go]").tap();
  await panel.locator("[data-tool-confirm]").tap();
  await expect.poll(() => seen.length, { timeout: 90_000 }).toBe(1);
  const video = (await relay.sent()).find(item => item.type.startsWith("video/"));
  expect(video!.bytes).toBeLessThan(RELAY_LIMIT);
  expect(await relay.refused()).toBe(0);
});

test("Finaliser : une vidéo de 25 Mo n’est jamais dégradée, elle est refusée avec une phrase claire, rien n’est lancé", async ({ page }, info) => {
  await simulateComfy(page);
  const relay = await simulateRelay(page);
  const seen = await graphs(page);
  const panel = await openTool(page, "vid-finaliser");
  await panel.locator("[data-outil-input=video] input[type=file]").setInputFiles(heavyMp4(info.outputPath("clip.mp4")));
  await panel.locator("[data-tool-go]").tap();
  await panel.locator("[data-tool-confirm]").tap();
  await expect(panel.locator("[data-tool-fail]")).toContainText("Finaliser garde la qualité", { timeout: 30_000 });
  expect(await relay.sent()).toHaveLength(0);
  expect(await relay.refused()).toBe(0);
  expect(seen).toHaveLength(0);
});

test("CAST, DÉCOR puis PRISE : deux photos de téléphone de 9 Mo partent sous la limite et la prise arrive", async ({ page }, info) => {
  await simulateComfy(page);
  const relay = await simulateRelay(page);
  const nav = (name: string) => page.getByRole("navigation").getByRole("button", { name, exact: false });
  await page.goto("/studio#personnage");
  await page.getByLabel("Importer un personnage", { exact: true }).setInputFiles(heavyJpeg(info.outputPath("lea.jpg")));
  await expect(nav("CAST")).toContainText("Prêt");
  await nav("DÉCOR").tap();
  await page.getByLabel("Importer un décor", { exact: true }).setInputFiles(heavyJpeg(info.outputPath("labo.jpg"), 11_000_000));
  await expect(nav("DÉCOR")).toContainText("Prêt");
  await nav("PRISE").tap();
  await expect(page.locator('[data-prise-ready="true"]')).toBeVisible();
  await page.getByRole("textbox", { name: "Ce qui se passe", exact: true }).fill("Léa ouvre la porte du laboratoire");
  await page.locator(".u-prise-actions .u-primary").tap();
  await page.locator("[data-confirm-gold]").tap();
  await expect(page.locator("[data-take-view] video")).toBeVisible({ timeout: 90_000 });
  const sent = await relay.sent();
  expect(sent.length).toBeGreaterThan(0);
  for (const file of sent) expect(file.bytes).toBeLessThan(RELAY_LIMIT);
  expect(await relay.refused()).toBe(0);
});

test("Bulle · références (#158) : une référence de 9 Mo part sous la limite et l’image arrive", async ({ page }, info) => {
  await simulateComfy(page);
  const relay = await simulateRelay(page);
  const seen = await graphs(page);
  await page.goto("/studio");
  await page.locator("[data-barre-plus]").tap();
  await page.locator("[data-barre-attach=reference]").tap();
  await page.locator("[data-refs-new]").tap();
  await page.locator("[data-ref-name]").fill("Léa");
  await page.locator("[data-ref-category]").selectOption("cast");
  await page.locator("[data-ref-photos]").setInputFiles(heavyJpeg(info.outputPath("lea.jpg")));
  await page.locator("[data-ref-save]").tap();
  await expect(page.locator("[data-ref-editor]")).toHaveCount(0);
  await page.locator("[data-ref]").filter({ hasText: "Léa" }).tap();
  await page.locator("[data-barre-input]").fill("Léa sur un quai, sous la pluie");
  await page.locator("[data-barre-send]").tap();
  await page.locator("[data-fil-confirm]").tap();
  await expect(page.locator("[data-bubble-render]")).toBeVisible();
  await page.locator("[data-bubble-return]").tap();
  await expect(page.locator("[data-fil-job=done]")).toHaveCount(1, { timeout: 60_000 });
  expect(seen).toHaveLength(1);
  const sent = await relay.sent();
  expect(sent.length).toBeGreaterThan(0);
  for (const file of sent) expect(file.bytes).toBeLessThan(RELAY_LIMIT);
  expect(await relay.refused()).toBe(0);
});
