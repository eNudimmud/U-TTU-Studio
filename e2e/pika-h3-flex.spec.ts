import { expect, test, type Page } from "@playwright/test";
import { simulateComfy } from "./helpers/simulate-comfy";

// Pika H3 Flex Ref2VA, third model of « Vidéo fidèle aux références » (MiniMax H3 stays the default).
// Comfy is simulated: nothing leaves, nothing is spent (0 crédits), nothing is cancelled.

type Graph = Record<string, { class_type: string; inputs: Record<string, unknown> }>;
const TURBO = "minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors";
const PIKA_LORA = "pika_h3_flex_ref2va_v1_bf16.safetensors";
const SIZES = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
] as const;

async function watch(page: Page) {
  const graphs: Graph[] = [];
  let cancels = 0;
  await page.route(/\/api\/prompt$/, route => { graphs.push(route.request().postDataJSON()?.prompt ?? {}); return route.fallback(); });
  await page.route(/\/api\/(queue|interrupt)$/, route => { cancels += 1; return route.fulfill({ json: {} }); });
  return { graphs, cancels: () => cancels };
}

async function pickPika(page: Page) {
  await page.goto("/studio#outils/vid-h3-refs");
  const panel = page.locator("[data-tool-panel=vid-h3-refs]");
  await expect(panel.locator("[data-model-current]")).toHaveText("Fidèle, économique");
  await panel.locator("[data-model-menu] > button").click();
  const choice = panel.locator("[data-model=vid-pika]");
  await expect(choice).toHaveText("Visage et lieu fidèles, son inclus (Pika · MiniMax H3)");
  expect((await choice.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await choice.click();
  await expect(panel).toHaveAttribute("data-tool-model", "vid-pika");
  return panel;
}

test("Pika dans « Changer de modèle » : nom simple, MiniMax H3 affiché, deux cases nommées, ≈ 8 crédits estimés", async ({ page }) => {
  const panel = await pickPika(page);
  await expect(page).toHaveURL(/#outils\/vid-pika$/);
  await expect(panel.locator("[data-model-current]")).toHaveText("Visage et lieu fidèles, son inclus (Pika · MiniMax H3)");
  await expect(panel.locator("[data-model-attribution]")).toHaveText("Pika H3 Flex, construit sur MiniMax H3");
  await expect(panel.locator("[data-outil-input=image] .u-label")).toHaveText("Personnage");
  await expect(panel.locator("[data-outil-input=image2] .u-label")).toHaveText("Lieu");
  await expect(panel.locator("[data-tool-step=consigne] textarea")).toBeVisible();
  await expect(panel.locator("[data-tool-go]")).toContainText("≈ 8 crédits estimés");
  await expect(panel).not.toContainText(/gratuit/i);
  // H3 and FastH3 are still offered.
  await panel.locator("[data-model-menu] > button").click();
  await expect(panel.locator("[data-model=vid-h3-refs]")).toBeVisible();
  await expect(panel.locator("[data-model=vid-fasth3]")).toBeVisible();
});

test("choisir Pika envoie le graphe Pika avec les deux références, sans LoRA turbo (Comfy simulé, 0 crédit)", async ({ page }) => {
  await simulateComfy(page);
  const seen = await watch(page);
  const panel = await pickPika(page);
  await panel.locator("[data-outil-sample=image]").click();
  await panel.locator("[data-outil-sample=image2]").click();
  await expect(panel.locator("[data-outil-input=image] img")).toBeVisible();
  await expect(panel.locator("[data-outil-input=image2] img")).toBeVisible();
  await panel.locator("[data-tool-step=consigne] textarea").fill("Uttu marche lentement le long du quai, la brume se lève.");
  await panel.locator("[data-tool-go]").click();
  await expect(panel.locator("[data-tool-ask]")).toBeVisible();
  await panel.locator("[data-tool-confirm]").click();
  await expect(panel.locator("[data-tool-done]")).toBeVisible({ timeout: 60_000 });
  expect(seen.graphs).toHaveLength(1);
  const graph = seen.graphs[0];
  expect(graph["145"].class_type).toBe("LoraLoaderModelOnly");
  expect(graph["145"].inputs.lora_name).toBe(PIKA_LORA);
  expect(graph["147"].class_type).toBe("ManualSigmas");
  expect(graph["123"].inputs.sampler_name).toBe("lcm");
  expect(graph["149"].inputs.image).toMatch(/^entree-\d+\.webp$/);
  expect(graph["150"].inputs.image).toMatch(/^entree-\d+\.webp$/);
  expect(graph["149"].inputs.image).not.toBe(graph["150"].inputs.image);
  expect(graph["136"].inputs["ref_images.ref_image_0"]).toEqual(["149", 0]);
  expect(graph["136"].inputs["ref_images.ref_image_1"]).toEqual(["150", 0]);
  expect(graph["115"].inputs.megapixels).toBe(0.4);
  expect(String(graph["138"].inputs.value)).toContain("<Subject 2> is the setting in <Picture 2>.");
  expect(String(graph["138"].inputs.value)).toContain("Uttu marche lentement");
  expect(JSON.stringify(graph)).not.toContain(TURBO);
  expect(Object.values(graph).filter(node => /^Lora/.test(node.class_type))).toHaveLength(1);
  expect(seen.cancels()).toBe(0);
});

test("Comfy refuse un poids de Pika : rien ne part, Pika quitte le menu, la carte revient à H3", async ({ page }) => {
  await simulateComfy(page);
  await page.route(/\/api\/prompt$/, route => route.fulfill({ status: 400, json: { error: { message: "Prompt outputs failed validation" }, node_errors: { "145": { class_type: "LoraLoaderModelOnly", errors: [{ message: "Value not in list", details: `lora_name: '${PIKA_LORA}' not in []` }] } } } }));
  const panel = await pickPika(page);
  await panel.locator("[data-outil-sample=image]").click();
  await panel.locator("[data-outil-sample=image2]").click();
  await panel.locator("[data-tool-step=consigne] textarea").fill("Uttu sur le quai.");
  await panel.locator("[data-tool-go]").click();
  await panel.locator("[data-tool-confirm]").click();
  await expect(panel.locator("[data-tool-fail]")).toContainText("Ce modèle n’est pas disponible aujourd’hui");
  await expect(panel).toHaveAttribute("data-tool-model", "vid-h3-refs");
  await expect(panel.locator("[data-model-current]")).toHaveText("Fidèle, économique");
  await panel.locator("[data-model-menu] > button").click();
  await expect(panel.locator("[data-model=vid-pika]")).toHaveCount(0);
  await expect(panel.locator("[data-model=vid-fasth3]")).toBeVisible();
});

for (const size of SIZES) {
  test(`Pika à ${size.width}×${size.height} : rien ne déborde, cibles d’au moins 44 px`, async ({ page }) => {
    await page.setViewportSize(size);
    const panel = await pickPika(page);
    await expect(panel.locator("[data-model-attribution]")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const targets = [
      panel.locator("[data-model-menu] > button"),
      panel.locator("[data-outil-sample=image]"),
      panel.locator("[data-outil-sample=image2]"),
      panel.locator("[data-outil-file=image]"),
      panel.locator("[data-outil-file=image2]"),
      panel.locator("[data-tool-go]"),
    ];
    for (const target of targets) {
      const box = (await target.boundingBox())!;
      expect(box.height, await target.evaluate(node => node.outerHTML.slice(0, 80))).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width + 0.5);
    }
  });
}
