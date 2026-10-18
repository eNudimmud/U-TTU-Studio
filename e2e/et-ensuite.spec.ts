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

test("asset : menu 44 px, devis estimé sur le bouton, Détourer archive un nouvel asset", async ({ page }) => {
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
  // Open by default: the next step is visible without a click.
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const items = detail.locator("[data-suite-item]");
  await expect(items).toHaveCount(7);
  for (const item of await items.all()) expect((await item.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await expect(detail.locator("[data-suite-item=suite-detourer]")).toContainText("estimé");

  await detail.locator("[data-suite-item=suite-detourer]").click();
  const panel = detail.locator("[data-suite-panel=suite-detourer]");
  await expect(panel.locator("[data-suite-quote=estime]")).toHaveText("≈ 2 cr. estimé");
  await expect(panel.locator("[data-suite-confirm]")).toContainText("réserve de 4 cr.");
  const go = panel.locator("[data-suite-go]");
  await expect(go).toContainText("≈ 2 cr.");
  await expect(go).toBeDisabled();
  await expect(panel.locator(".u-why")).toHaveText("Coche la confirmation pour lancer.");
  await expect(panel.locator("[data-etape-courante]")).toHaveAttribute("data-etape-courante", "confirmer");
  await panel.locator("[data-suite-confirm]").click();
  await expect(go).toBeEnabled();
  await go.click();
  await expect(panel.locator("[data-suite-done]")).toBeVisible({ timeout: 60_000 });
  await expect(panel.locator("[data-suite-done] img")).toBeVisible();
  await expect(panel.locator("[data-etape-courante]")).toHaveAttribute("data-etape-courante", "fini");
  expect(types(seen.graphs.at(-1))).toEqual(expect.arrayContaining(["RemoveBackground", "JoinImageWithAlpha", "SaveImage"]));
  expect(seen.cancels()).toBe(0);
  await expect(original).toHaveAttribute("src", before ?? "");
});

test("asset : un rendu raté laisse l'original intact", async ({ page }) => {
  await simulateComfy(page);
  const seen = await watch(page);
  await page.route(/\/api\/job\/([^/]+)\/status$/, route => route.fulfill({ json: { status: "failed" } }));
  await page.route(/\/api\/jobs\/([^/?]+)$/, route => route.fulfill({ json: { status: "failed", execution_error: { exception_message: "simulé" } } }));
  await page.goto("/mon-studio?galerie=4&detail=1&suite=suite-modifier");
  const detail = page.locator(".u-asset-detail");
  const original = detail.locator(":scope > img");
  const before = await original.getAttribute("src");
  const panel = detail.locator("[data-suite-panel=suite-modifier]");
  await expect(panel).toBeVisible();
  await panel.locator("textarea").fill("Une écharpe rouge.");
  await panel.locator("[data-suite-confirm]").click();
  await panel.locator("[data-suite-go]").click();
  await expect(panel.locator("[data-suite-fail]")).toContainText("L’original reste intact.", { timeout: 60_000 });
  await expect(panel.locator("[data-etape=controler]")).toHaveAttribute("data-etat", "echec");
  await expect(original).toHaveAttribute("src", before ?? "");
  expect(types(seen.graphs.at(-1))).toEqual(expect.arrayContaining(["ReferenceMultiLatent", "SaveImage"]));
  expect(seen.cancels()).toBe(0);
});

test("prise importée : Finaliser poids ouverts, fluidifier en option, devis par tranche de 5 s", async ({ page }) => {
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
  await detail.locator("[data-suite-item=suite-finaliser-video]").click();
  const panel = detail.locator("[data-suite-panel=suite-finaliser-video]");
  await expect(panel.locator("[data-suite-quote=estime]")).toHaveText("≈ 8 cr. estimé");
  await expect(panel.locator("[data-suite-confirm]")).toContainText("réserve de 16 cr.");
  await panel.locator("[data-suite-fluide]").click();
  await expect(panel.locator("[data-suite-quote=estime]")).toHaveText("≈ 10 cr. estimé");
  await expect(panel.locator("[data-suite-confirm]")).toContainText("réserve de 20 cr.");
  await panel.locator("[data-suite-confirm]").click();
  await panel.locator("[data-suite-go]").click();
  await expect(panel.locator("[data-suite-done] video")).toBeVisible({ timeout: 60_000 });
  const sent = types(seen.graphs.at(-1));
  expect(sent).toEqual(expect.arrayContaining(["SeedVR2Conditioning", "FrameInterpolate", "SaveVideo"]));
  expect(sent).not.toContain("RTXVideoSuperResolution");
  expect(seen.cancels()).toBe(0);
});

test("MONTAGE : avec Poids ouverts seulement, Finaliser passe par SeedVR2 au lieu d'être bloqué", async ({ page }) => {
  await simulateComfy(page);
  const seen = await watch(page);
  await page.addInitScript(() => localStorage.setItem("u-ttu-moteurs", JSON.stringify({ openWeightsOnly: true, nanoBanana: false, engine: "ltx", engineManual: false })));
  await page.goto("/studio");
  await page.getByRole("navigation").getByRole("button", { name: "MONTAGE" }).click();
  await page.locator("[data-partir-exemple=montage]").click();
  const open = page.locator("[data-finaliser-open]");
  await expect(open).toBeEnabled();
  await open.click();
  const sheet = page.getByRole("dialog", { name: "Finaliser le montage" });
  await expect(sheet.locator("[data-final-open]")).toBeVisible();
  await expect(sheet.locator("[data-final-quote='estimation']")).toBeVisible();
  await expect(sheet.getByRole("button", { name: "4K" })).toHaveCount(0);
  await sheet.locator("[data-final-confirm]").click();
  await sheet.locator("[data-final-go]").click();
  await expect(sheet.locator("[data-final-stage]").or(sheet.locator("video"))).toBeVisible({ timeout: 90_000 });
  await expect.poll(() => seen.graphs.length, { timeout: 90_000 }).toBeGreaterThan(0);
  const sent = types(seen.graphs.at(-1));
  expect(sent).toContain("SeedVR2Conditioning");
  expect(sent).not.toContain("RTXVideoSuperResolution");
  expect(seen.cancels()).toBe(0);
});
