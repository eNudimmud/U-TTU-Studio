import { test, expect } from "@playwright/test";
import { simulateComfy } from "./helpers/simulate-comfy";

// U*TTU free mode: no model, no credit, no external call. Found from the top bar at every size.
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1024, height: 600 },
  { width: 1280, height: 800 },
];

for (const viewport of VIEWPORTS) {
  test(`U*TTU guide local à ${viewport.width}×${viewport.height} : guide, FAQ et estimation sans dépense`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Viewports are set by the test");
    await page.setViewportSize(viewport);
    await simulateComfy(page);
    let paid = 0;
    await page.route(/\/api\/(prompt|agent|router|chat)/, route => { paid++; return route.abort(); });
    await page.goto("/studio");

    const button = page.locator("[data-top-uttu]");
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");

    const panel = page.locator("[data-assistant-panel]");
    await expect(panel).toBeVisible();
    await expect(panel.locator("#u-assistant-title")).toHaveText("U*TTU");
    await expect(panel.locator("[data-uttu-guide]")).toHaveAttribute("open", "");
    await expect(panel.locator("[data-uttu-step]")).toHaveCount(4);
    await expect(panel.locator("[data-uttu-pricing]")).toHaveAttribute("href", "https://www.comfy.org/cloud/pricing");
    await expect(panel.locator("[data-uttu-version]")).toBeVisible();

    const input = panel.locator("[data-uttu-input]");
    await input.fill("Combien coûtent 3 portraits + 2 prises LTX ?");
    await panel.locator("[data-uttu-send]").click();
    const reply = panel.locator("[data-uttu-log] [data-role=assistant]").last();
    await expect(reply.locator("[data-uttu-total]")).toContainText("crédits estimés");
    await expect(reply.locator("[data-uttu-total]")).toContainText("40–74");

    await input.fill("où coller ma clé ?");
    await input.press("Enter");
    await expect(panel.locator("[data-uttu-log] [data-role=assistant]").last().locator("[data-uttu-act=connect]")).toBeVisible();

    await input.fill("quelle est la recette des crêpes");
    await input.press("Enter");
    await expect(panel.locator("[data-uttu-log] [data-role=assistant]").last()).toContainText("agent Comfy");

    // The production plan below stays the same kernel.
    await expect(panel.locator("[data-assistant-input]")).toBeAttached();
    expect(paid).toBe(0);
  });
}

test("U*TTU parle allemand avec du, et le simulateur suit la langue", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop only");
  await page.context().addCookies([{ name: "u-ttu-locale", value: "de", url: "http://127.0.0.1:3000" }]);
  await page.addInitScript(() => window.localStorage.setItem("u-ttu-locale", "de"));
  await simulateComfy(page);
  await page.goto("/studio");
  await page.locator("[data-top-uttu]").click();
  const panel = page.locator("[data-assistant-panel]");
  await panel.locator("[data-uttu-input]").fill("Was kosten 3 Porträts + 2 LTX-Takes?");
  await panel.locator("[data-uttu-send]").click();
  await expect(panel.locator("[data-uttu-log] [data-role=assistant]").last().locator("[data-uttu-total]")).toContainText("Credits geschätzt");
});
