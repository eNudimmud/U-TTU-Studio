import { test, expect } from "@playwright/test";
import { simulateComfy } from "./helpers/simulate-comfy";

test("mobile agent proposes cutout without spending credits, preserving image and quote", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile-specific acceptance test");
  await simulateComfy(page);
  let prompts = 0;
  await page.route(/\/api\/prompt$/, route => { prompts++; return route.abort(); });
  await page.goto("/mon-studio?galerie=4&detail=1");
  const detail = page.locator(".u-asset-detail");
  await expect(detail.locator(":scope > img")).toBeVisible();
  await detail.getByRole("button", { name: /^U\*TTU · Ton assistant/ }).click();
  await detail.getByRole("textbox", { name: "Demande à U*TTU" }).fill("Détoure cette image");
  await detail.getByRole("button", { name: "Proposer" }).click();
  const prepare = detail.getByRole("link", { name: "Ouvrir l’outil et vérifier le devis" });
  await expect(prepare).toBeVisible();
  await prepare.click();
  await expect(page).toHaveURL(/\/studio#outils\/ret-detourer/);
  const panel = page.locator("[data-tool-panel=ret-detourer]");
  await expect(panel.locator("[data-outil-input=image] img")).toBeVisible();
  await expect(panel.locator("[data-tool-go]")).toContainText(/≈.*cr/);
  expect(prompts).toBe(0);
  await panel.locator("[data-tool-go]").click();
  await expect(panel.locator("[data-tool-ask]")).toBeVisible();
  expect(prompts).toBe(0);
});
