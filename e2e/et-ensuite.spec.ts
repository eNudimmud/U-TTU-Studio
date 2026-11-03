import { test, expect, type Page } from "@playwright/test";
import { simulateComfy } from "./helpers/simulate-comfy";

// « Et ensuite ? » : menu on an asset and on a take. Comfy is simulated: nothing leaves, nothing is spent.

type Graph = Record<string, { class_type: string; inputs: Record<string, unknown> }>;

async function watch(page: Page) {
  const graphs: Graph[] = [];
  let cancels = 0;
  await page.route(/\/api\/prompt$/, route => { graphs.push(route.request().postDataJSON()?.prompt ?? {}); return route.fallback(); });
  await page.route(/\/api\/(queue|interrupt)$/, route => { cancels += 1; return route.fulfill({ json: {} }); });
  return { graphs, cancels: () => cancels };
}

const types = (graph: Graph | undefined) => Object.values(graph ?? {}).map(node => node.class_type);

test("asset : menu 44 px, un coût, Détourer ouvre la page outil avec l’image", async ({ page }) => {
  await simulateComfy(page);
  const seen = await watch(page);
  await page.goto("/mon-studio?galerie=4&detail=1");
  const detail = page.locator(".u-asset-detail");
  const original = detail.locator(":scope > img");
  await expect(original).toBeVisible();
  const before = await original.getAttribute("src");
  const toggle = detail.locator("[data-suite-toggle]");
  await expect(toggle).toHaveText(/Et ensuite \?/);
  expect((await toggle.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const suite = detail.locator(".u-suite");
  await expect(suite).not.toContainText(/réserve|bientôt|graphe|nœud|open weights|poids ouverts/i);
  const items = detail.locator("[data-suite-item]");
  await expect(items).toHaveCount(7);
  for (const item of await items.all()) {
    expect((await item.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    // One cost per item, always said as an estimate.
    await expect(item).toContainText(/≈ [\d,]+ crédits? estimés?/);
    await expect(item).not.toContainText(/réserve/i);
  }
  const link = detail.locator("[data-suite-item=suite-detourer]");
  await expect(link).toHaveAttribute("href", /#outils\/ret-detourer/);
  await expect(link).toContainText("Détourer");
  await expect(link).toContainText("≈ 1 crédit");
  await link.click();
  await expect(page).toHaveURL(/\/studio#outils\/ret-detourer/);
  const panel = page.locator("[data-tool-panel=ret-detourer]");
  await expect(panel).toBeVisible();
  await expect(panel.locator("[data-outil-input=image] img")).toBeVisible();
  await expect(panel.locator("[data-tool-go]")).toContainText("≈ 1 crédit");
  await expect(panel).not.toContainText(/réserve|bientôt|graphe/i);
  expect(seen.graphs).toHaveLength(0);
  expect(seen.cancels()).toBe(0);
  await page.goto("/mon-studio?galerie=4&detail=1");
  await expect(page.locator(".u-asset-detail > img")).toHaveAttribute("src", before ?? "");
});

test("asset : Modifier ouvre la page outil, l’original n’est pas envoyé", async ({ page }) => {
  await simulateComfy(page);
  const seen = await watch(page);
  await page.goto("/mon-studio?galerie=4&detail=1&suite=suite-modifier");
  const link = page.locator(".u-asset-detail [data-suite-item=suite-modifier]");
  await expect(link).toHaveAttribute("aria-current", "true");
  await link.click();
  await expect(page).toHaveURL(/\/studio#outils\/ret-modifier/);
  const panel = page.locator("[data-tool-panel=ret-modifier]");
  await expect(panel.locator("[data-outil-input=image] img")).toBeVisible();
  await expect(panel.locator("textarea")).toBeVisible();
  await expect(panel).not.toContainText(/réserve|Coche la confirmation/i);
  expect(seen.graphs).toHaveLength(0);
});

test("prise importée : trois actions, chacune vers sa page, un coût", async ({ page }) => {
  await simulateComfy(page);
  const seen = await watch(page);
  await page.goto("/mon-studio");
  await page.locator(".u-assets-tools input[type=file]").setInputFiles("e2e/fixtures/prise-5s-vp9.mp4");
  const card = page.locator(".u-asset-grid .u-card-lg").filter({ has: page.locator("video") }).first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await card.locator(".u-pick").click();
  const detail = page.locator(".u-asset-detail");
  await expect(detail.locator("[data-suite-toggle]")).toHaveAttribute("aria-expanded", "true");
  await expect(detail.locator("[data-suite-item]")).toHaveCount(3);
  const finish = detail.locator("[data-suite-item=suite-finaliser-video]");
  await expect(finish).toHaveAttribute("href", /#outils\/vid-finaliser/);
  // 5 s at 24 fps, billed per frame of the 1080p result (31.10.2026 measures: 41–43).
  await expect(finish).toContainText("≈ 42 crédits");
  await expect(detail.locator("[data-suite-item=suite-fluidifier]")).toHaveAttribute("href", /#outils\/vid-fluidifier/);
  await expect(detail.locator(".u-suite")).not.toContainText(/réserve/i);
  await finish.click();
  await expect(page).toHaveURL(/\/studio#outils\/vid-finaliser/);
  const panel = page.locator("[data-tool-panel=vid-finaliser]");
  await expect(panel.locator("[data-outil-input=video] video")).toBeVisible({ timeout: 30_000 });
  await expect(panel.locator("[data-tool-go]")).toContainText("≈ 42 crédits");
  await expect(panel).not.toContainText(/réserve/i);
  expect(seen.graphs).toHaveLength(0);
});
